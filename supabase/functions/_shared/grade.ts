// Shared grading + rate limiting (single source of truth).
// Imported by submit-attempt and run-scheduler so the algorithm cannot drift.
export type SnapQ = {
  id: string; qtype: string; mark: number;
  options: { id: string; is_correct: boolean }[];
};
export type Given = {
  option_id?: string; value?: string; option_ids?: string[]; text?: string;
};

export function autoGrade(snap: SnapQ[], byQ: Record<string, Given>) {
  let auto = 0, correct = 0, wrong = 0, unanswered = 0;
  const manual: { question_id: string; max_mark: number }[] = [];
  for (const q of snap) {
    const a = byQ[q.id];
    if (q.qtype === "written") {
      manual.push({ question_id: q.id, max_mark: Number(q.mark) });
      if (!a || !(a.text || "").trim()) unanswered++;
      continue;
    }
    if (!a) { unanswered++; continue; }
    let ok = false;
    if (q.qtype === "mcq" || q.qtype === "tf") {
      const r = q.options.find((o) => o.is_correct);
      ok = !!r && (a.option_id === r.id || a.value === r.id);
    } else if (q.qtype === "multi") {
      const rs = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
      const gs = new Set(a.option_ids || []);
      // exact set match; partial credit is a documented future option
      ok = rs.size > 0 && rs.size === gs.size && [...rs].every((x) => gs.has(x));
    }
    if (ok) { auto += Number(q.mark); correct++; } else wrong++;
  }
  return { auto, correct, wrong, unanswered, manual };
}

// Fixed-window rate limiter backed by public.rate_limits (service role only).
// Returns true if allowed. Approximate under concurrency (documented).
export async function checkRate(db: any, key: string, limit: number, windowSec: number) {
  const now = Date.now();
  const ws = new Date(Math.floor(now / 1000 / windowSec) * windowSec * 1000).toISOString();
  const { data } = await db.from("rate_limits").select("*").eq("key", key).maybeSingle();
  if (!data || data.window_start !== ws) {
    await db.from("rate_limits").upsert({ key, window_start: ws, count: 1 }, { onConflict: "key" });
    return true;
  }
  if (data.count >= limit) return false;
  await db.from("rate_limits").update({ count: data.count + 1 }).eq("key", key);
  return true;
}
