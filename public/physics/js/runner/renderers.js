// Physics Question Renderers (MCQ, Written, Self-Marked, Multi-Step Calculation)
import { S } from '../state.js';
import { $, esc, ak, chipify, tableHtml, imgSrc, qImages, imgHtml } from '../utils.js';
import { renderQ, navNext, progress } from './assessment.js';
import { finishQuiz } from './finish.js';
import { goExploreBack } from '../views/explore.js';
import { matchMistakes, feedbackHtml } from '../../../shared/js/answerFeedback.js';

export function normalizeDeps(deps){
  if (!Array.isArray(deps)) return [];
  return deps.map(d => typeof d === 'string' ? { id: d, showAnswer: false } : { id: d.id, showAnswer: !!d.showAnswer }).filter(d => d.id);
}

export function depAnswerData(src){
  if (!src) return null;
  if (src.type === 'calculation'){
    const t = `${src.answer} ${src.unit || ''}`.trim();
    return { label: 'Answer', text: t };
  }
  if (src.type === 'multiple-choice'){
    const o = src.options?.[src.correctIndex];
    return { label: 'Answer', text: typeof o === 'string' ? o : (o?.text || '') };
  }
  if (src.type === 'written') return { label: 'Mark scheme', points: (src.markScheme || []).map(m => m.text) };
  if (src.type === 'self-marked'){
    return {
      label: 'Answer', text: src.answerText || '',
      image: src.answerImage ? imgSrc(src.answerImage, src._imgBase) : null,
      alt: src.answerAlt || ('Answer diagram for ' + src.id),
    };
  }
  return null;
}

export function resolveDeps(questions, pool){
  const byId = new Map();
  for (const q of pool) {
    if (!q?.id) continue;
    if (!byId.has(q.id)) byId.set(q.id, []);
    byId.get(q.id).push(q);
  }
  // ids collide across banks — a question's prerequisite is the one from its
  // own source file; bare-id fallback only when no same-file candidate exists
  const pickSrc = (id, dependent) => {
    const cands = byId.get(id);
    if (!cands) return null;
    if (dependent && dependent._srcFile) {
      const same = cands.find(c => c._srcFile === dependent._srcFile);
      if (same) return same;
    }
    return cands[0];
  };
  for (const q of questions){
    q._deps = normalizeDeps(q.dependsOn).map(d => {
      const src = pickSrc(d.id, q);
      if (!src || src === q) return { id: d.id, missing: !src };
      return {
        id: src.id, _srcKey: src._key || null, prompt: src.prompt, guidance: src.guidance, showAnswer: d.showAnswer,
        table: src.table || null,
        images: qImages(src).map(it => ({ src: imgSrc(it.file, src._imgBase), alt: it.alt, caption: it.caption })),
        answer: depAnswerData(src),
      };
    });
  }
  return questions;
}

export function depAnswerVisible(dep){
  if (!dep.showAnswer || !dep.answer) return false;
  if (S.runMode === 'explore') return true;
  // identity first: the exact object resolution picked — two run questions can
  // share an id across banks, and the wrong one's lock must not gate the answer
  const inRun = (dep._srcKey && (S.quiz?.questions || []).find(q => q._key === dep._srcKey))
    || (S.quiz?.questions || []).find(q => q.id === dep.id);
  if (!inRun) return true; // predecessor not in this set - needed to proceed
  const a = S.answers[ak(inRun)];
  return !!(a && a.locked);
}

