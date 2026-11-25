// Computer Science Evaluation Helpers & Markdown Table Parser
import { esc, formatInline, checkDiscreteAnswer } from '../utils.js';

export function renderPromptHtml(rawText, ans) {
  if (!rawText) return '';
  let text = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang || 'text', code: code.trimEnd() });
    return `\n\n${placeholder}\n\n`;
  });

  // Extract tables
  const tables = [];
  const tableRegex = /((?:^[ \t]*\|[^\n]+\|[ \t]*(?:\n|$))+)/gm;
  text = text.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    const sepIndex = lines.findIndex(l => /^\|[\s:\-\|]+\|$/.test(l));
    if (sepIndex === -1) return match;

    const headerLines = lines.slice(0, sepIndex);
    const sepLine = lines[sepIndex];
    const bodyLines = lines.slice(sepIndex + 1);

    const sepCells = sepLine.split('|').slice(1, -1).map(s => s.trim());
    const alignments = sepCells.map(s => {
      if (s.startsWith(':') && s.endsWith(':')) return 'center';
      if (s.endsWith(':')) return 'right';
      return 'left';
    });

    const parseRow = (line) => line.split('|').slice(1, -1).map(c => c.trim());

    const tIdx = tables.length;
    let tableHtml = '<div class="prompt-table-wrap"><table class="qtable">';
    if (headerLines.length > 0) {
      tableHtml += '<thead>';
      headerLines.forEach(hl => {
        const cells = parseRow(hl);
        tableHtml += '<tr>' + cells.map((c, i) => {
          const align = alignments[i] || 'left';
          return `<th style="text-align:${align};">${formatInline(c)}</th>`;
        }).join('') + '</tr>';
      });
      tableHtml += '</thead>';
    }

    if (bodyLines.length > 0) {
      tableHtml += '<tbody>';
      bodyLines.forEach((bl, rIdx) => {
        const cells = parseRow(bl);
        tableHtml += '<tr>' + cells.map((c, cIdx) => {
          const align = alignments[cIdx] || 'left';
          const trimmed = c.trim();
          const isBlankOrQ = trimmed === '' || trimmed === '?' || trimmed === '[ ]';
          if (isBlankOrQ) {
            const cellKey = `t${tIdx}_${rIdx}_${cIdx}`;
            const isTicked = !!(ans && ans.tableTicks && ans.tableTicks[cellKey]);
            return `<td style="text-align:${align};" class="cell-tickable ${isTicked ? 'is-ticked' : ''}" data-table-cell="${cellKey}">${isTicked ? '✓' : (trimmed === '?' ? '<span class="cell-qmark">?</span>' : '&nbsp;')}</td>`;
          }
          return `<td style="text-align:${align};">${formatInline(c) || '&nbsp;'}</td>`;
        }).join('') + '</tr>';
      });
      tableHtml += '</tbody>';
    }
    tableHtml += '</table></div>';

    const placeholder = `__TABLE_BLOCK_${tables.length}__`;
    tables.push(tableHtml);
    return `\n\n${placeholder}\n\n`;
  });

  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const renderedBlocks = paragraphs.map(p => {
    const codeMatch = p.match(/^__CODE_BLOCK_(\d+)__$/);
    if (codeMatch) {
      const b = codeBlocks[+codeMatch[1]];
      return `<div class="code-snippet-box"><div class="code-snippet-header"><span class="mono">${esc((b.lang || 'code').toUpperCase())}</span></div><pre class="prompt-code"><code>${esc(b.code)}</code></pre></div>`;
    }

    const tableMatch = p.match(/^__TABLE_BLOCK_(\d+)__$/);
    if (tableMatch) {
      return tables[+tableMatch[1]];
    }

    if (/^\*\*(Table|Fig|Figure)\s*[^:]*:[^*]+\*\*$/.test(p)) {
      const captionText = p.replace(/^\*\*|\*\*$/g, '');
      return `<div class="prompt-table-caption">${formatInline(captionText)}</div>`;
    }

    // Check if bullet list
    const pLines = p.split('\n');
    const firstBulletIdx = pLines.findIndex(l => /^[*-]\s+/.test(l.trim()));
    if (firstBulletIdx !== -1 && pLines.slice(firstBulletIdx).every(l => /^[*-]\s+/.test(l.trim()))) {
      const leadLines = pLines.slice(0, firstBulletIdx);
      const bulletLines = pLines.slice(firstBulletIdx).map(l => l.trim().replace(/^[*-]\s+/, ''));
      let res = '';
      if (leadLines.length > 0) {
        res += `<p class="q-para">${leadLines.map(l => formatInline(l.trim())).join('<br>')}</p>`;
      }
      res += `<ul class="prompt-list">${bulletLines.map(it => `<li>${formatInline(it)}</li>`).join('')}</ul>`;
      return res;
    }

    const lines = p.split('\n').map(l => formatInline(l.trim())).filter(Boolean);
    return `<p class="q-para">${lines.join('<br>')}</p>`;
  });

  return renderedBlocks.join('\n');
}

