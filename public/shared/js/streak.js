// JustQuizMe study streaks — pure helpers over completed-run dates.
// streakModel(entries) → { current, best, lastDay } where entries are ISO
// date strings / Dates of completed runs (any kind). No DOM, no imports.

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDay(v) {
  const t = v instanceof Date ? v : new Date(typeof v === 'object' && v ? v.date ?? v.at ?? v.when : v);
  if (Number.isNaN(t.getTime())) return null;
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

// current: consecutive study days ending today, or ending yesterday when no
// run has landed today yet — the in-progress day is a grace window, not a gap.
// best: longest consecutive-day run in history. lastDay: most recent study day.
export function streakModel(entries, now = new Date()) {
  const days = new Set();
  for (const e of entries || []) {
    const d = parseDay(e);
    if (d) days.add(dayKey(d));
  }
  const sorted = [...days].sort();
  if (!sorted.length) return { current: 0, best: 0, lastDay: null };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const yestKey = dayKey(yest);
  const has = k => days.has(k);

  // anchor: today if studied, else yesterday; gap before that → streak dead
  let anchor = has(todayKey) ? new Date(today) : has(yestKey) ? new Date(yest) : null;
  let current = 0;
  if (anchor) {
    current = 1;
    const d = new Date(anchor);
    for (;;) {
      d.setDate(d.getDate() - 1);
      if (has(dayKey(d))) current += 1;
      else break;
    }
  }

  let best = 0, run = 0, prev = null;
  for (const k of sorted) {
    // calendar-day step, not a 24h diff — a DST shift makes a real day 23/25h
    const next = prev ? new Date(prev) : null;
    next?.setDate(next.getDate() + 1);
    run = next && dayKey(next) === k ? run + 1 : 1;
    if (run > best) best = run;
    const [y, m, dd] = k.split('-').map(Number);
    prev = new Date(y, m - 1, dd);
  }

  return { current, best, lastDay: sorted[sorted.length - 1] };
}

export function toStreakText(model) {
  const n = model?.current || 0;
  if (n <= 0) return '';
  return `${n}-day streak`;
}
