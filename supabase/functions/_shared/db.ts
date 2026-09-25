// Shared helper for Edge Functions (Deno).
// Verifies the caller JWT and exposes a service-role client.
// Service-role key lives ONLY in function env — never in the frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function caller(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return { user: null, error: "missing token" };
  const db = adminClient();
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return { user: null, error: "invalid token" };
  const { data: prof } = await db.from("profiles").select("id,role,is_active,forced_logout_at")
    .eq("id", data.user.id).maybeSingle();
  if (!prof || !prof.is_active) return { user: null, error: "inactive account" };
  // forced logout (logout-from-all-devices): any session signed in before
  // forced_logout_at is rejected on EVERY backend action.
  if (prof.forced_logout_at && data.user.last_sign_in_at &&
      new Date(prof.forced_logout_at) > new Date(data.user.last_sign_in_at)) {
    return { user: null, error: "session revoked by admin" };
  }
  return { user: { id: data.user.id, role: prof.role }, error: null };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });

export async function audit(db: ReturnType<typeof adminClient>, e: {
  actor_id: string | null; action: string; entity?: string; entity_id?: string;
  old_value?: unknown; new_value?: unknown; ip?: string; user_agent?: string;
}) {
  await db.from("audit_logs").insert({
    actor_id: e.actor_id, action: e.action, entity: e.entity || "",
    entity_id: e.entity_id || "", old_value: e.old_value ?? null,
    new_value: e.new_value ?? null, ip: e.ip || "", user_agent: e.user_agent || "",
  });
}

export const STAFF = ["super_admin", "admin", "teacher", "grader"];
export const ADMIN = ["super_admin", "admin"];
export const TEACH = ["super_admin", "admin", "teacher"];

// Real client network data from the edge (Supabase requirement §20: IP/device).
export function net(req: Request) {
  return {
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
    user_agent: req.headers.get("user-agent") || "",
  };
}
