// Weakest-topics panel mount for the maths practice view.
import { S } from './state.js';
import { esc, normT } from './utils.js';
import { topicAccuracy, pickWeakest } from '../../shared/js/weakestTopics.js';
import { OCR_MATHS_TOPIC_SPECS } from './state.js';
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

// Generated runs (topic synth quizzes) all share MIXED_UUID, so the manifest
// lookup misses them; their title is "<topic> · N-mark quiz", so recover the
// topic from the leading segment when it names a known topic.
function titleTopicHint(entry) {
  const head = String(entry && entry.quizTitle || '').split(' · ')[0].trim();
  return head && OCR_MATHS_TOPIC_SPECS.some(s => normT(s.topic) === normT(head)) ? [head] : null;
}

function topicIndex(topic) {
  for (const [key, c] of S._topicCache || []) {
    if (key.startsWith('t') && c && c.t && normT(c.t.topic) === normT(topic)) {
      // startTopicQuiz silently returns on an empty pool — only enable the
      // button when the topic actually has questions to draw from.
      return c.all && c.all.length ? +key.slice(1) : -1;
    }
  }
  return -1;
}

export function weakestPanelHtml() {
  const rows = pickWeakest(topicAccuracy(S.scores, quizTopicMap(), titleTopicHint));
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
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">your scores on sets covering each topic</span>
    </div>
    <ul class="weak-list">${items}</ul>
  </div>`;
}

export function wireWeakestPanel() {
  document.querySelectorAll('[data-weak-topic]').forEach(b => {
    b.onclick = () => {
      const ti = topicIndex(b.dataset.weakTopic);
      if (ti >= 0) {
        startTopicQuiz(ti, false);
        // startTopicQuiz routes exits to Past Papers; this panel lives on
        // Topic Sets, so send the student back here instead.
        S.returnRoom = 'practice';
      }
    };
  });
}
