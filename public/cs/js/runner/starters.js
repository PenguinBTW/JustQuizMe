// Computer Science Quiz Run Starters
import { S, MIXED_UUID } from '../state.js';
import { orderTypeShuffled } from '../utils.js';
import { mixedPool, pickForMode } from '../taxonomy.js';
import { beginRun } from './assessment.js';

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
      timeLimitMinutes: exam ? Math.round(tot * 1.07) : null,
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
