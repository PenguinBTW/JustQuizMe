// Weakest-topics panel mount for the maths practice view.
import { S } from './state.js';
import { esc, normT } from './utils.js';
import { topicAccuracy, pickWeakest } from '../../shared/js/weakestTopics.js';
import { startTopicQuiz } from './runner/starters.js';

function quizTopicMap() {
  const map = {};
  for (const list of Object.values(S.quizzes || {})) {
    for (const m of list || []) {
      if (m && m.uuid && Array.isArray(m.topics) && m.topics.length) map[m.uuid] = m.topics;
    }
  }
  return map;
}

function topicIndex(topic) {
  for (const [key, c] of S._topicCache || []) {
    if (key.startsWith('t') && c && c.t && normT(c.t.topic) === normT(topic)) {
      return +key.slice(1);
    }
  }
  return -1;
}

export function weakestPanelHtml() {
  const rows = pickWeakest(topicAccuracy(S.scores, quizTopicMap()));
  if (!rows.length) return '';
  const items = rows.map(r => {
    const pct = Math.round(r.accuracy * 100);
    return `<li class="weak-row">
      <span class="weak-topic">${esc(r.topic)}</span>
      <span class="mono weak-acc ${pct < 50 ? 'weak-low' : ''}">${pct}% · ${r.scored}/${r.total} marks</span>
      <button class="btn-ghost mono weak-start" data-weak-topic="${esc(r.topic)}" ${topicIndex(r.topic) < 0 ? 'disabled' : ''}>Practice this →</button>
    </li>`;
  }).join('');
  return `<div class="card weak-panel">
    <div class="weak-head">
      <h3 class="serif">Weakest Topics</h3>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">ranked by your scored accuracy</span>
    </div>
    <ul class="weak-list">${items}</ul>
  </div>`;
}

export function wireWeakestPanel() {
  document.querySelectorAll('[data-weak-topic]').forEach(b => {
    b.onclick = () => {
      const ti = topicIndex(b.dataset.weakTopic);
      if (ti >= 0) startTopicQuiz(ti, false);
    };
  });
}
