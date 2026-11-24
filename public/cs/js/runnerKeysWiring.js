// Thin DOM wiring for the runner keyboard bindings in runnerKeys.js.
// Mounted once from main.js; watches #stage so the hint chip appears
// whenever the runner renders its chrome. `env` injection keeps it testable.
import { S } from './state.js';
import { BINDINGS, decide } from './runnerKeys.js';

const CHIP_ID = 'runnerKeysChip';
const POP_ID = 'runnerKeysPop';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function initRunnerKeys(env = {}) {
  const doc = env.doc ?? document;
  const MO = env.MutationObserver ?? MutationObserver;

  const q = (sel) => doc.querySelector(sel);
  const runnerChromeLive = () => !!(q('#prevQ') || q('#nextQ') || q('#finishQ'));

  function ctx() {
    const ae = doc.activeElement;
    return {
      // finish.js leaves S.room === 'runner' on the results screen — a run is
      // only "live" while the question footer buttons exist
      runner: S.room === 'runner' && runnerChromeLive(),
      inputFocused: isTypingTarget(ae),
      buttonFocused: ae?.tagName === 'BUTTON',
      modalOpen: !!q('.modal-backdrop.open'),
      popoverOpen: !!doc.getElementById(POP_ID),
      canPrev: !!q('#prevQ'),
      canNext: !!q('#nextQ'),
      optionCount: doc.querySelectorAll('[data-opt-idx]').length,
      optionsEnabled: !!q('[data-opt-idx]:not([disabled])'),
    };
  }

  function togglePopover(show) {
    let pop = doc.getElementById(POP_ID);
    if (show === undefined) show = !pop;
    if (!show) { pop?.remove(); return; }
    if (pop) return;
    pop = doc.createElement('div');
    pop.id = POP_ID;
    pop.className = 'runner-keys-pop';
    pop.innerHTML = `<div class="runner-keys-title">Runner keys</div>` +
      BINDINGS.map(b => `<div class="runner-keys-row">${b.label}</div>`).join('');
    doc.body.appendChild(pop);
  }

  function ensureChip() {
    if (doc.getElementById(CHIP_ID)) return;
    const chrome = q('.q-chrome');
    if (!chrome) return;
    const chip = doc.createElement('button');
    chip.id = CHIP_ID;
    chip.className = 'runner-keys-chip mono';
    chip.type = 'button';
    chip.textContent = '⌨ keys';
    chip.title = 'Keyboard shortcuts (?)';
    chip.onclick = () => togglePopover();
    chrome.appendChild(chip);
  }

  function sweep() {
    if (S.room === 'runner' && runnerChromeLive()) ensureChip();
    else {
      doc.getElementById(CHIP_ID)?.remove();
      doc.getElementById(POP_ID)?.remove();
    }
  }

  doc.addEventListener('keydown', (e) => {
    if (e.repeat) return; // held keys must not chain-advance or auto-submit
    const d = decide(e.key, { ...ctx(), modKey: e.ctrlKey || e.metaKey || e.altKey });
    switch (d.action) {
      case 'prev': e.preventDefault(); q('#prevQ')?.click(); break;
      case 'next': e.preventDefault(); q('#nextQ')?.click(); break;
      case 'primary': {
        e.preventDefault();
        (q('#nextQ') || q('#finishQ'))?.click();
        break;
      }
      case 'select': {
        const b = q(`[data-opt-idx="${d.index}"]`);
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
        break;
      }
      case 'hint': e.preventDefault(); togglePopover(); break;
      case 'dismiss': e.preventDefault(); togglePopover(false); break;
      default: break;
    }
  });

  // Re-mount the chip each time the runner chrome re-renders.
  const stage = doc.getElementById('stage');
  if (stage) new MO(sweep).observe(stage, { childList: true, subtree: true });
  sweep();
}
