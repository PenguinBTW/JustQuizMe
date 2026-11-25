// Flag glue — injects a ⚑ issue-flag button into the runner chrome next to
// the bookmark star. Posts to /api/<portal>/flags; one flat list per data dir.
import { attachFlagButton } from './flags.js';

export function registerFlagButton({ S, portal, apiBase }) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const inject = () => {
    const cluster = document.querySelector('.q-chrome .chrome-cluster') || document.querySelector('.q-chrome');
    if (!cluster || cluster.querySelector('.qflag-btn')) return;
    // the runner chrome can linger in the DOM after returning to a list view —
    // only inject while the runner is the active room, or a report filed from
    // the list would attach itself to the last-viewed question
    if (S.room !== 'runner') return;
    const q = S.quiz && S.quiz.questions && S.quiz.questions[S.idx];
    if (!q) return;
    attachFlagButton(cluster, {
      portal,
      apiBase,
      questionOf: () => {
        const cur = S.quiz && S.quiz.questions[S.idx];
        if (!cur) return null;
        return { id: cur._origQid || cur.id, topic: cur.topic, _srcFile: cur._srcFile || (S.quizMeta && S.quizMeta.file) || '' };
      },
    });
  };
  const observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  inject();
}
