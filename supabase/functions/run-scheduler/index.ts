// run-scheduler: invoked by Supabase Scheduled Functions (e.g. every minute).
// Requires header x-scheduler-secret == SCHEDULER_SECRET env (set in dashboard).
// Tasks (all on SERVER time):
//  1) exam state transitions (scheduled/published -> active -> expired)
//  2) auto-submit overdue in_progress attempts (finalize + grade + notify)
//  3) one-hour reminders for upcoming exams (once per exam)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, json, audit } from "../_shared/db.ts";

serve(async (req) => {
  const secret = Deno.env.get("SCHEDULER_SECRET") || "";
  if (!secret || req.headers.get("x-scheduler-secret") !== secret)
    return json({ error: "unauthorized" }, 401);

  const db = adminClient();
  const now = new Date();
  const iso = now.toISOString();
  const out: Record<string, number> = { activated: 0, expired: 0, autosubmitted: 0, reminders: 0 };

  // 1) transitions
  const { data: exams } = await db.from("exams").select("*").is("deleted_at", null)
    .in("status", ["scheduled", "published", "active"]);
  for (const e of exams || []) {
    let next: string | null = null;
    if (e.ends_at && new Date(e.ends_at) <= now &&
        ["scheduled", "published", "active"].includes(e.status)) next = "expired";
    else if ((!e.starts_at || new Date(e.starts_at) <= now) &&
             (!e.ends_at || new Date(e.ends_at) > now) &&
             ["scheduled", "published"].includes(e.status)) next = "active";
    if (next) {
      await db.from("exams").update({ status: next }).eq("id", e.id);
      await audit(db, { actor_id: null, action: "exam.auto_" + next,
        entity: "exams", entity_id: e.id });
      if (next === "active") out.activated++; else out.expired++;
    }
  }

  // 2) overdue attempts -> finalize as timed out
  const { data: over } = await db.from("attempts").select("*,exams!inner(*)")
    .eq("status", "in_progress").lte("server_deadline", iso).limit(50);
  for (const att of over || []) {
    const exam = (att as { exams: Record<string, unknown> }).exams;
    const snap = att.question_snapshot as {
      id: string; qtype: string; mark: number;
      options: { id: string; is_correct: boolean }[];
    }[];
    const { data: ansRows } = await db.from("answers").select("*").eq("attempt_id", att.id);
    const byQ: Record<string, unknown> = {};
    (ansRows || []).forEach((a: { question_id: string; answer_json: unknown }) => {
      byQ[a.question_id] = a.answer_json;
    });
    let auto = 0, correct = 0, wrong = 0, unanswered = 0;
    const manual: { question_id: string; max_mark: number }[] = [];
    for (const q of snap) {
      const a = byQ[q.id] as { option_id?: string; value?: string; option_ids?: string[] } | undefined;
      if (q.qtype === "written") {
        manual.push({ question_id: q.id, max_mark: Number(q.mark) });
        if (!a) unanswered++;
        continue;
      }
      if (!a) { unanswered++; continue; }
      let ok = false;
      if (q.qtype === "mcq" || q.qtype === "tf") {
        const right = q.options.find((o) => o.is_correct);
        ok = !!right && (a.option_id === right.id || a.value === right.id);
      } else if (q.qtype === "multi") {
        const rs = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
        const gs = new Set(a.option_ids || []);
        ok = rs.size > 0 && rs.size === gs.size && [...rs].every((x) => gs.has(x));
      }
      if (ok) { auto += Number(q.mark); correct++; } else wrong++;
    }
    const total = snap.reduce((s, q) => s + Number(q.mark), 0);
    const status = manual.length ? "grading" : "graded";
    await db.from("attempts").update({ status, submitted_at: iso, timed_out: true }).eq("id", att.id);
    for (const m of manual) {
      await db.from("manual_grading").upsert(
        { attempt_id: att.id, question_id: m.question_id, max_mark: m.max_mark },
        { onConflict: "attempt_id,question_id" });
    }
    const pub = (exam.show_result_immediately as boolean) && !manual.length;
    await db.from("results").upsert({
      attempt_id: att.id, auto_score: auto, manual_score: 0, final_score: auto,
      correct_count: correct, wrong_count: wrong, unanswered_count: unanswered,
      percentage: total ? Math.round((auto / total) * 10000) / 100 : 0,
      passed: auto >= Number(exam.pass_mark),
      published: pub, published_at: pub ? iso : null,
    }, { onConflict: "attempt_id" });
    await db.from("notifications").insert({
      user_id: att.student_id, type: "timeout",
      title: "انتهى وقت امتحان " + (exam.title as string),
      body: manual.length
        ? "تم تسليم إجاباتك تلقائيا لانتهاء الوقت. بعض الأسئلة بانتظار التصحيح اليدوي."
        : `تم التسليم تلقائيا. نتيجتك: ${auto} من ${total}.`,
      link: "#/student",
    });
    await audit(db, { actor_id: null, action: "attempt.auto_submit",
      entity: "attempts", entity_id: att.id, new_value: { auto_score: auto } });
    out.autosubmitted++;
  }

  // 3) reminders one hour ahead
  const inHour = new Date(now.getTime() + 3600000).toISOString();
  const { data: soon } = await db.from("exams").select("id,title")
    .is("deleted_at", null).in("status", ["scheduled", "published"])
    .gt("starts_at", iso).lte("starts_at", inHour);
  for (const e of soon || []) {
    const { data: sent } = await db.from("exam_reminders").select("exam_id").eq("exam_id", e.id).maybeSingle();
    if (sent) continue;
    const { data: studs } = await db.from("profiles").select("id")
      .eq("role", "student").eq("is_active", true).is("deleted_at", null);
    if (studs && studs.length) {
      await db.from("notifications").insert(
        studs.map((s: { id: string }) => ({
          user_id: s.id, type: "reminder",
          title: "تذكير: امتحان " + (e as { title: string }).title + " بعد ساعة",
          body: "سيبدأ الامتحان خلال ساعة. تأكد من جاهزية اتصالك.",
          link: "#/student",
        })));
    }
    await db.from("exam_reminders").insert({ exam_id: e.id });
    out.reminders++;
  }

  return json({ ok: true, ...out, at: iso });
});
