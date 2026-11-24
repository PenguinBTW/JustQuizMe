// Physics Past Papers Room View
import { S, AQA_TOPICS, MIXED_UUID } from '../state.js';
import { $, esc, num } from '../utils.js';
import { roomNav, wireRoomNav, resumeBannerHtml, wireResumeBanner, rerenderKeepScroll } from '../navigation.js';
import { openSynthModal, openTopicModal } from '../modals.js';
import { openExploreList } from './explore.js';
import { startSubQuiz, beginFileQuiz } from '../runner/starters.js';
import { exploreFullFile } from './practice.js';
import { computeMastery, weakestTopics } from '../../../shared/js/mastery.js';
import { masteryBadge, resolveScoreTopics, buildUuidIndex } from '../../../shared/js/masteryUi.js';

export function synthPoolQ(){
  let q = 0;
  for (const t of (S._topicData || [])) if (S.mixed.topics.has(t.topic)) q += t.qcount;
  return q;
}

export function renderPast(){
  const data = S._topicData || [];
  const masteryRows = computeMastery(S.scores, (s) => resolveScoreTopics(s, buildUuidIndex(S.quizzes)));
  const masteryByTopic = new Map(masteryRows.map(r => [r.topic, r]));
  const totalQ = data.reduce((s, t) => s + t.qcount, 0);
  const cells = data.map((t, ti) => {
    const sel = S.mixed.topics.has(t.topic);
    const subTotal = t.subs.length;
    const subSel = sel ? t.subs.filter((g, gi) => S.mixed.subs.has(`${t.topic}|${gi}`)).length : 0;
    return `<div class="topic-cell ${sel ? 'selected' : ''}" data-synth-topic="${ti}">
      <div class="topic-cell-left"><span class="topic-check">✓</span>
        <span class="topic-cell-title">${String(ti + 1).padStart(2, '0')} ${esc(t.topic)} ${masteryBadge(masteryByTopic.get(t.topic))}</span></div>
      <div class="topic-cell-meta">${subSel}/${subTotal} · ${t.qcount}Q</div>
    </div>`;
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
      <button class="btn btn-primary" id="synthContinueBtn" ${S.mixed.topics.size ? '' : 'disabled'}>Continue →</button>
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
    <h3 class="serif" style="font-size:24px;">Browse by Topic</h3>
    <span class="mono" style="font-size:12px; color:var(--ink-muted);">11 AQA Sections</span>
  </div>
  <div class="accordion-list">
    ${data.map((t, ti) => `
    <div class="accordion-item ${S.openTopics.has(t.topic) ? 'open' : ''}" data-acc="${ti}">
      <div class="accordion-header-row">
        <div class="acc-trigger-left" data-acc-toggle="${ti}">
          <span class="acc-num">${String(ti + 1).padStart(2, '0')}</span>
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
          </div>
        </div>`).join('') || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No questions tagged here yet.</p>'}
      </div>
    </div>`).join('')}
  </div>

  <details class="fullpapers">
    <summary><span>Full Sets · A-Z</span><span class="mono" style="font-size:12px; color:var(--ink-muted);">${S.quizzes['past-paper'].length} sets</span></summary>
    <div class="fullpapers-body">
      ${AQA_TOPICS.map(topic => {
        const files = S.quizzes['past-paper'].filter(m => (m.topics || []).some(t => normT(t) === normT(topic)));
        if (!files.length) return '';
        return `<div class="fp-year">${esc(topic)}</div>` + files.map(m => `
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
  </div>`;

  wireRoomNav(); wireResumeBanner();
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
  document.querySelectorAll('[data-topic-modal]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openTopicModal(+b.dataset.topicModal); });
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
}

function normT(s){ return String(s || '').trim().toLowerCase(); }

export function toggleSynthTopic(ti){
  const t = (S._topicData || [])[ti];
  if (!t) return;
  if (S.mixed.topics.has(t.topic)){
    S.mixed.topics.delete(t.topic);
    [...S.mixed.subs].forEach(k => { if (k.startsWith(t.topic + '|')) S.mixed.subs.delete(k); });
  } else {
    S.mixed.topics.add(t.topic);
    t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
  }
  rerenderKeepScroll();
}

export function toggleAllMajorTopics(){
  const data = (S._topicData || []).filter(t => t.qcount > 0);
  const allSel = data.every(t => S.mixed.topics.has(t.topic));
  if (allSel){ S.mixed.topics.clear(); S.mixed.subs.clear(); }
  else data.forEach(t => {
    S.mixed.topics.add(t.topic);
    t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
  });
  rerenderKeepScroll();
}
