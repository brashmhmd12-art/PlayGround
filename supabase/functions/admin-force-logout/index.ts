// admin-force-logout: staff revokes ALL sessions of a user effective immediately.
// Mechanism: sets profiles.forced_logout_at; the shared caller() rejects every
// backend action whose session started before it, and the app signs out on load.
// Honest note: already-issued JWTs stay technically valid until expiry (~1h),
// but they become useless: no API action and no app screen will accept them.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, caller, json, audit, ADMIN } from "../_shared/db.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { user, error } = await caller(req);
  if (!user) return json({ error }, 401);
  if (!ADMIN.includes(user.role)) return json({ error: "admins only" }, 403);

  const { user_id } = await req.json();
  if (!user_id || user_id === user.id)
    return json({ error: "invalid target" }, 400);
  const db = adminClient();
  const { data: t } = await db.from("profiles").select("id").eq("id", user_id).maybeSingle();
  if (!t) return json({ error: "not found" }, 404);

  await db.from("profiles").update({ forced_logout_at: new Date().toISOString() }).eq("id", user_id);
  await db.from("notifications").insert({ user_id, type: "security",
    title: "تم إنهاء جلساتك", body: "قامت الإدارة بإنهاء جميع جلسات الدخول. سجل الدخول مجددا." });
  await audit(db, { actor_id: user.id, action: "auth.force_logout",
    entity: "profiles", entity_id: user_id });
  return json({ ok: true });
});
