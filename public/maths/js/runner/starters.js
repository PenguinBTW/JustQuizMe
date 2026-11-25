// Maths Quiz Run Starters
import { S, MIXED_UUID } from '../state.js';
import { orderTypeShuffled, stampFile } from '../utils.js';
import { api } from '../api.js';
import { ensurePastFull, buildCaches, topicData, topicDraft, topicAllQs, pickForMode, mixedPool } from '../taxonomy.js';
import { renderRoom } from '../navigation.js';
import { beginRun } from './assessment.js';
import { createSeries } from '../../../shared/js/mockSeries.js';


// Exam pace → minutes per mark. null = untimed (opt-out of time pressure).
export function paceMinutesPerMark(pace) {
  const map = { untimed: null, relaxed: 1.5, standard: 1.07, strict: 0.9 };
  return pace in map ? map[pace] : 1.07;
}

export function startMixedSel(exam) {
  const pool = mixedPool();
  if (!pool.length) return;
  const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
  if (!set.length) return;

  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `Mixed Mathematics · ${tot}m (${set.length}Q)`,
      timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace))) : null,
      exam: !!exam,
      questions: set
    },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: {
      kind: 'mixedsel',
      topics: [...S.mixed.topics],
      subs: [...S.mixed.subs],
      marks: S.mixed.m,
      mode: S.mixed.mode,
      exam: !!exam
    }
  });
}

export function startTopicQuiz(ti, exam) {
  const c = S._topicCache.get('t' + ti);
  if (!c) return;

  const m = S.topicModal && S.topicModal.ti === ti ? S.topicModal : null;
  const marks = m ? m.marks : topicDraft(c.t.topic, c.t.mmarks).marks;
  const mode = m ? m.mode : topicDraft(c.t.topic, c.t.mmarks).mode;
  const use = m && m.set ? m : (() => {
    const { set, tot } = pickForMode(c.all, mode, marks);
    return { set, tot };
  })();

  if (!use.set.length) return;

  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `${c.t.topic} · ${use.tot}-mark quiz`,
      timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(use.tot * paceMinutesPerMark(S.mixed.pace))) : null,
      exam: !!exam,
      questions: use.set
    },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'topic', topic: c.t.topic, marks, mode, exam: !!exam, pace: S.mixed.pace }
  });
}

export function startSubQuiz(topic, sub) {
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `${topic} · ${sub.name}`,
      timeLimitMinutes: null,
      questions: orderTypeShuffled(sub.questions)
    },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'sub', topic, subName: sub.name }
  });
}

export function beginFileRun(quiz, category, file, shuffleIt) {
  const stamped = stampFile(quiz);
  S.returnRoom = category === 'past-paper' ? 'past' : 'practice';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: quiz.uuid,
      version: quiz.version,
      title: quiz.title,
      timeLimitMinutes: quiz.timeLimitMinutes || null,
      questions: shuffleIt ? orderTypeShuffled(stamped) : stamped
    },
    meta: { category, file },
    retrySpec: { kind: 'file', category, file, shuffle: !!shuffleIt }
  });
}

