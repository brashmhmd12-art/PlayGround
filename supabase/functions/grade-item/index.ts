// grade-item: staff grades ONE written answer.
// Clamps to max_mark. Every change keeps old->new in grade_history + audit.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit, STAFF, net } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);
  if (!STAFF.includes(user.role)) return json({ error: "staff only" }, 403);
  const N = net(req);

  const { grading_id, awarded_mark, feedback } = await req.json();
  const db = adminClient();
  const { data: g } = await db.from("manual_grading").select("*").eq("id", grading_id).single();
  if (!g) return json({ error: "not found" }, 404);

  const mark = Math.max(0, Math.min(Number(g.max_mark), Number(awarded_mark)));
  if (Number.isNaN(mark)) return json({ error: "invalid mark" }, 400);

  if (g.awarded_mark !== null && g.awarded_mark !== undefined) {
    await db.from("grade_history").insert({
      grading_id, changed_by: user.id,
      old_mark: g.awarded_mark, new_mark: mark, reason: "manual correction update",
    });
  }
  await db.from("manual_grading").update({
    awarded_mark: mark, feedback: feedback || "", status: "done",
    grader_id: user.id, graded_at: new Date().toISOString(),
  }).eq("id", grading_id);

  await audit(db, { actor_id: user.id, action: "grade.item",
    entity: "manual_grading", entity_id: grading_id, ip: N.ip, user_agent: N.user_agent,
    old_value: { awarded_mark: g.awarded_mark }, new_value: { awarded_mark: mark } });
  return json({ saved: true, awarded_mark: mark });
});
