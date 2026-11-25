// Computer Science Past Papers View
import { S, OCR_TOPICS } from '../state.js';
import { $, esc, num } from '../utils.js';
import { roomNav, wireRoomNav, resumeBannerHtml, wireResumeBanner, renderRoom } from '../navigation.js';
import { openSynthModal, openTopicModal } from '../modals.js';
import { openExploreList } from './explore.js';
import { startSubQuiz } from '../runner/starters.js';
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
  const comp1Topics = data.filter(t => t.component === '01');
  const comp2Topics = data.filter(t => t.component === '02');

  const comp1AllSel = comp1Topics.length > 0 && comp1Topics.every(t => S.mixed.topics.has(t.topic));
  const comp2AllSel = comp2Topics.length > 0 && comp2Topics.every(t => S.mixed.topics.has(t.topic));
  const allSel = data.length > 0 && data.every(t => S.mixed.topics.has(t.topic));

  const renderCell = (t) => {
    const ti = data.findIndex(x => x.topic === t.topic);
    const sel = S.mixed.topics.has(t.topic);
    const subTotal = t.subs.length;
    const subSel = sel ? t.subs.filter((g, gi) => S.mixed.subs.has(`${t.topic}|${gi}`)).length : 0;
    return `
      <div class="topic-cell ${sel ? 'selected' : ''}" data-synth-topic="${ti}">
        <div class="topic-cell-left">
          <span class="topic-check">✓</span>
          <span class="topic-cell-title">${t.unit} ${esc(t.topic)} ${masteryBadge(masteryByTopic.get(t.topic))}</span>
        </div>
        <div class="topic-cell-meta">${subSel}/${subTotal} · ${t.qcount}Q</div>
      </div>
    `;
  };

  const recent = (S.scores || []).slice(-2).reverse();
  const recentHtml = recent.length
    ? `<span>Recent: ${recent.map(a => `<strong>${esc(a.quizTitle || 'Assessment')}</strong> (${a.total ? Math.round(a.score / a.total * 100) : 0}%)`).join(' · ')}</span>`
    : `<span class="mono" style="font-size:12.5px; color:var(--ink-muted);">No attempts logged yet - your history will land here.</span>`;

  $('#stage').innerHTML = `
    ${resumeBannerHtml()}
    ${roomNav('past')}

    <div class="synthesizer-sheet">
      <div class="window-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="window-dots">
            <span class="window-dot dot-close"></span>
            <span class="window-dot dot-min"></span>
            <span class="window-dot dot-max"></span>
          </div>
          <span class="window-title">custom-paper-synthesizer.sh</span>
        </div>
        <span class="window-badge">OCR Specification</span>
      </div>

      <div class="synthesizer-top">
        <div>
          <h2 class="serif" style="font-size: 29px; line-height: 1.15;">Custom Paper Synthesizer</h2>
          <p style="font-size: 13.5px; color: var(--ink-secondary); margin-top: 4px;">
            Select the major topics you want to be quizzed on, then click continue to fine-tune subtopics and marks.
          </p>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <span class="mono" style="font-size:12px; color:var(--ink-muted);" id="synthPoolLabel"><span style="color:var(--accent); font-weight:600;">${S.mixed.topics.size}</span> topics · <span style="color:var(--accent); font-weight:600;">${num(synthPoolQ())}</span> Qs in pool</span>
          <div class="comp-quick-selects">
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="toggleMajorBtn">${allSel ? 'Deselect all' : 'Select all'}</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="reviewWeakestBtn" title="Select your weakest topics and open the synthesizer">⚡ Review weakest</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="mockSeriesBtn" title="Sit Comp 01 + Comp 02 back-to-back as a timed mock series">🎬 Mock series</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="smartCardsBtn" title="Flashcard session across all topics — weak-topic cards first">🂡 Smart cards</button>
            <button class="btn-ghost mono" style="font-size:11.5px; padding:2px 8px;" id="dueReviewBtn" title="Topics whose decayed mastery is due for review"></button>
          </div>
        </div>
      </div>

      <div class="topic-grid" id="synthGrid">
        <div class="comp-divider">
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="comp-badge comp-01">Comp 01</span>
            <span>Component 01 · Computer Systems (Units 1.1 - 1.5)</span>
          </span>
          <button class="btn-ghost mono" style="font-size:11px; padding:2px 8px;" id="toggleComp1Btn">${comp1AllSel ? 'Deselect Comp 01' : 'Select Comp 01'}</button>
        </div>
        ${comp1Topics.map(renderCell).join('')}

        <div class="comp-divider">
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="comp-badge comp-02">Comp 02</span>
            <span>Component 02 · Algorithms &amp; Problem Solving (Units 2.1 - 2.3)</span>
          </span>
          <button class="btn-ghost mono" style="font-size:11px; padding:2px 8px;" id="toggleComp2Btn">${comp2AllSel ? 'Deselect Comp 02' : 'Select Comp 02'}</button>
        </div>
        ${comp2Topics.map(renderCell).join('')}
      </div>

      <div class="synthesizer-footer">
        <span class="mono" style="font-size:12px; color:var(--ink-secondary);">
          Target: <strong style="color:var(--accent);">${S.mixed.m} marks</strong> · ~${Math.round(S.mixed.m * 1.07)} mins
        </span>
        <button class="btn btn-primary" id="synthContinueBtn" ${S.mixed.topics.size ? '' : 'disabled'}>Continue →</button>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
      <h3 class="serif" style="font-size:24px;">Browse by Topic</h3>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">${OCR_TOPICS.length} OCR Sections</span>
    </div>

    <div class="accordion-list">
      ${data.map((t, ti) => `
        <div class="accordion-item ${S.openTopics.has(t.topic) ? 'open' : ''}" data-acc="${ti}">
          <div class="accordion-header-row">
            <div class="acc-trigger-left" data-acc-toggle="${ti}">
              <span class="acc-num">${t.unit || String(ti + 1).padStart(2, '0')}</span>
              <span class="acc-title">${esc(t.topic)} ${masteryBadge(masteryByTopic.get(t.topic))}</span>
            </div>
            <div class="acc-right">
              <span class="mono" style="font-size:12px; color:var(--ink-muted);">${t.qcount} Qs · ${num(t.mmarks)} marks</span>
              ${t.qcount ? `<button class="btn" style="padding:5px 14px; font-size:12px;" data-topic-modal="${ti}">Quiz Me</button>` : ''}
            </div>
          </div>
          <div class="accordion-body">
            ${t.subs.map((g, gi) => `
              <div class="subtopic-row">
                <span>${esc(g.name)}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button class="btn-ghost mono" style="font-size:12px;" data-explore-sub="${esc(t.topic)}|${gi}">Explore</button>
                  <button class="btn" style="padding:4px 13px; font-size:12px;" data-quiz-sub="${esc(t.topic)}|${gi}">Quiz</button>
                  <button class="btn-ghost mono" style="font-size:12px;" data-cards-sub="${esc(t.topic)}|${gi}" title="Flashcard session for this subtopic">Cards</button>
                </div>
              </div>
            `).join('') || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No questions tagged in this unit yet.</p>'}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="sheet-footer" style="margin-top:24px;">
      <div>${recentHtml}</div>
      <button class="btn-ghost mono" style="font-size:12px;" id="viewHistoryFooter">Full History →</button>
    </div>
  `;

  wireRoomNav();
  wireResumeBanner();
  wirePastEvents();
}

export function wirePastEvents() {
  const startCards = (cards, title) => {
    const stage = $('#stage');
    if (!stage) return;
    mountFlashcards({
      S, stage, deck: cards, portal: location.pathname.split('/').filter(Boolean)[0] || 'cs', title,
      onExit: () => renderPast(),
    });
  };
  document.querySelectorAll('[data-cards-sub]').forEach(btn => btn.addEventListener('click', () => {
    const [topic, gi] = btn.dataset.cardsSub.split('|');
    const t = (S._topicData || []).find(x => x.topic === topic);
    const g = t && t.subs[+gi];
    if (!g) return;
    startCards(deckFromQuestions(g.questions || []), `${topic} — ${g.name}`);
  }));
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

  $('#synthGrid')?.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-synth-topic]');
    if (!cell) return;
    const ti = +cell.dataset.synthTopic;
    const t = S._topicData[ti];
    if (!t) return;
    if (S.mixed.topics.has(t.topic)) {
      S.mixed.topics.delete(t.topic);
      t.subs.forEach((g, gi) => S.mixed.subs.delete(`${t.topic}|${gi}`));
    } else {
      S.mixed.topics.add(t.topic);
      t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
    }
    renderPast();
  });

  const toggleComponent = (compCode) => {
    const comp = (S._topicData || []).filter(t => t.component === compCode);
    const allCompSel = comp.length > 0 && comp.every(t => S.mixed.topics.has(t.topic));
    comp.forEach(t => {
      if (allCompSel) {
        S.mixed.topics.delete(t.topic);
        t.subs.forEach((g, gi) => S.mixed.subs.delete(`${t.topic}|${gi}`));
      } else {
        S.mixed.topics.add(t.topic);
        t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
      }
    });
    renderPast();
  };

  $('#toggleComp1Btn')?.addEventListener('click', () => toggleComponent('01'));
  $('#toggleComp2Btn')?.addEventListener('click', () => toggleComponent('02'));

  $('#toggleMajorBtn')?.addEventListener('click', () => {
    const data = S._topicData || [];
    const allSel = data.length > 0 && data.every(t => S.mixed.topics.has(t.topic));
    if (allSel) {
      S.mixed.topics.clear();
      S.mixed.subs.clear();
    } else {
      data.forEach(t => {
        S.mixed.topics.add(t.topic);
        t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
      });
    }
    renderPast();
  });

  $('#synthContinueBtn')?.addEventListener('click', () => openSynthModal());

  $('#mockSeriesBtn')?.addEventListener('click', async () => {
    const { startMockSeries } = await import('../runner/starters.js');
    startMockSeries({ breakMinutes: 10 });
  });

  $('#reviewWeakestBtn')?.addEventListener('click', () => {
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
    renderPast();
    openSynthModal();
  });

  document.querySelectorAll('[data-acc-toggle]').forEach(el => {
    el.onclick = () => {
      const ti = +el.dataset.accToggle;
      const t = S._topicData[ti];
      if (!t) return;
      if (S.openTopics.has(t.topic)) S.openTopics.delete(t.topic);
      else S.openTopics.add(t.topic);
      renderPast();
    };
  });

  document.querySelectorAll('[data-topic-modal]').forEach(b => {
    b.onclick = () => openTopicModal(+b.dataset.topicModal);
  });

  document.querySelectorAll('[data-explore-sub]').forEach(b => {
    b.onclick = () => {
      const c = S._subCache.get(b.dataset.exploreSub);
      if (c) openExploreList(c.topic, c.sub.name, c.sub.questions, 'past');
    };
  });

  document.querySelectorAll('[data-quiz-sub]').forEach(b => {
    b.onclick = () => {
      const c = S._subCache.get(b.dataset.quizSub);
      if (c) startSubQuiz(c.topic, c.sub);
    };
  });

  $('#viewHistoryFooter')?.addEventListener('click', () => {
    S.room = 'history';
    renderRoom();
  });
}
