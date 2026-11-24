// Daily-question core: deterministic per-day pick + localStorage record.
// Pure — no DOM. Storage is injectable for node --test.

// FNV-1a 32-bit hash → uint32
export function dailySeed(dateStr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic pick: the same date picks the same question for everyone,
// across every portal holding the same bank. Order is by questionId, not
// display order — callers pass any iterable of ids.
export function pickDailyId(ids, dateStr) {
  const sorted = [...ids].sort();
  if (!sorted.length) return null;
  return sorted[dailySeed(dateStr) % sorted.length];
}

export function dailyKey(portal) {
  return `jqm.daily.v1.${portal}`;
}

// Record shape: { days: { 'YYYY-MM-DD': { questionId, got: true|false } } }
export function loadDaily(store, portal) {
  try {
    const raw = store.getItem(dailyKey(portal));
    if (!raw) return { days: {} };
    const rec = JSON.parse(raw);
    if (!rec || typeof rec !== 'object' || typeof rec.days !== 'object' || !rec.days) return { days: {} };
    return rec;
  } catch {
    return { days: {} };
  }
}

export function saveDaily(store, portal, rec) {
  try {
    store.setItem(dailyKey(portal), JSON.stringify(rec));
  } catch { /* storage full / private mode — treat as transient */ }
  return rec;
}

export function recordDay(store, portal, dateStr, questionId, got) {
  const rec = loadDaily(store, portal);
  rec.days[dateStr] = { questionId, got: !!got };
  return saveDaily(store, portal, rec);
}

export function recordFor(rec, dateStr) {
  const d = rec?.days?.[dateStr];
  return d ? { date: dateStr, questionId: d.questionId, got: d.got } : null;
}

export function isTodayDone(rec, dateStr) {
  const d = recordFor(rec, dateStr);
  return !!d && d.got !== null && d.got !== undefined;
}

export function todayStr(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function prevDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

// Consecutive days answered ending today (or yesterday if today is still open)
export function dailyStreak(rec, dateStr = todayStr()) {
  const days = rec?.days || {};
  let cur = days[dateStr] ? dateStr : prevDay(dateStr);
  let n = 0;
  while (days[cur]) { n++; cur = prevDay(cur); }
  return n;
}
