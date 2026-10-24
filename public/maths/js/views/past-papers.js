// Mathematics Past Papers View
import { esc } from '../../../../shared/js/utils.js';

export function renderPastPapers(S, onStartQuiz, onStartExam, onOpenSynth) {
  const quizzes = S.quizzes['past-paper'] || [];

  const cardsHtml = quizzes.map((q, idx) => `
    <div class="subtopic-card" data-idx="${idx}">
      <div class="subtopic-card-top">
        <span class="subtopic-title">${esc(q.title)}</span>
        <span class="status-badge mono">${q.totalMarks} Marks</span>
      </div>
      <div class="subtopic-meta mono">
        <span>${q.questionCount} Questions</span>
        <span>${q.board || 'OCR H240'}</span>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button class="btn btn-start-quiz" data-idx="${idx}" style="flex: 1; padding: 6px 10px; font-size: 12px;">Quiz ↑</button>
        <button class="btn btn-primary btn-start-exam" data-idx="${idx}" style="flex: 1; padding: 6px 10px; font-size: 12px;">Exam ⏱</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="topic-group-header">
      <div>
        <h2 class="topic-group-title">Official Past Papers (Pure, Stats &amp; Mechanics)</h2>
        <p style="font-size: 13px; color: var(--ink-secondary); margin-top: 2px;">Authentic OCR examination series with CAS mark equivalence.</p>
      </div>
      <button class="btn btn-primary" id="btnOpenCustomSynth">Synthesize Custom Paper ↓</button>
    </div>

    <div class="subtopic-grid">
      ${cardsHtml}
    </div>
  `;
}

export function wirePastPapers(container, S, onStartQuiz, onStartExam, onOpenSynth) {
  container.querySelectorAll('.btn-start-quiz').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      onStartQuiz(S.quizzes['past-paper'][idx]);
    };
  });

  container.querySelectorAll('.btn-start-exam').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      onStartExam(S.quizzes['past-paper'][idx]);
    };
  });

  const synthBtn = container.querySelector('#btnOpenCustomSynth');
  if (synthBtn) synthBtn.onclick = () => onOpenSynth();
}
