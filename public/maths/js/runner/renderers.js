// Maths Question Renderers (Symbolic CAS, Milestone, Proof, Hypothesis, Mechanics, Graph, Written, Calc)
import { S } from '../state.js';
import { $, esc, ak, chipify } from '../utils.js';
import { areMathEqual, cleanMathStr } from '../cas.js';
import { mathKeypadHtml } from './keypad.js';
import { renderQ } from './assessment.js';

// 1. Multiple Choice
export function mcqHtml(q) {
  const a = S.answers[ak(q)] || {};
  const explore = S.runMode === 'explore';
  const showResult = !explore && a.locked;
  const opts = (q.options || []).map((o, i) => {
    let cls = 'opt-card';
    if (showResult || (explore && a.revealed)) {
      if (i === q.correctIndex) cls += ' is-correct';
      else if (i === a.picked) cls += ' is-wrong';
      else cls += ' is-dim';
    }
    const dis = (!explore && a.locked) ? 'disabled' : '';
    const text = typeof o === 'string' ? o : (o.text || '');
    return `
      <button class="${cls}" data-pick="${i}" ${dis}>
        <div class="opt-top">
          <span class="mono" style="font-size:12px; font-weight:700;">${'ABCDEF'[i] || i + 1}</span>
        </div>
        <div>${chipify(text)}</div>
      </button>
    `;
  }).join('');

  let fb = '';
  if (showResult) {
    fb = `<div class="${a.correct ? 'note-ok' : 'note-bad'}">${a.correct ? '✅ Correct: ' + esc(q.feedbackCorrect || 'Mark awarded.') : '❌ Not quite: ' + esc(q.feedbackWrong || ('Correct option: ' + ('ABCDEF'[q.correctIndex])))}</div>`;
  }
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    <div class="opt-grid" style="margin-top:16px;">${opts}</div>
    ${fb}
  `;
}

export function wireMcq(q) {
  document.querySelectorAll('[data-pick]').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.pick;
      const k = ak(q);
      if (S.runMode === 'explore') {
        const a = (S.answers[k] ||= {});
        a.picked = i;
        a.revealed = true;
      } else {
        const correct = i === q.correctIndex;
        S.answers[k] = { locked: true, picked: i, correct, score: correct ? q.marks : 0 };
      }
      renderQ();
    };
  });
}

// 2. Symbolic CAS Exact
export function symbolicHtml(q) {
  const a = S.answers[ak(q)] || {};
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}
    <div style="margin-top:14px;">
      ${mathKeypadHtml('symInput')}
      <input type="text" id="symInput" class="math-input" placeholder="e.g. 5x - 3 or 16/3" value="${esc(a.text || '')}" ${isLocked ? 'disabled' : ''}>
    </div>
    ${!S.quiz?.exam ? `<div style="margin-top:14px;"><button class="btn" id="checkSymBtn" ${isLocked ? 'disabled' : ''}>Check Symbolic Answer</button></div>` : ''}
    ${a.checked && !S.quiz?.exam ? `<div class="${a.correct ? 'note-ok' : 'note-bad'}">${a.correct ? '✅ Equivalence verified!' : '❌ Not equivalent. Expected: ' + esc(q.expected || q.answer)}</div>` : ''}
    <p class="note-line">${S.quiz?.exam ? 'Exam Mode: Your answer will be audited against the mark scheme upon completion.' : 'Enter your simplified mathematical expression.'}</p>
  `;
}

export function wireSymbolic(q) {
  const k = ak(q);
  const inp = $('#symInput');
  if (inp) {
    inp.onfocus = () => { S._activeInputId = 'symInput'; };
    inp.oninput = () => {
      const a = (S.answers[k] ||= {});
      a.text = inp.value;
      if (S.quiz?.exam) {
        a.locked = true;
        a.correct = areMathEqual(inp.value, q.expected || q.answer);
        a.score = a.correct ? q.marks : 0;
      }
    };
  }
  const chk = $('#checkSymBtn');
  if (chk) {
    chk.onclick = () => {
      const val = $('#symInput').value;
      const expected = q.expected || q.answer;
      const correct = areMathEqual(val, expected);
      S.answers[k] = { locked: true, text: val, correct, checked: true, score: correct ? q.marks : 0 };
      renderQ();
    };
  }
}

