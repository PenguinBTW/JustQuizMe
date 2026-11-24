// Maths Unscored Explore Mode View
import { S } from '../state.js';
import { $, esc } from '../utils.js';
import { renderRoom } from '../navigation.js';
import { beginRun } from '../runner/assessment.js';

export function openExploreList(title, sub, questions, backRoom) {
  S.exploreCtx = { title, sub, questions, backRoom: backRoom || 'past' };
  S.room = 'explore';
  renderRoom();
}

export function renderExploreList() {
  const ctx = S.exploreCtx;
  if (!ctx) {
    S.room = 'past';
    return renderRoom();
  }
  const icons = {
    'multiple-choice': 'CHOOSE ONE',
    'symbolic-exact': 'SYMBOLIC CAS',
    'calculation': 'CALCULATION',
    'method-milestone': 'MILESTONE PROOF',
    'show-that-proof': 'SHOW THAT PROOF',
    'graph-features': 'GRAPH FEATURES',
    'statistics-hypothesis': 'HYPOTHESIS TEST',
    'mechanics-vector-fbd': 'MECHANICS VECTOR',
    'written': 'EXPLAIN',
    'self-marked': 'SELF-MARKED'
  };

  $('#stage').innerHTML = `
    <div class="q-chrome">
      <button class="btn-ghost" id="exploreBackBtn">← Back</button>
      <span class="mono">${ctx.questions.length} questions</span>
      <span class="mono">Practice · no score</span>
    </div>
    <div class="thin-progress"><div style="width:100%;"></div></div>
    <h2 class="serif" style="font-size:32px; margin-bottom:6px;">${esc(ctx.title)}</h2>
    <p style="font-size:13.5px; color:var(--ink-secondary); margin-bottom:24px;">${esc(ctx.sub)}</p>
    <div class="card" style="padding:10px 28px;">
      ${ctx.questions.map((q, i) => `
        <div class="history-entry explore-row" data-explore-q="${i}">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
              <strong class="acc-title-sm">${esc(q.id)}</strong>
              <span class="pill">${esc(icons[q.type] || q.type || '')}</span>
            </div>
            <div class="mono" style="font-size:12px; color:var(--ink-muted);">
              ${esc(q.section || '')} · ${q.marks} mark${q.marks === 1 ? '' : 's'}${q.subtopic ? ` · ${esc(q.subtopic)}` : ''}${q._src ? ` · from ${esc(q._src)}` : ''}
            </div>
          </div>
          <span class="mono" style="color:var(--ink-muted);">›</span>
        </div>
      `).join('')}
    </div>
  `;

  $('#exploreBackBtn').onclick = () => {
    S.room = ctx.backRoom || 'past';
    renderRoom();
  };
  document.querySelectorAll('[data-explore-q]').forEach(b => {
    b.onclick = () => {
      S.returnRoom = ctx.backRoom;
      beginRun({
        mode: 'explore',
        quizLike: { uuid: null, version: null, title: ctx.title, timeLimitMinutes: null, questions: ctx.questions },
        meta: { category: 'past-paper', file: '', virtual: true },
        // Results-review lists keep the finished run's working (unlocked);
        // any other explore list starts clean.
        resume: ctx.carryAnswers ? { answers: S.answers, elapsedSeconds: S.elapsed, startedAt: S.startedAt } : undefined,
        startIdx: +b.dataset.exploreQ
      });
    };
  });
}
