// Practice-mode mount — "Practice" buttons beside each quiz card start.
import { S } from './state.js';
import { api } from './api.js';
import { mountPractice } from '../../shared/js/mountPractice.js';

mountPractice({
  portal: 'maths',
  selector: '.btn-start-quiz, [data-quiz-file]',
  title: 'maths practice',
  collect: async (btn) => {
    if (btn.dataset.quizFile) {
      const [cat, file] = btn.dataset.quizFile.split('|');
      if (!cat || !file) return null;
      const qz = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(file)}`);
      return qz?.questions || null;
    }
    const idx = parseInt(btn.getAttribute('data-idx'), 10);
    const meta = S.quizzes['past-paper']?.[idx];
    if (!meta?.file) return null;
    const qz = await api(`/api/quiz?category=past-paper&file=${encodeURIComponent(meta.file)}`);
    return qz?.questions || null;
  }
});
