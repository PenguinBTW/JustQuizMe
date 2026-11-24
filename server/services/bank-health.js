// Bank health scanner — pure filesystem → report module with no Express
// dependency, so it is exercisable on a synthetic tree from node --test.
const fs = require('fs');
const path = require('path');

// Canonical fields checked per question, with the key spellings seen across
// the banks folded into one presence test each.
const QUESTION_FIELDS = [
  { key: 'id', keys: ['id', 'qid', 'questionId'] },
  { key: 'title', keys: ['title', 'prompt', 'text', 'question'] },
  { key: 'marks', keys: ['marks', 'mark'] },
  { key: 'options', keys: ['options', 'choices'] },
  { key: 'answer', keys: ['answer', 'correctAnswer', 'correctIndex', 'markScheme'] }
];

const SAMPLE_LIMIT = 25;

function hasField(question, keys) {
  return keys.some((k) => question[k] !== undefined && question[k] !== null);
}

function questionRef(file, index, question) {
  const qid = question.id ?? question.qid ?? question.questionId;
  return `${file}#${qid !== undefined ? qid : `q${index}`}`;
}

// Scan one subject's questionsDir ({normal/, past-paper/} layout shared with
// QuizService) and fold every valid manifest into a per-portal report.
function scanQuestionsDir(questionsDir) {
  const report = {
    questionsDir,
    missingDir: !fs.existsSync(questionsDir),
    totalQuizzes: 0,
    totalQuestions: 0,
    totalMarks: 0,
    marksDistribution: {},
    missingFields: {},
    missingFieldSamples: {},
    duplicateIds: [],
    skippedFiles: []
  };
  if (report.missingDir) return report;

  for (const field of QUESTION_FIELDS) {
    report.missingFields[field.key] = 0;
    report.missingFieldSamples[field.key] = [];
  }

  const seenIds = new Map(); // id -> [file, ...]

  const scanFile = (dir, category, file) => {
    const full = path.join(dir, file);
    let quiz;
    try {
      quiz = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      report.skippedFiles.push({ file: `${category}/${file}`, reason: 'invalid JSON' });
      return;
    }
    if (!quiz || typeof quiz !== 'object' || !Array.isArray(quiz.questions)) {
      report.skippedFiles.push({ file: `${category}/${file}`, reason: 'no questions array' });
      return;
    }

    const rel = `${category}/${file}`;
    report.totalQuizzes += 1;
    for (const [index, question] of quiz.questions.entries()) {
      report.totalQuestions += 1;
      const marks = Number(question?.marks) || 0;
      report.totalMarks += marks;
      report.marksDistribution[marks] = (report.marksDistribution[marks] || 0) + 1;

      for (const field of QUESTION_FIELDS) {
        if (!question || typeof question !== 'object' || !hasField(question, field.keys)) {
          report.missingFields[field.key] += 1;
          const samples = report.missingFieldSamples[field.key];
          if (samples.length < SAMPLE_LIMIT) {
            samples.push(questionRef(rel, index, question ?? {}));
          }
        }
      }

      const id = question?.id ?? question?.qid ?? question?.questionId;
      if (id !== undefined && id !== null) {
        const key = String(id);
        if (!seenIds.has(key)) seenIds.set(key, []);
        seenIds.get(key).push(rel);
      }
    }
  };

  for (const category of ['normal', 'past-paper']) {
    const dir = path.join(questionsDir, category);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith('.json')) scanFile(dir, category, file);
    }
  }

  // An id repeated across files (or twice in one) is a duplicate; report the
  // id plus where it was seen, bounded so the payload stays small.
  for (const [id, files] of seenIds) {
    if (files.length > 1) {
      report.duplicateIds.push({ id, count: files.length, files: files.slice(0, 10) });
    }
  }
  report.duplicateIds.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  report.duplicateIds = report.duplicateIds.slice(0, SAMPLE_LIMIT);

  return report;
}

// Fold every configured portal into one /api/bank-health payload. `subjects`
// is { key: { name, spec, questionsDir } } — shape-compatible with
// config.SUBJECTS and trivially mockable in tests.
function buildBankHealthReport(subjects) {
  const portals = {};
  for (const [key, subject] of Object.entries(subjects)) {
    portals[key] = {
      name: subject.name,
      spec: subject.spec,
      ...scanQuestionsDir(subject.questionsDir)
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    portals
  };
}

module.exports = { scanQuestionsDir, buildBankHealthReport, QUESTION_FIELDS };
