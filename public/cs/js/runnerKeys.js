// Keyboard bindings for the quiz/exam runner — pure decision logic, DOM-free.
// The wiring layer (runnerKeysWiring.js) turns these decisions into clicks on
// the runner's real buttons, so keys always mirror what the mouse would do.

export const BINDINGS = [
  { keys: ['ArrowLeft', 'k'], action: 'prev', label: '← or k — previous question' },
  { keys: ['ArrowRight', 'j'], action: 'next', label: '→ or j — next question' },
  { keys: ['Enter'], action: 'primary', label: 'Enter — continue / submit' },
  { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], action: 'select', label: '1–9 — pick option n' },
  { keys: ['?'], action: 'hint', label: '? — show these keys' },
];

// ctx: {
//   runner:         a run is on screen (S.room === 'runner')
//   inputFocused:   focus is in input/textarea/select/contentEditable
//   modKey:         Ctrl / Meta / Alt held
//   modalOpen:      a modal backdrop is open
//   popoverOpen:    the keys hint popover is showing
//   buttonFocused:  focus is on a button (an answer option, save, nav…) — its
//                   own Enter activation must win over runner nav
//   canPrev:        a previous question exists
//   canNext:        a next question exists (false on the last question)
//   optionCount:    visible MCQ option buttons
//   optionsEnabled: MCQ options are not locked/disabled
// }
// Returns { action } — one of 'prev' | 'next' | 'primary' | 'select' | 'hint' |
// 'dismiss' | 'none'. 'select' carries { index } (0-based option index).
export function decide(key, ctx = {}) {
  const none = { action: 'none' };
  if (ctx.modKey || ctx.inputFocused || ctx.modalOpen) return none;
  if (!ctx.runner) return none;
  if (key === 'Escape') return ctx.popoverOpen ? { action: 'dismiss' } : none;
  if (key === '?') return { action: 'hint' };
  if (key === 'ArrowLeft' || key === 'k') return ctx.canPrev ? { action: 'prev' } : none;
  if (key === 'ArrowRight' || key === 'j') return ctx.canNext ? { action: 'next' } : none;
  if (key === 'Enter') return ctx.buttonFocused ? none : { action: 'primary' };
  if (/^[1-9]$/.test(key) && ctx.optionsEnabled) {
    const i = +key - 1;
    if (i < (ctx.optionCount || 0)) return { action: 'select', index: i };
  }
  return none;
}
