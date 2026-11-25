// Self-mounting "Daily question" chip for each portal home view.
// Watches #stage for the home synthesizer sheet (rendered only on the
// default 'past' room) and injects a chip before it — no view file edits.
// Overlay shows today's deterministic question, Reveal → got it/missed it.

import { esc } from './utils.js';
import {
  pickDailyId, loadDaily, recordDay, recordFor, dailyStreak, todayStr
} from './daily.js';

const CHIP_ID = 'dailyQuizChip';
const OVERLAY_ID = 'dailyQuizOverlay';
const HOME_ANCHOR = '.synthesizer-sheet';

const CSS = `
#${CHIP_ID} { display:inline-flex; align-items:center; gap:8px; padding:5px 13px;
  border:1px solid #3a3f45; border-radius:8px; background:#1d2126;
  color:#e6e9ec; font:600 12.5px/1.2 inherit; cursor:pointer; }
#${CHIP_ID}:hover { border-color:#7aa2f7; }
#${CHIP_ID} .daily-streak { color:#7aa2f7; font-weight:700; }
#${OVERLAY_ID} { position:fixed; inset:0; z-index:1000; display:flex; align-items:center;
  justify-content:center; background:rgba(0,0,0,.55); }
#${OVERLAY_ID} .daily-card { width:min(560px,92vw); max-height:84vh; overflow:auto;
  background:#1d2126; border:1px solid #3a3f45; border-radius:12px;
  padding:20px 22px; color:#e6e9ec; }
#${OVERLAY_ID} [hidden] { display:none !important; }
#${OVERLAY_ID} .daily-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
#${OVERLAY_ID} .daily-title { font-weight:700; font-size:15px; }
#${OVERLAY_ID} .daily-x { cursor:pointer; background:none; border:none; color:#9aa5b1; font-size:18px; }
#${OVERLAY_ID} .daily-prompt { font-size:14.5px; line-height:1.55; white-space:pre-wrap; margin-bottom:12px; }
#${OVERLAY_ID} .daily-ctx { font-size:13px; color:#9aa5b1; margin-bottom:10px; white-space:pre-wrap; }
#${OVERLAY_ID} .daily-img { max-width:100%; border-radius:6px; margin-bottom:10px; }
#${OVERLAY_ID} .daily-marks { color:#9aa5b1; font-size:12px; margin-bottom:12px; }
#${OVERLAY_ID} .daily-ms { border-top:1px dashed #3a3f45; padding-top:10px; margin:10px 0; }
#${OVERLAY_ID} .daily-ms li { font-size:13.5px; margin:4px 0; }
#${OVERLAY_ID} .daily-btns { display:flex; gap:10px; margin-top:14px; }
`;

