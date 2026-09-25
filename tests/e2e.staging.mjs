// tests/e2e.staging.mjs — end-to-end security assertions against a STAGING project.
// Run: SUPABASE_URL=... ANON_KEY=... STU_EMAIL=... STU_PASS=... ADM_EMAIL=... ADM_PASS=... node tests/e2e.staging.mjs
// Uses ONLY test accounts on a staging project. Never run against production.
// Exits non-zero on first failure. No secrets are printed.
const U = process.env.SUPABASE_URL, K = process.env.ANON_KEY;
const SE = process.env.STU_EMAIL, SP = process.env.STU_PASS;
const AE = process.env.ADM_EMAIL, AP = process.env.ADM_PASS;
if (!U || !K || !SE || !SP || !AE || !AP) {
  console.error("missing env: SUPABASE_URL ANON_KEY STU_EMAIL STU_PASS ADM_EMAIL ADM_PASS");
  process.exit(2);
}
let pass = 0;
const ok = (n, c) => { if (!c) { console.error("FAIL: " + n); process.exit(1); } pass++; console.log("ok: " + n); };
const login = async (email, password) => {
  const r = await fetch(U + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: K, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error("login failed for " + email);
  return (await r.json()).access_token;
};
const rest = (tok, path) => fetch(U + "/rest/v1/" + path, {
  headers: { apikey: K, Authorization: "Bearer " + tok },
}).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));
const fn = (tok, name, body, idem) => {
  const h = { apikey: K, Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  if (idem) h["Idempotency-Key"] = idem;
  return fetch(U + "/functions/v1/" + name, { method: "POST", headers: h, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));
};

const stu = await login(SE, SP);
const adm = await login(AE, AP);

// E1: student sees zero question_options rows (correct answers never leak)
{
  const r = await rest(stu, "question_options?select=id&limit=1");
  ok("E1 student options hidden", r.s === 200 && Array.isArray(r.j) && r.j.length === 0);
}
// E2: student cannot call grade-item
{
  const r = await fn(stu, "grade-item", { grading_id: "00000000-0000-0000-0000-000000000000", awarded_mark: 10 });
  ok("E2 student grade-item denied", r.s === 401 || r.s === 403 || r.s === 404);
}
// E3: student cannot call publish-result
{
  const r = await fn(stu, "publish-result", { result_id: "00000000-0000-0000-0000-000000000000", published: true });
  ok("E3 student publish denied", r.s === 401 || r.s === 403 || r.s === 404);
}
// E4: student cannot force-logout anyone
{
  const r = await fn(stu, "admin-force-logout", { user_id: "00000000-0000-0000-0000-000000000000" });
  ok("E4 student force-logout denied", r.s === 401 || r.s === 403 || r.s === 400);
}
// E5: starting a nonexistent exam is denied (no info leak: 403 either way)
{
  const r = await fn(stu, "start-attempt", { exam_id: "00000000-0000-0000-0000-000000000000" });
  ok("E5 phantom exam denied", r.s === 403);
}
// E6: scheduler without secret is denied
{
  const r = await fetch(U + "/functions/v1/run-scheduler", { method: "POST", headers: { apikey: K } });
  ok("E6 scheduler locked", r.status === 401);
}
// E7: get-review on phantom result is denied
{
  const r = await fn(stu, "get-review", { result_id: "00000000-0000-0000-0000-000000000000" });
  ok("E7 phantom review denied", r.s === 403);
}
// E8: admin CAN read audit log (duty works)
{
  const r = await rest(adm, "audit_logs?select=id&limit=1");
  ok("E8 admin audit readable", r.s === 200 && Array.isArray(r.j));
}
// E9: student CANNOT read audit log
{
  const r = await rest(stu, "audit_logs?select=id&limit=1");
  ok("E9 student audit hidden", r.s === 200 && Array.isArray(r.j) && r.j.length === 0);
}
// E10: student CANNOT insert exams directly
{
  const r = await fetch(U + "/rest/v1/exams", {
    method: "POST", headers: { apikey: K, Authorization: "Bearer " + stu, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x", subject: "y", duration_min: 10 }),
  });
  ok("E10 student exam-create denied", r.status === 401 || r.status === 403);
}
console.log("ALL " + pass + " E2E STAGING TESTS PASSED");
