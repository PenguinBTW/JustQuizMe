// Progress dashboard — thin portal wrapper over the shared progressView.
import { S } from '../state.js';
import { $ } from '../utils.js';
import { roomNav, wireRoomNav, renderRoom } from '../navigation.js';
import { progressHtml } from '../../../shared/js/progressView.js';
import { computeMastery, weakestTopics } from '../../../shared/js/mastery.js';
import { resolveScoreTopics, buildUuidIndex } from '../../../shared/js/masteryUi.js';

export function renderProgress() {
  const data = S._topicData || [];
  const knownTopics = data.filter(t => t.qcount > 0).map(t => t.topic);
  $('#stage').innerHTML = `
    ${roomNav('progress')}
    ${progressHtml({ scores: S.scores || [], quizzes: S.quizzes, knownTopics })}
  `;
  wireRoomNav();
  document.querySelectorAll('[data-progress-review]').forEach(b => {
    b.onclick = () => {
      const idx = buildUuidIndex(S.quizzes);
      const rows = computeMastery(S.scores, (s) => resolveScoreTopics(s, idx));
      const picks = weakestTopics(rows, knownTopics, 3);
      S.mixed.topics.clear();
      S.mixed.subs.clear();
      for (const pick of picks) {
        const t = data.find(x => x.topic === pick.topic);
        if (!t) continue;
        S.mixed.topics.add(t.topic);
        t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
      }
      S.room = 'past';
      renderRoom();
    };
  });
}
