// Spaced-repetition due-review computation — pure functions, no DOM.
//
// Honest model, documented: mastery decays approximately as m(t) = m · 2^(-t/14)
// (the same 14-day half-life the mastery model uses for recency weighting —
// the projection treats current mastery as concentrated at the most recent
// practice, which slightly overestimates retention for topics practiced in
// several spaced sessions. That's the honest conservative direction: topics
// come due a little early rather than a little late).
import { HALF_LIFE_DAYS, WEAK_THRESHOLD } from './mastery.js';

// Project days until a topic's mastery decays below the weak threshold.
// Negative = already below (overdue). 0 mastery never becomes due — nothing to forget.
export function daysUntilDue(mastery, now = Date.now()) {
  if (!(mastery > 0)) return null;
  if (mastery <= WEAK_THRESHOLD) {
    // already weak: how overdue? invert the decay — how long since it crossed.
    return -HALF_LIFE_DAYS * Math.log2(WEAK_THRESHOLD / mastery) || 0;
  }
  return HALF_LIFE_DAYS * Math.log2(mastery / WEAK_THRESHOLD);
}

// dueReview(masteryRows, now) → ordered urgency list.
// rows: computeMastery output. Returns topics with {topic, mastery, daysDue,
// overdue, label} — overdue first (most overdue first), then due-soonest.
// Topics with no measured mastery are excluded: no evidence, no schedule.
export function dueReview(rows, { dueWithinDays = 7 } = {}) {
  const out = [];
  for (const r of rows || []) {
    if (r.mastery == null || !(r.mastery > 0)) continue;
    // retention NOW = measured mastery decayed by time since last practice —
    // mastery itself is a static measurement, memory is what fades.
    const age = typeof r.daysSince === 'number' && r.daysSince > 0 ? r.daysSince : 0;
    const retention = r.mastery * Math.pow(0.5, age / HALF_LIFE_DAYS);
    if (!(retention > 0)) continue;
    const days = daysUntilDue(retention);
    if (days == null) continue;
    const overdue = days <= 0;
    const dueSoon = !overdue && days <= dueWithinDays;
    if (!overdue && !dueSoon) continue;
    out.push({
      topic: r.topic,
      mastery: retention,
      measuredMastery: r.mastery,
      daysDue: days,
      overdue,
      label: overdue
        ? (days <= -1 ? `overdue ${Math.max(1, Math.round(-days))}d` : 'due today')
        : (days < 1 ? 'due today' : `due in ${Math.round(days)}d`),
    });
  }
  return out.sort((a, b) => a.daysDue - b.daysDue);
}

export function dueCount(rows, opts) {
  return dueReview(rows, opts).length;
}
