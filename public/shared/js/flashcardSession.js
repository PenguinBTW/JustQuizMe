// Flashcard session — quick-fire recall practice, minimal chrome, keyboard-driven.
// Writes ONE flashcard-tagged score entry per session so mastery stays coherent
// across modes (per-question data present) while exam statistics can tell the
// difference (flashcard: true — the explore-distinction pattern).
import { deckFromQuestions, orderDeckByMastery } from './flashcards.js';
import { recordGrade, orderCardsByDue } from './cardSchedule.js';
import { computeMastery } from './mastery.js';
import { buildUuidIndex, resolveScoreTopics } from './masteryUi.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildSmartDeck(S, questions) {
  const scores = Array.isArray(S.scores) ? S.scores : [];
  const uuidIndex = buildUuidIndex(S.quizzes);
  const resolveFn = s => resolveScoreTopics(s, uuidIndex);
  const rows = computeMastery(scores, resolveFn);
  const cards = deckFromQuestions(questions);
  // mastery bands first (weak > unpractised > strong); per-card due state
  // reorders only within a band — due/overdue first, then unseen, then future.
  const ordered = orderDeckByMastery(cards, rows);
  return orderCardsByDue(ordered);
}

// Mounts a flashcard session into `stage`. Returns nothing; cleanup via onExit.
let fcSessionSeq = 0;

export function mountFlashcards({ S, stage, deck, portal, title, onExit }) {
  const sessionToken = 'fc' + (++fcSessionSeq);
  const cards = deck || [];
  let idx = 0;
  let flipped = false;
  const grades = []; // {card, got}
  let keyHandler = null;

  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    delete stage.dataset.fcSession;
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    // honest accounting: ungraded cards never happened — they are not zeros
    const total = grades.reduce((s, g) => s + (g.card.marks || 1), 0);
    const got = grades.reduce((s, g) => s + (g.got ? (g.card.marks || 1) : 0), 0);
    const seen = grades.length;
    const topics = [...new Set(cards.map(c => c.topic).filter(Boolean))];
    const perQuestion = grades.map(g => ({
      id: g.card.id, topic: g.card.topic, subtopic: null, type: 'flashcard',
      score: g.got ? (g.card.marks || 1) : 0, marks: g.card.marks || 1, attempted: true,
    }));
    if (seen > 0) {
      const entry = {
        date: new Date().toISOString(), title: title || 'Flashcards', type: 'flashcards',
        quizUuid: 'flashcards',
        topic: topics[0] || null, topics, subtopics: [],
        score: got, total, mode: 'flashcards', flashcard: true,
        perQuestion, topLevelMarkTotals: { attained: got, possible: total },
      };
      try {
        const res = await fetch(`/api/${portal}/scores`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (res.ok) {
          const saved = await res.json().catch(() => null);
          (S.scores = S.scores || []).unshift(saved && saved.entry && typeof saved.entry === 'object' ? saved.entry : entry);
          if (S.scores.length > 500) S.scores.length = 500;
        }
      } catch { /* offline — session still completes */ }
    }
    const pct = total > 0 ? Math.round(100 * got / total) : 0;
    stage.innerHTML = `
      <div class="fc-done">
        <h2>Session complete</h2>
        <p class="fc-stats">${seen}/${cards.length} cards · <strong>${got}/${total}</strong> marks (${pct}%)</p>
        <p class="fc-hint">Recorded as flashcard practice — feeds your mastery without counting as exam results.</p>
        <button class="btn btn-primary" id="fcBack">Back</button>
      </div>`;
    stage.querySelector('#fcBack').addEventListener('click', () => onExit && onExit());
  };

  const render = () => {
    if (idx >= cards.length) { finish(); return; }
    const c = cards[idx];
    stage.innerHTML = `
      <div class="fc-session">
        <div class="fc-meta">
          <span class="fc-count mono">${idx + 1}/${cards.length}</span>
          <span class="fc-topic">${esc(c.topic || '')}</span>
          <button class="fc-exit" id="fcExit" title="End session (esc)">✕</button>
        </div>
        <div class="fc-card">
          <div class="fc-front">${esc(c.front).replace(/\n/g, '<br>')}</div>
          ${flipped ? `<div class="fc-back">${esc(c.back).replace(/\n/g, '<br>')}</div>` : `<div class="fc-flip-hint">space to flip</div>`}
        </div>
        ${flipped ? `
        <div class="fc-grade">
          <button class="btn fc-no" id="fcNo">✗ Didn't <span class="fc-key">1</span></button>
          <button class="btn btn-primary fc-yes" id="fcYes">✓ Got it <span class="fc-key">2</span></button>
        </div>` : ''}
      </div>`;
    stage.querySelector('#fcExit').addEventListener('click', () => { idx = cards.length; render(); });
    const cardEl = stage.querySelector('.fc-card');
    if (cardEl && !flipped) cardEl.addEventListener('click', () => { flipped = true; render(); });
    if (flipped) {
      stage.querySelector('#fcNo').addEventListener('click', () => grade(false));
      stage.querySelector('#fcYes').addEventListener('click', () => grade(true));
    }
  };

  const grade = got => {
    try { recordGrade(cards[idx].key || cards[idx].id || cards[idx].front, got); } catch {}
    grades.push({ card: cards[idx], got });
    idx += 1; flipped = false;
    render();
  };

  keyHandler = e => {
    // self-cleanup: navigating away mid-session must not leave live shortcuts
    if (!document.contains(stage) || stage.dataset.fcSession !== sessionToken) {
      document.removeEventListener('keydown', keyHandler);
      return;
    }
    if (e.repeat) return;
    if (e.key === 'Escape') { idx = cards.length; render(); return; }
    if (idx >= cards.length) return;
    if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipped = true; render(); return; }
    if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) grade(false);
    if (flipped && (e.key === '2' || e.key === 'ArrowRight' || e.key === 'Enter')) grade(true);
  };
  document.addEventListener('keydown', keyHandler);

  stage.dataset.fcSession = sessionToken;

  if (!cards.length) {
    stage.innerHTML = `<div class="fc-done"><h2>No flashcards</h2><p class="fc-hint">None of these questions suit flashcard treatment (need short definite answers).</p><button class="btn btn-primary" id="fcBack">Back</button></div>`;
    stage.querySelector('#fcBack').addEventListener('click', () => onExit && onExit());
    return;
  }
  render();
}
