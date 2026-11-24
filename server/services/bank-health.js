// Bank health scanner — pure filesystem → report module with no Express
// dependency, so it is exercisable on a synthetic tree from node --test.
// Field expectations follow docs/QUESTION_SCHEMA.md: common fields are always
// required, while options/answer expectations depend on the question `type`.
const fs = require('fs');
const path = require('path');

const ID_KEYS = ['id', 'qid', 'questionId'];
const TITLE_KEYS = ['title', 'prompt', 'text', 'question'];
const MARKS_KEYS = ['marks', 'mark'];

// Canonical fields checked for every question.
const QUESTION_FIELDS = [
  { key: 'id', keys: ID_KEYS },
  { key: 'title', keys: TITLE_KEYS },
  { key: 'marks', keys: MARKS_KEYS }
];

// Per-type expectations from docs/QUESTION_SCHEMA.md §3: which field supplies
// the answer key, and whether choices are required. Unknown/absent types fall
// back to GENERIC so nothing goes silently unreported.
const TYPE_FIELDS = {
  'multiple-choice': { options: ['options', 'choices'], answer: ['correctIndex', 'answer', 'correctAnswer'] },
  'written': { options: null, answer: ['markScheme'] },
  'calculation': { options: null, answer: ['answer', 'correctAnswer'] },
  'trace-table': { options: null, answer: ['expectedRows'] },
  'truth-table': { options: null, answer: ['rows'] },
  'lmc': { options: null, answer: ['requirements'] },
  'code-requirement': { options: null, answer: ['requirements'] }
};
const GENERIC_FIELDS = {
  options: ['options', 'choices'],
  answer: ['answer', 'correctAnswer', 'correctIndex', 'markScheme', 'expectedRows', 'rows', 'requirements']
};
const REPORT_FIELDS = ['id', 'title', 'marks', 'options', 'answer'];

const SAMPLE_LIMIT = 25;

function hasField(question, keys) {
  return question != null && keys.some((k) => question[k] !== undefined && question[k] !== null);
}

function questionRef(file, index, question) {
  const qid = hasField(question, ID_KEYS) ? question.id ?? question.qid ?? question.questionId : undefined;
  return `${file}#${qid !== undefined ? qid : `q${index}`}`;
}

// Scan one subject's questionsDir ({normal/, past-paper/} layout shared with
// QuizService) and fold every valid manifest into a per-portal report.
// `questionsDir` is used for scanning only — it never enters the report, so
// absolute server paths stay out of the public /api/bank-health payload.
function scanQuestionsDir(questionsDir) {
  const report = {
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

  for (const key of REPORT_FIELDS) {
    report.missingFields[key] = 0;
    report.missingFieldSamples[key] = [];
  }

  const miss = (key, rel, index, question) => {
    report.missingFields[key] += 1;
    const samples = report.missingFieldSamples[key];
    if (samples.length < SAMPLE_LIMIT) {
      samples.push(questionRef(rel, index, question ?? {}));
    }
  };

  const scanFile = (dir, category, file) => {
    const rel = `${category}/${file}`;
    const full = path.join(dir, file);
    let quiz;
    try {
      quiz = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      report.skippedFiles.push({ file: rel, reason: 'invalid JSON' });
      return;
    }
    if (!quiz || typeof quiz !== 'object' || !Array.isArray(quiz.questions)) {
      report.skippedFiles.push({ file: rel, reason: 'no questions array' });
      return;
    }
    // QuizService.listQuizzes only serves manifests that carry a uuid; count
    // the rest as skipped so the totals match what the library can show.
    if (!quiz.uuid) {
      report.skippedFiles.push({ file: rel, reason: 'no uuid' });
      return;
    }

    report.totalQuizzes += 1;
    const fileIds = new Map(); // id -> count within this one manifest
    for (const [index, question] of quiz.questions.entries()) {
      report.totalQuestions += 1;
      const marks = Number(hasField(question, MARKS_KEYS) ? question.marks ?? question.mark : 0) || 0;
      report.totalMarks += marks;
      report.marksDistribution[marks] = (report.marksDistribution[marks] || 0) + 1;

      const object = question && typeof question === 'object';
      for (const field of QUESTION_FIELDS) {
        if (!object || !hasField(question, field.keys)) miss(field.key, rel, index, question);
      }
      if (object) {
        const typeFields = TYPE_FIELDS[question.type] ?? GENERIC_FIELDS;
        if (typeFields.options && !hasField(question, typeFields.options)) miss('options', rel, index, question);
        if (!hasField(question, typeFields.answer)) miss('answer', rel, index, question);
      } else {
        miss('options', rel, index, question);
        miss('answer', rel, index, question);
      }

      const id = object ? question.id ?? question.qid ?? question.questionId : undefined;
      if (id !== undefined && id !== null) {
        const key = String(id);
        fileIds.set(key, (fileIds.get(key) ?? 0) + 1);
      }
    }

    // The schema scopes question-id uniqueness to a single quiz, so only ids
    // repeated inside this manifest are duplicates.
    for (const [id, count] of fileIds) {
      if (count > 1) report.duplicateIds.push({ id, file: rel, count });
    }
  };

  for (const category of ['normal', 'past-paper']) {
    const dir = path.join(questionsDir, category);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith('.json')) scanFile(dir, category, file);
    }
  }

  report.duplicateIds.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file) || a.id.localeCompare(b.id));
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

module.exports = { scanQuestionsDir, buildBankHealthReport, QUESTION_FIELDS, TYPE_FIELDS };
