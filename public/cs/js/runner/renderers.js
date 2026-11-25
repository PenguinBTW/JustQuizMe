// Computer Science Question Renderers & Interaction Handlers
import { S } from '../state.js';
import { $, esc, ak, formatPrompt, imgSrc } from '../utils.js';
import { api } from '../api.js';
import { renderPromptHtml, evaluateTraceTable, evaluateTruthTable, evaluateCalculation } from './evaluators.js';
import { saveCurrent, saveProgress, renderQ } from './assessment.js';
import { finishQuiz } from './finish.js';
import { renderRoom } from '../navigation.js';
import { matchMistakes, feedbackHtml } from '../../../shared/js/answerFeedback.js';

export function renderQuestionSpecifics(q) {
  // initialise into the store, not a throwaway: table rows set up here must
  // be the SAME object wireQuestionInteractions binds against, or Add Row
  // and cell input target a rows array that was never persisted
  const ans = S.answers[ak(q)] ||= {};

  // 1. Multiple Choice
  if (q.type === 'multiple-choice') {
    return `
      <div class="opt-grid">
        ${q.options.map((opt, i) => {
          const text = typeof opt === 'object' ? opt.text : opt;
          const sub = typeof opt === 'object' ? opt.sub : null;
          let cls = 'opt-card';
          if (ans.locked) {
            if (i === q.correctIndex) cls += ' is-correct';
            else if (ans.selected === i) cls += ' is-wrong';
            else cls += ' is-dim';
          } else if (ans.selected === i) {
            cls += ' is-selected';
          }
          const ariaState = !ans.locked ? `aria-pressed="${ans.selected === i ? 'true' : 'false'}"` : '';
          return `
            <button class="${cls}" data-opt-idx="${i}" ${ans.locked ? 'disabled' : ''} ${ariaState}>
              <div class="opt-top">
                <span class="mono" style="font-weight:700;">${String.fromCharCode(65 + i)}</span>
                <span style="font-size:15px; font-weight:600;">${formatPrompt(text)}</span>
              </div>
              ${sub ? `<span class="opt-sub">${formatPrompt(sub)}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
      ${ans.locked && S.runMode !== 'exam' ? `
        <div class="${ans.selected === q.correctIndex ? 'note-ok' : 'note-bad'}">
          ${ans.selected === q.correctIndex ? (q.feedbackCorrect || 'Correct!') : (q.feedbackWrong || 'Incorrect.')}
          ${feedbackHtml(matchMistakes(q, ans.selected), esc)}
        </div>
      ` : ''}
    `;
  }

  // 2. Written (Standard Mark Scheme)
  if (q.type === 'written') {
    const isLocked = !!ans.revealed;
    const maxMarks = +q.marks || 0;
    const earnedMarks = Math.min(maxMarks, ans.score != null ? ans.score : (ans.tickedCount != null ? ans.tickedCount : (ans.ticked ? ans.ticked.length : 0)));
    return `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">YOUR RESPONSE ${isLocked ? '(LOCKED AFTER VIEWING MARK SCHEME)' : ''}</span>
        ${ans.text ? '<span class="mono" style="font-size:11.5px; color:var(--accent);">Saved ✓</span>' : ''}
      </div>
      <textarea class="essay-pad" id="essayText" placeholder="Type your response here..." ${isLocked ? 'readonly' : ''}>${esc(ans.text || '')}</textarea>

      ${!ans.revealed ? `
        <div style="margin-top:16px;">
          <button class="btn btn-primary" id="revealMsBtn">Compare with Official Mark Scheme ↓</button>
        </div>
      ` : `
        <div style="margin-top:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">COMPARE WITH OFFICIAL MARK SCHEME</span>
            <span class="pill green">${earnedMarks} / ${maxMarks} marks</span>
          </div>
          ${(q.markScheme || []).map((item, mIdx) => {
            const isTicked = (ans.ticked || []).includes(mIdx);
            let rendered = esc(item.text);
            (item.highlights || []).forEach(hl => {
              rendered = rendered.split(esc(hl)).join(`<span class="key-phrase">${esc(hl)}</span>`);
            });
            return `
              <div class="ms-item ${isTicked ? 'checked' : ''}" data-midx="${mIdx}">
                <span class="mono" style="color:var(--accent); font-weight:700;">${isTicked ? '☑' : '☐'}</span>
                <div>[${item.marks}m] ${rendered}</div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // 3. Extended Response (Levels of Response 9 & 12 Markers)
  if (q.type === 'extended-response') {
    const isLocked = !!ans.revealed;
    const wordCount = (ans.text || '').trim().split(/\s+/).filter(Boolean).length;
    const levels = q.levels || [
      { level: 3, title: 'Level 3 (High Mark Band)', range: [q.marks >= 12 ? 9 : 7, q.marks], ao1: 'Comprehensive and accurate technical knowledge across all key domains.', ao2: 'Thorough and detailed application with coherent logical progression.', ao3: 'Critical, nuanced, and balanced evaluation with substantiated conclusions.' },
      { level: 2, title: 'Level 2 (Medium Mark Band)', range: [q.marks >= 12 ? 5 : 4, q.marks >= 12 ? 8 : 6], ao1: 'Sound knowledge of concepts and relevant computer science terminology.', ao2: 'Applied with clear reasoning to the context.', ao3: 'Evaluation is present, though arguments may lack full balance or completeness.' },
      { level: 1, title: 'Level 1 (Low Mark Band)', range: [1, q.marks >= 12 ? 4 : 3], ao1: 'Basic knowledge with isolated technical terminology.', ao2: 'Superficial or generalized application.', ao3: 'Little or no evaluation present.' }
    ];

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">EXTENDED ESSAY RESPONSE ${isLocked ? '(LOCKED AFTER REVEALING RUBRIC)' : ''}</span>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="word-counter" id="wordCount">${wordCount} words</span>
          ${ans.text ? '<span class="mono" style="font-size:11.5px; color:var(--accent);">Saved ✓</span>' : ''}
        </div>
      </div>
      <textarea class="essay-pad" id="essayText" placeholder="Write your extended technical response here (include detailed concepts, laws/standards, algorithmic implications, and balanced evaluation)..." style="min-height:220px;" ${isLocked ? 'readonly' : ''}>${esc(ans.text || '')}</textarea>

      ${!ans.revealed ? `
        <div style="margin-top:16px;">
          <button class="btn btn-primary" id="revealLevelsBtn">Compare with Levels of Response Rubric &amp; Indicative Content ↓</button>
        </div>
      ` : `
        <div style="margin-top:28px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">OFFICIAL OCR LEVEL DESCRIPTORS &amp; ASSESSMENT OBJECTIVES</span>
            <span class="pill green" id="levelAwardedPill">${Math.min(+q.marks || 0, ans.score != null ? ans.score : 0)} / ${q.marks} marks</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
            ${levels.map((lvl) => {
              const isSelected = ans.selectedLevel === lvl.level;
              return `
                <div class="level-card ${isSelected ? 'selected' : ''}" data-level-idx="${lvl.level}" tabindex="0" role="button" aria-pressed="${isSelected}">
                  <div class="level-card-top">
                    <strong style="font-size:15px;">${esc(lvl.title)}</strong>
                    <span class="format-badge">${lvl.range[0]}-${lvl.range[1]} Marks</span>
                  </div>
                  <div style="font-size:13px; color:var(--ink-secondary); line-height:1.5; margin-top:6px;">
                    <div><strong>AO1:</strong> ${esc(lvl.ao1)}</div>
                    <div style="margin-top:3px;"><strong>AO2:</strong> ${esc(lvl.ao2)}</div>
                    <div style="margin-top:3px;"><strong>AO3:</strong> ${esc(lvl.ao3)}</div>
                  </div>
                  ${isSelected ? `
                    <div style="display:flex; align-items:center; gap:14px; margin-top:12px; padding-top:10px; border-top:1px dashed var(--border);">
                      <span class="mono" style="font-size:12px; font-weight:600;">Allocate Marks:</span>
                      <input type="range" id="levelMarkSlider" min="${lvl.range[0]}" max="${lvl.range[1]}" value="${ans.score ?? lvl.range[0]}" style="flex:1;" />
                      <span class="mono" id="sliderValDisplay" style="font-size:14px; font-weight:700; color:var(--accent); min-width:32px;">${ans.score ?? lvl.range[0]}m</span>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          ${(q.indicativeContent && q.indicativeContent.length) ? `
            <div class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:10px;">INDICATIVE TECHNICAL CONTENT CHECKLIST</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${q.indicativeContent.map((point, pIdx) => {
                const isTicked = (ans.tickedIndicative || []).includes(pIdx);
                return `
                  <div class="ms-item ${isTicked ? 'checked' : ''}" data-indicative-idx="${pIdx}" tabindex="0" role="checkbox" aria-checked="${isTicked}">
                    <span class="mono" style="color:var(--accent); font-weight:700;">${isTicked ? '☑' : '☐'}</span>
                    <div style="font-size:13.5px;">${formatPrompt(point)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `}
    `;
  }

  // 4. Calculation / Discrete Value
  if (q.type === 'calculation') {
    const badge = q.formatBadge || q.base || (q.unit ? `(${q.unit})` : null);
    return `
      <div class="answer-dock">
        <div class="unit-field">
          <input type="text" id="calcInput" placeholder="Answer..." value="${esc(ans.text || '')}" ${ans.locked ? 'disabled' : ''} />
          ${badge ? `<span class="format-badge">${esc(badge)}</span>` : ''}
        </div>
        ${!ans.locked ? `<button class="btn btn-primary" id="calcCheckBtn">Check Answer</button>` : ''}
        <span class="mono" style="font-size:12px; color:var(--ink-muted);">${esc(q.formatHelp || 'Exact discrete answer (spaces and base prefixes ignored)')}</span>
      </div>
      ${ans.checked ? `
        <div class="${ans.correct ? 'note-ok' : 'note-bad'}" style="margin-top:16px;">
          ${ans.correct ? 'Correct discrete result!' : 'Incorrect result.'} ${q.explanation ? esc(q.explanation) : ''}
        </div>
      ` : ''}
      ${(q.recoverySteps && q.recoverySteps.length) ? `
        <div style="margin-top:24px;">
          <div class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:12px;">ALGORITHMIC CHECKPOINTS</div>
          <div class="recovery-stack">
            ${q.recoverySteps.map((step, sIdx) => {
              const sAns = (ans.recovery || {})[sIdx] || {};
              return `
                <div class="recovery-step">
                  <div>
                    <div style="font-size:14px; font-weight:600;">${esc(step.prompt)}</div>
                    ${step.hint ? `<div style="font-size:12px; color:var(--ink-muted); margin-top:2px;">${esc(step.hint)}</div>` : ''}
                  </div>
                  <div class="step-input-row" style="margin-top:0;">
                    <input type="text" data-step-idx="${sIdx}" value="${esc(sAns.val || '')}" placeholder="Value..." ${sAns.locked ? 'disabled' : ''} />
                    ${!sAns.locked ? `<button class="btn btn-ghost" data-check-step="${sIdx}">Verify</button>` : ''}
                    ${sAns.checked ? `<span class="mono" style="font-size:12px; color:${sAns.correct ? 'var(--green)' : 'var(--red)'}; font-weight:700;">${sAns.correct ? '✓' : '✕'}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  // 5. Trace Table (Dry Run Algorithm Table)
  if (q.type === 'trace-table') {
    const cols = q.columns || ['Line', 'Variable', 'Output'];
    if (!ans.rows || !ans.rows.length) {
      ans.rows = q.initialRows ? JSON.parse(JSON.stringify(q.initialRows)) : [new Array(cols.length).fill('')];
    }

    return `
      ${q.codeSnippet ? `<div class="code-snippet-box">${esc(q.codeSnippet)}</div>` : ''}
      <div class="trace-wrap">
        <table class="trace-table">
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              ${cols.map(c => `<th>${esc(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${ans.rows.map((row, rIdx) => `
              <tr>
                <td><span class="mono" style="font-size:11px; color:var(--ink-muted);">${rIdx + 1}</span></td>
                ${cols.map((_, cIdx) => {
                  const val = row[cIdx] ?? '';
                  const st = (ans.cellStatus || {})[`${rIdx}_${cIdx}`];
                  const cls = st === 'correct' ? 'cell-correct' : st === 'wrong' ? 'cell-wrong' : '';
                  return `
                    <td>
                      <input class="trace-cell ${cls}" data-tr-r="${rIdx}" data-tr-c="${cIdx}" value="${esc(val)}" ${ans.locked ? 'disabled' : ''} />
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="trace-actions">
        <div style="display:flex; gap:8px;">
          ${!ans.locked ? `
            <button class="btn btn-ghost" id="addTraceRowBtn">+ Add Row</button>
            <button class="btn btn-ghost" id="delTraceRowBtn" ${ans.rows.length <= 1 ? 'disabled' : ''}>- Delete Row</button>
            <button class="btn btn-ghost" id="clearTraceBtn">Clear Table</button>
          ` : ''}
        </div>
        ${S.runMode !== 'exam' ? `
          <button class="btn btn-accent" id="checkTraceBtn">${ans.evaluated ? 'Re-check Trace' : 'Check Dry Run Trace ▷'}</button>
        ` : `
          <span class="mono" style="font-size:12px; color:var(--ink-muted);">Exam Mode: Trace evaluated upon final submission</span>
        `}
      </div>

      ${ans.evaluated ? `
        <div class="${ans.score === q.marks ? 'note-ok' : 'note-bad'}" style="margin-top:14px;">
          <strong>${ans.score} / ${q.marks} Marks:</strong> ${esc(ans.matchMessage || '')}
        </div>
      ` : ''}
    `;
  }

  // 6. Truth Table (Boolean Logic)
  if (q.type === 'truth-table') {
    const inputs = q.inputs || ['A', 'B'];
    const outputs = q.outputs || ['Q'];
    const rows = q.rows || [];
    ans.outputs ||= {};

    return `
      ${q.formula ? `<div class="code-snippet-box" style="text-align:center; font-size:16px;">${formatPrompt(q.formula)}</div>` : ''}
      <table class="truth-table">
        <thead>
          <tr>
            ${inputs.map(inp => `<th>${esc(inp)}</th>`).join('')}
            ${outputs.map(out => `<th style="color:var(--accent);">${esc(out)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rIdx) => `
            <tr>
              ${(row.inputs || []).map(val => `<td class="mono" style="font-weight:600;">${val}</td>`).join('')}
              ${outputs.map((_, cIdx) => {
                const key = `${rIdx}_${cIdx}`;
                const val = ans.outputs[key] ?? '-';
                const st = (ans.outputStatus || {})[key];
                const cls = st === 'correct' ? 'is-correct' : st === 'wrong' ? 'is-wrong' : '';
                return `
                  <td>
                    <button class="truth-toggle-btn ${cls}" data-tt-r="${rIdx}" data-tt-c="${cIdx}" ${ans.locked ? 'disabled' : ''}>${val}</button>
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
        <span class="mono" style="font-size:12px; color:var(--ink-muted);">Click cell to toggle values ( - → 0 → 1 )</span>
        ${S.runMode !== 'exam' ? `
          <button class="btn btn-accent" id="checkTruthBtn">${ans.evaluated ? 'Re-check Truth Table' : 'Check Truth Table ▷'}</button>
        ` : `
          <span class="mono" style="font-size:12px; color:var(--ink-muted);">Exam Mode: Evaluated upon final paper submission</span>
        `}
      </div>

      ${ans.evaluated ? `
        <div class="${ans.score === q.marks ? 'note-ok' : 'note-bad'}" style="margin-top:14px;">
          <strong>${ans.score} / ${q.marks} Marks:</strong> ${esc(ans.matchMessage || '')}
        </div>
      ` : ''}
    `;
  }

  // 7. Little Man Computer (LMC Assembly)
  if (q.type === 'lmc') {
    const userCode = ans.code != null ? ans.code : (q.starterCode || '');
    return `
      <div class="code-terminal-card">
        <div class="code-terminal-bar">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="pill accent" style="font-size:11px;">LMC ASSEMBLY</span>
            <span class="pill" style="font-size:11px;">100 MAILBOXES</span>
          </div>
          <button class="btn-ghost" id="lmcRefToggleBtn" style="font-size:11.5px; padding:3px 10px;">Mnemonics Cheat Sheet ▾</button>
        </div>
        <div id="lmcRefBox" style="display:none; padding:10px 16px; background:var(--surface); border-bottom:1px solid var(--border); font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--ink-secondary); line-height:1.6;">
          <strong>INP</strong> (Input to Acc) · <strong>OUT</strong> (Acc to Output) · <strong>LDA &lt;addr&gt;</strong> (Load) · <strong>STA &lt;addr&gt;</strong> (Store) · <strong>ADD &lt;addr&gt;</strong> (Add to Acc) · <strong>SUB &lt;addr&gt;</strong> (Subtract from Acc) · <strong>BRA &lt;label&gt;</strong> (Branch Always) · <strong>BRZ &lt;label&gt;</strong> (Branch Zero) · <strong>BRP &lt;label&gt;</strong> (Branch Positive/Zero) · <strong>DAT [val]</strong> (Data Storage) · <strong>HLT</strong> (Halt)
        </div>
        <textarea class="code-editor-area" id="lmcCodeArea" spellcheck="false" autocomplete="off" style="min-height:240px;">${esc(userCode)}</textarea>
      </div>

      ${S.runMode !== 'exam' ? `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="mono" style="font-size:12px; color:var(--ink-muted);">Validate assembly against test cases:</span>
          <button class="btn btn-accent" id="testLmcBtn" style="padding:8px 22px;">Run &amp; Test Assembly ▷</button>
        </div>
      ` : `
        <div class="exam-locked-banner">
          <span>🔒</span>
          <div>
            <strong>Exam Mode Active:</strong> Execution is locked during the paper. Assembly program is evaluated strictly once upon paper submission.
          </div>
        </div>
      `}

      <div class="req-header-row">
        <span>ASSEMBLY SPECIFICATIONS &amp; MARK SCHEME</span>
        <span class="pill green">${ans.totalScore != null ? `${Math.min(+q.marks || 0, ans.totalScore)} / ${q.marks} Marks` : `${q.marks} Marks Total`}</span>
      </div>

      ${(q.requirements || []).map(req => {
        const rRes = (ans.results || []).find(r => r.id === req.id);
        let statusCls = '';
        let icon = '☐';
        let detail = '';
        if (rRes) {
          if (rRes.passed) {
            statusCls = 'passed';
            icon = '☑';
            detail = `<div style="font-size:12px; color:var(--green); margin-top:2px;">${esc(rRes.message)}</div>`;
          } else {
            statusCls = 'failed';
            icon = '✕';
            detail = `<div style="font-size:12px; color:var(--red); margin-top:2px;">${esc(rRes.message)}</div>`;
          }
        }
        return `
          <div class="req-card ${statusCls}">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <span class="mono" style="color:var(--accent); font-weight:700;">${icon}</span>
              <div>
                <div style="font-size:14px;">[${req.marks}m] ${formatPrompt(req.description)}</div>
                ${detail}
              </div>
            </div>
            <span class="mono" style="font-size:12px; font-weight:600; color:var(--ink-muted);">${req.marks}m</span>
          </div>
        `;
      }).join('')}

      ${ans.compileError ? `
        <div class="note-bad" style="font-family:'JetBrains Mono',monospace; font-size:12px; white-space:pre-wrap;">${esc(ans.compileError)}</div>
      ` : ''}
    `;
  }

  // 8. Code-Requirement (C# & OCR Pseudocode)
  if (q.type === 'code-requirement') {
    const lang = ans.language || (q.allowedLanguages?.[0] || 'ocr');
    const starter = q.starterCode?.[lang] || '';
    const userCode = ans.code != null ? ans.code : starter;

    return `
      ${q.mockFiles ? `
        <div style="background:var(--paper-subtle); border:1px solid var(--border); border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:12.5px;">
          <div class="mono" style="font-size:11px; color:var(--accent); font-weight:600; margin-bottom:6px;">📁 VIRTUAL SANDBOX FILES PROVIDED:</div>
          ${Object.entries(q.mockFiles).map(([fn, c]) => `
            <div style="margin-top:6px;">
              <span class="mono" style="font-weight:600; color:var(--ink); font-size:12px;">📄 ${esc(fn)}</span>
              <pre class="mono" style="margin:4px 0 0; padding:6px 10px; background:var(--paper-card); border-radius:4px; font-size:11px; white-space:pre-wrap; border:1px solid var(--border); max-height:120px; overflow-y:auto;">${esc(c)}</pre>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="code-terminal-card">
        <div class="code-terminal-bar">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="segmented" id="codeLangSeg">
              <button data-lang="ocr" class="${lang === 'ocr' ? 'active' : ''}">OCR Pseudocode</button>
              <button data-lang="csharp" class="${lang === 'csharp' ? 'active' : ''}">C# (.NET 10)</button>
            </div>
            <span class="pill accent" style="font-size:11px;">NO AUTOCOMPLETE</span>
          </div>
          <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">AUTHENTIC EXAM TERMINAL</span>
        </div>
        <textarea class="code-editor-area" id="csCodeArea" spellcheck="false" autocomplete="off" autocapitalize="off">${esc(userCode)}</textarea>
      </div>

      ${S.runMode !== 'exam' ? `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="mono" style="font-size:12px; color:var(--ink-muted);">Validate against program requirements:</span>
          <button class="btn btn-accent" id="testCodeBtn" style="padding:8px 22px;">Run &amp; Test Requirements ▷</button>
        </div>
      ` : `
        <div class="exam-locked-banner">
          <span>🔒</span>
          <div>
            <strong>Exam Mode Active:</strong> Execution is locked during the paper. All coding questions are evaluated strictly once upon paper submission.
          </div>
        </div>
      `}

      <div class="req-header-row">
        <span>PROGRAM REQUIREMENTS &amp; MARK SCHEME</span>
        <span class="pill green">${ans.totalScore != null ? `${Math.min(+q.marks || 0, ans.totalScore)} / ${q.marks} Marks` : `${q.marks} Marks Total`}</span>
      </div>

      ${(q.requirements || []).map(req => {
        const rRes = (ans.results || []).find(r => r.id === req.id);
        let statusCls = '';
        let icon = '☐';
        let detail = '';
        if (rRes) {
          if (rRes.passed) {
            statusCls = 'passed';
            icon = '☑';
            detail = `<div style="font-size:12px; color:var(--green); margin-top:2px;">${esc(rRes.message)}</div>`;
          } else {
            statusCls = 'failed';
            icon = '✕';
            detail = `<div style="font-size:12px; color:var(--red); margin-top:2px;">${esc(rRes.message)}</div>`;
          }
        }
        return `
          <div class="req-card ${statusCls}">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <span class="mono" style="color:var(--accent); font-weight:700;">${icon}</span>
              <div>
                <div style="font-size:14px;">[${req.marks}m] ${formatPrompt(req.description)}</div>
                ${detail}
              </div>
            </div>
            <span class="mono" style="font-size:12px; font-weight:600; color:var(--ink-muted);">${req.marks}m</span>
          </div>
        `;
      }).join('')}

      ${ans.lastRunStdout ? `
        <div class="console-terminal">TERMINAL STDOUT:\n${esc(ans.lastRunStdout)}</div>
      ` : ''}

      ${ans.compileError ? `
        <div class="note-bad" style="font-family:'JetBrains Mono',monospace; font-size:12px; white-space:pre-wrap;">${esc(ans.compileError)}</div>
      ` : ''}
    `;
  }

  // 9. Self-Marked (Drawings, Karnaugh Maps, Trees, Graphs, Data Structure Diagrams)
  if (q.type === 'self-marked') {
    const isRevealed = !!ans.revealed;
    const maxMarks = +q.marks || 0;
    const earnedMarks = Math.min(maxMarks, Math.max(0, ans.score != null ? ans.score : 0));

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">YOUR DIAGRAM / WORKING NOTES ${isRevealed ? '(LOCKED AFTER REVEALING OFFICIAL SOLUTION)' : ''}</span>
        ${ans.text ? '<span class="mono" style="font-size:11.5px; color:var(--accent);">Saved ✓</span>' : ''}
      </div>
      <textarea class="essay-pad" id="selfMarkNotes" placeholder="Draft your notes, answer, or working here (or complete diagram on rough paper)..." style="min-height:120px;" ${isRevealed ? 'readonly' : ''}>${esc(ans.text || '')}</textarea>

      ${!isRevealed ? `
        <div style="margin-top:16px;">
          <button class="btn btn-primary" id="revealSelfBtn">Reveal Official Diagram &amp; Model Solution ↓</button>
        </div>
      ` : `
        <div style="margin-top:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase;">OFFICIAL OCR MARK SCHEME &amp; MODEL DIAGRAM</span>
            <span class="pill green" id="selfAwardedPill">${earnedMarks} / ${maxMarks} marks awarded</span>
          </div>

          ${q.answerImage ? `
            <figure class="qfig" style="margin:16px 0; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:var(--surface);">
              <img src="${esc(imgSrc(q.answerImage, q._imgBase))}" alt="${esc(q.answerAlt || 'Model solution diagram')}" style="max-width:100%; height:auto; display:block; margin:0 auto;" />
              <figcaption style="padding:8px 12px; font-size:12px; color:var(--ink-secondary); text-align:center; background:rgba(0,0,0,0.15);">Official Mark Scheme Diagram / Solution</figcaption>
            </figure>
          ` : ''}

          ${q.answerText ? `
            <div style="background:rgba(16,185,129,0.08); border-left:3px solid var(--accent); padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:14px; line-height:1.6; color:var(--ink);">
              <strong style="color:var(--accent); font-family:'JetBrains Mono',monospace; font-size:11.5px; display:block; margin-bottom:6px; letter-spacing:0.04em;">EXPLANATION / SCORING CRITERIA:</strong>
              ${renderPromptHtml(q.answerText, ans)}
            </div>
          ` : ''}

          ${(q.markScheme || []).length > 0 ? `
            <div style="margin:16px 0;">
              ${(q.markScheme || []).map((item, mIdx) => {
                const isTicked = (ans.ticked || []).includes(mIdx);
                let rendered = esc(item.text);
                (item.highlights || []).forEach(hl => {
                  rendered = rendered.split(esc(hl)).join(`<span class="key-phrase">${esc(hl)}</span>`);
                });
                return `
                  <div class="ms-item ${isTicked ? 'checked' : ''}" data-midx="${mIdx}">
                    <span class="mono" style="color:var(--accent); font-weight:700;">${isTicked ? '☑' : '☐'}</span>
                    <div>[${item.marks}m] ${rendered}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <div style="background:var(--surface-subtle); border:1px solid var(--border); border-radius:8px; padding:16px; margin-top:20px;">
            <div class="mono" style="font-size:12px; color:var(--ink-secondary); margin-bottom:10px;">
              Honest Self-Assessment: Award marks based on how accurately your diagram/solution matches the official criteria:
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${Array.from({ length: maxMarks + 1 }, (_, m) => `
                <button class="btn ${ans.score === m ? 'btn-jade' : 'btn-ghost'}" data-award-self="${m}" style="min-width:54px; font-weight:700;">
                  ${m}m
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `}
    `;
  }

  return '<div class="card">Question format not supported</div>';
}

export function wireQuestionInteractions(q) {
  const k = ak(q);
  S.answers[k] ||= {};
  const ans = S.answers[k];

  // Footer Navigation
  $('#backTop')?.addEventListener('click', () => {
    if (S.idx > 0) { saveCurrent(q); S.idx--; renderQ(); }
    else { S.room = S.returnRoom || 'past'; renderRoom(); }
  });

  $('#prevQ')?.addEventListener('click', () => {
    saveCurrent(q);
    S.idx--;
    renderQ();
  });

  $('#nextQ')?.addEventListener('click', () => {
    saveCurrent(q);
    S.idx++;
    renderQ();
  });

  $('#saveBtn')?.addEventListener('click', () => {
    saveCurrent(q);
    saveProgress();
  });

  $('#finishQ')?.addEventListener('click', () => {
    saveCurrent(q);
    finishQuiz();
  });

  // Interactive prompt table cell toggles (fill-in/tick tables)
  document.querySelectorAll('[data-table-cell]').forEach(td => {
    td.onclick = () => {
      const cellKey = td.dataset.tableCell;
      ans.tableTicks ||= {};
      ans.tableTicks[cellKey] = !ans.tableTicks[cellKey];
      if (ans.tableTicks[cellKey]) {
        td.classList.add('is-ticked');
        td.innerHTML = '✓';
      } else {
        td.classList.remove('is-ticked');
        td.innerHTML = '&nbsp;';
      }
    };
  });

  // MCQ
  if (q.type === 'multiple-choice') {
    document.querySelectorAll('[data-opt-idx]').forEach(b => {
      b.onclick = () => {
        if (ans.locked) return;
        const i = +b.dataset.optIdx;
        if (S.runMode === 'exam') {
          // exam mode: selections stay changeable until paper submission and
          // must not reveal correctness mid-paper — scoring happens in finishQuiz
          ans.selected = i;
        } else {
          ans.selected = i;
          ans.locked = true;
          ans.score = (i === q.correctIndex) ? q.marks : 0;
        }
        renderQ();
      };
    });
  }

  // Written
  if (q.type === 'written') {
    const txt = $('#essayText');
    if (txt) txt.oninput = (e) => { ans.text = e.target.value; };
    $('#revealMsBtn')?.addEventListener('click', () => {
      ans.revealed = true;
      ans.ticked ||= [];
      const earned = ans.ticked.reduce((sum, idx) => {
        const item = (q.markScheme || [])[idx];
        return sum + (item && +item.marks ? +item.marks : 1);
      }, 0);
      ans.score = Math.min(+q.marks || 0, earned);
      ans.tickedCount = ans.score;
      renderQ();
    });
    document.querySelectorAll('[data-midx]').forEach(el => {
      el.onclick = () => {
        const mIdx = +el.dataset.midx;
        ans.ticked ||= [];
        if (ans.ticked.includes(mIdx)) ans.ticked = ans.ticked.filter(i => i !== mIdx);
        else ans.ticked.push(mIdx);
        const earned = ans.ticked.reduce((sum, idx) => {
          const item = (q.markScheme || [])[idx];
          return sum + (item && +item.marks ? +item.marks : 1);
        }, 0);
        ans.score = Math.min(+q.marks || 0, earned);
        ans.tickedCount = ans.score;
        renderQ();
      };
    });
  }

  // Extended Response (Levels of Response 9 & 12 Markers)
  if (q.type === 'extended-response') {
    const txt = $('#essayText');
    if (txt) {
      txt.oninput = (e) => {
        ans.text = e.target.value;
        const words = (e.target.value || '').trim().split(/\s+/).filter(Boolean).length;
        const wc = $('#wordCount');
        if (wc) wc.textContent = `${words} words`;
      };
    }
    $('#revealLevelsBtn')?.addEventListener('click', () => {
      ans.revealed = true;
      ans.selectedLevel ||= 2;
      ans.score = Math.min(+q.marks || 0, ans.score != null ? ans.score : (q.levels?.find(l=>l.level===2)?.range[0] || 1));
      renderQ();
    });
    document.querySelectorAll('[data-level-idx]').forEach(el => {
      const activate = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const lvlNum = +el.dataset.levelIdx;
        ans.selectedLevel = lvlNum;
        const matchedLvl = (q.levels || []).find(l => l.level === lvlNum);
        if (matchedLvl) ans.score = Math.min(+q.marks || 0, matchedLvl.range[0]);
        renderQ();
        document.querySelector(`[data-level-idx="${lvlNum}"]`)?.focus();
      };
      el.onclick = activate;
      el.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); activate(e); } };
    });
    const slider = $('#levelMarkSlider');
    if (slider) {
      slider.oninput = (e) => {
        ans.score = Math.min(+q.marks || 0, +e.target.value);
        const disp = $('#sliderValDisplay');
        if (disp) disp.textContent = `${ans.score}m`;
        const pill = $('#levelAwardedPill');
        if (pill) pill.textContent = `${ans.score} / ${q.marks} marks`;
      };
    }
    document.querySelectorAll('[data-indicative-idx]').forEach(el => {
      const toggle = () => {
        const pIdx = +el.dataset.indicativeIdx;
        ans.tickedIndicative ||= [];
        if (ans.tickedIndicative.includes(pIdx)) ans.tickedIndicative = ans.tickedIndicative.filter(i => i !== pIdx);
        else ans.tickedIndicative.push(pIdx);
        renderQ();
        document.querySelector(`[data-indicative-idx="${pIdx}"]`)?.focus();
      };
      el.onclick = toggle;
      el.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); toggle(); } };
    });
  }

  // Calculation (Discrete)
  if (q.type === 'calculation') {
    const inp = $('#calcInput');
    if (inp) inp.oninput = (e) => { ans.text = e.target.value; };
    $('#calcCheckBtn')?.addEventListener('click', () => {
      evaluateCalculation(q, ans);
      renderQ();
    });

    // Algorithmic recovery checkpoints
    document.querySelectorAll('[data-check-step]').forEach(btn => {
      btn.onclick = () => {
        const sIdx = +btn.dataset.checkStep;
        ans.recovery ||= {};
        ans.recovery[sIdx] ||= {};
        const stepInp = document.querySelector(`input[data-step-idx="${sIdx}"]`);
        const userStepVal = stepInp ? stepInp.value : '';
        ans.recovery[sIdx].val = userStepVal;
        const stepDef = (q.recoverySteps || [])[sIdx];
        if (stepDef) {
          const isStepCorrect = checkDiscreteAnswer(userStepVal, stepDef);
          ans.recovery[sIdx].checked = true;
          ans.recovery[sIdx].correct = isStepCorrect;
          if (isStepCorrect) ans.recovery[sIdx].locked = true;
        }
        renderQ();
      };
    });
  }

  // Trace Table
  if (q.type === 'trace-table') {
    document.querySelectorAll('[data-tr-r]').forEach(inp => {
      inp.oninput = () => {
        const r = +inp.dataset.trR, c = +inp.dataset.trC;
        ans.rowsTouched = true;
        if (ans.rows && ans.rows[r]) ans.rows[r][c] = inp.value;
      };
    });

    $('#addTraceRowBtn')?.addEventListener('click', () => {
      saveCurrent(q);
      ans.rowsTouched = true;
      ans.rows.push(new Array((q.columns || []).length).fill(''));
      renderQ();
    });

    $('#delTraceRowBtn')?.addEventListener('click', () => {
      saveCurrent(q);
      if (ans.rows.length > 1) {
        ans.rows.pop();
        renderQ();
      }
    });

    $('#clearTraceBtn')?.addEventListener('click', () => {
      if (confirm('Clear all entered trace rows?')) {
        ans.rows = [new Array((q.columns || []).length).fill('')];
        ans.evaluated = false;
        ans.cellStatus = {};
        renderQ();
      }
    });

    $('#checkTraceBtn')?.addEventListener('click', () => {
      saveCurrent(q);
      evaluateTraceTable(q, ans);
      renderQ();
    });
  }

  // Truth Table
  if (q.type === 'truth-table') {
    document.querySelectorAll('[data-tt-r]').forEach(btn => {
      btn.onclick = () => {
        if (ans.locked) return;
        const r = btn.dataset.ttR;
        const c = btn.dataset.ttC;
        const key = `${r}_${c}`;
        const cur = ans.outputs[key];
        if (cur === '0') ans.outputs[key] = '1';
        else if (cur === '1') ans.outputs[key] = '0';
        else ans.outputs[key] = '0';
        ans.evaluated = false;
        renderQ();
      };
    });

    $('#checkTruthBtn')?.addEventListener('click', () => {
      evaluateTruthTable(q, ans);
      renderQ();
    });
  }

  // Little Man Computer (LMC)
  if (q.type === 'lmc') {
    const lmcArea = $('#lmcCodeArea');
    if (lmcArea) {
      lmcArea.oninput = (e) => { ans.code = e.target.value; };
      lmcArea.onkeydown = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = lmcArea.selectionStart;
          const end = lmcArea.selectionEnd;
          lmcArea.value = lmcArea.value.substring(0, start) + '    ' + lmcArea.value.substring(end);
          lmcArea.selectionStart = lmcArea.selectionEnd = start + 4;
          ans.code = lmcArea.value;
        }
      };
    }

    $('#lmcRefToggleBtn')?.addEventListener('click', () => {
      const box = $('#lmcRefBox');
      if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });

    $('#testLmcBtn')?.addEventListener('click', async () => {
      const btn = $('#testLmcBtn');
      btn.disabled = true;
      btn.textContent = 'Testing Assembly...';
      try {
        const res = await api('/api/execute/lmc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: lmcArea.value,
            requirements: q.requirements || []
          })
        });

        ans.code = lmcArea.value;
        ans.results = res.results || [];
        ans.totalScore = Math.min(+q.marks || 0, res.totalScore || 0);
        ans.score = ans.totalScore;
        ans.compileError = res.compileError || null;
        renderQ();
      } catch (err) {
        alert('Execution failed: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Run & Test Assembly ▷';
      }
    });
  }

  // Code-Requirement (C# & OCR Pseudocode)
  if (q.type === 'code-requirement') {
    const codeArea = $('#csCodeArea');
    if (codeArea) {
      codeArea.oninput = (e) => { ans.code = e.target.value; };
      codeArea.onkeydown = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = codeArea.selectionStart;
          const end = codeArea.selectionEnd;
          codeArea.value = codeArea.value.substring(0, start) + '    ' + codeArea.value.substring(end);
          codeArea.selectionStart = codeArea.selectionEnd = start + 4;
          ans.code = codeArea.value;
        }
      };
    }

    document.querySelectorAll('#codeLangSeg button').forEach(btn => {
      btn.onclick = () => {
        const l = btn.dataset.lang;
        if (ans.language !== l) {
          if (confirm(`Switch to ${l === 'csharp' ? 'C#' : 'OCR Pseudocode'}? This resets the editor to the starter template.`)) {
            ans.language = l;
            ans.code = q.starterCode?.[l] || '';
            ans.results = null;
            ans.totalScore = null;
            ans.lastRunStdout = null;
            ans.compileError = null;
            renderQ();
          }
        }
      };
    });

    $('#testCodeBtn')?.addEventListener('click', async () => {
      const btn = $('#testCodeBtn');
      btn.disabled = true;
      btn.textContent = 'Testing Requirements...';
      const lang = ans.language || (q.allowedLanguages?.[0] || 'ocr');
      const endpoint = lang === 'csharp' ? '/api/execute/csharp' : '/api/execute/ocr-pseudo';

      try {
        const res = await api(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: codeArea.value,
            requirements: q.requirements || [],
            options: { entryFunction: q.entryFunction, entryMethod: q.entryMethod, className: q.className, mockFiles: q.mockFiles }
          })
        });

        ans.code = codeArea.value;
        ans.results = res.results || [];
        ans.totalScore = Math.min(+q.marks || 0, res.totalScore || 0);
        ans.score = ans.totalScore;
        ans.lastRunStdout = res.stdout || '';
        ans.compileError = res.compileError || null;
        renderQ();
      } catch (err) {
        alert('Execution failed: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Run & Test Requirements ▷';
      }
    });
  }

  // Self-Marked
  if (q.type === 'self-marked') {
    const notes = $('#selfMarkNotes');
    if (notes) notes.oninput = (e) => { ans.text = e.target.value; };

    $('#revealSelfBtn')?.addEventListener('click', () => {
      ans.revealed = true;
      if (ans.score == null) ans.score = 0;
      renderQ();
    });

    document.querySelectorAll('[data-award-self]').forEach(btn => {
      btn.onclick = () => {
        ans.score = +btn.dataset.awardSelf;
        renderQ();
      };
    });

    document.querySelectorAll('.ms-item[data-midx]').forEach(el => {
      el.onclick = () => {
        const mIdx = +el.dataset.midx;
        ans.ticked ||= [];
        if (ans.ticked.includes(mIdx)) ans.ticked = ans.ticked.filter(i => i !== mIdx);
        else ans.ticked.push(mIdx);
        const earned = ans.ticked.reduce((sum, idx) => {
          const item = (q.markScheme || [])[idx];
          return sum + (item && +item.marks ? +item.marks : 1);
        }, 0);
        ans.score = Math.min(+q.marks || 0, earned);
        renderQ();
      };
    });
  }
}
