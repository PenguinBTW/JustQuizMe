// Computer Science Practice Sets Room View
import { S } from '../state.js';
import { $, esc, stampFile } from '../utils.js';
import { api } from '../api.js';
import { roomNav, wireRoomNav, resumeBannerHtml, wireResumeBanner } from '../navigation.js';
import { openExploreList } from './explore.js';
import { beginRun } from '../runner/assessment.js';

export function renderPractice() {
  const list = S.quizzes.normal || [];
  $('#stage').innerHTML = `
    ${resumeBannerHtml()}
    ${roomNav('practice')}
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${list.map(q => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:20px;">${q.icon || '💻'}</span>
              <span class="serif" style="font-size:22px; font-weight:600;">${esc(q.title)}</span>
              <span class="pill accent">${esc(q.board || 'OCR H446')}</span>
            </div>
            <div class="mono" style="font-size:12px; color:var(--ink-muted);">
              ${q.questionCount} Questions · ${q.totalMarks} Marks · Topics: ${(q.topics || []).join(' · ')}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" data-explore-file="normal|${esc(q.file)}">Explore</button>
            <button class="btn" data-quiz-file="normal|${esc(q.file)}">Quiz ↑</button>
            <button class="btn btn-primary" data-exam-file="normal|${esc(q.file)}">Exam ⏱</button>
          </div>
        </div>
      `).join('') || '<p class="mono" style="color:var(--ink-muted);">No practice sets found in questions/normal/</p>'}
    </div>
  `;

  wireRoomNav();
  wireResumeBanner();

  document.querySelectorAll('[data-explore-file]').forEach(b => {
    b.onclick = async () => {
      const [cat, file] = b.dataset.exploreFile.split('|');
      const qz = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(file)}`);
      openExploreList(qz.title, (qz.topics || []).join(' · '), stampFile(qz), 'practice');
    };
  });

  document.querySelectorAll('[data-quiz-file]').forEach(b => {
    b.onclick = async () => {
      const [cat, file] = b.dataset.quizFile.split('|');
      const qz = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(file)}`);
      beginRun({ mode: 'quiz', quizLike: qz, meta: { category: cat, file } });
    };
  });

  document.querySelectorAll('[data-exam-file]').forEach(b => {
    b.onclick = async () => {
      const [cat, file] = b.dataset.examFile.split('|');
      const qz = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(file)}`);
      beginRun({ mode: 'exam', quizLike: qz, meta: { category: cat, file } });
    };
  });
}
