// complete-grading: finalize attempt when ALL written items are graded.
// final = auto + manual (server-computed). Publishes per exam settings
// and notifies the student. Idempotent.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit, TEACH } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);
  if (!TEACH.includes(user.role)) return json({ error: "teachers only" }, 403);

  const { attempt_id, publish } = await req.json();
  const db = adminClient();

  const { data: items } = await db.from("manual_grading").select("*").eq("attempt_id", attempt_id);
  const pending = (items || []).filter((i: { status: string }) => i.status !== "done");
  if (pending.length) return json({ error: "manual grading incomplete", pending: pending.length }, 409);

  const manual = (items || []).reduce((s: number, i: { awarded_mark: number | null }) =>
    s + Number(i.awarded_mark || 0), 0);
  const { data: res } = await db.from("results").select("*").eq("attempt_id", attempt_id).single();
  if (!res) return json({ error: "result missing" }, 500);
  if (res.published) return json({ already: true, result: res });

  const { data: att } = await db.from("attempts").select("exam_id,student_id").eq("id", attempt_id).single();
  const { data: exam } = await db.from("exams").select("title,total_mark,pass_mark").eq("id", att.exam_id).single();
  const final = Number(res.auto_score) + manual;
  const doPublish = publish !== false;

  const { data: updated } = await db.from("results").update({
    manual_score: manual, final_score: final,
    percentage: Math.round((final / Number(exam.total_mark)) * 10000) / 100,
    passed: final >= Number(exam.pass_mark),
    published: doPublish, published_at: doPublish ? new Date().toISOString() : null,
  }).eq("attempt_id", attempt_id).select().single();
  await db.from("attempts").update({ status: "graded" }).eq("id", attempt_id);

  if (doPublish) {
    await db.from("notifications").insert({
      user_id: att.student_id, type: "result",
      title: "تم الانتهاء من تصحيح امتحان " + exam.title,
      body: `النتيجة النهائية: ${final} من ${exam.total_mark}.`,
      link: "/results/" + updated.id,
    });
  }
  await audit(db, { actor_id: user.id, action: "grade.complete",
    entity: "attempts", entity_id: attempt_id,
    old_value: { final_score: res.final_score }, new_value: { final_score: final } });
  return json({ completed: true, final_score: final, published: doPublish });
});