// 3. Method Milestones
export function milestoneHtml(q) {
  const a = S.answers[ak(q)] || { milestones: {}, targetVal: '' };
  const isLocked = !S.quiz?.exam && a.locked;
  const milestones = q.milestones || [];

  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}
    
    <div style="margin:20px 0;">
      <h4 class="serif" style="font-size:22px; margin-bottom:8px;">Final Exact Answer:</h4>
      ${mathKeypadHtml('finalTargetInput')}
      <input type="text" id="finalTargetInput" class="math-input" placeholder="e.g. 16/3 or 5.333333" value="${esc(a.targetVal || '')}" ${isLocked ? 'disabled' : ''}>
    </div>

    <div style="margin-top:24px;">
      <h4 class="serif" style="font-size:22px; margin-bottom:12px;">Derivation Milestones:</h4>
      ${milestones.map((m, mi) => {
        const mAns = (a.milestones && a.milestones[m.id]) || {};
        return `
          <div class="milestone-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div><span class="milestone-num">${mi + 1}</span><strong>${esc(m.title)}</strong></div>
              <span class="pill mono">${esc(m.rubricMark || m.marks + 'm')}</span>
            </div>
            ${(m.fields || []).map(f => `
              <div class="step-input-row" style="margin-top:6px;">
                <label style="min-width:200px; font-size:13px;">${esc(f.label)}</label>
                <input type="text" data-m-field="${m.id}|${f.key}" placeholder="Working expression" value="${esc(mAns[f.key] || '')}" ${isLocked ? 'disabled' : ''}>
                ${!S.quiz?.exam && f.hint ? `<small class="mono" style="font-size:12px; color:var(--ink-muted);">💡 ${esc(f.hint)}</small>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>

    ${!S.quiz?.exam ? `<div style="margin-top:16px;"><button class="btn" id="checkMilestonesBtn" ${isLocked ? 'disabled' : ''}>Check Milestones</button></div>` : ''}
    ${a.checked && !S.quiz?.exam ? `<div class="${a.score > 0 ? 'note-ok' : 'note-bad'}">Awarded <b>${a.score} / ${q.marks} marks</b> across milestones and final target.</div>` : ''}
  `;
}

export function wireMilestone(q) {
  const k = ak(q);
  const targetInp = $('#finalTargetInput');
  if (targetInp) {
    targetInp.onfocus = () => { S._activeInputId = 'finalTargetInput'; };
    targetInp.oninput = () => {
      const a = (S.answers[k] ||= { milestones: {} });
      a.targetVal = targetInp.value;
      if (S.quiz?.exam) {
        a.locked = true;
        evaluateMilestone(q, a);
      }
    };
  }

  document.querySelectorAll('[data-m-field]').forEach(inp => {
    inp.oninput = () => {
      const [mid, fkey] = inp.dataset.mField.split('|');
      const a = (S.answers[k] ||= { milestones: {} });
      a.milestones = a.milestones || {};
      a.milestones[mid] = a.milestones[mid] || {};
      a.milestones[mid][fkey] = inp.value;
      if (S.quiz?.exam) {
        a.locked = true;
        evaluateMilestone(q, a);
      }
    };
  });

  const chk = $('#checkMilestonesBtn');
  if (chk) {
    chk.onclick = () => {
      const a = (S.answers[k] ||= { milestones: {} });
      a.checked = true;
      a.locked = true;
      evaluateMilestone(q, a);
      renderQ();
    };
  }
}

export function evaluateMilestone(q, a) {
  let score = 0;
  const expectedTarget = (q.finalTarget && q.finalTarget.expected) || q.answer;
  if (areMathEqual(a.targetVal, expectedTarget)) score += 2;
  for (const m of q.milestones || []) {
    const mAns = (a.milestones && a.milestones[m.id]) || {};
    let mPass = true;
    for (const f of m.fields || []) {
      if (!areMathEqual(mAns[f.key], f.expected)) mPass = false;
    }
    if (mPass) score += m.marks;
  }
  a.score = Math.min(score, q.marks);
}

// 4. Show-That Proof
export function proofHtml(q) {
  const a = S.answers[ak(q)] || { proofText: '', checks: [] };
  const isLocked = !S.quiz?.exam && a.locked;
  const rubric = q.rubric || [];

  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}

    <div style="margin:16px 0;">
      <h4 class="serif" style="font-size:22px; margin-bottom:8px;">Complete Proof Working:</h4>
      <textarea class="essay-pad" id="proofText" placeholder="Write out your complete proof structure, induction steps, or algebraic reasoning here..." ${isLocked ? 'disabled' : ''}>${esc(a.proofText || '')}</textarea>
    </div>

    <div style="margin-top:16px;">
      <h4 class="serif" style="font-size:22px; margin-bottom:10px;">Formal Rubric Checklist:</h4>
      ${rubric.map((r, ri) => `
        <label class="rubric-item ${a.checks?.[ri] ? 'checked' : ''}">
          <input type="checkbox" data-proof-check="${ri}" ${a.checks?.[ri] ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
          <span><strong>[${esc(r.mark || '1m')}]</strong> ${chipify(r.criterion || r.text || '')}</span>
        </label>
      `).join('')}
    </div>

    ${!S.quiz?.exam ? `<div style="margin-top:14px;"><button class="btn" id="lockProofBtn" ${isLocked ? 'disabled' : ''}>Lock &amp; Save Proof</button></div>` : ''}
    ${a.locked ? `<div class="note-ok">Proof logged with <b>${a.score} / ${q.marks} marks</b>.</div>` : ''}
  `;
}

export function wireProof(q) {
  const k = ak(q);
  const txt = $('#proofText');
  if (txt) {
    txt.oninput = () => {
      const a = (S.answers[k] ||= { checks: [] });
      a.proofText = txt.value;
      if (S.quiz?.exam) {
        a.locked = true;
        a.score = Math.min((a.checks || []).filter(Boolean).length, q.marks);
      }
    };
  }

  document.querySelectorAll('[data-proof-check]').forEach(c => {
    c.onchange = () => {
      const a = (S.answers[k] ||= { checks: [] });
      a.checks = a.checks || [];
      a.checks[+c.dataset.proofCheck] = c.checked;
      if (S.quiz?.exam) {
        a.locked = true;
        a.score = Math.min(a.checks.filter(Boolean).length, q.marks);
      }
      renderQ();
    };
  });

  const lockBtn = $('#lockProofBtn');
  if (lockBtn) {
    lockBtn.onclick = () => {
      const a = (S.answers[k] ||= { checks: [] });
      a.locked = true;
      a.score = Math.min((a.checks || []).filter(Boolean).length, q.marks);
      renderQ();
    };
  }
}

// 5. Statistics Hypothesis Testing
export function hypothesisHtml(q) {
  const a = S.answers[ak(q)] || { h0: '', h1: '', testStat: '', pVal: '', conclusion: '' };
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}

    <div class="card" style="margin-top:16px;">
      <div class="step-input-row">
        <label style="min-width:160px;">Null Hypothesis $H_0$:</label>
        <input type="text" id="hypH0" placeholder="e.g. p = 0.2" value="${esc(a.h0 || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:160px;">Alt Hypothesis $H_1$:</label>
        <input type="text" id="hypH1" placeholder="e.g. p > 0.2" value="${esc(a.h1 || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:160px;">Test Statistic / Dist:</label>
        <input type="text" id="hypStat" placeholder="e.g. X ~ B(20, 0.2)" value="${esc(a.testStat || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:160px;">Calculated p-value:</label>
        <input type="text" id="hypPVal" placeholder="e.g. 0.0321" value="${esc(a.pVal || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div style="margin-top:14px;">
        <label style="display:block; margin-bottom:6px; font-size:13.5px;">Contextual Conclusion:</label>
        <textarea class="essay-pad" id="hypConc" placeholder="State whether to reject/accept H0 and provide conclusion in context..." ${isLocked ? 'disabled' : ''}>${esc(a.conclusion || '')}</textarea>
      </div>
    </div>

    ${!S.quiz?.exam ? `<div style="margin-top:14px;"><button class="btn" id="checkHypBtn" ${isLocked ? 'disabled' : ''}>Check Hypothesis Test</button></div>` : ''}
    ${a.checked && !S.quiz?.exam ? `<div class="${a.score > 0 ? 'note-ok' : 'note-bad'}">Awarded <b>${a.score} / ${q.marks} marks</b>.</div>` : ''}
  `;
}

export function wireHypothesis(q) {
  const k = ak(q);
  const sync = () => {
    const a = (S.answers[k] ||= {});
    a.h0 = $('#hypH0')?.value || '';
    a.h1 = $('#hypH1')?.value || '';
    a.testStat = $('#hypStat')?.value || '';
    a.pVal = $('#hypPVal')?.value || '';
    a.conclusion = $('#hypConc')?.value || '';
    if (S.quiz?.exam) {
      a.locked = true;
      let s = 0;
      if (cleanMathStr(a.h0).includes('0.2')) s += 1;
      if (cleanMathStr(a.h1).includes('0.2')) s += 1;
      if (areMathEqual(a.pVal, q.expectedPVal || '0.0321')) s += 2;
      if ((a.conclusion || '').length > 10) s += 2;
      a.score = Math.min(s, q.marks);
    }
  };

  ['#hypH0', '#hypH1', '#hypStat', '#hypPVal', '#hypConc'].forEach(sel => {
    const el = $(sel);
    if (el) el.oninput = sync;
  });

  const chk = $('#checkHypBtn');
  if (chk) {
    chk.onclick = () => {
      sync();
      const a = S.answers[k];
      a.checked = true;
      a.locked = true;
      let s = 0;
      if (cleanMathStr(a.h0).includes('0.2')) s += 1;
      if (cleanMathStr(a.h1).includes('0.2')) s += 1;
      if (areMathEqual(a.pVal, q.expectedPVal || '0.0321')) s += 2;
      if ((a.conclusion || '').length > 10) s += 2;
      a.score = Math.min(s, q.marks);
      renderQ();
    };
  }
}

// 6. Mechanics Vector & Equilibrium
export function mechanicsHtml(q) {
  const a = S.answers[ak(q)] || { normalR: '', friction: '', momentsEq: '', finalAcc: '' };
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}

    <div class="card" style="margin-top:16px;">
      <div class="step-input-row">
        <label style="min-width:200px;">Normal Reaction $R$ (N):</label>
        <input type="text" id="mechR" placeholder="e.g. 49 N" value="${esc(a.normalR || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:200px;">Friction $F = \\mu R$:</label>
        <input type="text" id="mechF" placeholder="e.g. 19.6 N" value="${esc(a.friction || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:200px;">Equation of Motion / Moments:</label>
        <input type="text" id="mechMom" placeholder="e.g. F - mg sin(30) = ma" value="${esc(a.momentsEq || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:200px;">Final Value / Acceleration:</label>
        <input type="text" id="mechAcc" placeholder="Exact or 3 s.f." value="${esc(a.finalAcc || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
    </div>

    ${!S.quiz?.exam ? `<div style="margin-top:14px;"><button class="btn" id="checkMechBtn" ${isLocked ? 'disabled' : ''}>Check Equilibrium</button></div>` : ''}
    ${a.checked && !S.quiz?.exam ? `<div class="${a.score > 0 ? 'note-ok' : 'note-bad'}">Awarded <b>${a.score} / ${q.marks} marks</b>.</div>` : ''}
  `;
}

export function wireMechanics(q) {
  const k = ak(q);
  const sync = () => {
    const a = (S.answers[k] ||= {});
    a.normalR = $('#mechR')?.value || '';
    a.friction = $('#mechF')?.value || '';
    a.momentsEq = $('#mechMom')?.value || '';
    a.finalAcc = $('#mechAcc')?.value || '';
    if (S.quiz?.exam) {
      a.locked = true;
      let s = 0;
      if (areMathEqual(a.normalR, q.expectedR || '49')) s += 2;
      if (areMathEqual(a.finalAcc, q.expectedAcc || '2.45')) s += 2;
      if ((a.momentsEq || '').length > 5) s += 1;
      a.score = Math.min(s, q.marks);
    }
  };

  ['#mechR', '#mechF', '#mechMom', '#mechAcc'].forEach(sel => {
    const el = $(sel);
    if (el) el.oninput = sync;
  });

  const chk = $('#checkMechBtn');
  if (chk) {
    chk.onclick = () => {
      sync();
      const a = S.answers[k];
      a.checked = true;
      a.locked = true;
      let s = 0;
      if (areMathEqual(a.normalR, q.expectedR || '49')) s += 2;
      if (areMathEqual(a.finalAcc, q.expectedAcc || '2.45')) s += 2;
      if ((a.momentsEq || '').length > 5) s += 1;
      a.score = Math.min(s, q.marks);
      renderQ();
    };
  }
}

// 7. Graph Features & Curves
export function graphFeaturesHtml(q) {
  const a = S.answers[ak(q)] || { asymptotes: '', stationaryPoints: '', nature: '' };
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}

    <div class="card" style="margin-top:16px;">
      <div class="step-input-row">
        <label style="min-width:200px;">Asymptotes (x and y):</label>
        <input type="text" id="gfAsym" placeholder="e.g. x = 2, y = 1" value="${esc(a.asymptotes || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:200px;">Stationary Point (x, y):</label>
        <input type="text" id="gfStat" placeholder="e.g. (3, 4)" value="${esc(a.stationaryPoints || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="step-input-row">
        <label style="min-width:200px;">Nature (Max / Min):</label>
        <input type="text" id="gfNature" placeholder="Local Minimum" value="${esc(a.nature || '')}" ${isLocked ? 'disabled' : ''}>
      </div>
    </div>

    ${!S.quiz?.exam ? `<div style="margin-top:14px;"><button class="btn" id="checkGfBtn" ${isLocked ? 'disabled' : ''}>Check Features</button></div>` : ''}
    ${a.checked && !S.quiz?.exam ? `<div class="${a.score > 0 ? 'note-ok' : 'note-bad'}">Awarded <b>${a.score} / ${q.marks} marks</b>.</div>` : ''}
  `;
}

export function wireGraphFeatures(q) {
  const k = ak(q);
  const sync = () => {
    const a = (S.answers[k] ||= {});
    a.asymptotes = $('#gfAsym')?.value || '';
    a.stationaryPoints = $('#gfStat')?.value || '';
    a.nature = $('#gfNature')?.value || '';
    if (S.quiz?.exam) {
      a.locked = true;
      let s = 0;
      if (cleanMathStr(a.asymptotes).includes('2')) s += 2;
      if (cleanMathStr(a.nature).includes('min') || cleanMathStr(a.nature).includes('max')) s += 2;
      a.score = Math.min(s, q.marks);
    }
  };

  ['#gfAsym', '#gfStat', '#gfNature'].forEach(sel => {
    const el = $(sel);
    if (el) el.oninput = sync;
  });

  const chk = $('#checkGfBtn');
  if (chk) {
    chk.onclick = () => {
      sync();
      const a = S.answers[k];
      a.checked = true;
      a.locked = true;
      let s = 0;
      if (cleanMathStr(a.asymptotes).includes('2')) s += 2;
      if (cleanMathStr(a.nature).includes('min') || cleanMathStr(a.nature).includes('max')) s += 2;
      a.score = Math.min(s, q.marks);
      renderQ();
    };
  }
}

// 8. Written / Explain
export function writtenHtml(q) {
  const a = S.answers[ak(q)] || { text: '', ticks: [] };
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}
    <textarea class="essay-pad" id="writtenText" placeholder="Write out your mathematical explanation here..." ${isLocked ? 'disabled' : ''}>${esc(a.text || '')}</textarea>
    ${!S.quiz?.exam ? `
      <div style="margin-top:14px;">
        <button class="btn" id="msToggle" ${a.showMs ? 'hidden' : ''}>Compare with official mark scheme ↓</button>
        ${a.showMs ? `
          <div style="margin-top:12px;">
            ${(q.markScheme || []).map((m, mi) => `
              <label class="ms-item ${a.ticks?.[mi] ? 'checked' : ''}">
                <input type="checkbox" data-w-tick="${mi}" ${a.ticks?.[mi] ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
                <span><strong>[${m.marks || 1}m]</strong> ${esc(m.text)}</span>
              </label>
            `).join('')}
          </div>
          <button class="btn" id="lockWrittenBtn" ${isLocked ? 'disabled' : ''}>Lock &amp; Save Score</button>
        ` : ''}
      </div>
    ` : ''}
  `;
}

export function wireWritten(q) {
  const k = ak(q);
  const txt = $('#writtenText');
  if (txt) {
    txt.oninput = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.text = txt.value;
      if (S.quiz?.exam) {
        a.locked = true;
        a.score = txt.value.trim().length > 20 ? q.marks : 0;
      }
    };
  }

  const tg = $('#msToggle');
  if (tg) {
    tg.onclick = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.showMs = true;
      renderQ();
    };
  }

  document.querySelectorAll('[data-w-tick]').forEach(c => {
    c.onchange = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.ticks = a.ticks || [];
      a.ticks[+c.dataset.wTick] = c.checked;
      renderQ();
    };
  });

  const lockBtn = $('#lockWrittenBtn');
  if (lockBtn) {
    lockBtn.onclick = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.locked = true;
      const ticked = (a.ticks || []).filter(Boolean).length;
      a.score = Math.min(ticked, q.marks);
      renderQ();
    };
  }
}

// 9. Self-Marked (e.g. diagrams / paper working)
export function selfMarkedHtml(q) {
  const a = S.answers[ak(q)] || { ticks: [] };
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}
    ${!a.revealed ? `<div style="margin-top:14px;"><button class="btn btn-primary" id="revealAnsBtn">Reveal Model Solution ↓</button></div>` : `
      <div class="card" style="margin-top:14px;">
        <div style="font-size:14px; margin-bottom:12px;">${chipify(q.answerText || q.answer || 'Refer to mark scheme points below.')}</div>
        ${(q.markScheme || []).map((m, mi) => `
          <label class="ms-item ${a.ticks?.[mi] ? 'checked' : ''}">
            <input type="checkbox" data-sm-tick="${mi}" ${a.ticks?.[mi] ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span><strong>[${m.marks || 1}m]</strong> ${esc(m.text)}</span>
          </label>
        `).join('')}
      </div>
      <div style="margin-top:12px;"><button class="btn" id="lockSmBtn" ${isLocked ? 'disabled' : ''}>Lock &amp; Save Score</button></div>
    `}
  `;
}

