// Bookmark glue — injects a ★ toggle into the runner chrome and launches
// bookmark-scoped runs. Storage stays server-side (same JSON convention as
// scores) via /api/bookmarks; all shapes come from shared/js/bookmarks.js.
import { S } from './state.js';
import { $ } from './utils.js';
import { api } from './api.js';
import { beginRun } from './runner/assessment.js';
import { stampFile } from './utils.js';
import {
  makeBookmark,
  bookmarkKey,
  isBookmarked,
  scopedQuizLike
} from '../../shared/js/bookmarks.js';

let cachedBookmarks = null;
let loadPromise = null;

export async function listBookmarks(force = false) {
  if (!force && cachedBookmarks) return cachedBookmarks;
  if (!loadPromise) {
    loadPromise = api('/api/bookmarks').catch(() => []);
  }
  cachedBookmarks = (await loadPromise) || [];
  loadPromise = null;
  return cachedBookmarks;
}

export async function toggleBookmark(q) {
  const b = makeBookmark(q, { ...S.quizMeta, uuid: S.quiz?.uuid, title: S.quizMeta?.title || S.quiz?.title }, S.idx);
  if (!b.file) return false;
  const r = await api('/api/bookmarks/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b)
  });
  cachedBookmarks = r.bookmarks || cachedBookmarks;
  return r.bookmarked;
}

export async function removeBookmark(key) {
  await api(`/api/bookmarks?key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => null);
  cachedBookmarks = (cachedBookmarks || []).filter(b => b.key !== key);
}

export async function launchBookmarkedRun(b) {
  const quiz = await api(`/api/quiz?category=${encodeURIComponent(b.category || 'normal')}&file=${encodeURIComponent(b.file)}`).catch(() => null);
  if (!quiz) return false;
  const stamped = stampFile(quiz);
  const like = scopedQuizLike(b, { ...quiz, questions: stamped });
  if (!like) return false;
  // Explore mode: unscored self-marked practice — a bookmark run must not post
  // a one-question score under the source quiz's id, delete an unrelated save,
  // or offer Save (resume would expand back to the whole file).
  S.exploreCtx = { title: like.title, sub: '1 bookmarked question', questions: like.questions, backRoom: 'practice' };
  S.returnRoom = 'practice';
  beginRun({
    mode: 'explore',
    quizLike: { ...like, uuid: null, version: null },
    meta: { category: b.category || 'normal', file: b.file, virtual: true },
    retrySpec: null
  });
  return true;
}

function currentBookmarkKey() {
  const q = S.quiz && S.quiz.questions && S.quiz.questions[S.idx];
  if (!q) return null;
  return bookmarkKey({
    category: q._srcCat || S.quizMeta?.category || '',
    file: q._srcFile || S.quizMeta?.file || '',
    qid: q._origQid || q.id
  });
}

async function syncStarBtn(btn) {
  const key = currentBookmarkKey();
  if (!key) return;
  const list = await listBookmarks();
  const on = isBookmarked(list, { key, qid: key.split('|')[2], file: key.split('|')[1], category: key.split('|')[0] });
  btn.textContent = on ? '★' : '☆';
  btn.title = on ? 'Remove bookmark' : 'Bookmark this question';
  btn.style.color = on ? 'var(--accent)' : '';
}

function injectStar() {
  const cluster = document.querySelector('.q-chrome .chrome-cluster');
  if (!cluster || document.getElementById('bmStarBtn')) return;
  // No resolvable source file (e.g. full-set Explore, virtual mixed runs) —
  // the bookmark couldn't be relaunched, so don't offer the star.
  const key = currentBookmarkKey();
  if (!key || key.split('|')[1] === '') return;
  const btn = document.createElement('button');
  btn.id = 'bmStarBtn';
  btn.className = 'btn-ghost mono';
  btn.style.fontSize = '13px';
  btn.textContent = '☆';
  btn.title = 'Bookmark this question';
  cluster.appendChild(btn);
  syncStarBtn(btn);
  btn.onclick = async () => {
    const q = S.quiz && S.quiz.questions[S.idx];
    if (!q) return;
    const on = await toggleBookmark(q);
    btn.textContent = on ? '★' : '☆';
    btn.style.color = on ? 'var(--accent)' : '';
  };
}

// The runner re-renders .q-chrome per question; observe and re-inject.
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(() => {
    if (document.querySelector('.q-chrome')) injectStar();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
