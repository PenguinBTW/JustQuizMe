// Topic coverage block for the physics landing view — thin glue over the
// pure shared/topicCoverage module, reading S.scores + S.quizzes.
import { S, AQA_TOPICS, MIXED_UUID } from '../state.js';
import { esc } from '../utils.js';
import { topicCoverage, coverageHtml } from '../../../shared/js/topicCoverage.js';

export function coverageBlockHtml() {
  const quizzes = [...(S.quizzes.normal || []), ...(S.quizzes['past-paper'] || [])];
  // Synthesized-paper scores have no catalog entry: attribute them to the
  // topics selected in the synthesizer.
  const rows = topicCoverage(S.scores, quizzes, AQA_TOPICS, { mixedUuid: MIXED_UUID, mixedTopics: [...S.mixed.topics] });
  return `<div class="coverage-block"><h3 class="coverage-title">Topic coverage</h3>${coverageHtml(rows, esc)}</div>`;
}
