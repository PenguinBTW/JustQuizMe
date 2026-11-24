// Practice-mode mount — "Practice" buttons beside each quiz-file start.
import { api } from './api.js';
import { mountPractice } from '../../shared/js/mountPractice.js';

mountPractice({
  portal: 'cs',
  selector: '[data-quiz-file]',
  title: 'cs practice',
  collect: async (btn) => {
    const [cat, file] = (btn.dataset.quizFile || '').split('|');
    if (!cat || !file) return null;
    const qz = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(file)}`);
    return qz?.questions || null;
  }
});
