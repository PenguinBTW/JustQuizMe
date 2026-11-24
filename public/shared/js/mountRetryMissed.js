// Self-mounting "Retry missed (n)" button for the run-results screen.
// Each portal registers once with its own state store and run starter;
// a MutationObserver on #stage watches for the results card so no results
// markup files need edits. Hidden entirely when nothing was missed.

import { collectMissed, buildRetrySpec, questionsFromRefs } from './missedRetry.js';

// Results-screen action buttons per portal (maths, physics, cs).
const ANCHOR_SELECTOR = '#retryResBtn, #retryBtn, #finishReturnBtn';
const BTN_ID = 'retryMissedBtn';

// registerRetryMissed({ S, beginRun, keyOf })
//   S        — portal state store (quiz, answers, retrySpec)
//   beginRun — portal run starter ({mode, quizLike, meta, retrySpec})
//   keyOf    — the answer-key fn the results screen uses (`ak`)
export function registerRetryMissed({ S, beginRun, keyOf }) {
  const stage = document.getElementById('stage') || document.body;

  const tryMount = () => {
    const anchor = stage.querySelector?.(ANCHOR_SELECTOR);
    const existing = stage.querySelector?.(`#${BTN_ID}`);
    // the anchor buttons only exist on the results screen (cs never sets
    // S.room='results', so the anchors — not S.room — are the discriminator)
    if (!anchor || !S.quiz?.questions?.length) {
      return;
    }
    const refs = collectMissed(S.quiz.questions, S.answers, keyOf);
    if (!refs.length) { existing?.remove(); return; }
    if (existing) {
      const label = `Retry missed (${refs.length})`;
      if (existing.textContent !== label) existing.textContent = label;
      return;
    }
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = anchor.className || 'btn';
    btn.textContent = `Retry missed (${refs.length})`;
    btn.title = 'Start a run from just the questions below full marks';
    btn.addEventListener('click', () => {
      const missed = collectMissed(S.quiz.questions, S.answers, keyOf);
      const questions = questionsFromRefs(S.quiz.questions, missed);
      if (!questions.length) return;
      // keep linked-question context (physics resolveDeps): predecessors
      // dropped from the missed subset must still resolve their dep stems.
      // Seed them into the dep pool S._pastAll only for the duration of
      // beginRun (resolveDeps runs synchronously inside it) so a cached
      // predecessor never leaks into a later run whose own set reuses the id
      const depAdded = [];
      if (S._pastAll) {
        for (const q of questions) {
          for (const d of q.dependsOn || []) {
            if (!d?.id || S._pastAll[d.id]) continue;
            const pred = S.quiz.questions.find(p => keyOf(p) === d.id || p.id === d.id);
            if (pred) { S._pastAll[d.id] = pred; depAdded.push(d.id); }
          }
        }
      }
      const spec = buildRetrySpec(missed, S.quiz.title);
      beginRun({
        mode: 'quiz',
        quizLike: {
          uuid: `${S.quiz.uuid}:retry-missed`,
          version: S.quiz.version,
          title: `⟳ ${spec.title}`,
          timeLimitMinutes: null,
          questions,
        },
        // 'retry-missed' attribution in the saved score entry (quizFile) —
        // keeps a retried run distinguishable from a fresh attempt
        meta: { category: 'retry', file: 'retry-missed', virtual: true },
        // the original spec carries through so this screen's generic
        // "try again" still replays the source run
        retrySpec: S.retrySpec,
      });
      for (const id of depAdded) delete S._pastAll[id];
    });
    anchor.insertAdjacentElement('beforebegin', btn);
  };

  new MutationObserver(tryMount).observe(stage, { childList: true, subtree: true });
  tryMount();
}