// registerDaily({ portal, S, store })
//   portal — storage namespace ('cs' | 'maths' | 'physics')
//   S      — portal state store (reads S._pastAll: id→question map)
//   store  — injectable for tests; defaults to localStorage
export function registerDaily({ portal, S, store = globalThis.localStorage }) {
  if (!document.getElementById('dailyQuizStyle')) {
    const st = document.createElement('style');
    st.id = 'dailyQuizStyle';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const stage = document.getElementById('stage') || document.body;

  const allQuestions = () => {
    const pool = S?._pastAll;
    if (!pool) return { ids: [], byId: new Map() };
    const byId = pool instanceof Map ? pool : new Map(Object.entries(pool));
    return { ids: [...byId.keys()], byId };
  };

  const promptText = (q) => {
    const p = q?.prompt;
    if (typeof p === 'string') return p;
    if (Array.isArray(p)) return p.map(b => b?.text ?? b ?? '').join('\n');
    return '';
  };

  const chipLabel = () => {
    const rec = loadDaily(store, portal);
    // a same-day bank change that swaps the pick shouldn't keep the old check
    const { ids } = allQuestions();
    const pick = pickDailyId(ids, todayStr());
    const streak = dailyStreak(rec, todayStr(), pick);
    const dayRec = recordFor(rec, todayStr());
    const done = !!(dayRec && dayRec.questionId === pick);
    const sTxt = streak > 0 ? ` <span class="daily-streak">· ${streak}d</span>` : '';
    return done ? `Daily ✓${sTxt}` : `Daily question${sTxt}`;
  };

  const openOverlay = () => {
    const { ids, byId } = allQuestions();
    const date = todayStr();
    const id = pickDailyId(ids, date);
    if (!id) return;
    const q = byId.get(id) || {};
    const rec = loadDaily(store, portal);
    const dayRec = recordFor(rec, date);
    // a same-day bank change that swaps the pick must not inherit the old rating
    const done = dayRec && dayRec.questionId === id ? dayRec : null;

    document.getElementById(OVERLAY_ID)?.remove();
    const ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    // reveal content: mark scheme first, then any other answer fields the bank carries
    const msItems = (q.markScheme || []).map(item =>
      `<li>${esc(typeof item === 'string' ? item : (item?.text ?? item?.mark ?? JSON.stringify(item)))}</li>`);
    for (const k of ['answer', 'answerText', 'modelAnswer', 'solution']) {
      if (q[k]) msItems.push(`<li>${esc(typeof q[k] === 'string' ? q[k] : JSON.stringify(q[k]))}</li>`);
    }
    if (Array.isArray(q.options)) {
      q.options.forEach((o, i) => {
        const txt = typeof o === 'string' ? o : (o?.text ?? JSON.stringify(o));
        const isC = o?.correct || q.correct === i || q.correctOption === i;
        if (isC) msItems.push(`<li><strong>${esc(txt)}</strong> ✓</li>`);
      });
    }
    const ms = msItems.join('');
    // context: linked dependency stems, a data table, figures the prompt needs
    const ctx = [];
    for (const d of q.dependsOn || q.deps || []) {
      const did = d?.id ?? d;
      // deps are sibling ids within the same paper — prefer same-file matches
      // so a reused id in another paper can't leak the wrong context in
      const sameFile = q._srcFile ? [...byId.values()].filter(x => x._srcFile === q._srcFile) : [];
      const src = sameFile.find(x => x.id === did || x._key === did)
        || byId.get(did)
        || sameFile.find(x => (x._key ?? '').endsWith(':' + did))
        || [...byId.values()].find(q2 => {
          const qid = q2.id ?? q2._key ?? '';
          return qid === did || qid.endsWith('/' + did) || qid.endsWith('#' + did) || qid.endsWith(':' + did);
        });
      const t = src ? promptText(src) : (d?.prompt ?? '');
      if (t) ctx.push(`(${esc(did)}: ${esc(t)})`);
    }
    let ctxHtml = ctx.length ? `<div class="daily-ctx">${ctx.join('<br>')}</div>` : '';
    if (q.table && Array.isArray(q.table.rows) && q.table.rows.length) {
      const tb = q.table;
      const head = Array.isArray(tb.headers) ? `<tr>${tb.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>` : '';
      const rows = tb.rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c2 => `<td>${esc(c2)}</td>`).join('')}</tr>`).join('');
      ctxHtml += `<div class="daily-ctx"><table border="1" style="border-collapse:collapse;font-size:12.5px;">${head}${rows}</table></div>`;
    }
    for (const img of [q.image, q.img, ...(Array.isArray(q.images) ? q.images : [])].filter(Boolean)) {
      const src = typeof img === 'string' ? img : (img?.src ?? img?.file ?? '');
      if (src) ctxHtml += `<img class="daily-img" src="${esc(src.startsWith('http') || src.startsWith('/') ? src : (q._imgBase || '') + src)}">`;
    }
    ov.innerHTML = `
      <div class="daily-card" tabindex="-1">
        <div class="daily-head">
          <span class="daily-title">Daily question — ${esc(date)}</span>
          <button class="daily-x" aria-label="Close">×</button>
        </div>
        <div class="daily-marks">${esc(q.marks ?? '?')} marks${done ? ` · ${done.got ? 'you got it' : 'you missed it'}` : ''}</div>
        ${ctxHtml}
        <div class="daily-prompt">${esc(promptText(q))}</div>
        <div class="daily-ms" id="dailyMs" hidden>${ms ? `<ul>${ms}</ul>` : '<li class="mono">(no answer attached)</li>'}</div>
        <div class="daily-btns">
          ${done
            ? `<button class="btn-ghost mono" id="dailyRevealBtn">Review answer</button>`
            : `<button class="btn" id="dailyRevealBtn">Reveal</button>
               <button class="btn" id="dailyGotBtn" hidden>Got it</button>
               <button class="btn-ghost mono" id="dailyMissedBtn" hidden>Missed it</button>`}
        </div>
      </div>`;
    document.body.appendChild(ov);
    // render any LaTeX inside the overlay (renderMath is scoped to #stage)
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(ov, { delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ] });
    }
    // focus stays inside the card until it closes
    const card = ov.querySelector('.daily-card');
    const close = () => ov.remove();
    card.focus();
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...ov.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      f[n].focus();
      e.preventDefault();
    });
    ov.querySelector('.daily-x').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelector('#dailyRevealBtn').onclick = () => {
      ov.querySelector('#dailyMs').hidden = false;
      const got = ov.querySelector('#dailyGotBtn');
      const missed = ov.querySelector('#dailyMissedBtn');
      if (got) { got.hidden = false; missed.hidden = false; ov.querySelector('#dailyRevealBtn').hidden = true; card.focus(); }
    };
    const settle = (got) => {
      recordDay(store, portal, date, id, got);
      close();
      const chip = document.getElementById(CHIP_ID);
      if (chip) chip.innerHTML = chipLabel();
    };
    ov.querySelector('#dailyGotBtn')?.addEventListener('click', () => settle(true));
    ov.querySelector('#dailyMissedBtn')?.addEventListener('click', () => settle(false));
  };

  const tryMount = () => {
    const anchor = stage.querySelector?.(HOME_ANCHOR);
    const existing = document.getElementById(CHIP_ID);
    if (!anchor) { existing?.remove(); return; }
    const { ids } = allQuestions();
    if (!ids.length) { existing?.remove(); return; } // banks still loading
    if (existing) {
      const label = chipLabel();
      if (existing.innerHTML !== label) existing.innerHTML = label;
      return;
    }
    const chip = document.createElement('button');
    chip.id = CHIP_ID;
    chip.innerHTML = chipLabel();
    chip.title = "One deterministic question per day — same for everyone";
    chip.addEventListener('click', openOverlay);
    anchor.parentElement.insertBefore(chip, anchor);
  };

  tryMount();
  new MutationObserver(tryMount).observe(stage, { childList: true, subtree: true });
}
