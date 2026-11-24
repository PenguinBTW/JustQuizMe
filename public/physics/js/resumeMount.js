// Quick-resume mount — auto-saves a resume anchor during runs and offers a
// "Resume · title" chip on the home (past) room.
import { S } from './state.js';
import { ak } from './utils.js';
import { beginRun } from './runner/assessment.js';
import { mountResume } from '../../shared/js/mountResume.js';

mountResume({
  portal: 'physics',
  isHome: () => S.room === 'past',
  host: () => document.getElementById('stage'),
  snapshot: () =>
    S.room === 'runner' && S.quiz && S.runMode !== 'explore'
      ? {
          portal: 'physics',
          kind: S.quizMeta?.virtual ? 'virtual' : 'file',
          category: S.quizMeta?.category || 'past-paper',
          quizFile: S.quizMeta?.file || '',
          quizUuid: S.quiz.uuid,
          quizVersion: S.quiz.version ?? 1,
          title: S.quiz.title || 'Untitled',
          qIndex: S.idx,
          total: S.quiz.questions.length,
          mode: S.runMode,
          order: S.quiz.questions.map(ak),
          answers: S.answers,
          elapsed: S.elapsed,
          startedAt: S.startedAt,
          spec: S.retrySpec,
          questions: S.quiz.questions,
          timeLimitMinutes: S.quiz.timeLimitMinutes ?? null,
          exam: !!S.quiz.exam
        }
      : null,
  isDone: () => S.room === 'results',
  resume: (a) => {
    const quizLike = {
      uuid: a.quizUuid,
      version: a.quizVersion ?? 1,
      title: a.title,
      timeLimitMinutes: a.timeLimitMinutes ?? null,
      exam: !!a.exam,
      questions: a.questions
    };
    beginRun({
      mode: a.mode === 'explore' ? 'explore' : 'quiz',
      quizLike,
      meta: { category: a.category, file: a.quizFile, virtual: a.kind === 'virtual' },
      resume: a,
      retrySpec: a.spec || { kind: 'mixed' }
    });
  }
});
