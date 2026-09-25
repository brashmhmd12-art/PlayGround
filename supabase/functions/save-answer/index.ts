// save-answer: autosave one answer. Server enforces ownership, live status,
// server deadline, and newer-seq-wins (prevents stale overwrite after offline).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);

  const { attempt_id, question_id, answer, seq } = await req.json();
  const db = adminClient();

  const { data: att } = await db.from("attempts").select(
    "id,student_id,status,server_deadline").eq("id", attempt_id).maybeSingle();
  if (!att || att.student_id !== user.id)
    return json({ error: "not your attempt" }, 403);
  if (att.status !== "in_progress")
    return json({ error: "attempt is closed" }, 409);
  if (new Date(att.server_deadline) < new Date())
    return json({ error: "time expired", expired: true }, 409);

  const { data: cur } = await db.from("answers").select("seq").eq("attempt_id", attempt_id)
    .eq("question_id", question_id).maybeSingle();
  if (cur && (seq ?? 0) <= cur.seq) return json({ saved: false, stale: true });

  const { error: upErr } = await db.from("answers").upsert({
    attempt_id, question_id, answer_json: answer ?? {}, seq: seq ?? 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "attempt_id,question_id" });
  if (upErr) return json({ error: "save failed" }, 500);

  await db.from("attempts").update({ client_seq: seq ?? 0 }).eq("id", attempt_id);
  return json({ saved: true, server_now: new Date().toISOString() });
});
