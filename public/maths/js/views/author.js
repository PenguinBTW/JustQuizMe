// Author tab — structured question authoring studio.
import { S } from '../state.js';
import { $ } from '../utils.js';
import { roomNav, wireRoomNav } from '../navigation.js';
import { mountAuthorStudio } from '../../../shared/js/authorStudio.js';

export function renderAuthor() {
  $('#stage').innerHTML = `
    ${roomNav('author')}
    <div class="card" style="padding:20px 26px;">
      <h2 class="serif" style="font-size:24px; margin-bottom:4px;">Question Authoring Studio</h2>
      <p style="font-size:13px; color:var(--ink-secondary); margin-bottom:16px;">
        Author schema-valid questions with examiner feedback, preview as a student, save into a bank in questions/normal — validated again server-side, written atomically.
      </p>
      <div id="authorHost"></div>
    </div>`;
  wireRoomNav();
    // refresh the quiz catalogue when a bank save lands so the new/edited
  // bank appears in Practice without a full reload
  if (!window._jqmBankSavedWired) {
    window._jqmBankSavedWired = true;
    window.addEventListener('jqm-bank-saved', async () => {
      try {
        const { api } = await import('../api.js');
        S.quizzes = await api('/api/quizzes');
      } catch {}
    });
  }
  mountAuthorStudio(document.getElementById('authorHost'), { portal: 'maths' });
}
