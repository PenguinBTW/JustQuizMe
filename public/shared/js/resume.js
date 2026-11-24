// Quick-resume anchor store — per-portal, localStorage-backed.
// An anchor captures enough of a run to re-enter it via beginRun({resume}):
// the quiz identity, ordered question keys, answers, position and elapsed time.
// Pure module: every function takes an optional StorageLike for tests.

export const RESUME_VERSION = 1;
export const RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000; // anchors older than a week are dead

const keyFor = (portal) => `jqm.resume.v1.${portal}`;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isInt = (v, min) => Number.isInteger(v) && v >= min;

// Structural validation — rejects tampered/malformed anchors and expired ones.
export function validAnchor(a, portal, now = Date.now()) {
  if (!isObj(a)) return null;
  if (a.v !== RESUME_VERSION) return null;
  if (a.portal !== portal) return null;
  if (!isStr(a.quizUuid) || !isStr(a.title)) return null;
  if (a.kind !== 'virtual' && a.kind !== 'file') return null;
  if (!isStr(a.category)) return null;
  if (typeof a.quizFile !== 'string') return null;
  if (a.mode !== 'quiz' && a.mode !== 'explore' && a.mode !== 'exam') return null;
  if (!isInt(a.qIndex, 0) || !isInt(a.total, 1) || a.qIndex >= a.total) return null;
  if (!Array.isArray(a.order) || a.order.length === 0) return null;
  if (!isObj(a.answers)) return null;
  if (typeof a.elapsed !== 'number' || !(a.elapsed >= 0)) return null;
  if (!isStr(a.startedAt) || Number.isNaN(Date.parse(a.startedAt))) return null;
  if (typeof a.savedAt !== 'number' || !(a.savedAt > 0)) return null;
  if (now - a.savedAt > RESUME_TTL_MS || a.savedAt > now + 60_000) return null;
  if (!Array.isArray(a.questions) || a.questions.length === 0) return null;
  return a;
}

export function saveAnchor(anchor, store = globalThis.localStorage) {
  // Explore runs are never a "last unfinished run" worth resuming.
  if (anchor && anchor.mode === 'explore') return null;
  const a = { v: RESUME_VERSION, ...anchor, savedAt: Date.now() };
  if (!validAnchor({ ...a, savedAt: a.savedAt }, a.portal)) return null;
  try {
    store.setItem(keyFor(a.portal), JSON.stringify(a));
  } catch {
    return null;
  }
  return a;
}

export function loadAnchor(portal, store = globalThis.localStorage) {
  let raw;
  try {
    raw = store.getItem(keyFor(portal));
  } catch {
    return null;
  }
  if (!raw) return null;
  let a;
  try {
    a = JSON.parse(raw);
  } catch {
    return null;
  }
  return validAnchor(a, portal);
}

export function clearAnchor(portal, store = globalThis.localStorage) {
  try {
    store.removeItem(keyFor(portal));
  } catch {}
}

// JQM has no URL deep-link routing — rooms are state-driven, so re-entry is a
// beginRun replay from the portal mount. Kept for a future hash router.
export function resumeHref(/* model */) {
  return null;
}
