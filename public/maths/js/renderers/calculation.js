// Mathematics Numerical Calculation Renderer
import { esc } from '../../../../shared/js/utils.js';

export function renderCalculation(q, currentAnswer = '', isExam = false) {
  const val = typeof currentAnswer === 'string' ? currentAnswer : (currentAnswer.val || '');

  return `
    <div style="background: var(--surface-subtle); padding: 20px; border-radius: 12px; border: 1px solid var(--border); margin: 18px 0;">
      <label class="mono" style="font-size: 11.5px; color: var(--ink-muted); text-transform: uppercase;">
        Numerical Solution (to 3 significant figures unless stated)
      </label>
      <input type="text" class="math-input-field" id="mathCalcInput" value="${esc(val)}" placeholder="e.g. 4.25, -0.816, 12.4" style="margin-top: 8px;" />
    </div>
  `;
}

export function wireCalculation(container, onUpdate) {
  const input = container.querySelector('#mathCalcInput');
  if (input) {
    input.addEventListener('input', () => {
      onUpdate({ val: input.value.trim() });
    });
  }
}
