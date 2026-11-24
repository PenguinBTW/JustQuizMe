// Cross-subject overview aggregation — pure functions, no DOM.
// Input: { cs: [...scores], maths: [...], physics: [...] } raw score histories.
// Mastery math comes from the shared mastery module — same model as the
// per-portal dashboards, so numbers agree with what students see there.
import { computeMastery } from './mastery.js';
import { questionStats } from './progressMath.js';

const DAY = 86400000;

// topics on score entries are stored directly (s.topics) — the launchpad has
// no quiz catalogue, so resolution is the honest direct-read subset.
function directTopics(s) {
  try {
    const t = s && Array.isArray(s.topics) ? s.topics.filter(x => typeof x === 'string' && x.trim()) : [];
    return t.length ? t : (s && typeof s.topic === 'string' && s.topic.trim() ? [s.topic] : []);
  } catch { return []; }
}

export function subjectSummary(scores, now = Date.now()) {
  const list = (Array.isArray(scores) ? scores : []).filter(s => s && typeof s === 'object');
  const rows = computeMastery(list, directTopics, now);
  const practiced = rows.filter(r => r.practiced !== false && (r.mastery != null));
  const mean = practiced.length ? practiced.reduce((s, r) => s + r.mastery, 0) / practiced.length : null;
  const weakCount = rows.filter(r => r.weak).length;
  const qs = questionStats(list);
  const last = list.length ? list.reduce((a, b) => {
    try { return new Date(a.date) > new Date(b.date) ? a : b; } catch { return a; }
  }) : null;
  return {
    meanMastery: mean,
    weakCount,
    topicsPracticed: practiced.length,
    questionsAttempted: qs.attempted,
    runs: list.length,
    lastActive: last ? last.date : null,
  };
}

// Cross-subject "what needs attention": weakest topics across all subjects,
// weakest first. Unpracticed topics can't be ranked (no evidence) — excluded.
export function attentionList(bySubject, now = Date.now(), limit = 5) {
  const out = [];
  for (const [subject, scores] of Object.entries(bySubject || {})) {
    const rows = computeMastery((Array.isArray(scores) ? scores : []).filter(s => s && typeof s === 'object'), directTopics, now);
    for (const r of rows) {
      if (r.mastery == null) continue;
      out.push({ subject, topic: r.topic, mastery: r.mastery, weak: !!r.weak });
    }
  }
  return out.sort((a, b) => a.mastery - b.mastery).slice(0, limit);
}

// Recent activity across subjects, newest first, flashcard sessions labeled honestly.
export function recentActivity(bySubject, limit = 6) {
  const out = [];
  for (const [subject, scores] of Object.entries(bySubject || {})) {
    for (const s of (Array.isArray(scores) ? scores : [])) {
      if (!s || typeof s !== 'object') continue;
      let ts = 0;
      try { ts = new Date(s.date).getTime(); } catch { continue; }
      if (!Number.isFinite(ts)) continue;
      out.push({
        subject, ts,
        title: typeof s.title === 'string' ? s.title : (typeof s.quizTitle === 'string' ? s.quizTitle : 'Assessment'),
        score: +s.score || 0, total: +s.total || 0,
        exam: !!s.exam, flashcard: !!s.flashcard,
      });
    }
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