export function depHtml(q){
  if (!q._deps?.length) return '';
  const items = q._deps.map(d => {
    if (d.missing) return `<p class="mono" style="font-size:12px; color:var(--ink-muted);">(${esc(d.id)} - not in this set)</p>`;
    const inRun = (d._srcKey && (S.quiz?.questions || []).find(x => x._key === d._srcKey)) || (S.quiz?.questions || []).find(x => x.id === d.id);
    const status = !inRun ? 'Needed for this question' : (S.answers[ak(inRun)]?.locked ? 'Already Answered' : 'Answer locked for now');
    const ans = depAnswerVisible(d) && d.answer ? `
      <div class="note-ok" style="margin-top:12px;"><b>${esc(d.answer.label)}:</b> ${d.answer.text ? chipify(d.answer.text) : ''}
      ${(d.answer.points || []).map(p => `<div>• ${esc(p)}</div>`).join('')}
      ${d.answer.image ? `<div class="diagram-frame" style="margin:12px 0 4px;"><img src="${esc(d.answer.image)}" alt="${esc(d.answer.alt || '')}" loading="lazy"/></div>` : ''}</div>` : '';
    return `<div class="context-reference">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
        <span class="mono" style="font-size:11px; font-weight:600; color:var(--blue); text-transform:uppercase;">Reference Context from ${esc(d.id)} · ${esc(status)}</span>
        <span class="pill blue">Read-only reference</span>
      </div>
      <p style="font-size:13.5px; color:var(--ink-secondary); margin-bottom:10px;">${chipify(d.prompt || '')}</p>
      ${d.table ? tableHtml({ table: d.table }) : ''}
      ${(d.images || []).map(it => `<div class="diagram-frame" style="margin:12px 0 4px;"><img src="${esc(it.src)}" alt="${esc(it.alt || '')}" loading="lazy"/>${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</div>`).join('')}${ans}
    </div>`;
  }).join('');
  return items;
}

export function msPanel(q, a, disabled){
  const items = (q.markScheme || []).map((m, i) => {
    const hl = m.highlights?.length ? m.highlights : [];
    let t = esc(m.text);
    for (const h of hl){ t = t.replace(esc(h), `<span class="key-phrase">${esc(h)}</span>`); }
    const on = !!a.ticks?.[i];
    return `<div class="ms-item ${on ? 'checked' : ''}" data-ms-item="${i}">
      <input type="checkbox" data-tick="${i}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="margin-top:4px; accent-color:var(--green);" />
      <div><strong>[${m.marks ?? 1}]</strong> ${t}</div>
    </div>`;
  }).join('');
  const ticked = (a.ticks || []).reduce((sum, t, i) => sum + (t ? (+((q.markScheme || [])[i] || {}).marks || 1) : 0), 0);
  return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
      <span class="mono" style="font-size:12px; font-weight:600;">COMPARE WITH OFFICIAL MARK SCHEME</span>
      <span class="pill green">${Math.min(ticked, q.marks)} / ${q.marks} marks</span>
    </div>${items}`;
}

export function promptHead(q){
  return `<h2 class="q-heading">${chipify(q.prompt)}</h2>${tableHtml(q)}${imgHtml(q)}`;
}

// ----- MCQ -----
export function mcqHtml(q){
  const a = S.answers[ak(q)] || {};
  const explore = S.runMode === 'explore';
  const showHelp = explore || !!a.locked;
  const showSubs = (!explore && a.locked) || (explore && a.revealed);
  const opts = q.options.map((o, i) => {
    let cls = 'opt-card';
    let tag = '';
    if ((!explore && a.locked) || (explore && a.revealed)){
      if (i === q.correctIndex){ cls += ' is-correct'; tag = `<span class="mono" style="font-size:11.5px; color:var(--green);">${explore ? '✓ Correct' : '✓ Locked Pick'}</span>`; }
      else if (i === a.picked){ cls += ' is-wrong'; }
      else cls += ' is-dim';
    }
    const dis = (!explore && a.locked) ? 'disabled' : '';
    const text = typeof o === 'string' ? o : (o.text || '');
    const sub = (typeof o !== 'string' && o.sub && showSubs) ? `<span class="opt-sub">${explore && i !== q.correctIndex ? 'Diagnostic: ' : ''}${esc(o.sub)}</span>` : '';
    return `<button class="${cls}" data-pick="${i}" ${dis}>
      <div class="opt-top"><strong class="mono">${'ABCDEF'[i] || i + 1} &nbsp; ${esc(text)}</strong>${tag}</div>${sub}
    </button>`;
  }).join('');
  let fb = '';
  if (!explore && a.locked)
    fb = `<div class="${a.correct ? 'note-ok' : 'note-bad'}">${a.correct ? '✅ <b>Lovely - spot on.</b> ' + esc(q.feedbackCorrect || 'One mark in the bank.') : '❌ <b>Not quite.</b> ' + esc(q.feedbackWrong || ('Correct answer: ' + 'ABCDEF'[q.correctIndex]))}</div>
    <p class="note-line"><b>One answer only</b> - your pick locks in and counts, right or wrong.</p>`;
  else if (!explore) fb = `<p class="note-line"><b>One answer only</b> - your pick locks in and counts, right or wrong.</p>`;
  else if (a.revealed) fb = `<div class="${a.picked === q.correctIndex ? 'note-ok' : 'note-bad'}">${a.picked === q.correctIndex ? '✅ <b>Correct.</b> ' + esc(q.feedbackCorrect || '') : '❌ <b>Not quite - try again.</b> ' + esc(q.feedbackWrong || '')}</div>
    <p class="note-line">Practice mode - pick freely, nothing is scored.</p>`;
  else fb = `<p class="note-line">Practice mode - pick freely, nothing is scored.</p>`;
  fb += feedbackHtml(matchMistakes(q, a.picked ?? a.selected), esc);
  return `${promptHead(q)}${q.hint && showHelp ? `<div class="q-guide">Starter hint: ${esc(q.hint)}</div>` : ''}
  <div class="opt-grid">${opts}</div>${fb}`;
}

export function wireQ(q){
  if (q.type === 'multiple-choice'){
    document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const i = +b.dataset.pick, k = ak(q);
      if (S.runMode === 'explore'){
        const a = S.answers[k] ||= {};
        a.picked = i; a.revealed = true;
      } else {
        const correct = i === q.correctIndex;
        S.answers[k] = { locked: true, picked: i, correct, score: correct ? q.marks : 0 };
      }
      renderQ();
    });
    wireNav();
  } else if (q.type === 'written'){ wireWritten(q); }
  else if (q.type === 'self-marked'){ wireSelfMarked(q); }
  else { wireCalc(q); }
}

export function wireNav(lockFn){
  $('#nextQ').onclick = () => navNext(lockFn);
  $('#finishQ').onclick = () => {
    if (S.runMode === 'explore') goExploreBack();
    else { if (lockFn) lockFn(); finishQuiz(); }
  };
}

// ----- Written -----
export function writtenHtml(q){
  const a = S.answers[ak(q)] || { text: '', ticks: [] };
  const explore = S.runMode === 'explore';
  const locked = !explore && a.locked;
  const showHelp = explore || !!a.locked;
  const tail = explore ? 'Practice - tick freely, nothing is scored.'
    : `Honest ticking only${a.locked ? ` · <b>Locked: ${a.score}/${q.marks}</b> (cannot be changed)` : ' · <b>Text locks the moment you open the mark scheme</b>'}`;
  return `${promptHead(q)}${q.guidance && showHelp ? `<div class="q-guide">${esc(q.guidance)}</div>` : ''}
  <div style="margin-bottom: 24px;">
    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
      <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">YOUR RESPONSE (LOCKED AFTER VIEWING MARK SCHEME)</span>
      <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">${(a.text || '').trim() ? 'Saved ✓' : ''}</span>
    </div>
    <textarea class="essay-pad" id="wText" placeholder="Type your explanation here..." ${(!explore && (a.locked || a.showMs)) ? 'disabled' : ''}>${esc(a.text || '')}</textarea>
  </div>
  ${a.showMs ? msPanel(q, a, locked) : `<button class="btn" id="msToggle">Compare with mark scheme ↓</button>
  <p class="note-line" style="margin-top:8px;">Official wording, with the phrases that earn marks · opening locks your text and cannot be undone</p>`}
  <p class="note-line">${tail}</p>`;
}

export function wireWritten(q){
  const k = ak(q), explore = S.runMode === 'explore';
  const t = $('#wText');
  if (t) t.oninput = () => { const a = S.answers[k] ||= { ticks: [] }; a.text = t.value; renderQFootSaved(); };
  const tg = $('#msToggle');
  if (tg) tg.onclick = () => { const a = S.answers[k] ||= { ticks: [] }; a.showMs = true; renderQ(); };
  wireTicks(k);
  if (explore){ wireNav(); return; } // free navigation, never locks
  const lock = () => {
    const a = S.answers[k] ||= { ticks: [] };
    if (!a.locked){ const n = (a.ticks || []).reduce((sum, t, i) => sum + (t ? (+((q.markScheme || [])[i] || {}).marks || 1) : 0), 0); a.locked = true; a.score = Math.min(n, q.marks); }
  };
  wireNav(lock);
}

export function wireTicks(k){
  document.querySelectorAll('[data-tick]').forEach(c => c.onchange = () => {
    const a = S.answers[k] ||= { ticks: [] }; a.ticks = a.ticks || [];
    a.ticks[+c.dataset.tick] = c.checked; renderQ();
  });
  document.querySelectorAll('[data-ms-item]').forEach(item => item.onclick = (e) => {
    if (e.target.tagName === 'INPUT') return;
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb && !cb.disabled){ cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
  });
}

export function renderQFootSaved(){ /* textarea keeps focus - no full rerender while typing */ }

// ----- Self-marked (draw/annotate: nothing typed) -----
export function selfMarkedHtml(q){
  const a = S.answers[ak(q)] || { ticks: [] };
  const explore = S.runMode === 'explore';
  const locked = !explore && a.locked;
  const revealed = !!a.revealed;
  const tail = explore ? 'Practice - tick honestly, nothing is scored.'
    : !revealed ? 'Work on paper first - honest self-marking only'
    : `Honest ticking only${a.locked ? ` · <b>Locked: ${a.score}/${q.marks}</b> (cannot be changed)` : ''}`;
  return `${promptHead(q)}${q.guidance ? `<div class="q-guide">${esc(q.guidance)}</div>` : ''}
  ${!revealed ? `<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:8px;">
      <button class="btn btn-primary" id="revealAns">Reveal Official Answer ↓</button>
      <span style="font-size:12.5px; color:var(--ink-muted);">Work on paper first - honest self-marking only</span>
    </div>` : `
    <div class="ms-item checked" style="cursor:default; margin-top:8px;">
      <div><strong>[${q.marks}]</strong> ${chipify(q.answerText || '')}</div>
    </div>
    ${q.answerImage ? `<div class="diagram-frame"><img src="${esc(imgSrc(q.answerImage, q._imgBase))}" alt="${esc(q.answerAlt || ('Answer diagram for ' + q.id))}" loading="lazy"/>${q.answerCaption ? `<figcaption>${esc(q.answerCaption)}</figcaption>` : ''}</div>` : ''}
    ${a.showMs ? msPanel(q, a, locked) : `<div style="margin-top:14px;"><button class="btn" id="msToggle">Tick against the mark scheme ↓</button>
    <p class="note-line" style="margin-top:8px;">Only tick what you actually had · cannot be closed again</p></div>`}`}
  <p class="note-line">${tail}</p>`;
}

export function wireSelfMarked(q){
  const k = ak(q), explore = S.runMode === 'explore';
  const rv = $('#revealAns');
  if (rv) rv.onclick = () => { const a = S.answers[k] ||= { ticks: [] }; a.revealed = true; a.showMs = true; renderQ(); };
  const tg = $('#msToggle');
  if (tg) tg.onclick = () => { const a = S.answers[k] ||= { ticks: [] }; a.showMs = true; renderQ(); };
  wireTicks(k);
  if (explore){ wireNav(); return; } // free navigation, never locks
  const lock = () => {
    const a = S.answers[k] ||= { ticks: [] };
    if (!a.locked){ const n = (a.ticks || []).reduce((sum, t, i) => sum + (t ? (+((q.markScheme || [])[i] || {}).marks || 1) : 0), 0); a.locked = true; a.score = Math.min(n, q.marks); }
  };
  wireNav(lock);
}

// ----- Calculation -----
export function numOk(v, target, tol = 2.5){ if (!isFinite(v) || !isFinite(target)) return false; if (target === 0) return Math.abs(v) < 1e-9; return Math.abs(v - target) / Math.abs(target) * 100 <= tol; }
// declared absolute tolerance bands take precedence over the percentage
// default — printed schemes publish the band, so online grading must agree
export function bandOk(v, q) {
  if (q && q.tolerance && typeof q.tolerance === 'object') return isFinite(v) && v >= q.tolerance.min && v <= q.tolerance.max;
  return numOk(v, q ? q.answer : NaN, (q && q.tolerancePercent) ?? 2.5);
}

export function stepBlocks(q, a, enabled){
  return ((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).map((s, i) => {
    const st = (a.steps || [])[i] || {};
    const prevOk = ((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).slice(0, i).every((_, j) => ((a.steps || [])[j] || {}).correct);
    const on = enabled && prevOk && !st.correct;
    return `<div class="recovery-step" ${st.correct ? 'style="border-color:var(--green);"' : ''}>
      <div>
        <div class="mono" style="font-size:11.5px; color:${st.correct ? 'var(--green)' : 'var(--ink-secondary)'};">${st.correct ? '✓ ' : ''}Step ${i + 1} · ${esc(s.title)}</div>
        <div class="step-equation">Use <code>${esc(s.equation || '')}</code>${s.hint ? ` - ${esc(s.hint)}` : ''}${s.unit ? ` (${esc(s.unit)})` : ''}</div>
        ${st.failed && s.equationReveal ? `<div class="equation-reveal">💡 ${esc(s.equationReveal)}</div>` : ''}
        ${st.correct ? '' : `<div class="step-input-row"><input data-step="${i}" placeholder="…" value="${esc(st.value ?? '')}" ${on ? '' : 'disabled'}/> <span class="mono" style="font-size:12px; color:var(--ink-muted);">${esc(s.unit || '')}</span></div>`}
      </div>
      ${st.correct ? `<span class="pill green">Verified</span>` : `<button class="btn" data-check-step="${i}" ${on ? '' : 'disabled'}>Check</button>`}
    </div>`;
  }).join('');
}

export function calcHtml(q){
  const a = S.answers[ak(q)] || { attempts: 0 };
  const tol = q.tolerancePercent ?? 2.5;
  if (S.runMode === 'explore'){
    const showSteps = !!a.showSteps;
    const done = ((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).length > 0 && (a.steps || []).filter(s => s.correct).length === ((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).length;
    return `${promptHead(q)}${q.guidance ? `<div class="q-guide">${esc(q.guidance)}</div>` : ''}
    <div class="answer-dock">
      <div class="unit-field"><input type="text" id="calcInput" placeholder="Value…" value="${esc(a.finalValue ?? '')}" /><span class="unit-tag">${esc(q.unit || '')}</span></div>
      <button class="btn btn-primary" id="checkCalc">Check Answer</button>
      ${((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).length ? `<button class="btn-ghost mono" style="font-size:12px;" id="showStepsBtn">${showSteps ? 'Hide steps' : 'Show steps'}</button>` : ''}
    </div>
    ${a.lastOk === true ? `<div class="note-ok">✅ <b>Correct.</b> ${esc(q.explanation || '')}</div>` : ''}
    ${a.lastOk === false ? `<p class="note-line">❌ Not quite - attempt ${a.attempts || 0}. Try again or open the steps.</p>` : ''}
    <p class="note-line">Practice - unlimited tries, nothing is scored.</p>
    ${showSteps ? `<div style="margin-top:24px; padding-top:20px; border-top:1px dashed var(--border-strong);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span class="mono" style="font-size:11.5px; color:var(--amber);">STEP-BY-STEP PRACTICE</span>
      </div>
      <div class="recovery-stack">${stepBlocks(q, a, true)}</div>
      ${done ? `<div class="note-ok">✅ All steps correct - nicely worked.</div>` : ''}</div>` : ''}`;
  }
  const showSteps = !!a.loggedWrong;
  const locked = a.soloCorrect || a.helpedDone;
  const stepsDone = ((q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) ) || []).length;
  const stepsOk = (a.steps || []).filter(s => s.correct).length;
  const canLog = a.loggedWrong && !a.helpedDone && (stepsDone === 0 || stepsOk === stepsDone);
  const statusPill = a.soloCorrect ? `<span class="pill green">Solo: ${q.marks}/${q.marks}</span>`
    : a.helpedDone ? `<span class="pill amber">Logged · helped</span>`
    : a.loggedWrong ? `<span class="pill amber">Solo: 0/${q.marks} · Helped Available</span>`
    : `<span class="pill">Attempt 1 / 1</span>`;
  return `${promptHead(q)}${q.guidance && (a.soloCorrect || a.loggedWrong || a.helpedDone) ? `<div class="q-guide">Method: ${esc(q.guidance)}</div>` : ''}
  <div class="answer-dock">
    <div class="unit-field"><input type="text" id="calcInput" placeholder="Value…" value="${esc(a.finalValue ?? '')}" ${(a.loggedWrong || a.soloCorrect) ? 'disabled' : ''} /><span class="unit-tag">${esc(q.unit || '')}</span></div>
    <button class="btn btn-primary" id="checkCalc" ${(a.loggedWrong || a.soloCorrect) ? 'disabled' : ''}>Check Answer</button>
    <span style="font-size:12.5px; color:var(--ink-muted); margin-left:auto;">Wrong stays wrong (0 solo) · Completing steps logs as <strong>helped</strong></span>
  </div>
  ${a.soloCorrect ? `<div class="note-ok">✅ <b>Correct first try - ${q.marks} mark${q.marks === 1 ? '' : 's'} solo.</b> ${esc(q.explanation || '')}</div>` : ''}
  ${a.loggedWrong && !a.helpedDone ? `<p class="note-wrong">✕ <b>Wrong first try - logged as wrong.</b> Work the steps below, then log it as helped.</p>` : ''}
  ${a.helpedDone ? `<div class="note-ok">✅ Steps complete - correct answer is <b>${esc(String(q.answer))} ${esc(q.unit || '')}</b>. Logged as <b>helped</b>; wrong stays wrong.</div>` : ''}
  ${showSteps ? `<div style="margin-top:24px; padding-top:20px; border-top:1px dashed var(--border-strong);">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span class="mono" style="font-size:11.5px; color:var(--amber);">GATED STEP-BY-STEP RECOVERY</span>
      ${statusPill}
    </div>
    <div class="recovery-stack">${stepBlocks(q, a, !locked)}
      <div class="recovery-step" ${canLog ? 'style="border-color:var(--green);"' : ''}>
        <div>
          <div class="mono" style="font-size:11.5px; color:var(--ink-secondary);">✓ Log it</div>
          <div style="font-size:13.5px; margin-top:3px;">Complete all steps above, then log this question as helped.</div>
        </div>
        <button class="btn btn-primary" data-finish-helped ${canLog ? '' : 'disabled'}>Log as helped ✓</button>
      </div>
    </div>
  </div>
  <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
    <button class="btn btn-primary" data-finish-helped ${canLog ? '' : 'disabled'}>Overwrite &amp; log helped ✓</button>
  </div>` : ''}`;
}

export function wireCalc(q){
  const k = ak(q);
  const a = S.answers[k] ||= { attempts: 0, steps: [] };
  const tol = q.tolerancePercent ?? 2.5;
  if (S.runMode === 'explore'){
    $('#checkCalc').onclick = () => {
      const v = parseFloat($('#calcInput').value);
      a.finalValue = $('#calcInput').value;
      a.attempts = (a.attempts || 0) + 1;
      a.lastOk = bandOk(v, q);
      renderQ();
    };
    const ss = $('#showStepsBtn');
    if (ss) ss.onclick = () => { a.showSteps = !a.showSteps; renderQ(); };
    wireStepChecks(q, a);
    wireNav();
    return;
  }
  const chk = $('#checkCalc');
  if (chk) chk.onclick = () => {
    const v = parseFloat($('#calcInput').value);
    a.finalValue = $('#calcInput').value;
    a.attempts = (a.attempts || 0) + 1;
    if (bandOk(v, q)){ a.soloCorrect = true; a.locked = true; a.score = q.marks; }
    else { a.loggedWrong = true; a.locked = true; a.score = 0; a.steps = a.steps || []; }
    renderQ();
  };
  wireStepChecks(q, a);
  document.querySelectorAll('[data-finish-helped]').forEach(b => b.onclick = () => { a.helped = true; a.helpedDone = true; a.locked = true; a.score = 0; renderQ(); });
  wireNav();
}

export function wireStepChecks(q, a){
  const tol = q.tolerancePercent ?? 2.5;
  document.querySelectorAll('[data-check-step]').forEach(b => b.onclick = () => {
    const i = +b.dataset.checkStep; const s = (q.steps || (q.stepChecks||[]).map(sc=>({title:sc.label})) )[i];
    const inp = document.querySelector(`[data-step="${i}"]`);
    const v = parseFloat(inp.value);
    a.steps = a.steps || []; a.steps[i] = a.steps[i] || {};
    a.steps[i].value = inp.value;
    if (numOk(v, s.answer, s.tolerancePercent ?? tol)){ a.steps[i].correct = true; }
    else { a.steps[i].failed = true; }
    renderQ();
  });
}
