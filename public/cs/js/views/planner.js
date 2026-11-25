// Planner tab — backwards revision timetable from the exam date.
import { S } from '../state.js';
import { $ } from '../utils.js';
import { roomNav, wireRoomNav } from '../navigation.js';
import { mountPlanner } from '../../../shared/js/studyPlannerUi.js';
import { computeMastery } from '../../../shared/js/mastery.js';
import { dueReview } from '../../../shared/js/dueReview.js';
import { resolveScoreTopics, buildUuidIndex } from '../../../shared/js/masteryUi.js';

export function renderPlanner() {
  $('#stage').innerHTML = `
    ${roomNav('planner')}
    <div id="plannerRoot"></div>
  `;
  wireRoomNav();
  let rows = [];
  try {
    const masteryRows = computeMastery(S.scores, (s) => resolveScoreTopics(s, buildUuidIndex(S.quizzes))) || [];
    const due = dueReview(masteryRows) || [];
    const byTopic = {};
    for (const r of masteryRows) if (r && r.topic) byTopic[r.topic] = r;
    const dueByTopic = {};
    for (const d of due) if (d && d.topic) dueByTopic[d.topic] = d;
    rows = (S._topicData || []).map(t => t.topic).filter(Boolean).map(topic => {
      const m = byTopic[topic];
      const d = dueByTopic[topic];
      return {
        topic,
        mastery: m ? m.mastery : null,
        dueInDays: d ? (d.overdue ? 0 : Math.max(0, Math.round(d.daysDue || 0))) : null,
      };
    });
  } catch {}
  mountPlanner(document.getElementById('plannerRoot'), {
    subject: 'cs',
    masteryRows: rows,
    scoreEntries: S.scores || [],
  });
}
