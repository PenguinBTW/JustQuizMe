// Computer Science Modal Dialogs (Synthesizer & Topic Builder)
import { S, MIXED_UUID } from './state.js';
import { $, esc } from './utils.js';
import { mixedPool, pickForMode } from './taxonomy.js';
import { startMixedRun } from './runner/starters.js';
import { beginRun } from './runner/assessment.js';

let modalFocusBack = null;

function focusInto(closeId) {
  const ae = document.activeElement;
  // Re-render calls (chip toggles) re-enter while focus is inside the OPEN
  // dialog — don't steal it back to the close button.
  if (ae?.closest?.('.modal-backdrop.open')) return;
  // Record the outside trigger as the return target. Never record <body>
  // (a removed chip falls back to it) or a control inside a closed dialog
  // (e.g. after Start Quiz hides the modal without moving focus).
  if (ae && ae !== document.body && !ae.closest?.('.modal-backdrop')) modalFocusBack = ae;
  $(closeId)?.focus();
}

export function restoreModalFocus() {
  modalFocusBack?.focus?.();
  modalFocusBack = null;
}

export function openSynthModal() {
  const data = (S._topicData || []).filter(t => S.mixed.topics.has(t.topic));
  let subHtml = '';

  data.forEach(t => {
    subHtml += `
      <div>
        <div class="modal-topic-group-title">
          <span>${esc(t.topic)}</span>
          <span class="mono" style="font-size:12px; color:var(--ink-muted);">(${t.subs.length} subtopics)</span>
        </div>
        <div class="subtopic-pills-wrap">
          ${t.subs.map((g, gi) => {
            const key = `${t.topic}|${gi}`;
            const checked = S.mixed.subs.has(key);
            return `
              <div class="subtopic-chip ${checked ? 'checked' : ''}" data-synth-sub="${esc(key)}" role="checkbox" aria-checked="${checked}" tabindex="0">
                <span class="custom-check" aria-hidden="true">✓</span>
                <span>${esc(g.name)}</span>
                <span class="mono" style="font-size:11px; opacity:0.7;">(${g.questions.length})</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  $('#synthModalSubtopicGroups').innerHTML = subHtml;
  const poolMarks = mixedPool().reduce((s, q) => s + (+q.marks || 0), 0);
  $('#synthModalSlider').max = Math.max(10, Math.min(70, poolMarks));
  $('#synthModalSlider').value = Math.min(S.mixed.m, poolMarks);
  $('#synthModalMarksLabel').textContent = `${$('#synthModalSlider').value} marks`;
  const mins = Math.round($('#synthModalSlider').value * 1.07);
  $('#synthStartExamBtn').textContent = `Start Exam · ${mins}m ⏱`;

  $('#synthModal').classList.add('open');
  focusInto('#synthClose');

  $('#synthClose').onclick = () => { $('#synthModal').classList.remove('open'); restoreModalFocus(); };
  $('#synthToggleAllBtn').onclick = () => {
    const allChecked = data.every(t => t.subs.every((g, gi) => S.mixed.subs.has(`${t.topic}|${gi}`)));
    if (allChecked) {
      data.forEach(t => t.subs.forEach((g, gi) => S.mixed.subs.delete(`${t.topic}|${gi}`)));
    } else {
      data.forEach(t => t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`)));
    }
    openSynthModal();
  };

  $('#synthModalSlider').oninput = (e) => {
    S.mixed.m = +e.target.value;
    $('#synthModalMarksLabel').textContent = `${S.mixed.m} marks`;
    const m = Math.round(S.mixed.m * 1.07);
    $('#synthStartExamBtn').textContent = `Start Exam · ${m}m ⏱`;
  };

  document.querySelectorAll('[data-synth-sub]').forEach(el => {
    el.onkeydown = (ev) => { if (!ev.repeat && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); el.click(); } };
    el.onclick = () => {
      const k = el.dataset.synthSub;
      if (S.mixed.subs.has(k)) S.mixed.subs.delete(k);
      else S.mixed.subs.add(k);
      openSynthModal();
      // The re-render replaced this chip; put focus back on its successor.
      document.querySelector(`[data-synth-sub="${CSS.escape(k)}"]`)?.focus();
    };
  });

  $('#synthStartQuizBtn').onclick = () => {
    $('#synthModal').classList.remove('open');
    startMixedRun(false);
  };

  $('#synthStartExamBtn').onclick = () => {
    $('#synthModal').classList.remove('open');
    startMixedRun(true);
  };
}

export function openTopicModal(ti) {
  const c = S._topicCache.get('t' + ti);
  if (!c) return;
  $('#modalTopicTitle').textContent = c.t.topic;
  $('#modalSlider').max = Math.min(50, c.t.mmarks);
  $('#modalSlider').value = Math.min(20, c.t.mmarks);
  $('#modalMarksLabel').textContent = `${$('#modalSlider').value} marks`;
  $('#modalExamBtn').textContent = `Start Exam · ${Math.round($('#modalSlider').value * 1.07)}m ⏱`;

  $('#topicModal').classList.add('open');
  focusInto('#topicClose');
  $('#topicClose').onclick = () => { $('#topicModal').classList.remove('open'); restoreModalFocus(); };

  $('#modalSlider').oninput = (e) => {
    $('#modalMarksLabel').textContent = `${e.target.value} marks`;
    $('#modalExamBtn').textContent = `Start Exam · ${Math.round(e.target.value * 1.07)}m ⏱`;
  };

  $('#topicStartQuizBtn').onclick = () => {
    $('#topicModal').classList.remove('open');
    const { set, tot } = pickForMode(c.all, 'standard', +$('#modalSlider').value);
    beginRun({
      mode: 'quiz',
      quizLike: { uuid: MIXED_UUID, version: 1, title: `${c.t.topic} · ${tot} Marks`, timeLimitMinutes: null, questions: set },
      meta: { category: 'normal', file: 'topic', virtual: true }
    });
  };

  $('#modalExamBtn').onclick = () => {
    $('#topicModal').classList.remove('open');
    const { set, tot } = pickForMode(c.all, 'standard', +$('#modalSlider').value);
    beginRun({
      mode: 'exam',
      quizLike: { uuid: MIXED_UUID, version: 1, title: `${c.t.topic} · ${tot} Marks`, timeLimitMinutes: Math.round(tot * 1.07), exam: true, questions: set },
      meta: { category: 'normal', file: 'topic', virtual: true }
    });
  };
}
