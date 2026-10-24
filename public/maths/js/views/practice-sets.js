// Mathematics Practice Sets View
import { esc } from '../../../../shared/js/utils.js';

export function renderPracticeSets(S, onStartQuiz) {
  const normalQuizzes = S.quizzes.normal || [];
  if (!normalQuizzes.length) {
    return `<div class="card" style="text-align: center; padding: 48px;"><p style="color: var(--ink-secondary);">No dedicated practice sets currently loaded. Explore the authentic Past Papers library!</p></div>`;
  }

  const cardsHtml = normalQuizzes.map((q, idx) => `
    <div class="subtopic-card">
      <div class="subtopic-card-top">
        <span class="subtopic-title">${esc(q.title)}</span>
        <span class="status-badge mono">${q.totalMarks} Marks</span>
      </div>
      <div class="subtopic-meta mono">
        <span>${q.questionCount} Questions</span>
      </div>
      <button class="btn btn-primary btn-practice-start" data-idx="${idx}" style="margin-top: 14px; width: 100%;">Practice Questions ↑</button>
    </div>
  `).join('');

  return `
    <div class="topic-group-header">
      <h2 class="topic-group-title">Curated Topic Practice Sets</h2>
    </div>
    <div class="subtopic-grid">
      ${cardsHtml}
    </div>
  `;
}

export function wirePracticeSets(container, S, onStartQuiz) {
  container.querySelectorAll('.btn-practice-start').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      onStartQuiz(S.quizzes.normal[idx]);
    };
  });
}
