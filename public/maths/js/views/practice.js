// Maths Practice Sets Room View
import { S } from '../state.js';
import { $, esc, stampFile } from '../utils.js';
import { api, bestFor } from '../api.js';
import { roomNav, wireRoomNav, renderRoom } from '../navigation.js';
import { openExploreList } from './explore.js';
import { beginFileQuiz } from '../runner/starters.js';
import { listBookmarks, removeBookmark, launchBookmarkedRun } from '../bookmarkGlue.js';

function bookmarkedSection(bookmarks) {
  if (!bookmarks.length) return '';
  const items = bookmarks.map(b => `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:12px 0; border-top:1px solid var(--border);">
      <button class="btn-ghost" data-bm-open="${esc(b.key)}" style="text-align:left; flex:1; padding:0;">
        <div class="mono" style="font-size:12px; color:var(--accent); font-weight:600;">${esc(b.quizTitle || b.file)}</div>
        <div style="font-size:13.5px; margin-top:4px;">${esc(b.snippet || b.qid)}</div>
        ${b.topic ? `<span class="pill" style="margin-top:6px; display:inline-block;">${esc(b.topic)}</span>` : ''}
      </button>
      <button class="btn-ghost mono" data-bm-remove="${esc(b.key)}" title="Remove bookmark" style="font-size:13px;">✕</button>
    </div>
  `).join('');
  return `
    <div class="card" style="margin-bottom:18px;">
      <h2 class="serif" style="font-size:24px; margin-bottom:4px;">Bookmarked</h2>
      <p class="mono" style="font-size:12px; color:var(--ink-muted); margin-bottom:8px;">${bookmarks.length} starred question${bookmarks.length === 1 ? '' : 's'} · click to run</p>
      ${items}
    </div>
  `;
}

export function renderPractice() {
  const cards = S.quizzes.normal.map(m => {
    const best = bestFor(m.uuid);
    const mine = S.scores.filter(s => s.quizUuid === m.uuid);
    return `
      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span class="pill">OCR H240</span>
            <span class="pill mono">${esc(m.file)}</span>
          </div>
          ${
            best
              ? `<span class="pill green">Best: ${Math.round((best.score / (best.total || m.totalMarks)) * 100)}% (${best.score}/${best.total ?? m.totalMarks})</span>`
              : ''
          }
        </div>
        <h2 class="serif" style="font-size: 32px; margin-bottom: 8px;">${esc(m.title)}</h2>
        <p style="color: var(--ink-secondary); margin-bottom: 24px;">
          ${m.questionCount} curated questions (${m.totalMarks} marks)${
      (m.topics || []).length ? ' covering ' + esc(m.topics.join(', ')) + '.' : '.'
    }
        </p>
        <div style="display:flex; align-items:center; justify-content:space-between; padding-top:20px; border-top:1px solid var(--border); flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
            <span class="mono" style="font-size:12.5px; color:var(--ink-muted);">${m.questionCount} Questions · ${m.totalMarks} Marks · v${m.version ?? 1}</span>
            ${
              mine.length
                ? `<button class="btn-ghost mono" style="font-size:12px;" data-practice-history="${esc(m.uuid)}">View Set History (${mine.length}) →</button>`
                : ''
            }
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn" data-practice-explore="${esc(m.file)}">Explore Unscored</button>
            <button class="btn btn-primary" data-practice-start="${esc(m.file)}">Start Scored Quiz</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="card"><p style="color:var(--ink-secondary);">No practice sets yet - add JSON to questions/normal/.</p></div>';

  $('#stage').innerHTML = `${roomNav('practice')}<div id="bmSection"></div>${cards}`;
  wireRoomNav();
  listBookmarks().then(bs => {
    const el = document.getElementById('bmSection');
    if (el) el.innerHTML = bookmarkedSection(bs);
    document.querySelectorAll('[data-bm-open]').forEach(b => {
      b.onclick = () => {
        const bm = bs.find(x => x.key === b.dataset.bmOpen);
        if (bm) launchBookmarkedRun(bm);
      };
    });
    document.querySelectorAll('[data-bm-remove]').forEach(b => {
      b.onclick = async () => {
        await removeBookmark(b.dataset.bmRemove);
        renderPractice();
      };
    });
  });
  document.querySelectorAll('[data-practice-history]').forEach(b => {
    b.onclick = () => {
      S.room = 'history';
      S.historySrc = 'practice';
      renderRoom();
    };
  });
  document.querySelectorAll('[data-practice-explore]').forEach(b => {
    b.onclick = () => exploreNormalFile(b.dataset.practiceExplore);
  });
  document.querySelectorAll('[data-practice-start]').forEach(b => {
    b.onclick = () => beginFileQuiz('normal', b.dataset.practiceStart, false);
  });
}

export async function exploreNormalFile(file) {
  const quiz = await api(`/api/quiz?category=normal&file=${encodeURIComponent(file)}`);
  openExploreList(quiz.title, `${quiz.questions.length} questions · practice, no score`, stampFile(quiz), 'practice');
}

export async function exploreFullFile(category, file) {
  const quiz = await api(`/api/quiz?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
  openExploreList(quiz.title, `${quiz.questions.length} questions · practice, no score`, stampFile(quiz), 'past');
}
