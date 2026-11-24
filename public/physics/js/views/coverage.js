// Topic coverage block for the physics landing view — thin glue over the
// pure shared/topicCoverage module, reading S.scores + S.quizzes.
import { S, AQA_TOPICS } from '../state.js';
import { esc } from '../utils.js';
import { topicCoverage, coverageHtml } from '../../../shared/js/topicCoverage.js';

export function coverageBlockHtml() {
  const quizzes = [...(S.quizzes.normal || []), ...(S.quizzes['past-paper'] || [])];
  const rows = topicCoverage(S.scores, quizzes, AQA_TOPICS);
  return `<div class="coverage-block"><h3 class="coverage-title">Topic coverage</h3>${coverageHtml(rows, esc)}</div>`;
}
