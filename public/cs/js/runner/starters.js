// Computer Science Quiz Run Starters
import { S, MIXED_UUID } from '../state.js';
import { orderTypeShuffled } from '../utils.js';
import { api } from '../api.js';
import { mixedPool, pickForMode } from '../taxonomy.js';
import { beginRun } from './assessment.js';
import { reviewQueue, planReviewRefs, resolveReviewDeck } from '../review.js';

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

async function fetchQuizForCategory(category, file) {
  if (category === 'past-paper' && S.pastFull[file]) return S.pastFull[file];
  const quiz = await api(`/api/quiz?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
  if (category === 'past-paper') S.pastFull[file] = quiz;
  return quiz;
}

// Review queue -> retry-spec deck of the questions the user still owes.
export async function startReviewRun(exam) {
  const refs = planReviewRefs(reviewQueue(), S.quizzes);
  return runReviewSpec({ kind: 'review', items: refs, exam: !!exam });
}

async function runReviewSpec(spec) {
  const { set, tot } = await resolveReviewDeck(spec.items, fetchQuizForCategory);
  if (!set.length) return alert('No questions found in the review queue.');
  S.returnRoom = 'history';
  beginRun({
    mode: spec.exam ? 'exam' : 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `Review Queue · ${tot}m (${set.length}Q)`,
      exam: !!spec.exam,
      questions: orderTypeShuffled(set)
    },
    meta: { category: 'normal', file: 'review', virtual: true },
    retrySpec: spec
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
