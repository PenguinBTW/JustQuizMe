// Physics portal Export CSV mount — injects the button into the Stats view.
// Self-initializing on import; downloads data/scores.json as an RFC-4180 CSV.
import { S } from './state.js';
import { $ } from './utils.js';
import { mountCsvExport } from '../../shared/js/exportCsv.js';

function uuidIndex() {
  const idx = {};
  for (const list of [S.quizzes.normal, S.quizzes['past-paper']]) {
    for (const m of list || []) {
      if (m.uuid && Array.isArray(m.topics) && m.topics.length) idx[m.uuid] = m.topics;
      }
  }
  return idx;
}

mountCsvExport({
  portal: 'physics',
  stage: $('#stage'),
  getScores: () => S.scores || [],
  uuidIndex
});
