// get-review: returns per-question right/wrong comparison for a published
// result ONLY when the exam allows review (and after close if required).
// Correct content comes from the server snapshot — never stored client-side.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);

  const { result_id } = await req.json();
  const db = adminClient();

  const { data: res } = await db.from("results").select("*").eq("id", result_id).single();
  if (!res || !res.published) return json({ error: "not available" }, 403);
  const { data: att } = await db.from("attempts").select("*").eq("id", res.attempt_id).single();
  if (!att || (att.student_id !== user.id && !["super_admin", "admin", "teacher", "grader"].includes(user.role)))
    return json({ error: "forbidden" }, 403);
  const { data: exam } = await db.from("exams").select("*").eq("id", att.exam_id).single();
  if (!exam.allow_review) return json({ error: "review disabled" }, 403);
  if (exam.show_review_after_close && exam.ends_at && new Date(exam.ends_at) > new Date())
    return json({ error: "review opens after close" }, 403);

  const { data: ansRows } = await db.from("answers").select("*").eq("attempt_id", att.id);
  const ansByQ: Record<string, unknown> = {};
  (ansRows || []).forEach((a: { question_id: string; answer_json: unknown }) => {
    ansByQ[a.question_id] = a.answer_json;
  });
  const { data: grades } = await db.from("manual_grading").select("*").eq("attempt_id", att.id);
  const gByQ: Record<string, { awarded_mark: number | null; feedback: string }> = {};
  (grades || []).forEach((g: { question_id: string; awarded_mark: number | null; feedback: string }) => {
    gByQ[g.question_id] = { awarded_mark: g.awarded_mark, feedback: g.feedback };
  });

  const items = (att.question_snapshot as {
    id: string; qtype: string; text: string; mark: number;
    explanation: string; options: { id: string; text: string; is_correct: boolean }[];
  }[]).map((q) => {
    const a = ansByQ[q.id] as {
      option_id?: string; value?: string; option_ids?: string[];
    } | undefined;
    if (q.qtype === "written") {
      return { id: q.id, qtype: q.qtype, text: q.text, mark: q.mark,
        mine: (a as { text?: string } | undefined)?.text ?? null,
        awarded: gByQ[q.id]?.awarded_mark ?? null,
        feedback: gByQ[q.id]?.feedback ?? "", explanation: q.explanation };
    }
    const right = q.options.filter((o) => o.is_correct).map((o) => o.id);
    const mine = q.qtype === "multi" ? (a?.option_ids || []) : [a?.option_id ?? a?.value].filter(Boolean);
    const ok = right.length === mine.length && right.every((x) => (mine as string[]).includes(x));
    return { id: q.id, qtype: q.qtype, text: q.text, mark: q.mark, correct: ok,
      mine_text: (mine as string[]).map((id) => q.options.find((o) => o.id === id)?.text || ""),
      right_text: right.map((id) => q.options.find((o) => o.id === id)?.text || ""),
      explanation: q.explanation };
  });
  return json({ items, final_score: res.final_score, percentage: res.percentage, passed: res.passed });
});
