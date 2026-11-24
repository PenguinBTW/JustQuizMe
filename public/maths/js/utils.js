// Maths Utility Functions
export const $ = (s) => document.querySelector(s);

export const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ak = (q) => q._key || q.id;

// Marks earned from mark-scheme ticks: scheme points can be worth >1 mark,
// so sum their `marks` weights rather than counting checked boxes.
export const tickMarks = (q, ticks) =>
  (q.markScheme || []).reduce((s, m, i) => s + (ticks && ticks[i] ? (+m.marks || 1) : 0), 0);
export const normT = (s) => String(s || '').trim().toLowerCase();
export const num = (n) => Number(n || 0).toLocaleString('en-GB');

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function orderTypeShuffled(qs) {
  const groups = [[], [], [], [], []];
  const pos = {
    'multiple-choice': 0,
    'symbolic-exact': 1,
    'calculation': 1,
    'method-milestone': 2,
    'show-that-proof': 2,
    'graph-features': 2,
    'statistics-hypothesis': 2,
    'mechanics-vector-fbd': 2,
    'written': 3,
    'self-marked': 3
  };
  for (const q of qs) groups[pos[q.type] ?? 4].push(q);
  return groups.flatMap(shuffle);
}

export function stampFile(quiz) {
  return (quiz.questions || []).map(q => ({ ...q, _key: q.id, _imgBase: quiz.imageFolder || '', _src: '' }));
}

export function stampPool(quiz, file) {
  const base = file.replace(/\.json$/i, '');
  return (quiz.questions || []).map(q => ({ ...q, _key: `${base}:${q.id}`, _imgBase: quiz.imageFolder || '', _src: quiz.title, _srcFile: file }));
}

export function chipify(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code class="val-chip">$1</code>');
}
