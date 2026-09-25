// publish-result: staff publishes / unpublishes a result.
// Manual grade edits use grade-item (history kept); this only flips visibility.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit, TEACH } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);
  if (!TEACH.includes(user.role)) return json({ error: "teachers only" }, 403);

  const { result_id, published } = await req.json();
  const db = adminClient();
  const { data: res } = await db.from("results").select("*,attempts!inner(exam_id,student_id)")
    .eq("id", result_id).single();
  if (!res) return json({ error: "not found" }, 404);

  const now = new Date().toISOString();
  await db.from("results").update({
    published: !!published, published_at: published ? now : null,
  }).eq("id", result_id);

  if (published) {
    const { data: exam } = await db.from("exams").select("title")
      .eq("id", (res as { attempts: { exam_id: string } }).attempts.exam_id).single();
    await db.from("notifications").insert({
      user_id: (res as unknown as { attempts: { student_id: string } }).attempts.student_id,
      type: "result", title: "تم نشر نتيجة امتحان " + (exam as { title: string }).title,
      body: "أصبحت نتيجتك متاحة الآن في صفحة النتائج.",
      link: "/results/" + result_id,
    });
  }
  await audit(db, { actor_id: user.id, action: published ? "result.publish" : "result.unpublish",
    entity: "results", entity_id: result_id });
  return json({ ok: true, published: !!published });
});
