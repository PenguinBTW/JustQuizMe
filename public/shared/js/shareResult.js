// Pure encode/parse/render helpers for shareable run-result links.
// A finished run can be packed into a base64url JSON payload carried on a
// `#/share?p=...` hash; the receiving portal renders a read-only result
// card instead of its home screen (and never touches stats).

export const SHARE_HASH = '#/share?p=';

const PORTALS = new Set(['cs', 'maths', 'physics']);
const MAX_TITLE = 200;
const MAX_MARKS = 100000;

// Minimal base64url that survives node --test and every browser.
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(str) {
  const b64 = str.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const isNum = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

// encodeResult({portal, title, score, marks, date}) → compact payload string
// (no '#', no 'p='); throws on invalid input so callers fail loudly.
export function encodeResult({ portal, title, score, marks, date }) {
  if (!PORTALS.has(portal)) throw new Error(`bad portal: ${portal}`);
  title = String(title ?? '').slice(0, MAX_TITLE);
  if (!isNum(+score, 0, MAX_MARKS) || !isNum(+marks, 0, MAX_MARKS) || +score > +marks) {
    throw new Error('bad score/marks');
  }
  const p = {
    p: portal,
    t: title,
    s: Math.round(+score * 100) / 100,
    m: Math.round(+marks * 100) / 100,
    d: Number.isFinite(+date) ? Math.round(+date) : Date.now(),
  };
  return b64urlEncode(JSON.stringify(p));
}

// parseResult(hash, portal) → {portal,title,score,marks,date,pct} or null.
// Rejects: missing/garbage payload, wrong portal, out-of-range numbers.
export function parseResult(hash, portal) {
  if (!PORTALS.has(portal)) return null;
  const raw = String(hash || '');
  const i = raw.indexOf(SHARE_HASH);
  if (i < 0) return null;
  const payload = raw.slice(i + SHARE_HASH.length).split('&')[0].split('#')[0];
  if (!payload || payload.length > 2000) return null;
  let p;
  try {
    p = JSON.parse(b64urlDecode(payload));
  } catch {
    return null;
  }
  if (!p || p.p !== portal) return null;
  if (typeof p.t !== 'string' || p.t.length > MAX_TITLE) return null;
  if (!isNum(+p.s, 0, MAX_MARKS) || !isNum(+p.m, 0, MAX_MARKS) || +p.s > +p.m) return null;
  if (!isNum(+p.d, 0, 1e15)) return null;
  const marks = +p.m;
  const score = +p.s;
  return {
    portal: p.p,
    title: p.t,
    score,
    marks,
    date: Math.round(+p.d),
    pct: marks > 0 ? Math.round((score / marks) * 100) : 0,
  };
}

// shareLink(model, base?) → absolute share URL; base defaults to the page.
export function shareLink(model, base) {
  const b = base ?? `${location.origin}${location.pathname}`;
  return `${b}${SHARE_HASH}${encodeResult(model)}`;
}

const escHtml = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// resultCardHtml(model, homeHref?) → read-only result card markup (no
// script, all user-controlled strings escaped). homeHref defaults to the
// current page path (portal home).
export function resultCardHtml(model, homeHref) {
  const href = escHtml(homeHref ?? location.pathname);
  const when = new Date(model.date);
  const dateStr = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  return `
    <div class="card" style="text-align:center; padding:44px 32px;" id="shareResultCard">
      <span class="pill accent" style="margin-bottom:12px;">SHARED RESULT</span>
      <h1 class="serif" style="font-size:36px; margin-bottom:8px;">${escHtml(model.title)}</h1>
      <div class="mono" style="font-size:48px; font-weight:700; color:var(--accent); margin:18px 0;">
        ${escHtml(model.score)} / ${escHtml(model.marks)}
        <span style="font-size:22px; color:var(--ink-muted);">(${model.pct}%)</span>
      </div>
      ${dateStr ? `<p style="color:var(--ink-secondary); font-size:14px; margin-bottom:28px;">Completed ${escHtml(dateStr)}.</p>` : ''}
      <a class="btn btn-jade" href="${href}" style="padding:10px 28px; font-size:14px; text-decoration:none; display:inline-block;">Take this quiz →</a>
    </div>`;
}
