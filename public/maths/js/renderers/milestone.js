// Mathematics Multi-Step Milestone Engine
import { esc } from '../../../../shared/js/utils.js';

export function renderMilestone(q, currentAnswer = {}, isExam = false) {
  const milestones = q.milestones || [
    { code: 'M1', description: 'Method mark for differentiation / integration substitution' },
    { code: 'A1', description: 'Accuracy mark for correct intermediate expression' },
    { code: 'A1', description: 'Final exact evaluated solution' }
  ];

  const userSteps = currentAnswer.steps || {};

  const stepsHtml = milestones.map((m, i) => {
    const isChecked = !!userSteps[i];
    return `
      <div class="milestone-step-card">
        <span class="milestone-badge">${esc(m.code || 'M1')}</span>
        <div style="flex: 1;">
          <div style="font-size: 13.5px; font-weight: 500;">${esc(m.description || m.text || '')}</div>
          ${!isExam ? `
            <label style="display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" class="milestone-check" data-step="${i}" ${isChecked ? 'checked' : ''} />
              <span>Award Step Mark</span>
            </label>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="margin-top: 16px;">
      <textarea class="written-textarea" id="milestoneWorkArea" placeholder="Show complete mathematical working here...">${esc(currentAnswer.working || '')}</textarea>
      <div style="margin-top: 16px;">
        <div class="mono" style="font-size: 11.5px; color: var(--ink-muted); text-transform: uppercase; margin-bottom: 8px;">
          Examiner Milestone Criteria
        </div>
        ${stepsHtml}
      </div>
    </div>
  `;
}

export function wireMilestone(container, onUpdate) {
  const textarea = container.querySelector('#milestoneWorkArea');
  const checks = container.querySelectorAll('.milestone-check');

  function update() {
    const steps = {};
    checks.forEach(c => {
      const idx = c.getAttribute('data-step');
      if (c.checked) steps[idx] = true;
    });
    onUpdate({
      working: textarea ? textarea.value : '',
      steps
    });
  }

  if (textarea) textarea.addEventListener('input', update);
  checks.forEach(c => c.addEventListener('change', update));
}

export function evaluateMilestone(q, userAns) {
  const steps = (userAns && userAns.steps) || {};
  const awarded = Object.values(steps).filter(Boolean).length;
  return awarded;
}
