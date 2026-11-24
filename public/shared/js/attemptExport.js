// Attempt export — turns a finished run into a downloadable JSON payload.
// DOM-free so it is testable under node --test: the caller (the results view)
// gathers the run state; buildExport shapes it and names the file.

const trim = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const slug = (s) => trim(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'attempt';

const datePart = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

const optText = (o) => (typeof o === 'string' ? o : trim(o?.text || o?.label || ''));

/** A readable summary of what the student submitted, per question type. */
function userAnswer(q, a) {
  if (!a) return '';
  switch (q.type) {
    case 'multiple-choice': {
      if (a.picked == null) return '';
      const letter = 'ABCDEFGHIJ'[a.picked] ?? `#${a.picked + 1}`;
      const t = optText((q.options || [])[a.picked]);
      return t ? `${letter}: ${t}` : `option ${letter}`;
    }
    case 'written': {
      const n = (a.ticks || []).filter(Boolean).length;
      const text = trim(a.text);
      return `${n} mark-scheme tick${n === 1 ? '' : 's'}${text ? ` — "${text}"` : ''}`;
    }
    case 'self-marked':
      return `${(a.ticks || []).filter(Boolean).length}/${q.marks} marks claimed`;
    case 'calculation': {
      const v = trim(a.finalValue);
      if (a.helped) return `helped (steps used${v ? `, last entry ${v}${q.unit ? ` ${q.unit}` : ''}` : ''})`;
      return v ? `${v}${q.unit ? ` ${q.unit}` : ''}` : `${a.attempts || 0} attempt(s)`;
    }
    default:
      return trim(a.text ?? a.value ?? '');
  }
}

/** full marks → 'correct', some → 'partial', zero → 'incorrect'; 'helped' when steps were used. */
function verdict(q, a) {
  if (a?.helped) return 'helped';
  const sc = a?.score ?? 0;
  if (sc >= q.marks) return 'correct';
  return sc > 0 ? 'partial' : 'incorrect';
}

/**
 * @param {object} r run data: portal slug, quiz {uuid,title,questions,exam}, quizMeta {file},
 *   answers keyed like the runner (ak), startedAt/finishedAt ISO strings, elapsedSeconds,
 *   keyOf(q) → stable question key (the portal's ak()).
 * @returns {{filename: string, json: object}}
 */
export function buildExport(r) {
  const keyOf = r.keyOf || ((q) => q._key || q.id);
  const finishedAt = r.finishedAt || new Date().toISOString();
  const quiz = r.quiz || {};
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answers = r.answers || {};

  let score = 0;
  let total = 0;
  const rows = questions.map((q, i) => {
    const key = keyOf(q) ?? `q${i + 1}`;
    const a = answers[key];
    const marks = Number(q.marks) || 0;
    const got = a?.score ?? 0;
    score += got;
    total += marks;
    return {
      ref: String(key),
      position: i + 1,
      section: q.section || '',
      text: trim(q.prompt || q.text || ''),
      type: q.type || '',
      answer: userAnswer(q, a),
      marks: { earned: got, total: marks },
      verdict: verdict(q, a),
    };
  });

  const file = r.quizMeta?.file || '';
  const json = {
    attempt: {
      id: `${quiz.uuid || file || 'quiz'}@${finishedAt}`,
      portal: r.portal || '',
      quiz: { file, uuid: quiz.uuid || '', title: quiz.title || file },
      mode: r.mode || (quiz.exam ? 'exam' : 'quiz'),
      exam: !!quiz.exam,
      startedAt: r.startedAt || null,
      finishedAt,
      timeUsedSeconds: Math.round(r.elapsedSeconds || 0),
      score,
      totalMarks: total,
      percentage: total ? Math.round((score / total) * 100) : 0,
      questions: rows,
    },
  };
  return { filename: `${slug(r.portal)}-${slug(quiz.title || file)}-${datePart(finishedAt)}.json`, json };
}
