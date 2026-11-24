// Physics Utility Functions
import { S } from './state.js';

export const $ = (s) => document.querySelector(s);

export const fmtClock = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const ak = (q) => q._key || q.id;
export const normT = (s) => String(s || '').trim().toLowerCase();
export const num = (n) => Number(n || 0).toLocaleString('en-GB');

export function fmtDur(sec){
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtDate(iso){
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

export function shuffle(arr){
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Past-paper quiz order: MCQ first, then written, calculation, self-marked - shuffled within each group.
export function orderTypeShuffled(qs){
  const groups = [[], [], [], [], []];
  const pos = { 'multiple-choice': 0, 'written': 1, 'calculation': 2, 'self-marked': 3 };
  for (const q of qs) groups[pos[q.type] ?? 4].push(q);
  return groups.flatMap(shuffle);
}

// Stamp questions with stable answer keys + image/source context.
export function stampFile(quiz){
  return (quiz.questions || []).map(q => ({ ...q, _key: q.id, _imgBase: quiz.imageFolder || '', _src: '' }));
}

export function stampPool(quiz, file, cat){
  const base = file.replace(/\.json$/i, '');
  return (quiz.questions || []).map(q => ({ ...q, _key: `${base}:${q.id}`, _imgBase: quiz.imageFolder || '', _src: quiz.title, _srcFile: file, _srcCat: cat }));
}

export function chipify(text){
  return esc(text).replace(/`([^`]+)`/g, '<span class="val-chip">$1</span>');
}

// Structured data tables: "table": {"caption":"Table 1","headers":[...],"rows":[[...]]}
export function tableHtml(q){
  const t = q.table;
  if (!t || !Array.isArray(t.rows) || !t.rows.length) return '';
  const head = Array.isArray(t.headers) && t.headers.length
    ? `<thead><tr>${t.headers.map(h => `<th>${chipify(String(h ?? ''))}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${t.rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${chipify(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="table-scroll"><table class="journal-table">${t.caption ? `<caption>${esc(t.caption)}</caption>` : ''}${head}${body}</table></div>`;
}

// Past-paper-only images: /physics/images/past-paper/<imageFolder>/<image>
// q.image (single) or q.images (array of filenames or {file,alt,caption}).
export function imgSrc(file, base){
  const f = String(file);
  if (/^[a-z]+:/i.test(f) || f.startsWith('/')) return f;
  return '/physics/images/past-paper/' + (base ? base.replace(/\/+$/,'') + '/' : '') + f;
}

export function qImages(q){
  if (Array.isArray(q.images) && q.images.length)
    return q.images.map(it => typeof it === 'string' ? { file: it } : it);
  if (q.image) return [{ file: q.image, alt: q.imageAlt, caption: q.imageCaption }];
  return [];
}

export function imgHtml(q){
  return qImages(q).map(it => {
    const src = imgSrc(it.file, q._imgBase);
    const cap = it.caption || (!q.images && q.imageCaption) || '';
    return `<div class="diagram-frame"><img src="${esc(src)}" alt="${esc(it.alt || q.imageAlt || ('Diagram for ' + q.id))}" loading="lazy"/>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</div>`;
  }).join('');
}
