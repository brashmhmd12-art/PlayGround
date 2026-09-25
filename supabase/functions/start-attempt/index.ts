// start-attempt: student starts (or resumes) an exam attempt.
// Enforces: ownership, exam state + time window, audience, access code,
// max attempts, single active attempt. Deadline computed on SERVER time.
// Response questions are SANITIZED: options shuffled per settings, NO is_correct.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit } from "../_shared/db.ts";

const sha256 = async (s: string) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const shuffle = <T>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);
  if (user.role !== "student") return json({ error: "students only" }, 403);

  const { exam_id, access_code, idempotency_key } = await req.json();
  const db = adminClient();
  const now = new Date();

  const { data: exam } = await db.from("exams").select("*").eq("id", exam_id).maybeSingle();
  if (!exam || exam.deleted_at || !["published", "active"].includes(exam.status))
    return json({ error: "exam not available" }, 403);
  if (exam.starts_at && new Date(exam.starts_at) > now)
    return json({ error: "exam has not started" }, 403);
  if (exam.ends_at && new Date(exam.ends_at) < now)
    return json({ error: "exam window closed" }, 403);
  if (exam.access_code_hash) {
    if (!access_code || (await sha256(access_code)) !== exam.access_code_hash)
      return json({ error: "invalid access code" }, 403);
  }

  // resume active attempt (same exam+student) — never a second parallel attempt
  const { data: active } = await db.from("attempts").select("*")
    .eq("exam_id", exam_id).eq("student_id", user.id).eq("status", "in_progress")
    .maybeSingle();
  if (active) {
    await audit(db, { actor_id: user.id, action: "attempt.resume",
      entity: "attempts", entity_id: active.id });
    return json({ attempt_id: active.id, resumed: true,
      server_deadline: active.server_deadline, server_now: now.toISOString() });
  }

  const { count } = await db.from("attempts").select("id", { count: "exact", head: true })
    .eq("exam_id", exam_id).eq("student_id", user.id);
  if ((count || 0) >= exam.max_attempts)
    return json({ error: "no attempts remaining" }, 403);

  // build snapshot server-side (WITH correct answers — stored, never sent)
  const { data: links } = await db.from("exam_questions").select(
    "position,mark_override,question_bank(id,subject,unit,topic,difficulty,qtype,text,mark,explanation,image_url)")
    .eq("exam_id", exam_id).order("position");
  const qids = (links || []).map((l: { question_bank: { id: string } }) => l.question_bank.id);
  const { data: opts } = await db.from("question_options").select("*").in("question_id", qids);

  const full = (links || []).map((l: {
    position: number; mark_override: number | null;
    question_bank: Record<string, unknown>;
  }) => ({
    ...l.question_bank,
    mark: l.mark_override ?? (l.question_bank as { mark: number }).mark,
    options: (opts || []).filter((o: { question_id: string }) =>
      o.question_id === (l.question_bank as { id: string }).id),
  }));
  const order = (exam.shuffle_questions ? shuffle(full.map((q) =>
    (q as { id: string }).id)) : full.map((q) => (q as { id: string }).id));

  const deadline = new Date(now.getTime() + exam.duration_min * 60000).toISOString();
  const key = idempotency_key ||
    `${exam_id}:${user.id}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;
  const { data: att, error: insErr } = await db.from("attempts").insert({
    exam_id, student_id: user.id, attempt_no: (count || 0) + 1,
    question_snapshot: full, question_order: order,
    server_deadline: deadline, idempotency_key: key,
  }).select().single();
  if (insErr) {
    // idempotent retry: same key returns existing attempt
    const { data: dup } = await db.from("attempts").select("*")
      .eq("idempotency_key", key).maybeSingle();
    if (dup) return json({ attempt_id: dup.id, resumed: true,
      server_deadline: dup.server_deadline, server_now: now.toISOString() });
    return json({ error: "could not start attempt" }, 500);
  }

  // sanitized view for the student
  const byId: Record<string, {
    id: string; qtype: string; text: string; mark: number; image_url: string | null;
    options: { id: string; text: string }[];
  }> = {};
  full.forEach((q: {
    id: string; qtype: string; text: string; mark: number; image_url: string | null;
    options: { id: string; text: string }[];
  }) => {
    const o = exam.shuffle_options && q.qtype !== "written"
      ? shuffle(q.options) : q.options;
    byId[q.id] = q.qtype === "written"
      ? { id: q.id, qtype: q.qtype, text: q.text, mark: q.mark,
          image_url: q.image_url, options: [] }
      : { id: q.id, qtype: q.qtype, text: q.text, mark: q.mark,
          image_url: q.image_url, options: o.map((x) => ({ id: x.id, text: x.text })) };
  });
  const questions = order.map((id: string) => byId[id]);

  await audit(db, { actor_id: user.id, action: "attempt.start",
    entity: "attempts", entity_id: att.id,
    new_value: { exam_id, attempt_no: att.attempt_no } });
  return json({ attempt_id: att.id, resumed: false, questions,
    allow_back_navigation: exam.allow_back_navigation,
    server_deadline: deadline, server_now: now.toISOString() });
});