export function evaluateTraceTable(q, ans) {
  if (!q.expectedRows || !ans.rows) return 0;
  // a table the student never touched is a skip, not an attempt: starter
  // rows exist in the answer store from first render (they scaffold the
  // layout), so silence must not score. Untouched = rows identical to the
  // bank's initialRows, or the explicit never-edited state.
  if (!ans.rowsTouched && q.initialRows) {
    const init = JSON.stringify(q.initialRows);
    if (JSON.stringify(ans.rows) === init) {
      ans.score = 0;
      ans.evaluated = true;
      ans.cellStatus = {};
      ans.matchMessage = 'not attempted';
      return 0;
    }
  }
  const userRows = ans.rows || [];
  const expectedRows = q.expectedRows || [];
  let totalExpectedCells = 0;
  let correctCells = 0;
  const cellStatus = {};

  expectedRows.forEach((expRow, rIdx) => {
    const userRow = userRows[rIdx] || [];
    // a row the student never touched must not score for its blank-expected
    // cells — leaving everything empty would otherwise earn free marks on
    // rows whose correct output is blank. Engagement = any non-empty entry.
    const rowEngaged = (userRow || []).some(c => String(c ?? '').trim() !== '');
    expRow.forEach((expCell, cIdx) => {
      totalExpectedCells++;
      const userCell = String(userRow[cIdx] ?? '').trim();
      const expectedCell = String(expCell ?? '').trim();
      let isMatch = userCell.toLowerCase() === expectedCell.toLowerCase();
      if (isMatch && expectedCell === '' && !rowEngaged) isMatch = false;
      cellStatus[`${rIdx}_${cIdx}`] = isMatch ? 'correct' : 'wrong';
      if (isMatch) correctCells++;
    });
  });

  const ratio = totalExpectedCells > 0 ? (correctCells / totalExpectedCells) : 1;
  const earned = Math.round(ratio * (+q.marks || 0));
  ans.score = earned;
  ans.evaluated = true;
  ans.cellStatus = cellStatus;
  ans.matchMessage = `${correctCells} of ${totalExpectedCells} cells correct`;
  return earned;
}

export function evaluateTruthTable(q, ans) {
  if (!q.rows || !ans.outputs) return 0;
  let totalOutputs = 0;
  let correctOutputs = 0;
  const outputStatus = {};

  q.rows.forEach((row, rIdx) => {
    const expectedOut = row.expected || [];
    expectedOut.forEach((expVal, cIdx) => {
      totalOutputs++;
      const key = `${rIdx}_${cIdx}`;
      const userVal = ans.outputs[key];
      const isMatch = String(userVal) === String(expVal);
      outputStatus[key] = isMatch ? 'correct' : 'wrong';
      if (isMatch) correctOutputs++;
    });
  });

  const ratio = totalOutputs > 0 ? (correctOutputs / totalOutputs) : 1;
  const earned = Math.round(ratio * (+q.marks || 0));
  ans.score = earned;
  ans.evaluated = true;
  ans.outputStatus = outputStatus;
  ans.matchMessage = `${correctOutputs} of ${totalOutputs} outputs correct`;
  return earned;
}

export function evaluateCalculation(q, ans) {
  const isCorrect = checkDiscreteAnswer(ans.text, q);
  ans.checked = true;
  ans.locked = true;
  ans.correct = isCorrect;
  ans.score = isCorrect ? (+q.marks || 0) : 0;
  return ans.score;
}