export function wireSelfMarked(q) {
  const k = ak(q);
  const rev = $('#revealAnsBtn');
  if (rev) {
    rev.onclick = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.revealed = true;
      renderQ();
    };
  }

  document.querySelectorAll('[data-sm-tick]').forEach(c => {
    c.onchange = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.ticks = a.ticks || [];
      a.ticks[+c.dataset.smTick] = c.checked;
      renderQ();
    };
  });

  const lockBtn = $('#lockSmBtn');
  if (lockBtn) {
    lockBtn.onclick = () => {
      const a = (S.answers[k] ||= { ticks: [] });
      a.locked = true;
      const ticked = (a.ticks || []).filter(Boolean).length;
      a.score = Math.min(ticked, q.marks);
      renderQ();
    };
  }
}

// 10. Numerical Calculation
export function calcHtml(q) {
  const a = S.answers[ak(q)] || {};
  const isLocked = !S.quiz?.exam && a.locked;
  return `
    <h2 class="q-heading">${chipify(q.prompt)}</h2>
    ${q.guidance ? `<div class="q-guide">${chipify(q.guidance)}</div>` : ''}
    <div class="answer-dock">
      <div class="unit-field">
        <input type="text" id="calcInput" placeholder="…" value="${esc(a.text || '')}" ${isLocked ? 'disabled' : ''}>
        <span class="unit-tag">${esc(q.unit || '')}</span>
      </div>
      ${!S.quiz?.exam ? `<button class="btn" id="checkCalcBtn" ${isLocked ? 'disabled' : ''}>Check</button>` : ''}
    </div>
    ${a.checked && !S.quiz?.exam ? `<div class="${a.correct ? 'note-ok' : 'note-bad'}">${a.correct ? '✅ Correct numerical value!' : '❌ Incorrect. Expected: ' + esc(q.answer)}</div>` : ''}
  `;
}

