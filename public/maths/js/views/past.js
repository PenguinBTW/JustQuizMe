// Maths Past Papers Room View
import { S, MIXED_UUID } from '../state.js';
import { $, esc, num } from '../utils.js';
import { roomNav, wireRoomNav, resumeBannerHtml, wireResumeBanner, rerenderKeepScroll } from '../navigation.js';
import { openSynthModal, openTopicModal } from '../modals.js';
import { openExploreList } from './explore.js';
import { startSubQuiz, beginFileQuiz } from '../runner/starters.js';
import { exploreFullFile } from './practice.js';
import { parseTerms, matchQuiz, countLabel, emptyMessage } from '../../../shared/js/quizSearch.js';

export function synthPoolQ() {
  let q = 0;
  for (const t of (S._topicData || [])) {
    if (S.mixed.topics.has(t.topic)) q += t.qcount;
  }
  return q;
}

export function renderPast() {
  const data = S._topicData || [];
  const cells = data.map((t, ti) => {
    const sel = S.mixed.topics.has(t.topic);
    const subTotal = t.subs.length;
    const subSel = sel ? t.subs.filter((g, gi) => S.mixed.subs.has(`${t.topic}|${gi}`)).length : 0;
    const compBadge = t.component ? `<span class="pill" style="font-size:10px; padding:1px 6px; margin-left:6px; opacity:0.85;">${esc(t.component)}</span>` : '';
    return `
      <div class="topic-cell ${sel ? 'selected' : ''}" data-synth-topic="${ti}">
        <div class="topic-cell-left">
          <span class="topic-check">✓</span>
          <span class="topic-cell-title">${String(ti + 1).padStart(2, '0')} ${esc(t.topic)} ${compBadge}</span>
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
        <button class="btn btn-primary" id="synthContinueBtn" ${S.mixed.topics.size ? '' : 'disabled'}>Continue →</button>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
      <h3 class="serif" style="font-size:24px;">Browse by Topic</h3>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">OCR A-Level Mathematics (H240)</span>
    </div>
    <div class="quiz-search">
      <input id="quizSearchInput" class="quiz-search-input" type="search" placeholder="Search quizzes by title or topic..." aria-label="Search quizzes" autocomplete="off">
      <span class="mono quiz-search-count" id="quizSearchCount"></span>
    </div>
    <div class="accordion-list" id="quizPickerList">
      ${data.map((t, ti) => {
        const compBadge = t.compName ? `<span class="pill" style="font-size:11px; padding:2px 8px; margin-left:10px; opacity:0.85;">${esc(t.compName)}</span>` : '';
        return `
        <div class="accordion-item ${S.openTopics.has(t.topic) ? 'open' : ''}" data-acc="${ti}" data-qs-topic="${esc(t.topic)}">
          <div class="accordion-header-row">
            <div class="acc-trigger-left" data-acc-toggle="${ti}">
              <span class="acc-num">${String(ti + 1).padStart(2, '0')}</span>
              <span class="acc-title">${esc(t.topic)} ${compBadge}</span>
            </div>
            <div class="acc-right">
              <span class="mono" style="font-size:12px; color:var(--ink-muted);">${t.qcount} Qs · ${num(t.mmarks)} marks</span>
              ${t.qcount ? `<button class="btn" style="padding:5px 14px; font-size:12px;" data-topic-modal="${ti}">Quiz Me</button>` : ''}
            </div>
          </div>
          <div class="accordion-body">
            ${t.subs.map((g, gi) => `
              <div class="subtopic-row" data-qs="${esc(g.name)} ${esc(t.topic)}">
                <span>${esc(g.name)} <span class="mono" style="font-size:11px; color:var(--ink-muted);">(${g.questions.length}Q · ${g.questions.reduce((a, q) => a + (+q.marks || 0), 0)}m)</span></span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button class="btn-ghost mono" style="font-size:12px;" data-explore-sub="${esc(t.topic)}|${gi}">Explore</button>
                  <button class="btn" style="padding:4px 13px; font-size:12px;" data-quiz-sub="${esc(t.topic)}|${gi}">Quiz</button>
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
          return `<div class="fp-year" data-qs-year>${esc(comp.name)} <span class="mono" style="font-weight:normal; font-size:12px; color:var(--ink-muted);">· ${files.length} question banks · ${comp.spec}</span></div>` + files.map(m => `
            <div class="subtopic-row" data-qs="${esc(m.title)} ${esc(comp.name)}">
              <span>${esc(m.title)} <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">· ${m.questionCount}Q · ${m.totalMarks}m</span></span>
              <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn-ghost mono" style="font-size:12px;" data-explore-file="past-paper|${esc(m.file)}">Explore</button>
                <button class="btn" style="padding:4px 13px; font-size:12px;" data-quiz-file="past-paper|${esc(m.file)}">Quiz</button>
              </div>
            </div>`).join('');
        }).join('') || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No past papers yet.</p>'}
      </div>
    </details>
    <p id="quizSearchEmpty" class="quiz-search-empty" hidden></p>

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

  document.querySelectorAll('[data-explore-file]').forEach(b => b.onclick = () => {
    const [cat, file] = b.dataset.exploreFile.split('|');
    exploreFullFile(cat, file);
  });

  document.querySelectorAll('[data-quiz-file]').forEach(b => b.onclick = () => {
    const [cat, file] = b.dataset.quizFile.split('|');
    beginFileQuiz(cat, file, true);
  });

  wireQuizSearch();
}

// Live-filter the picker's quiz rows; an active filter opens accordions
// so matched sub rows stay visible, and clearing restores a full render.
export function wireQuizSearch() {
  const input = $('#quizSearchInput');
  if (!input) return;
  const apply = () => {
    const terms = parseTerms(input.value);
    const rows = [...document.querySelectorAll('#quizPickerList [data-qs], .fullpapers [data-qs]')];
    document.querySelectorAll('#quizPickerList .accordion-item').forEach(item => {
      const topicHit = terms.length && matchQuiz(item.dataset.qsTopic || '', terms);
      let anySub = false;
      item.querySelectorAll('[data-qs]').forEach(r => {
        const hit = !terms.length || topicHit || matchQuiz(r.dataset.qs, terms);
        r.hidden = !hit;
        anySub = anySub || hit;
      });
      item.hidden = terms.length && !topicHit && !anySub;
      // qs-open (not 'open') marks expansion we added — a clear restores it
      item.classList.toggle('qs-open', terms.length > 0 && !item.hidden);
    });
    document.querySelectorAll('.fullpapers [data-qs]').forEach(r => {
      r.hidden = terms.length && !matchQuiz(r.dataset.qs, terms);
    });
    document.querySelectorAll('.fp-year').forEach(h => {
      let el = h.nextElementSibling, show = false;
      while (el && !el.classList.contains('fp-year')) {
        if (el.dataset && el.dataset.qs !== undefined && !el.hidden) show = true;
        el = el.nextElementSibling;
      }
      h.hidden = terms.length && !show;
    });
    const shown = rows.filter(r => !r.hidden).length;
    $('#quizSearchCount').textContent = terms.length ? countLabel(shown, rows.length) : '';
    const empty = $('#quizSearchEmpty');
    empty.textContent = emptyMessage(terms);
    empty.hidden = !terms.length || shown > 0;
  };
  input.oninput = apply;
  input.onkeydown = e => { if (e.key === 'Escape') { input.value = ''; apply(); } };
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
