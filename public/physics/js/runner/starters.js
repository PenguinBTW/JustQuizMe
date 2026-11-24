// Physics Quiz Run Starters
import { S, MIXED_UUID } from '../state.js';
import { orderTypeShuffled, stampFile, stampPool } from '../utils.js';
import { api } from '../api.js';
import { ensurePastFull, buildCaches, topicData, topicDraft, topicAllQs, pickForMode, mixedPool } from '../taxonomy.js';
import { renderRoom } from '../navigation.js';
import { beginRun } from './assessment.js';


// Exam pace → minutes per mark. null = untimed (opt-out of time pressure).
export function paceMinutesPerMark(pace) {
  const map = { untimed: null, relaxed: 1.5, standard: 1.07, strict: 0.9 };
  return pace in map ? map[pace] : 1.07;
}

export function startMixedSel(exam){
  const pool = mixedPool();
  if (!pool.length) return;
  const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
  if (!set.length) return;
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: { uuid: MIXED_UUID, version: 1, title: `Mixed · ${tot}m (${set.length}Q)`, timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace))) : null, exam: !!exam, questions: set },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'mixedsel', topics: [...S.mixed.topics], subs: [...S.mixed.subs], marks: S.mixed.m, mode: S.mixed.mode, exam: !!exam },
  });
}

export function startTopicQuiz(ti, exam){
  const c = S._topicCache.get('t' + ti);
  if (!c) return;
  const m = S.topicModal && S.topicModal.ti === ti ? S.topicModal : null;
  const marks = m ? m.marks : topicDraft(c.t.topic, c.t.mmarks).marks;
  const mode = m ? m.mode : topicDraft(c.t.topic, c.t.mmarks).mode;
  const use = (m && m.set) ? m : (() => { const { set, tot } = pickForMode(c.all, mode, marks); return { set, tot }; })();
  if (!use.set.length) return;
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: { uuid: MIXED_UUID, version: 1, title: `${c.t.topic} · ${use.tot}-mark quiz`, timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null ? Math.max(5, Math.round(use.tot * paceMinutesPerMark(S.mixed.pace))) : null, exam: !!exam, questions: use.set },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'topic', topic: c.t.topic, marks, mode, exam: !!exam, pace: S.mixed.pace },
  });
}

export async function startMixedQuiz(){
  await ensurePastFull();
  buildCaches();
  const pool = [];
  for (const m of S.quizzes['past-paper']){
    const quiz = S.pastFull[m.file];
    if (quiz) pool.push(...stampPool(quiz, m.file));
  }
  if (!pool.length) return;
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: { uuid: MIXED_UUID, version: 1, title: 'Mixed Past Papers', timeLimitMinutes: null, questions: orderTypeShuffled(pool) },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'mixed', pace: S.mixed.pace },
  });
}

export function startSubQuiz(topic, sub){
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: { uuid: MIXED_UUID, version: 1, title: `${topic} · ${sub.name}`, timeLimitMinutes: null, questions: orderTypeShuffled(sub.questions) },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: { kind: 'sub', topic, subName: sub.name },
  });
}

export function beginFileRun(quiz, category, file, shuffleIt){
  const stamped = stampFile(quiz);
  S.returnRoom = category === 'past-paper' ? 'past' : 'practice';
  beginRun({
    mode: 'quiz',
    quizLike: { uuid: quiz.uuid, version: quiz.version, title: quiz.title, timeLimitMinutes: quiz.timeLimitMinutes || null, questions: shuffleIt ? orderTypeShuffled(stamped) : stamped },
    meta: { category, file },
    retrySpec: { kind: 'file', category, file, shuffle: !!shuffleIt },
  });
}

export async function beginFileQuiz(category, file, shuffleIt, resume){
  const quiz = await api(`/api/quiz?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
  if (resume){
    const stamped = stampFile(quiz);
    S.returnRoom = category === 'past-paper' ? 'past' : 'practice';
    beginRun({
      mode: 'quiz',
      quizLike: { uuid: quiz.uuid, version: quiz.version, title: quiz.title, timeLimitMinutes: quiz.timeLimitMinutes || null, questions: stamped },
      meta: { category, file },
      resume,
      retrySpec: { kind: 'file', category, file, shuffle: category === 'past-paper' },
    });
    return;
  }
  beginFileRun(quiz, category, file, shuffleIt);
}

export async function retryRun(){
  const r = S.retrySpec;
  if (!r){ S.room = 'past'; return renderRoom(); }
  if (r.kind === 'mixed') return startMixedQuiz();
  if (r.kind === 'topic'){
    await ensurePastFull(); buildCaches();
    const t = topicData().find(x => x.topic === r.topic);
    if (!t){ S.room = 'past'; return renderRoom(); }
    S.topicDrafts[r.topic] = { marks: r.marks, mode: r.mode };
    const all = topicAllQs(t);
    const { set, tot } = pickForMode(all, r.mode, r.marks);
    if (!set.length){ S.room = 'past'; return renderRoom(); }
    S.returnRoom = 'past';
    beginRun({
      mode: 'quiz',
      quizLike: { uuid: MIXED_UUID, version: 1, title: `${r.topic} · ${tot}-mark quiz`, timeLimitMinutes: r.exam && paceMinutesPerMark(r.pace ?? S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(r.pace ?? S.mixed.pace))) : null, exam: !!r.exam, questions: set },
      meta: { category: 'past-paper', file: 'mixed', virtual: true },
      retrySpec: r,
    });
    return;
  }
  if (r.kind === 'mixedsel'){
    await ensurePastFull(); buildCaches();
    S.mixed.topics = new Set(r.topics || []);
    S.mixed.subs = new Set(r.subs || []);
    S.mixed.m = r.marks || 20; S.mixed.mode = r.mode || 'standard'; S.mixed._init = true;
    const pool = mixedPool();
    if (!pool.length){ S.room = 'past'; return renderRoom(); }
    const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
    S.returnRoom = 'past';
    beginRun({
      mode: 'quiz',
      quizLike: { uuid: MIXED_UUID, version: 1, title: `Mixed · ${tot}m (${set.length}Q)`, timeLimitMinutes: r.exam && paceMinutesPerMark(r.pace ?? S.mixed.pace) != null ? Math.max(5, Math.round(tot * paceMinutesPerMark(r.pace ?? S.mixed.pace))) : null, exam: !!r.exam, questions: set },
      meta: { category: 'past-paper', file: 'mixed', virtual: true },
      retrySpec: r,
    });
    return;
  }
  if (r.kind === 'sub'){
    await ensurePastFull(); buildCaches();
    const t = topicData().find(x => x.topic === r.topic);
    const g = t?.subs.find(s => s.name === r.subName);
    if (g) return startSubQuiz(r.topic, g);
    S.room = 'past'; return renderRoom();
  }
  return beginFileQuiz(r.category, r.file, r.shuffle);
}