export async function beginFileQuiz(category, file, shuffleIt, resume) {
  const quiz = await api(`/api/quiz?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
  if (resume) {
    const stamped = stampFile(quiz);
    S.returnRoom = category === 'past-paper' ? 'past' : 'practice';
    beginRun({
      mode: 'quiz',
      quizLike: {
        uuid: quiz.uuid,
        version: quiz.version,
        title: quiz.title,
        timeLimitMinutes: quiz.timeLimitMinutes || null,
        questions: stamped
      },
      meta: { category, file },
      resume,
      retrySpec: { kind: 'file', category, file, shuffle: category === 'past-paper' }
    });
    return;
  }
  beginFileRun(quiz, category, file, shuffleIt);
}

export async function retryRun() {
  const r = S.retrySpec;
  if (!r) {
    S.room = 'past';
    return renderRoom();
  }
  if (r.kind === 'topic') {
    await ensurePastFull();
    buildCaches();
    const t = topicData().find(x => x.topic === r.topic);
    if (!t) {
      S.room = 'past';
      return renderRoom();
    }
    S.topicDrafts[r.topic] = { marks: r.marks, mode: r.mode };
    const all = topicAllQs(t);
    const { set, tot } = pickForMode(all, r.mode, r.marks);
    if (!set.length) {
      S.room = 'past';
      return renderRoom();
    }
    S.returnRoom = 'past';
    beginRun({
      mode: 'quiz',
      quizLike: {
        uuid: MIXED_UUID,
        version: 1,
        title: `${r.topic} · ${tot}-mark quiz`,
        timeLimitMinutes: r.exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace))) : null,
        exam: !!r.exam,
        questions: set
      },
      meta: { category: 'past-paper', file: 'mixed', virtual: true },
      retrySpec: r
    });
    return;
  }
  if (r.kind === 'mixedsel') {
    await ensurePastFull();
    buildCaches();
    S.mixed.topics = new Set(r.topics || []);
    S.mixed.subs = new Set(r.subs || []);
    S.mixed.m = r.marks || 25;
    S.mixed.mode = r.mode || 'standard';
    S.mixed._init = true;
    const pool = mixedPool();
    if (!pool.length) {
      S.room = 'past';
      return renderRoom();
    }
    const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
    S.returnRoom = 'past';
    beginRun({
      mode: 'quiz',
      quizLike: {
        uuid: MIXED_UUID,
        version: 1,
        title: `Mixed Mathematics · ${tot}m (${set.length}Q)`,
        timeLimitMinutes: r.exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace))) : null,
        exam: !!r.exam,
        questions: set
      },
      meta: { category: 'past-paper', file: 'mixed', virtual: true },
      retrySpec: r
    });
    return;
  }
  if (r.kind === 'sub') {
    await ensurePastFull();
    buildCaches();
    const t = topicData().find(x => x.topic === r.topic);
    const g = t?.subs.find(s => s.name === r.subName);
    if (g) return startSubQuiz(r.topic, g);
    S.room = 'past';
    return renderRoom();
  }
  return beginFileQuiz(r.category, r.file, r.shuffle);
}

// Mock exam series — two papers back-to-back under fatigue. Papers build from
// the full topic pool; component-tagged banks split by component when possible.
export function startMockSeries({ breakMinutes = 10 } = {}) {
  const data = (typeof topicData === 'function' ? topicData() : (S._topicData || []));
  const allRaw = data.flatMap(t => (t.subs || []).flatMap(g => (g.questions || []).map(q => ({ ...q, _topic: q.topic || t.topic, _sub: g.name }))));
  // multi-tagged questions repeat across topics — dedupe by id so one
  // question can't land in both papers or score twice within one
  const seen = new Set();
  const all = allRaw.filter(q => { const k = q._key || (q._srcFile ? q._srcFile + ":" + q.id : null) || q.id || q.uuid || JSON.stringify(q).length + q.prompt; if (seen.has(k)) return false; seen.add(k); return true; });
  if (all.length < 8) return alert('Not enough questions in the bank to assemble a mock series.');
  const pace = paceMinutesPerMark(S.mixed.pace);
  const papers = [];
  const sets = [];
  const half = Math.ceil(all.length / 2);
  for (const [i, label] of [[0, 'Paper 1'], [1, 'Paper 2']]) {
    const slice = i === 0 ? all.slice(0, half) : all.slice(half);
    const poolMarks = slice.reduce((x, q) => x + (+q.marks || 0), 0);
    const target = Math.max(10, Math.min(60, poolMarks));
    const { set, tot } = pickForMode(slice, 'standard', target);
    if (!set.length) continue;
    papers.push({ key: `paper${i + 1}`, title: `Mock · ${label} (${tot} marks)`, totalMarks: tot, timeLimitMinutes: pace == null ? null : Math.max(5, Math.round(tot * pace)) });
    sets.push(set);
  }
  if (papers.length < 2) return alert('Could not assemble two papers.');
  // a series checkpoint shares the single save slot with ordinary quizzes —
  // preserve any in-progress save inside the series so it can be restored
  // when the series completes; warn before displacing it.
  const priorSeries = S.save && S.save.seriesContinuation ? (S.save.series || null) : null;
  const inherited = priorSeries && priorSeries.displacedSave ? priorSeries.displacedSave : null;
  if (S.save && !S.save.seriesContinuation) {
    const t = (S.save && S.save.title) || 'untitled session';
    // a displaced TIMED exam's deadline honestly keeps running while the series
    // is sat — the student must know before they trade their remaining time
    const clockNote = (S.save.exam && S.save.timeLimitMinutes) ? ' Its exam clock keeps running while you sit the series.' : '';
    if (!confirm('Starting this mock series will pause your saved session "' + t + '" — it is restored automatically when the series finishes.' + clockNote + ' Continue?')) return;
  }
  const series = createSeries(papers, { breakMinutes });
  // a replacement series inherits the displaced quiz from the checkpoint it
  // replaces — otherwise the paused session is lost without warning
  series.displacedSave = (S.save && !S.save.seriesContinuation) ? JSON.parse(JSON.stringify(S.save)) : (inherited ? JSON.parse(JSON.stringify(inherited)) : null);
  series._sets = sets;
  S.series = series;
  beginSeriesPaper();
}

export function beginSeriesPaper() {
  const series = S.series;
  if (!series) return;
  const i = series.index;
  const paper = series.papers[i];
  const set = series._sets[i];
  if (!paper || !set) return;
  S.returnRoom = 'past';
  beginRun({
    mode: 'exam',
    seriesRun: true,
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: paper.title,
      timeLimitMinutes: paper.timeLimitMinutes,
      untimed: paper.timeLimitMinutes == null,
      exam: true,
      questions: set,
    },
    meta: { category: 'past-paper', file: 'series', virtual: true },
  });
}
