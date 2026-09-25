// submit-attempt: finalize an attempt in ONE server transaction.
// Auto-grades mcq/tf/multi against the SNAPSHOT (immune to later edits).
// Written questions -> manual_grading queue. Result row created unpublished
// unless settings allow immediate display AND no manual grading is pending.
// Idempotent via Idempotency-Key header / idempotency_key body.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit } from "../_shared/db.ts";

type Q = {
  id: string; qtype: string; mark: number;
  options: { id: string; is_correct: boolean }[];
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);

  const body = await req.json();
  const { attempt_id } = body;
  const idem = req.headers.get("Idempotency-Key") || body.idempotency_key || null;
  const db = adminClient();
  const now = new Date();

  const { data: att } = await db.from("attempts").select("*").eq("id", attempt_id).maybeSingle();
  if (!att || att.student_id !== user.id)
    return json({ error: "not your attempt" }, 403);
  if (att.status !== "in_progress") {
    const { data: res } = await db.from("results").select("*")
      .eq("attempt_id", attempt_id).maybeSingle();
    return json({ already: true, result: res });
  }
  if (idem && idem !== att.idempotency_key)
    return json({ error: "idempotency mismatch" }, 409);

  const timedOut = new Date(att.server_deadline) < now;
  const { data: exam } = await db.from("exams").select("*").eq("id", att.exam_id).single();
  const snap = att.question_snapshot as Q[];
  const { data: ansRows } = await db.from("answers").select("*").eq("attempt_id", attempt_id);
  const ansByQ: Record<string, { answer_json: unknown }> = {};
  (ansRows || []).forEach((a: { question_id: string; answer_json: unknown }) => {
    ansByQ[a.question_id] = { answer_json: a.answer_json };
  });

  let auto = 0, correct = 0, wrong = 0, unanswered = 0;
  const manual: { question_id: string; max_mark: number }[] = [];

  for (const q of snap) {
    const a = ansByQ[q.id]?.answer_json as {
      option_id?: string; value?: string; option_ids?: string[];
    } | undefined;
    if (q.qtype === "written") {
      manual.push({ question_id: q.id, max_mark: Number(q.mark) });
      if (!a) unanswered++;
      continue;
    }
    if (!a) { unanswered++; continue; }
    let ok = false;
    if (q.qtype === "mcq") {
      const right = q.options.find((o) => o.is_correct);
      ok = !!right && a.option_id === right.id;
    } else if (q.qtype === "tf") {
      const right = q.options.find((o) => o.is_correct);
      ok = !!right && (a.value === right.id || a.option_id === right.id);
    } else if (q.qtype === "multi") {
      const rightSet = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
      const gotSet = new Set(a.option_ids || []);
      ok = rightSet.size > 0 && rightSet.size === gotSet.size &&
        [...rightSet].every((x) => gotSet.has(x)); // exact match; partial credit = future
    }
    if (ok) { auto += Number(q.mark); correct++; }
    else wrong++;
  }

  const status = manual.length ? "grading" : "graded";
  await db.from("attempts").update({
    status, submitted_at: now.toISOString(), timed_out,
  }).eq("id", attempt_id);

  for (const m of manual) {
    await db.from("manual_grading").upsert({
      attempt_id, question_id: m.question_id, max_mark: m.max_mark,
    }, { onConflict: "attempt_id,question_id" });
  }

  const total = snap.reduce((s, q) => s + Number(q.mark), 0);
  const percentage = total ? Math.round((auto / total) * 10000) / 100 : 0;
  const publishNow = exam.show_result_immediately && manual.length === 0;
  const { data: result } = await db.from("results").upsert({
    attempt_id, auto_score: auto, manual_score: 0, final_score: auto,
    correct_count: correct, wrong_count: wrong, unanswered_count: unanswered,
    percentage, passed: auto >= Number(exam.pass_mark),
    published: publishNow, published_at: publishNow ? now.toISOString() : null,
  }, { onConflict: "attempt_id" }).select().single();

  await db.from("notifications").insert({
    user_id: user.id, type: manual.length ? "grading_pending" : "result",
    title: manual.length ? "تم استلام الامتحان" : "نتيجة الامتحان: " + exam.title,
    body: manual.length
      ? "تم استلام إجابتك بنجاح. بعض الأسئلة تحتاج إلى تصحيح يدوي. سيصلك إشعار عند اعتماد النتيجة النهائية."
      : `نتيجتك: ${auto} من ${total}.`,
    link: "/results/" + result.id,
  });
  if (manual.length) {
    await db.from("notifications").insert({
      user_id: exam.created_by, type: "grading_needed",
      title: "تقديم جديد يحتاج تصحيحا",
      body: `امتحان ${exam.title} — ${manual.length} سؤال يحتاج تصحيحا يدويا.`,
      link: "/grading/" + attempt_id,
    });
  }
  await audit(db, { actor_id: user.id, action: timedOut ? "attempt.auto_submit" : "attempt.submit",
    entity: "attempts", entity_id: attempt_id,
    new_value: { auto_score: auto, status } });
  return json({ submitted: true, timed_out, needs_manual: manual.length > 0,
    auto_score: auto, total, result_id: result.id, published: publishNow });
});
