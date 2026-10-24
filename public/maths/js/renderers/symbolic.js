// Mathematics Symbolic CAS Renderer & Math Keypad
import { esc } from '../../../../shared/js/utils.js';

export function renderSymbolic(q, currentAnswer = '', isExam = false) {
  const userText = typeof currentAnswer === 'string' ? currentAnswer : (currentAnswer.expr || '');

  return `
    <div class="math-symbolic-box">
      <label class="mono" style="font-size: 11.5px; color: var(--ink-muted); text-transform: uppercase;">
        Exact Symbolic Answer (Surds, Fractions, Trig, or Exact Values)
      </label>
      <input type="text" class="math-input-field" id="mathSymbolicInput" value="${esc(userText)}" placeholder="e.g. 1/2 ln(2x) or 3sqrt(5)/2" />

      <div class="math-keypad" id="mathKeypad">
        <button class="math-key-btn" data-insert="\\sqrt{}">√</button>
        <button class="math-key-btn" data-insert="\\frac{}{}">a/b</button>
        <button class="math-key-btn" data-insert="^">xⁿ</button>
        <button class="math-key-btn" data-insert="\\pi">π</button>
        <button class="math-key-btn" data-insert="\\ln()">ln</button>
        <button class="math-key-btn" data-insert="\\sin()">sin</button>
        <button class="math-key-btn" data-insert="\\cos()">cos</button>
        <button class="math-key-btn" data-insert="\\tan()">tan</button>
        <button class="math-key-btn" data-insert="(">(</button>
        <button class="math-key-btn" data-insert=")">)</button>
      </div>
    </div>
  `;
}

export function wireSymbolic(container, onUpdate) {
  const input = container.querySelector('#mathSymbolicInput');
  const keypad = container.querySelector('#mathKeypad');
  if (!input) return;

  input.addEventListener('input', () => {
    onUpdate({ expr: input.value });
  });

  if (keypad) {
    keypad.querySelectorAll('.math-key-btn').forEach(btn => {
      btn.onclick = () => {
        const ins = btn.getAttribute('data-insert');
        input.value += ins;
        input.focus();
        onUpdate({ expr: input.value });
      };
    });
  }
}
