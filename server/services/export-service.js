const fs = require('fs');
const path = require('path');

// Tutor-facing analytics export: flattens the score history into CSV shapes a
// tutor can pivot — one row per question attempt, and one row per topic
// rollup. Same JSON-convention reads as the other services; no writes.
function csvCell(v) {
  let s = v == null ? '' : String(v);
  // neutralize spreadsheet formulas — a tutor opening the CSV must not
  // evaluate attacker/student-authored text as a formula; spreadsheet apps
  // normalize leading whitespace and control chars before evaluating
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

class ExportService {
  constructor(dataDir) {
    this.scoresFile = path.join(dataDir, 'scores.json');
  }
  scores() {
    try { return JSON.parse(fs.readFileSync(this.scoresFile, 'utf8')); } catch { return []; }
  }
  // one row per question attempt, newest first
  attemptsCsv(portal) {
    // scores.json is stored newest-first — preserve that order
    const rows = [['date', 'portal', 'quizTitle', 'quizFile', 'questionKey', 'questionId', 'topic', 'subtopic', 'type', 'score', 'marks', 'attempted', 'exam']];
    for (const s of this.scores()) {
      for (const q of s.perQuestion || []) {
        if (!q || typeof q !== 'object') continue;
        rows.push([s.date, portal, s.quizTitle || s.title || '', s.quizFile, q.key || q.id || '', q.id, q.topic, q.subtopic || '', q.type, +q.score || 0, +q.marks || 0, q.attempted === false ? 'no' : 'yes', s.exam ? 'yes' : 'no']);
      }
    }
    return toCsv(rows);
  }
  // one row per topic: attempts, marks earned/available, accuracy
  topicsCsv(portal) {
    const acc = new Map();
    for (const s of this.scores()) {
      for (const q of s.perQuestion || []) {
        if (!q || typeof q !== 'object') continue;
        const key = q.topic || '(untagged)';
        const t = acc.get(key) || { attempts: 0, earned: 0, available: 0 };
        // available marks count even when skipped — the runner's totals include
        // them, so accuracy here agrees with what the student saw at finish;
        // the attempt count itself only ticks when they actually answered
        if (q.attempted !== false) t.attempts += 1;
        t.earned += +q.score || 0;
        t.available += +q.marks || 0;
        acc.set(key, t);
      }
    }
    const rows = [['portal', 'topic', 'attempts', 'marksEarned', 'marksAvailable', 'accuracyPct']];
    for (const [topic, t] of [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      rows.push([portal, topic, t.attempts, t.earned, t.available, t.available ? Math.round((t.earned / t.available) * 1000) / 10 : '']);
    }
    return toCsv(rows);
  }
}
module.exports = ExportService;
