// Computer Science Quiz Run Starters
import { S, MIXED_UUID } from '../state.js';
import { orderTypeShuffled } from '../utils.js';
import { mixedPool, pickForMode } from '../taxonomy.js';
import { beginRun } from './assessment.js';

// Exam pace → minutes per mark. null = untimed (opt-out of time pressure).
export function paceMinutesPerMark(pace) {
  const map = { untimed: null, relaxed: 1.5, standard: 1.07, strict: 0.9 };
  return pace in map ? map[pace] : 1.07;
}

export function startMixedRun(exam) {
  const pool = mixedPool();
  if (!pool.length) return alert('No questions found in chosen topics.');
  const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
  if (!set.length) return;
  beginRun({
    mode: exam ? 'exam' : 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `Synthesized Paper · ${tot}m (${set.length}Q)`,
      timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null
        ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace)))
        : null,
      untimed: paceMinutesPerMark(S.mixed.pace) == null,
      exam: !!exam,
      questions: set
    },
    meta: { category: 'normal', file: 'synthesized', virtual: true }
  });
}

export function startSubQuiz(topic, sub) {
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `${topic} · ${sub.name}`,
      timeLimitMinutes: null,
      questions: orderTypeShuffled(sub.questions)
    },
    meta: { category: 'normal', file: 'subtopic', virtual: true }
  });
}
