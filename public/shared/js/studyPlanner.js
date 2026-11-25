// Study planner — backwards-generated revision timetables from exam dates.
// Pure date/ordering logic, zero deps. The plan is a PROJECTION from current
// mastery, not a contract — it is regenerated, never edited.

export function dayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

export function daysBetween(a, b) {
  const da = new Date(dayKey(a)), db = new Date(dayKey(b));
  return Math.round((db - da) / 86400000);
}

// weight per topic: weaker mastery → more sessions. Never zero — even strong
// topics get light maintenance. Unpractised topics (mastery null) count weakest.
export function topicWeight(mastery) {
  const m = mastery == null ? 0 : mastery;
  return 0.25 + (1 - Math.max(0, Math.min(1, m)));
}

// spacing ladder: after a topic is first studied, repeat at widening intervals
export const SPACING_LADDER = [0, 1, 3, 7, 14, 21];

// generatePlan({ examDate, topics, startDate, sessionsPerDay })
// topics: [{topic, mastery (0-1|null), dueInDays (number|null)}]
// → { days: [{date, sessions: [{topic, kind, minutes, round}]}], examDate, truncated }
export function generatePlan({ examDate, topics, startDate = new Date(), sessionsPerDay = 2, minutesPerSession = 30 }) {
  const daysLeft = daysBetween(startDate, examDate);
  if (!topics || !topics.length || daysLeft < 1) return { days: [], examDate, truncated: daysLeft < 1 };

  // total weighted sessions that fit; every topic appears at least once if possible
  const totalSlots = daysLeft * sessionsPerDay;
  const weights = topics.map(t => ({ ...t, w: topicWeight(t.mastery) }));
  const wSum = weights.reduce((s, t) => s + t.w, 0);

  // desired session counts per topic, weighted, minimum 1 each when slots allow
  let counts = weights.map(t => Math.max(totalSlots >= topics.length ? 1 : 0, Math.round((t.w / wSum) * totalSlots)));
  // honest cap: massed daily practice of one topic is bad pedagogy — a topic
  // never gets more sessions than the spacing ladder usefully places
  counts = counts.map((c, i) => {
    const ladderFits = SPACING_LADDER.filter(g => g < daysLeft).length + 1;
    // strong topics need only maintenance, weak topics the full ladder —
    // cap proportionally to weight so the weighting survives the cap
    const maxW = Math.max(...weights.map(t => t.w));
    const scaledCap = Math.max(1, Math.round(ladderFits * (weights[i].w / maxW)));
    return Math.min(c, scaledCap);
  });
  // scale down if over budget, never below 1 unless slots < topics
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > totalSlots) {
    const maxI = counts.indexOf(Math.max(...counts));
    if (counts[maxI] <= 1) break;
    counts[maxI] -= 1;
    total -= 1;
  }

  // urgency for first session: due/overdue topics first, then weakest
  const order = weights.map((t, i) => ({ i, t }))
    .sort((a, b) => {
      const ad = a.t.dueInDays, bd = b.t.dueInDays;
      if (ad != null && bd != null && ad !== bd) return ad - bd;
      if (ad != null && bd == null) return -1;
      if (ad == null && bd != null) return 1;
      return b.t.w - a.t.w;
    });

  // place sessions day-by-day: first occurrence urgency-ordered in the first
  // days, repetitions spread by the spacing ladder working within daysLeft
  const days = [];
  for (let d = 0; d < daysLeft; d++) {
    const date = new Date(new Date(dayKey(startDate)).getTime() + d * 86400000);
    days.push({ date: dayKey(date), sessions: [] });
  }

  const placements = [];
  for (const { t } of order) {
    const idx = weights.findIndex(x => x.topic === t.topic);
    const n = counts[idx] || 0;
    if (!n) continue;
    // first session day: due topics land on/before their due day, weakest early
    let firstDay = 0;
    if (t.dueInDays != null) firstDay = Math.max(0, Math.min(daysLeft - 1, t.dueInDays));
    else firstDay = Math.min(daysLeft - 1, order.indexOf(order.find(o => o.t === t)) % Math.max(1, Math.ceil(daysLeft / 2)));
    for (let k = 0; k < n; k++) {
      const ladderGap = SPACING_LADDER[Math.min(k, SPACING_LADDER.length - 1)];
      let dayIdx = firstDay + (k === 0 ? 0 : ladderGap + (k >= SPACING_LADDER.length ? (k - SPACING_LADDER.length + 1) * 21 : 0));
      // compress: if beyond exam, pull back into remaining days
      if (dayIdx >= daysLeft) dayIdx = daysLeft - 1 - ((k - 1) % Math.max(1, Math.floor(daysLeft / 2)));
      if (dayIdx < 0) dayIdx = 0;
      placements.push({ topic: t.topic, dayIdx, round: k + 1, mastery: t.mastery });
    }
  }

  // final-week revision pass: the days before the exam are for review /
  // past-paper consolidation, weakest topics first — the ladder alone never
  // reaches them. Budget-honest: only as many as the week's slots allow.
  if (daysLeft >= 3) {
    const weakestFirst = [...order].sort((a, b) => b.t.w - a.t.w);
    let reviewDay = Math.max(0, daysLeft - 7);
    outer: for (const { t } of weakestFirst) {
      // don't review what was never studied this plan
      const studied = placements.some(pl => pl.topic === t.topic);
      if (!studied) continue;
      let d = reviewDay;
      while (d < daysLeft && days[d].sessions.length >= sessionsPerDay) d++;
      if (d >= daysLeft) break outer;
      days[d].sessions.push({ topic: t.topic, kind: 'review', minutes: minutesPerSession, round: 99 });
      reviewDay = d + 1;  // round-robin forward through the final week
    }
  }

  // distribute into days respecting sessionsPerDay; overflow spills forward
  placements.sort((a, b) => a.dayIdx - b.dayIdx);
  for (const p of placements) {
    let d = p.dayIdx;
    while (d < daysLeft && days[d].sessions.length >= sessionsPerDay) d++;
    if (d >= daysLeft) {
      d = p.dayIdx;
      while (d >= 0 && days[d].sessions.length >= sessionsPerDay) d--;
      if (d < 0) d = daysLeft - 1;
    }
    // kind: flashcards every 3rd occurrence of a topic, deep quiz otherwise;
    // final week before exam → review sessions
    const dayNum = d;
    const isFlashcard = p.round > 1 && p.round % 3 === 0;
    const isReview = daysLeft - dayNum <= 7 && p.round > 1;
    days[d].sessions.push({
      topic: p.topic,
      kind: isReview ? 'review' : isFlashcard ? 'flashcards' : 'quiz',
      minutes: minutesPerSession,
      round: p.round,
    });
  }
  for (const d of days) d.sessions.sort((a, b) => a.round - b.round);
  return { days, examDate: dayKey(examDate), truncated: false };
}

