// Practice-mode mount — "Practice" buttons beside each quiz card start.
import { S } from './state.js';
import { api } from './api.js';
import { mountPractice } from '../../shared/js/mountPractice.js';

mountPractice({
  portal: 'physics',
  selector: '.btn-start-quiz',
  title: 'physics practice',
  collect: async (btn) => {
    const idx = parseInt(btn.getAttribute('data-idx'), 10);
    const meta = S.quizzes['past-paper']?.[idx];
    if (!meta?.file) return null;
    const qz = await api(`/api/quiz?category=past-paper&file=${encodeURIComponent(meta.file)}`);
    return qz?.questions || null;
  }
});
