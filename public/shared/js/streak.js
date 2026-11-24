// Practice-streak math. Pure and DOM-free: given ISO attempt dates it returns
// the current/best day streaks and a 7-day activity strip. Shared between the
// launchpad widget (browser) and the node --test suite.

const DAY_MS = 86400000;

// Local calendar-day index: days roll over at local midnight.
const localDayIndex = (d) =>
  Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

// dates: iterable of ISO strings (or anything Date can parse — junk ignored)
// now: injectable clock for tests
export function computeStreak(dates, now = new Date()) {
  const days = new Set(); // local day indices with >= 1 attempt
  const counts = new Map(); // local day index -> attempts
  for (const s of dates) {
    const t = new Date(s);
    if (!Number.isFinite(t.getTime())) continue;
    const k = localDayIndex(t);
    days.add(k);
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const today = localDayIndex(now);

  // Current streak: consecutive practiced days ending today — or yesterday,
  // since a day without an attempt hasn't ended the streak yet.
  let current = 0;
  let cursor = days.has(today) ? today : today - 1;
  while (days.has(cursor)) {
    current++;
    cursor--;
  }

  // Best streak across every practiced day.
  let best = 0,
    run = 0,
    prev = -2;
  for (const d of [...days].sort((a, b) => a - b)) {
    run = d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  // 7-day strip, oldest → today, attempts per day (duplicates count).
  const last7 = [];
  let last7Total = 0;
  for (let i = 6; i >= 0; i--) {
    const n = counts.get(today - i) || 0;
    last7.push(n);
    last7Total += n;
  }

  // All-time attempt count across every stored day.
  let total = 0;
  for (const n of counts.values()) total += n;

  return { current, best, last7, last7Total, total };
}