// completion: a session ticks off when a matching score entry exists that day
export function sessionDone(session, dateStr, scoreEntries) {
  const day = dayKey(dateStr);
  return (scoreEntries || []).some(e => {
    if (!e || !e.date) return false;
    if (dayKey(e.date) !== day) return false;
    if (session.kind === 'flashcards') {
      return (e.flashcard || e.type === 'flashcards') && (!session.topic || (e.topics || []).includes(session.topic) || (e.topic === session.topic));
    }
    return (e.topics || []).includes(session.topic);
  });
}

// planProgress(plan, scoreEntries) → {done, total, perDay}
export function planProgress(plan, scoreEntries) {
  let done = 0, total = 0;
  const perDay = (plan.days || []).map(d => {
    const sessions = d.sessions.map(s => ({ ...s, done: sessionDone(s, d.date, scoreEntries) }));
    done += sessions.filter(s => s.done).length;
    total += sessions.length;
    return { ...d, sessions };
  });
  return { done, total, perDay };
}

// exam-date store — localStorage, shared across the whole origin so the
// launchpad reads all three subjects' dates
const STORE_KEY = 'jqm-exam-dates-v1';
export function loadExamDates(storage) {
  try { return JSON.parse((storage || localStorage).getItem(STORE_KEY) || '{}'); } catch { return {}; }
}
export function saveExamDate(subject, dateStr, storage) {
  const all = loadExamDates(storage);
  if (dateStr) all[subject] = dateStr; else delete all[subject];
  try { (storage || localStorage).setItem(STORE_KEY, JSON.stringify(all)); } catch {}
  return all;
}
