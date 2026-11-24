// Maths Past Papers Room View
import { S, MIXED_UUID } from '../state.js';
import { $, esc, num } from '../utils.js';
import { roomNav, wireRoomNav, resumeBannerHtml, wireResumeBanner, rerenderKeepScroll } from '../navigation.js';
import { openSynthModal, openTopicModal } from '../modals.js';
import { openExploreList } from './explore.js';
import { startSubQuiz, beginFileQuiz } from '../runner/starters.js';
import { exploreFullFile } from './practice.js';
import { computeMastery, weakestTopics } from '../../../shared/js/mastery.js';
import { dueReview } from '../../../shared/js/dueReview.js';
import { masteryBadge, resolveScoreTopics, buildUuidIndex } from '../../../shared/js/masteryUi.js';
import { mountFlashcards, buildSmartDeck } from '../../../shared/js/flashcardSession.js';
import { deckFromQuestions } from '../../../shared/js/flashcards.js';

export function synthPoolQ() {
  let q = 0;
  for (const t of (S._topicData || [])) {
    if (S.mixed.topics.has(t.topic)) q += t.qcount;
  }
  return q;
}

export function renderPast() {
  const data = S._topicData || [];
  const masteryRows = computeMastery(S.scores, (s) => resolveScoreTopics(s, buildUuidIndex(S.quizzes)));
  const masteryByTopic = new Map(masteryRows.map(r => [r.topic, r]));
  queueMicrotask(() => {
    const dueChip = document.getElementById('dueReviewBtn');
    if (!dueChip) return;
    const due = dueReview(masteryRows);
    if (!due.length) { dueChip.remove(); return; }
    const overdue = due.filter(d => d.overdue).length;
    dueChip.textContent = overdue ? `⏰ ${overdue} overdue` : `⏰ ${due.length} due soon`;
    dueChip.title = due.slice(0, 5).map(d => `${d.topic} — ${d.label}`).join('\n');
  });
  const cells = data.map((t, ti) => {
    const sel = S.mixed.topics.has(t.topic);
    const subTotal = t.subs.length;
    const subSel = sel ? t.subs.filter((g, gi) => S.mixed.subs.has(`${t.topic}|${gi}`)).length : 0;
    const compBadge = t.component ? `<span class="pill" style="font-size:10px; padding:1px 6px; margin-left:6px; opacity:0.85;">${esc(t.component)}</span>` : '';
    return `
      <div class="topic-cell ${sel ? 'selected' : ''}" data-synth-topic="${ti}">
        <div class="topic-cell-left">
          <span class="topic-check">✓</span>
          <span class="topic-cell-title">${String(ti + 1).padStart(2, '0')} ${esc(t.topic)} ${masteryBadge(masteryByTopic.get(t.topic))} ${compBadge}</span>
        </div>
        <div class="topic-cell-meta">${subSel}/${subTotal} · ${t.qcount}Q</div>
      </div>
    `;
  }).join('');

  const allSel = data.filter(t => t.qcount > 0).every(t => S.mixed.topics.has(t.topic));
  const recent = S.scores.filter(s => s.quizUuid === MIXED_UUID || S.quizzes['past-paper'].some(m => m.uuid === s.quizUuid)).slice(-2).reverse();
  const recentHtml = recent.length
    ? `<span>Recent: ${recent.map(a => `<strong>${esc(a.quizTitle || 'Past paper')}</strong> (${a.total ? Math.round(a.score / a.total * 100) : 0}%)`).join(' · ')}</span>`
    : `<span class="mono" style="font-size:12.5px; color:var(--ink-muted);">No attempts logged yet - your history will land here.</span>`;

  $('#stage').innerHTML = `
    ${resumeBannerHtml()}
    ${roomNav('past')}
    <div class="synthesizer-sheet">
      <div class="synthesizer-top">
        <div>
          <h2 class="serif" style="font-size: 29px; line-height: 1.15;">Custom Paper Synthesizer</h2>
          <p style="font-size: 13.5px; color: var(--ink-secondary); margin-top: 4px;">
            Select the major topics you want to be quizzed on, then click continue to fine-tune subtopics and marks.
          </p>
        </div>
        <span class="mono" style="font-size:12px; color:var(--ink-muted);" id="synthPoolLabel"><span style="color:var(--accent); font-weight:600;">${S.mixed.topics.size}</span> topics · <span style="color:var(--accent); font-weight:600;">${num(synthPoolQ())}</span> Qs in pool</span>
      </div>
      <div class="topic-grid" id="synthGrid">${cells}</div>
      <div class="synthesizer-footer">
        <button class="btn-ghost mono" style="font-size:12px;" id="toggleMajorBtn">${allSel ? 'Deselect all topics' : 'Select all topics'}</button>
        <button class="btn-ghost mono" style="font-size:12px;" id="reviewWeakestBtn" title="Select your weakest topics and open the synthesizer">⚡ Review weakest</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="smartCardsBtn" title="Flashcard session across all topics — weak-topic cards first">🂡 Smart cards</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="dueReviewBtn" title="Topics whose decayed mastery is due for review"></button>
        <button class="btn btn-primary" id="synthContinueBtn" ${S.mixed.topics.size ? '' : 'disabled'}>Continue →</button>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
      <h3 class="serif" style="font-size:24px;">Browse by Topic</h3>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">OCR A-Level Mathematics (H240)</span>
    </div>
    <div class="accordion-list">
      ${data.map((t, ti) => {
        const compBadge = t.compName ? `<span class="pill" style="font-size:11px; padding:2px 8px; margin-left:10px; opacity:0.85;">${esc(t.compName)}</span>` : '';
        return `
        <div class="accordion-item ${S.openTopics.has(t.topic) ? 'open' : ''}" data-acc="${ti}">
          <div class="accordion-header-row">
            <div class="acc-trigger-left" data-acc-toggle="${ti}">
              <span class="acc-num">${String(ti + 1).padStart(2, '0')}</span>
              <span class="acc-title">${esc(t.topic)} ${masteryBadge(masteryByTopic.get(t.topic))} ${compBadge}</span>
            </div>
            <div class="acc-right">
              <span class="mono" style="font-size:12px; color:var(--ink-muted);">${t.qcount} Qs · ${num(t.mmarks)} marks</span>
              ${t.qcount ? `<button class="btn" style="padding:5px 14px; font-size:12px;" data-topic-modal="${ti}">Quiz Me</button>` : ''}
            </div>
          </div>
          <div class="accordion-body">
            ${t.subs.map((g, gi) => `
              <div class="subtopic-row">
                <span>${esc(g.name)} <span class="mono" style="font-size:11px; color:var(--ink-muted);">(${g.questions.length}Q · ${g.questions.reduce((a, q) => a + (+q.marks || 0), 0)}m)</span></span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button class="btn-ghost mono" style="font-size:12px;" data-explore-sub="${esc(t.topic)}|${gi}">Explore</button>
                  <button class="btn" style="padding:4px 13px; font-size:12px;" data-quiz-sub="${esc(t.topic)}|${gi}">Quiz</button>
                  <button class="btn-ghost mono" style="font-size:12px;" data-cards-sub="${esc(t.topic)}|${gi}" title="Flashcard session for this subtopic">Cards</button>
                </div>
              </div>`).join('') || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No questions tagged here yet.</p>'}
          </div>
        </div>`;
      }).join('')}
    </div>

    <details class="fullpapers">
      <summary><span>Full Sets · A-Z</span><span class="mono" style="font-size:12px; color:var(--ink-muted);">${S.quizzes['past-paper'].length} sets</span></summary>
      <div class="fullpapers-body">
        ${[
          { name: 'Pure Mathematics', spec: 'Component 01' },
          { name: 'Applied Statistics', spec: 'Component 02' },
          { name: 'Applied Mechanics', spec: 'Component 03' }
        ].map(comp => {
          const files = S.quizzes['past-paper'].filter(m => {
            const quiz = S.pastFull[m.file];
            const compName = quiz?.component || m.component || (m.file.startsWith('pure') ? 'Pure Mathematics' : m.file.startsWith('stats') ? 'Applied Statistics' : 'Applied Mechanics');
            return compName === comp.name;
          });
          if (!files.length) return '';
          return `<div class="fp-year">${esc(comp.name)} <span class="mono" style="font-weight:normal; font-size:12px; color:var(--ink-muted);">· ${files.length} question banks · ${comp.spec}</span></div>` + files.map(m => `
            <div class="subtopic-row">
              <span>${esc(m.title)} <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">· ${m.questionCount}Q · ${m.totalMarks}m</span></span>
              <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn-ghost mono" style="font-size:12px;" data-explore-file="past-paper|${esc(m.file)}">Explore</button>
                <button class="btn" style="padding:4px 13px; font-size:12px;" data-quiz-file="past-paper|${esc(m.file)}">Quiz</button>
              </div>
            </div>`).join('');
        }).join('') || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No past papers yet.</p>'}
      </div>
    </details>

    <div style="margin-top: 36px; display:flex; align-items:center; justify-content:space-between; color:var(--ink-secondary); font-size:13px;">
      ${recentHtml}
      <button class="btn-ghost mono" style="font-size:12px;" data-room="history">Full History →</button>
    </div>
  `;

  wireRoomNav();
  wireResumeBanner();

  document.querySelectorAll('[data-synth-topic]').forEach(c => c.onclick = () => toggleSynthTopic(+c.dataset.synthTopic));
  $('#toggleMajorBtn').onclick = toggleAllMajorTopics;
  $('#synthContinueBtn').onclick = () => { if (S.mixed.topics.size) openSynthModal(); };

  $('#reviewWeakestBtn').onclick = () => {
    const rows = computeMastery(S.scores, (s) => resolveScoreTopics(s, buildUuidIndex(S.quizzes)));
    const picks = weakestTopics(rows, (S._topicData || []).filter(t => t.qcount > 0).map(t => t.topic), 3);
    S.mixed.topics.clear();
    S.mixed.subs.clear();
    for (const pick of picks) {
      const t = (S._topicData || []).find(x => x.topic === pick.topic);
      if (!t) continue;
      S.mixed.topics.add(t.topic);
      t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
    }
    rerenderKeepScroll();
    if (S.mixed.topics.size) openSynthModal();
  };

  document.querySelectorAll('[data-acc-toggle]').forEach(el => el.onclick = () => {
    const t = (S._topicData || [])[+el.dataset.accToggle];
    if (!t) return;
    S.openTopics.has(t.topic) ? S.openTopics.delete(t.topic) : S.openTopics.add(t.topic);
    rerenderKeepScroll();
  });

  document.querySelectorAll('[data-topic-modal]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openTopicModal(+b.dataset.topicModal);
  });

  document.querySelectorAll('[data-explore-sub]').forEach(b => b.onclick = () => {
    const c = S._subCache.get(b.dataset.exploreSub);
    if (c) openExploreList(`${c.topic} · ${c.sub.name}`, `${c.sub.questions.length} questions · practice, no score`, c.sub.questions, 'past');
  });

  document.querySelectorAll('[data-quiz-sub]').forEach(b => b.onclick = () => {
    const c = S._subCache.get(b.dataset.quizSub);
    if (c) startSubQuiz(c.topic, c.sub);
  });

  const startCards = (cards, title) => {
    const stage = $('#stage');
    if (!stage) return;
    mountFlashcards({
      S, stage, deck: cards, portal: location.pathname.split('/').filter(Boolean)[0] || 'maths', title,
      onExit: () => renderPast(),
    });
  };
  document.querySelectorAll('[data-cards-sub]').forEach(b => b.onclick = () => {
    const c = S._subCache.get(b.dataset.cardsSub);
    if (c) startCards(deckFromQuestions(c.sub.questions || []), `${c.topic} — ${c.sub.name}`);
  });
  $('#dueReviewBtn')?.addEventListener('click', () => {
    const rows = computeMastery(S.scores, (s) => resolveScoreTopics(s, buildUuidIndex(S.quizzes)));
    const due = dueReview(rows);
    if (!due.length) return;
    S.mixed.topics.clear(); S.mixed.subs.clear();
    for (const d of due.slice(0, 3)) {
      const t = (S._topicData || []).find(x => x.topic === d.topic);
      if (!t) continue;
      S.mixed.topics.add(t.topic);
      t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
    }
    renderPast();
  });
  $('#smartCardsBtn')?.addEventListener('click', () => {
    const all = (S._topicData || []).flatMap(t => (t.subs || []).flatMap(g => g.questions || []));
    startCards(buildSmartDeck(S, all).slice(0, 30), 'Smart cards');
  });

  document.querySelectorAll('[data-explore-file]').forEach(b => b.onclick = () => {
    const [cat, file] = b.dataset.exploreFile.split('|');
    exploreFullFile(cat, file);
  });

  document.querySelectorAll('[data-quiz-file]').forEach(b => b.onclick = () => {
    const [cat, file] = b.dataset.quizFile.split('|');
    beginFileQuiz(cat, file, true);
  });
}

export function toggleSynthTopic(ti) {
  const t = (S._topicData || [])[ti];
  if (!t) return;
  if (S.mixed.topics.has(t.topic)) {
    S.mixed.topics.delete(t.topic);
    [...S.mixed.subs].forEach(k => {
      if (k.startsWith(t.topic + '|')) S.mixed.subs.delete(k);
    });
  } else {
    S.mixed.topics.add(t.topic);
    t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
  }
  rerenderKeepScroll();
}

export function toggleAllMajorTopics() {
  const data = (S._topicData || []).filter(t => t.qcount > 0);
  const allSel = data.every(t => S.mixed.topics.has(t.topic));
  if (allSel) {
    S.mixed.topics.clear();
    S.mixed.subs.clear();
  } else {
    data.forEach(t => {
      S.mixed.topics.add(t.topic);
      t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
    });
  }
  rerenderKeepScroll();
}
