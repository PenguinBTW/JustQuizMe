// Physics Modal Dialogs (Synthesizer & Topic Quiz Builder)
import { S, AQA_TOPICS } from './state.js';
import { $, esc } from './utils.js';
import { mixedPool, topicDraft, pickForMode } from './taxonomy.js';
import { startMixedSel, startTopicQuiz } from './runner/starters.js';
import { paceMinutesPerMark } from './runner/starters.js';

export function openSynthModal(){
  const data = (S._topicData || []).filter(t => S.mixed.topics.has(t.topic) && t.qcount > 0);
  if (!data.length) return;
  // All subtopics selected by default when opening the modal.
  // Seed subtopic selections only for topics never initialized — re-opening
  // (e.g. after a pace change) must not undo deliberate exclusions.
  S.mixed.seededTopics ||= new Set();
  data.forEach(t => {
    if (S.mixed.seededTopics.has(t.topic)) return;
    S.mixed.seededTopics.add(t.topic);
    t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
  });
  const box = $('#synthModalSubtopicGroups');
  box.innerHTML = data.map(t => `
    <div>
      <div class="modal-topic-group-title"><span>${String(AQA_TOPICS.indexOf(t.topic) + 1).padStart(2, '0')} ${esc(t.topic)}</span><span class="mono" style="font-size:11.5px; color:var(--ink-muted);">(${t.qcount} Qs)</span></div>
      <div class="subtopic-pills-wrap">
        ${t.subs.map((g, gi) => `
        <span class="subtopic-chip ${S.mixed.subs.has(`${t.topic}|${gi}`) ? 'checked' : ''}" data-synth-sub="${esc(t.topic)}|${gi}"><span class="custom-check">✓</span> ${esc(g.name)} <span class="mono" style="font-size:11px; color:var(--ink-muted);">(${g.questions.length})</span></span>`).join('')}
      </div>
    </div>`).join('');
  const poolMarks = mixedPool().reduce((s, q) => s + (+q.marks || 0), 0);
  const slider = $('#synthModalSlider');
  slider.max = Math.max(5, Math.min(60, poolMarks));
  S.mixed.m = Math.max(5, Math.min(+slider.max, S.mixed.m || 45));
  slider.value = S.mixed.m;
  document.querySelectorAll('#synthModeSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === S.mixed.mode));
  updateSynthModalMarks(S.mixed.m);
  syncPopupToggleAllButton();
  box.querySelectorAll('[data-synth-sub]').forEach(ch => ch.onclick = () => {
    ch.classList.toggle('checked');
    ch.classList.contains('checked') ? S.mixed.subs.add(ch.dataset.synthSub) : S.mixed.subs.delete(ch.dataset.synthSub);
    syncPopupToggleAllButton();
  });
  $('#synthModal').classList.add('open');
}

export function closeSynthModal(){ $('#synthModal').classList.remove('open'); }

export function syncPopupToggleAllButton(){
  const chips = [...document.querySelectorAll('#synthModalSubtopicGroups .subtopic-chip')];
  const checked = chips.filter(c => c.classList.contains('checked')).length;
  const all = chips.length > 0 && checked === chips.length;
  $('#synthToggleAllBtn').textContent = all ? 'Deselect all' : 'Select all';
  $('#synthModalSubtitle').textContent = `${checked} of ${chips.length} subtopics active across your selected topics.`;
  $('#synthStartQuizBtn').disabled = checked === 0;
  $('#synthStartExamBtn').disabled = checked === 0;
}

export function updateSynthModalMarks(val){
  const m = Number(val);
  S.mixed.m = m;
  $('#synthModalMarksLabel').textContent = `${m} marks`;
  $('#synthStartExamBtn').textContent = paceMinutesPerMark(S.mixed.pace) == null ? 'Start Exam · untimed' : `Start Exam · ${Math.max(5, Math.round(m * paceMinutesPerMark(S.mixed.pace)))}m ⏱`;
}

export function toggleAllPopupSubtopics(){
  const chips = [...document.querySelectorAll('#synthModalSubtopicGroups .subtopic-chip')];
  const all = chips.length > 0 && chips.every(c => c.classList.contains('checked'));
  chips.forEach(c => {
    c.classList.toggle('checked', !all);
    !all ? S.mixed.subs.add(c.dataset.synthSub) : S.mixed.subs.delete(c.dataset.synthSub);
  });
  syncPopupToggleAllButton();
}

export function openTopicModal(ti){
  const c = S._topicCache.get('t' + ti);
  if (!c || !c.t.qcount) return;
  const d = topicDraft(c.t.topic, c.t.mmarks);
  const maxM = Math.max(5, Math.min(50, c.t.mmarks));
  S.topicModal = { ti, marks: Math.max(5, Math.min(maxM, d.marks || 20)), mode: d.mode || 'standard' };
  $('#modalTopicTitle').textContent = c.t.topic;
  const slider = $('#modalSlider');
  slider.max = maxM;
  slider.value = S.topicModal.marks;
  document.querySelectorAll('#topicModeSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === S.topicModal.mode));
  regenTopicModal();
  $('#topicModal').classList.add('open');
}

export function closeTopicModal(){ $('#topicModal').classList.remove('open'); }

export function regenTopicModal(){
  const m = S.topicModal;
  if (!m) return;
  const c = S._topicCache.get('t' + m.ti);
  if (!c) return;
  const { set, tot } = pickForMode(c.all, m.mode, m.marks);
  m.set = set; m.tot = tot;
  $('#modalMarksLabel').textContent = `${m.marks} marks`;
  const pacePerMark = paceMinutesPerMark(S.mixed.pace);
  $('#modalExamBtn').textContent = pacePerMark == null
    ? 'Start Exam · untimed'
    : `Start Exam · ${Math.max(5, Math.round((m.tot || m.marks) * pacePerMark))}m ⏱`;
  $('#modalSummaryLine').textContent = `LIVE SUBTOPIC DISTRIBUTION · ${set.length} QUESTIONS (${tot} MARKS)`;
  const bySub = new Map();
  for (const q of set){
    const k = q._sub || q.subtopic || 'General';
    const e = bySub.get(k) || { n: 0, m: 0 };
    e.n++; e.m += +q.marks || 0; bySub.set(k, e);
  }
  $('#modalSubtopicRows').innerHTML = set.length
    ? [...bySub.entries()].map(([k, e]) => `<div class="dist-row"><span>${esc(k)}</span><span class="mono">${e.n}Q · ${e.m}m</span></div>`).join('')
    : '<span class="mono" style="font-size:12px; color:var(--ink-muted);">Nothing in this pool.</span>';
  const d = topicDraft(c.t.topic, c.t.mmarks);
  d.marks = m.marks; d.mode = m.mode;
}

export function wireModals(){
  $('#synthClose').onclick = closeSynthModal;
  $('#synthModal').addEventListener('click', (e) => { if (e.target.id === 'synthModal') closeSynthModal(); });
  $('#synthToggleAllBtn').onclick = toggleAllPopupSubtopics;
  $('#synthModalSlider').oninput = (e) => updateSynthModalMarks(e.target.value);
  document.querySelectorAll('#synthModeSeg button').forEach(b => b.onclick = () => {
    S.mixed.mode = b.dataset.seg;
    document.querySelectorAll('#synthModeSeg button').forEach(x => x.classList.toggle('active', x === b));
  });
  document.querySelectorAll('#synthPaceSeg [data-pace]').forEach(b => {
    b.classList.toggle('active', b.dataset.pace === S.mixed.pace);
    b.onclick = () => {
      S.mixed.pace = b.dataset.pace;
      document.querySelectorAll('#synthPaceSeg [data-pace]').forEach(x => x.classList.toggle('active', x === b));
      openSynthModal();
    };
  });

  $('#synthStartQuizBtn').onclick = () => { closeSynthModal(); startMixedSel(false); };
  $('#synthStartExamBtn').onclick = () => { closeSynthModal(); startMixedSel(true); };
  $('#topicClose').onclick = closeTopicModal;
  $('#topicModal').addEventListener('click', (e) => { if (e.target.id === 'topicModal') closeTopicModal(); });
  $('#modalSlider').oninput = (e) => { if (S.topicModal){ S.topicModal.marks = +e.target.value; regenTopicModal(); } };
  document.querySelectorAll('#topicModeSeg button').forEach(b => b.onclick = () => {
    if (!S.topicModal) return;
    S.topicModal.mode = b.dataset.seg;
    document.querySelectorAll('#topicModeSeg button').forEach(x => x.classList.toggle('active', x === b));
    regenTopicModal();
  });
  $('#topicStartQuizBtn').onclick = () => { const m = S.topicModal; closeTopicModal(); if (m) startTopicQuiz(m.ti, false); };
  $('#modalExamBtn').onclick = () => { const m = S.topicModal; closeTopicModal(); if (m) startTopicQuiz(m.ti, true); };
}
