const fs = require('fs');
const path = require('path');

class QuizService {
  constructor(subjectConfig) {
    this.config = subjectConfig;
    this.questionsDir = subjectConfig.questionsDir;
    this.normalDir = path.join(this.questionsDir, 'normal');
    this.pastDir = path.join(this.questionsDir, 'past-paper');

    for (const d of [this.questionsDir, this.normalDir, this.pastDir]) {
      if (!fs.existsSync(d)) {
        try { fs.mkdirSync(d, { recursive: true }); } catch {}
      }
    }
  }

  summarizeQuiz(quiz, category, file) {
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    return {
      uuid: quiz.uuid,
      version: quiz.version,
      title: quiz.title || quiz.name || file.replace(/\.json$/i, ''),
      file,
      category,
      board: quiz.board || this.config.spec,
      topics: quiz.topics || [],
      component: quiz.component || '',
      unit: quiz.unit || '',
      icon: quiz.icon || (category === 'past-paper' ? this.config.icon : '⚡'),
      timeLimitMinutes: quiz.timeLimitMinutes || null,
      questionCount: questions.length,
      totalMarks
    };
  }

  listQuizzes() {
    const out = { normal: [], 'past-paper': [] };
    for (const [dir, cat] of [[this.normalDir, 'normal'], [this.pastDir, 'past-paper']]) {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.toLowerCase().endsWith('.json')) continue;
        try {
          const fullPath = path.join(dir, file);
          const raw = fs.readFileSync(fullPath, 'utf8');
          const quiz = JSON.parse(raw);
          if (!quiz.uuid || !Array.isArray(quiz.questions)) continue;
          if (!quiz.category) quiz.category = cat;
          out[cat].push(this.summarizeQuiz(quiz, cat, file));
        } catch {
          // skip invalid json
        }
      }
    }
    out.normal.sort((a, b) => a.title.localeCompare(b.title));
    out['past-paper'].sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }

  findQuizFile(category, file) {
    const base = category === 'past-paper' ? this.pastDir : this.normalDir;
    const cleanName = path.basename(file || '');
    if (!cleanName.toLowerCase().endsWith('.json')) return null;
    const full = path.join(base, cleanName);
    if (!fs.existsSync(full)) return null;
    return full;
  }

  getQuiz(category, file) {
    const full = this.findQuizFile(category, file);
    if (!full) return null;
    try {
      return JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      return null;
    }
  }
}

module.exports = QuizService;
