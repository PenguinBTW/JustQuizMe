// Universal String, Number & Array Utilities

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

export const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[c]));

export const ak = (q) => q._key || q.id;

export const normT = (s) => String(s || '').trim().toLowerCase();

export const num = (n) => Number(n || 0).toLocaleString('en-GB');

export function fmtDur(sec) {
  sec = Math.round(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}s`;
  return `${m}m ${s}s`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pct(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}
