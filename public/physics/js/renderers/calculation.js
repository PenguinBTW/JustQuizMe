// Physics Calculation Renderer & Tolerance Verification
import { esc } from '../../../../shared/js/utils.js';

export function calcOk(v, q) {
  if (q && q.tolerance && typeof q.tolerance === 'object') return isFinite(v) && v >= q.tolerance.min && v <= q.tolerance.max;
  return numOk(v, Number(q && (q.expectedNumber || q.answer)), (q && q.tolerancePercent) ?? 2.5);
}

export function numOk(v, target, tol = 2.5) {
  if (!isFinite(v) || !isFinite(target)) return false;
  if (target === 0) return Math.abs(v) < 1e-9;
  return Math.abs(v - target) / Math.abs(target) * 100 <= tol;
}

export function renderCalculation(q, currentAnswer = '', isExam = false) {
  const val = typeof currentAnswer === 'string' ? currentAnswer : (currentAnswer.val || '');
  const unit = q.unit || q.units || '';

  return `
    <div style="background: var(--surface-subtle); padding: 20px; border-radius: 12px; border: 1px solid var(--border); margin: 18px 0;">
      <label class="mono" style="font-size: 11.5px; color: var(--ink-muted); text-transform: uppercase;">
        Numerical Value (Standard Scientific Notation Accepted, e.g. 1.6e-19, 3.00e8)
      </label>
      <div class="calc-input-row">
        <input type="text" class="calc-input-field" id="physCalcInput" value="${esc(val)}" placeholder="Value" />
        <span class="calc-unit-label">${esc(unit)}</span>
      </div>
      <div class="mono" style="font-size: 11.5px; color: var(--ink-secondary);">
        ${q.tolerance && typeof q.tolerance === 'object'
          ? `Accepted range: ${q.tolerance.min} – ${q.tolerance.max}${unit ? ' ' + esc(unit) : ''}`
          : 'Tolerance bound: ±2.5% of official AQA mark scheme solution'}
      </div>
    </div>
  `;
}

export function wireCalculation(container, onUpdate) {
  const input = container.querySelector('#physCalcInput');
  if (input) {
    input.addEventListener('input', () => {
      onUpdate({ val: input.value.trim() });
    });
  }
}
