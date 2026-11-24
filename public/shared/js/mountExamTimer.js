// Self-mounting exam pace chip — attaches next to the exam clock in the runner
// header during exam runs only (#examClock exists only when quiz.exam + limit).
// Green/amber/red pace dot + mm:ss; at 0 it pulses "time's up" without auto-submit.
import { timerSpec, tick, mmss, parseChromeCount, parseRemaining } from './examTimer.js';

const CHIP_ID = 'jqmExamPace';
const DOT = { ahead: '#2e9e5b', on: '#d9a02b', behind: '#d94f3d' };

function ensureStyle() {
  if (document.getElementById('jqm-exam-pace-style')) return;
  const st = document.createElement('style');
  st.id = 'jqm-exam-pace-style';
  st.textContent = `
    #${CHIP_ID} { display:inline-flex; align-items:center; gap:6px; margin-left:8px;
      padding:2px 8px; border-radius:999px; font:600 12.5px ui-monospace,monospace;
      background:var(--surface-2,rgba(127,127,127,.12)); }
    #${CHIP_ID} .dot { width:8px; height:8px; border-radius:50%; }
    #${CHIP_ID}.timesup { animation:jqmPacePulse 1.1s ease-in-out infinite; }
    @keyframes jqmPacePulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  `;
  document.head.appendChild(st);
}

function host() {
  const clock = document.getElementById('examClock');
  return clock ? clock.parentElement : null;
}

// mid's innerHTML is rewritten every second, so the chip lives one level up
// where portal rewrites can't remove it.

function refresh(chip, spec) {
  const mid = host();
  if (!mid) { chip.remove(); return false; }
  const remainingSec = parseRemaining(mid.textContent);
  const qc = parseChromeCount(mid.textContent);
  const t = tick({ remainingSec, questionIndex: qc?.index }, spec);
  if (t.remainingSec <= 0) {
    chip.classList.add('timesup');
    chip.innerHTML = `<span>⏱ 00:00</span><span>time's up — keep going if you want</span>`;
    return true;
  }
  chip.classList.remove('timesup');
  chip.innerHTML =
    `<span class="dot" style="background:${DOT[t.pace]};" title="${t.pace === 'on' ? 'on pace' : t.pace + ' of pace'}"></span>` +
    `<span>${mmss(t.remainingSec)}</span>`;
  return true;
}

function tryMount() {
  if (document.getElementById(CHIP_ID)) return;
  const mid = host();
  if (!mid) return;
  const qc = parseChromeCount(mid.textContent);
  const rem = parseRemaining(mid.textContent);
  if (!qc || rem == null) return;
  // Chip mounts with the runner (elapsed ≈ 0), so total ≈ first-seen remaining;
  // elapsed then falls out of totalSec - parsed remaining each tick.
  const spec = timerSpec({ totalMin: rem / 60, questionCount: qc.count });
  ensureStyle();
  const chip = document.createElement('span');
  chip.id = CHIP_ID;
  (mid.parentElement || mid).appendChild(chip);
  const iv = setInterval(() => {
    if (!refresh(chip, spec)) clearInterval(iv);
  }, 1000);
  refresh(chip, spec);
}

const mo = new MutationObserver(tryMount);
mo.observe(document.documentElement, { childList: true, subtree: true });
tryMount();
