// Computer Science Utility Functions
export const $ = (s) => document.querySelector(s);

export const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ak = (q) => q._key || q.id;
export const normT = (s) => String(s || '').trim().toLowerCase();
export const num = (n) => Number(n || 0).toLocaleString('en-GB');

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

export function fmtSaved(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Question ordering: MCQ -> Truth Table -> Calculation -> Trace Table -> Written / Extended -> LMC -> Code-Requirement
export function orderTypeShuffled(qs) {
  const groups = [[], [], [], [], [], [], []];
  const pos = {
    'multiple-choice': 0,
    'truth-table': 1,
    'calculation': 2,
    'trace-table': 3,
    'written': 4,
    'extended-response': 4,
    'lmc': 5,
    'code-requirement': 6
  };
  for (const q of qs) (groups[pos[q.type] ?? 4] || groups[4]).push(q);
  return groups.flatMap(shuffle);
}

// Discrete Computer Science value normalization (exact match, base normalization, space-stripping)
export function normalizeDiscreteVal(val) {
  if (val == null) return '';
  let s = String(val).trim().toLowerCase();
  s = s.replace(/\s+/g, '');
  if (/^0b[01]+$/i.test(s)) s = s.substring(2);
  if (/^0x[0-9a-f]+$/i.test(s)) s = s.substring(2);
  return s;
}

export function checkDiscreteAnswer(userVal, q) {
  const normUser = normalizeDiscreteVal(userVal);
  if (!normUser) return false;

  const validExpected = [];
  if (Array.isArray(q.answers)) {
    validExpected.push(...q.answers.map(normalizeDiscreteVal));
  }
  if (q.answer != null) {
    validExpected.push(normalizeDiscreteVal(q.answer));
  }
  return validExpected.includes(normUser);
}

export function stampFile(quiz) {
  return (quiz.questions || []).map(q => ({ ...q, _key: q.id, _imgBase: quiz.imageFolder || '', _src: '' }));
}

export function stampPool(quiz, file, cat) {
  const base = file.replace(/\.json$/i, '');
  return (quiz.questions || []).map(q => ({ ...q, _key: `${base}:${q.id}`, _imgBase: quiz.imageFolder || '', _src: quiz.title, _srcFile: file, _srcCat: cat || '' }));
}

// Question images
export function imgSrc(file, base) {
  const f = String(file);
  if (/^[a-z]+:/i.test(f) || f.startsWith('/')) return f;
  return '/cs/images/past-paper/' + (base ? base.replace(/\/+$/, '') + '/' : '') + f;
}

export function qImages(q) {
  if (Array.isArray(q.images) && q.images.length) {
    return q.images.map(it => typeof it === 'string' ? { file: it } : it);
  }
  if (q.image) {
    return [{ file: q.image, alt: q.imageAlt, caption: q.imageCaption }];
  }
  return [];
}

export function imgHtml(q) {
  return qImages(q).map(it => {
    const src = imgSrc(it.file, q._imgBase);
    return `<figure class="qfig"><img src="${esc(src)}" alt="${esc(it.alt || q.imageAlt || ('Diagram for ' + q.id))}" loading="lazy"/>${it.caption || (!q.images && q.imageCaption) ? `<figcaption>${esc(it.caption || q.imageCaption || '')}</figcaption>` : ''}</figure>`;
  }).join('');
}

export function formatInline(text) {
  if (!text) return '';
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<span class="val-chip">$1</span>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

export function formatPrompt(text) {
  return formatInline(text);
}

export function tableHtml(q) {
  const t = q.table;
  if (!t || !Array.isArray(t.rows) || !t.rows.length) return '';
  const head = Array.isArray(t.headers) && t.headers.length
    ? `<thead><tr>${t.headers.map(h => `<th>${formatPrompt(String(h ?? ''))}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${t.rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${formatPrompt(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<figure class="qtable"><table>${head}${body}</table>${t.caption ? `<figcaption>${esc(t.caption)}</figcaption>` : ''}</figure>`;
}