export function wireCalc(q) {
  const k = ak(q);
  const inp = $('#calcInput');
  if (inp) {
    inp.oninput = () => {
      const a = (S.answers[k] ||= {});
      a.text = inp.value;
      a.checked = false; // an edited answer can't keep the old verdict
      if (S.quiz?.exam) {
        a.locked = true;
        a.correct = areMathEqual(inp.value, q.answer);
        a.score = a.correct ? q.marks : 0;
      }
    };
  }

  const chk = $('#checkCalcBtn');
  if (chk) {
    chk.onclick = () => {
      const val = $('#calcInput').value;
      const correct = areMathEqual(val, q.answer);
      S.answers[k] = { locked: true, text: val, correct, checked: true, score: correct ? q.marks : 0 };
      renderQ();
    };
  }
}

export function wireQ(q) {
  if (q.type === 'multiple-choice') wireMcq(q);
  else if (q.type === 'symbolic-exact') wireSymbolic(q);
  else if (q.type === 'method-milestone') wireMilestone(q);
  else if (q.type === 'show-that-proof') wireProof(q);
  else if (q.type === 'statistics-hypothesis') wireHypothesis(q);
  else if (q.type === 'mechanics-vector-fbd') wireMechanics(q);
  else if (q.type === 'graph-features') wireGraphFeatures(q);
  else if (q.type === 'written') wireWritten(q);
  else if (q.type === 'self-marked') wireSelfMarked(q);
  else wireCalc(q);
}
