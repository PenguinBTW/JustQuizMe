// Thin DOM wiring for the runner keyboard bindings in runnerKeys.js.
// Mounted once from main.js; watches #stage so the hint chip appears
// whenever the runner renders its chrome.
import { S } from './state.js';
import { $ } from './utils.js';
import { BINDINGS, decide } from './runnerKeys.js';

const CHIP_ID = 'runnerKeysChip';
const POP_ID = 'runnerKeysPop';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function ctx() {
  return {
    runner: S.room === 'runner',
    inputFocused: isTypingTarget(document.activeElement),
    modalOpen: !!document.querySelector('.modal-backdrop.open'),
    popoverOpen: !!document.getElementById(POP_ID),
    canPrev: !!$('#prevQ'),
    canNext: !!$('#nextQ'),
    optionCount: document.querySelectorAll('[data-opt-idx]').length,
    optionsEnabled: !!document.querySelector('[data-opt-idx]:not([disabled])'),
  };
}

function togglePopover(show) {
  let pop = document.getElementById(POP_ID);
  if (show === undefined) show = !pop;
  if (!show) { pop?.remove(); return; }
  if (pop) return;
  pop = document.createElement('div');
  pop.id = POP_ID;
  pop.className = 'runner-keys-pop';
  pop.innerHTML = `<div class="runner-keys-title">Runner keys</div>` +
    BINDINGS.map(b => `<div class="runner-keys-row">${b.label}</div>`).join('');
  document.body.appendChild(pop);
}

function ensureChip() {
  if (document.getElementById(CHIP_ID)) return;
  const chrome = document.querySelector('.q-chrome');
  if (!chrome) return;
  const chip = document.createElement('button');
  chip.id = CHIP_ID;
  chip.className = 'runner-keys-chip mono';
  chip.type = 'button';
  chip.textContent = '⌨ keys';
  chip.title = 'Keyboard shortcuts (?)';
  chip.onclick = () => togglePopover();
  chrome.appendChild(chip);
}

function sweep() {
  if (S.room === 'runner' && $('#prevQ') || S.room === 'runner' && $('#nextQ') || S.room === 'runner' && $('#finishQ')) ensureChip();
  else {
    document.getElementById(CHIP_ID)?.remove();
    document.getElementById(POP_ID)?.remove();
  }
}

export function initRunnerKeys() {
  document.addEventListener('keydown', (e) => {
    const d = decide(e.key, { ...ctx(), modKey: e.ctrlKey || e.metaKey || e.altKey });
    switch (d.action) {
      case 'prev': e.preventDefault(); $('#prevQ')?.click(); break;
      case 'next': e.preventDefault(); $('#nextQ')?.click(); break;
      case 'primary': {
        e.preventDefault();
        ($('#nextQ') || $('#finishQ'))?.click();
        break;
      }
      case 'select': {
        const b = document.querySelector(`[data-opt-idx="${d.index}"]`);
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
        break;
      }
      case 'hint': e.preventDefault(); togglePopover(); break;
      case 'dismiss': e.preventDefault(); togglePopover(false); break;
      default: break;
    }
  });

  // Re-mount the chip each time the runner chrome re-renders.
  const stage = document.getElementById('stage');
  if (stage) new MutationObserver(sweep).observe(stage, { childList: true, subtree: true });
  sweep();
}
