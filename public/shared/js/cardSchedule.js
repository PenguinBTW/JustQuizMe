// Per-card spaced repetition — SM-2-lite, localStorage-persisted.
// Honest minimal model: correct recall doubles the interval (capped at 60d),
// a lapse resets to 1 day. No ease factors, no fake precision.
const STORE_KEY = 'jqm-card-schedule-v1';
// Card keys are only unique within a portal (filename+question id) — namespace
// by subject so two subjects sharing ids don't share schedules.
function ns() {
  try { const m = location.pathname.match(/\/(cs|maths|physics)\//); return m ? m[1] + ':' : ''; }
  catch { return ''; }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
}
function saveAll(m) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch { /* storage full/blocked — session still works */ }
}

// recordGrade(cardKey, got) → updated state {interval, due, reps}
export function recordGrade(cardKey, got, now = Date.now()) {
  cardKey = ns() + cardKey;
  const all = load();
  const prev = all[cardKey] || { interval: 1, reps: 0 };
  const interval = got ? Math.min(60, prev.interval * 2) : 1;
  const st = { interval, due: now + interval * 86400000, reps: (prev.reps || 0) + 1 };
  all[cardKey] = st;
  saveAll(all);
  return st;
}

// dueCardKeys(keys, now) → the subset due now or overdue
export function dueCardKeys(keys, now = Date.now()) {
  const all = load();
  const p = ns();
  return (keys || []).filter(k => {
    const st = all[p + k];
    if (!st) return true; // never seen — due by definition
    return (st.due || 0) <= now;
  });
}

// orderCardsByDue(cards, now) → due first (overdue-most first), then new, then not-yet-due
export function orderCardsByDue(cards, now = Date.now()) {
  const all = load();
  const p = ns();
  const rank = c => {
    const st = all[p + (c.key || c.id || c.front)];
    if (!st) return { band: 0, due: 0 };
    return (st.due || 0) <= now ? { band: 0, due: st.due } : { band: 2, due: st.due };
  };
  return [...(cards || [])]
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => a.r.band - b.r.band || a.r.due - b.r.due || a.i - b.i)
    .map(x => x.c);
}

// dueRank(card) → 0 overdue, 1 unseen, 2 not-yet-due — compose with mastery
// bands: sort by (masteryBand, dueRank) so weak-topic cards always precede
// stronger-topic cards, and within a topic band reviews precede new cards.
export function dueRank(c, now = Date.now()) {
  const all = load();
  const st = all[ns() + (c.key || c.id || c.front)];
  if (!st) return 1;
  return (st.due || 0) <= now ? 0 : 2;
}

// dueStamp(card) → the card's due timestamp; unseen cards count as due at time 0
// (most overdue possible) since they've never been reviewed.
export function dueStamp(c) {
  const all = load();
  const st = all[ns() + (c.key || c.id || c.front)];
  return st ? (st.due || 0) : 0;
}
