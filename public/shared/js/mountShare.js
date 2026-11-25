// Self-mounting "Share result" button for the run-results screen, plus the
// receiving side that renders a read-only result card when the loaded hash
// carries a share payload for this portal. A MutationObserver on #stage
// means no results markup files need edits, and the card is painted over
// whatever home screen the portal boots (it is swapped back in on every
// re-render while the hash stays live).

import { SHARE_HASH, parseResult, shareLink, resultCardHtml } from './shareResult.js';

// Results-screen action buttons per portal (same anchors as retry-missed).
const ANCHOR_SELECTOR = '#retryResBtn, #retryBtn, #finishReturnBtn';
const BTN_ID = 'shareResultBtn';
const CARD_ID = 'shareResultCard';

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// totalsForRun(S, keyOf) → {score, marks} mirroring finish.js's clamp.
function totalsForRun(S, keyOf) {
  let score = 0;
  let marks = 0;
  for (const q of S.quiz?.questions || []) {
    const qm = +q.marks || 0;
    marks += qm;
    const ans = S.answers?.[keyOf(q)] || {};
    score += Math.min(qm, Math.max(0, ans.score || 0));
  }
  return { score, marks };
}

// registerShareResult({ S, portal, keyOf })
//   S      — portal state store (quiz, answers)
//   portal — 'cs' | 'maths' | 'physics' (payload portal check)
//   keyOf  — the answer-key fn the results screen uses (`ak`)
export function registerShareResult({ S, portal, keyOf }) {
  const stage = document.getElementById('stage') || document.body;

  // --- receiving side: share hash → read-only card over everything ---
  // Leaving the payload (Back / in-page hash nav) reloads the page:
  // markup we could restore would have none of the portal's handlers.
  // A new payload repaints the card so a second shared link never shows
  // the first result; the repaint key is the raw payload, not the
  // re-encoded model (a valid foreign payload may carry precision
  // encodeResult would round away).
  const paintCard = () => {
    const model = parseResult(location.hash, portal);
    const holder = document.getElementById(CARD_ID);
    if (!model) {
      if (holder) location.reload();
      return false;
    }
    const i = location.hash.indexOf(SHARE_HASH);
    const raw = i < 0 ? '' : location.hash.slice(i + SHARE_HASH.length).split('&')[0].split('#')[0];
    if (!holder || holder.dataset.shareP !== raw) {
      stage.innerHTML = resultCardHtml(model);
      document.getElementById(CARD_ID).dataset.shareP = raw;
    }
    return true;
  };

  // --- sending side: Share result button on the results screen ---
  const tryMount = () => {
    if (paintCard()) return; // sharing view wins over everything else
    const anchor = stage.querySelector?.(ANCHOR_SELECTOR);
    const existing = stage.querySelector?.(`#${BTN_ID}`);
    if (!anchor || !S.quiz?.questions?.length) {
      if (existing) existing.remove();
      return;
    }
    const { score, marks } = totalsForRun(S, keyOf);
    if (!marks) { existing?.remove(); return; }
    if (!existing) {
      const btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.className = anchor.className || 'btn';
      btn.textContent = 'Share result';
      btn.title = 'Copy a link to a read-only result card';
      const retryBtn = stage.querySelector?.('#retryMissedBtn');
      (retryBtn || anchor).insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', () => {
        const { score: s, marks: m } = totalsForRun(S, keyOf);
        // the card's "Completed" date is this run's finish — startedAt +
        // elapsed — not the moment the link is copied. The scores list is
        // only a fallback (cs never refreshes it after finish).
        const started = S.startedAt ? Date.parse(S.startedAt) : NaN;
        const rawUuid = String(S.quiz?.uuid || '').replace(/:retry-missed$/, '');
        const rec = (S.scores || []).find((e) =>
          e?.quizUuid === S.quiz?.uuid || e?.quizUuid === rawUuid);
        const finished = Number.isFinite(started)
          ? started + (S.elapsed || 0) * 1000
          : (rec?.date ? Date.parse(rec.date) : Date.now());
        const link = shareLink({
          portal,
          title: S.quiz?.title || 'Assessment',
          score: s,
          marks: m,
          date: Number.isFinite(finished) ? finished : Date.now(),
        });
        copyText(link).then((ok) => {
          btn.textContent = ok ? 'Copied!' : 'Copy failed';
          setTimeout(() => { btn.textContent = 'Share result'; }, 1600);
        });
      });
    }
  };

  tryMount();
  const obs = new MutationObserver(tryMount);
  obs.observe(stage, { childList: true, subtree: true });
  window.addEventListener('hashchange', tryMount);
}
