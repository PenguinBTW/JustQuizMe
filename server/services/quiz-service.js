const fs = require('fs');
const path = require('path');

class QuizService {
  constructor(subjectConfig) {
    this.config = subjectConfig;
    this.questionsDir = subjectConfig.questionsDir;
    this.bundledDir = subjectConfig.bundledDir || null;
    this.normalDir = path.join(this.questionsDir, 'normal');
    this.pastDir = path.join(this.questionsDir, 'past-paper');
    // dir pairs ordered low-to-high precedence: bundled repo banks are merged
    // underneath the external library so fresh clones have content without
    // ever hiding banks or past papers the user already has
    this.scanRoots = [];
    if (this.bundledDir) {
      this.scanRoots.push({
        normal: path.join(this.bundledDir, 'normal'),
        past: path.join(this.bundledDir, 'past-paper')
      });
    }
    this.scanRoots.push({ normal: this.normalDir, past: this.pastDir });

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
    const merged = { normal: new Map(), 'past-paper': new Map() };
    for (const roots of this.scanRoots) {
      for (const [dir, cat] of [[roots.normal, 'normal'], [roots.past, 'past-paper']]) {
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir)) {
          if (!file.toLowerCase().endsWith('.json')) continue;
          try {
            const fullPath = path.join(dir, file);
            const raw = fs.readFileSync(fullPath, 'utf8');
            const quiz = JSON.parse(raw);
            if (!quiz.uuid || !Array.isArray(quiz.questions)) continue;
            if (!quiz.category) quiz.category = cat;
            merged[cat].set(file, this.summarizeQuiz(quiz, cat, file));
          } catch {
            // skip invalid json
          }
        }
      }
    }
    const out = {
      normal: [...merged.normal.values()],
      'past-paper': [...merged['past-paper'].values()]
    };
    out.normal.sort((a, b) => a.title.localeCompare(b.title));
    out['past-paper'].sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }

  findQuizFile(category, file) {
    const cleanName = path.basename(file || '');
    if (!cleanName.toLowerCase().endsWith('.json')) return null;
    const key = category === 'past-paper' ? 'past' : 'normal';
    // high precedence first: external library shadows bundled repo banks
    for (const roots of [...this.scanRoots].reverse()) {
      const full = path.join(roots[key], cleanName);
      if (!fs.existsSync(full)) continue;
      // a malformed override must not shadow a valid bank beneath it —
      // fall through to the next root rather than serving 'Quiz not found'
      try {
        const quiz = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (quiz && Array.isArray(quiz.questions)) return full;
      } catch {}
    }
    return null;
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
