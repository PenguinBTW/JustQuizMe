// Self-mounting "Daily question" chip for each portal home view.
// Watches #stage for the home synthesizer sheet (rendered only on the
// default 'past' room) and injects a chip before it — no view file edits.
// Overlay shows today's deterministic question, Reveal → got it/missed it.

import { esc } from './utils.js';
import {
  pickDailyId, loadDaily, recordDay, recordFor, isTodayDone, dailyStreak, todayStr
} from './daily.js';

const CHIP_ID = 'dailyQuizChip';
const OVERLAY_ID = 'dailyQuizOverlay';
const HOME_ANCHOR = '.synthesizer-sheet';

const CSS = `
#${CHIP_ID} { display:inline-flex; align-items:center; gap:8px; padding:5px 13px;
  border:1px solid var(--line, #3a3f45); border-radius:8px; background:var(--card, #1d2126);
  color:var(--ink, #e6e9ec); font:600 12.5px/1.2 inherit; cursor:pointer; }
#${CHIP_ID}:hover { border-color:var(--accent, #7aa2f7); }
#${CHIP_ID} .daily-streak { color:var(--accent, #7aa2f7); font-weight:700; }
#${OVERLAY_ID} { position:fixed; inset:0; z-index:1000; display:flex; align-items:center;
  justify-content:center; background:rgba(0,0,0,.55); }
#${OVERLAY_ID} .daily-card { width:min(560px,92vw); max-height:84vh; overflow:auto;
  background:var(--card, #1d2126); border:1px solid var(--line, #3a3f45); border-radius:12px;
  padding:20px 22px; color:var(--ink, #e6e9ec); }
#${OVERLAY_ID} .daily-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
#${OVERLAY_ID} .daily-title { font-weight:700; font-size:15px; }
#${OVERLAY_ID} .daily-x { cursor:pointer; background:none; border:none; color:var(--ink-muted,#9aa); font-size:18px; }
#${OVERLAY_ID} .daily-prompt { font-size:14.5px; line-height:1.55; white-space:pre-wrap; margin-bottom:12px; }
#${OVERLAY_ID} .daily-marks { color:var(--ink-muted,#9aa); font-size:12px; margin-bottom:12px; }
#${OVERLAY_ID} .daily-ms { border-top:1px dashed var(--line,#3a3f45); padding-top:10px; margin:10px 0; }
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
    const streak = dailyStreak(rec);
    const done = isTodayDone(rec, todayStr());
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
    const done = recordFor(rec, date);

    document.getElementById(OVERLAY_ID)?.remove();
    const ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    const ms = (q.markScheme || []).map(item =>
      `<li>${esc(typeof item === 'string' ? item : (item?.text ?? item?.mark ?? JSON.stringify(item)))}</li>`).join('');
    ov.innerHTML = `
      <div class="daily-card">
        <div class="daily-head">
          <span class="daily-title">Daily question — ${esc(date)}</span>
          <button class="daily-x" aria-label="Close">×</button>
        </div>
        <div class="daily-marks">${esc(q.marks ?? '?')} marks${done ? ` · ${done.got ? 'you got it' : 'you missed it'}` : ''}</div>
        <div class="daily-prompt">${esc(promptText(q))}</div>
        <div class="daily-ms" id="dailyMs" hidden>${ms ? `<ul>${ms}</ul>` : '<li class="mono">(no mark scheme attached)</li>'}</div>
        <div class="daily-btns">
          ${done
            ? `<button class="btn-ghost mono" id="dailyRevealBtn">Review answer</button>`
            : `<button class="btn" id="dailyRevealBtn">Reveal</button>
               <button class="btn" id="dailyGotBtn" hidden>Got it</button>
               <button class="btn-ghost mono" id="dailyMissedBtn" hidden>Missed it</button>`}
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.daily-x').onclick = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#dailyRevealBtn').onclick = () => {
      ov.querySelector('#dailyMs').hidden = false;
      const got = ov.querySelector('#dailyGotBtn');
      const missed = ov.querySelector('#dailyMissedBtn');
      if (got) { got.hidden = false; missed.hidden = false; ov.querySelector('#dailyRevealBtn').hidden = true; }
    };
    const settle = (got) => {
      recordDay(store, portal, date, id, got);
      ov.remove();
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
