// Computer Science Modal Dialogs (Synthesizer & Topic Builder)
import { S, MIXED_UUID } from './state.js';
import { $, esc } from './utils.js';
import { mixedPool, pickForMode } from './taxonomy.js';
import { startMixedRun, paceMinutesPerMark } from './runner/starters.js';
import { beginRun } from './runner/assessment.js';
import { paperPrintDoc, markSchemePrintDoc, openPrintWindow } from '../../shared/js/printPaper.js';

// print export — paper + mark scheme from the SAME pick (cached so the
// teacher copy always matches the student paper it was printed with)
let _printPick = null;
function wireSynthPrint(portalLabel) {
  const host = $('#synthStartExamBtn') && $('#synthStartExamBtn').parentElement;
  if (!host || $('#synthPrintPaperBtn')) return;
  const mk = (id, label, title) => {
    const b = document.createElement('button');
    b.className = 'btn btn-ghost';
    b.id = id;
    b.textContent = label;
    b.title = title;
    b.style.fontSize = '11.5px';
    host.appendChild(b);
    return b;
  };
  const buildPick = () => {
    const pool = mixedPool();
    if (!pool.length) { alert('No questions in the selected topics.'); return null; }
    const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
    if (!set.length) { alert('No paper can be built from the current selection.'); return null; }
    const pace = paceMinutesPerMark(S.mixed.pace);
    const timeMinutes = pace == null ? null : Math.max(5, Math.round(tot * pace));
    return { set, tot, timeMinutes, title: `Synthesized Paper · ${tot} marks` };
  };
  const settingsSig = () => JSON.stringify([[...S.mixed.topics].sort(), [...S.mixed.subs].sort(), S.mixed.m, S.mixed.mode, S.mixed.pace]);
  mk('synthPrintPaperBtn', '⎙ Print paper', 'Print-ready student paper (opens print dialog)').onclick = () => {
    // reuse the cached pick when settings haven't changed — paper and scheme
    // always match, and re-printing the paper never silently re-rolls it
    if (!_printPick || _printPick.sig !== settingsSig()) {
      const p = buildPick(); if (!p) return;
      p.sig = settingsSig();
      _printPick = p;
    }
    openPrintWindow(paperPrintDoc({ title: _printPick.title, portal: portalLabel, timeMinutes: _printPick.timeMinutes, questions: _printPick.set }));
  };
  mk('synthPrintSchemeBtn', '⎙ Mark scheme', 'Teacher copy with marking criteria + common errors — matches the last printed paper').onclick = () => {
    if (!_printPick || _printPick.sig !== settingsSig()) {
      const p = buildPick(); if (!p) return;
      p.sig = settingsSig();
      _printPick = p;
    }
    openPrintWindow(markSchemePrintDoc({ title: _printPick.title, portal: portalLabel, timeMinutes: _printPick.timeMinutes, questions: _printPick.set }));
  };
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
              <div class="subtopic-chip ${checked ? 'checked' : ''}" data-synth-sub="${esc(key)}">
                <span class="custom-check">✓</span>
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
  const pace = paceMinutesPerMark(S.mixed.pace);
  $('#synthStartExamBtn').textContent = pace == null
    ? 'Start Exam · untimed'
    : `Start Exam · ${Math.max(5, Math.round($('#synthModalSlider').value * pace))}m ⏱`;

  $('#synthModal').classList.add('open');
  wireSynthPrint('A-Level Computer Science · OCR');

  $('#synthClose').onclick = () => $('#synthModal').classList.remove('open');
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
    const pm = paceMinutesPerMark(S.mixed.pace);
    $('#synthStartExamBtn').textContent = pm == null
      ? 'Start Exam · untimed'
      : `Start Exam · ${Math.max(5, Math.round(S.mixed.m * pm))}m ⏱`;
  };

  document.querySelectorAll('[data-synth-sub]').forEach(el => {
    el.onclick = () => {
      const k = el.dataset.synthSub;
      if (S.mixed.subs.has(k)) S.mixed.subs.delete(k);
      else S.mixed.subs.add(k);
      openSynthModal();
    };
  });

  document.querySelectorAll('#synthPaceSeg [data-pace]').forEach(b => {
    b.onclick = () => {
      S.mixed.pace = b.dataset.pace;
      document.querySelectorAll('#synthPaceSeg [data-pace]').forEach(x => x.classList.toggle('active', x === b));
      const pm2 = paceMinutesPerMark(S.mixed.pace);
      $('#synthStartExamBtn').textContent = pm2 == null
        ? 'Start Exam · untimed'
        : `Start Exam · ${Math.max(5, Math.round(S.mixed.m * pm2))}m ⏱`;
    };
  });
  document.querySelectorAll('#synthPaceSeg [data-pace]').forEach(x => x.classList.toggle('active', x.dataset.pace === S.mixed.pace));

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
  $('#topicClose').onclick = () => $('#topicModal').classList.remove('open');

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
