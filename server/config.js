const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REVISION_DIR = path.resolve(ROOT_DIR, '..');

// Questions live in the sibling revision folders when present. The repo also
// tracks a bundled banks/<subject> library; the quiz service merges it UNDER
// the external directory (external wins on filename conflicts), so a fresh
// clone has usable content out of the box without hiding anything a user
// already has — including past papers in an otherwise sparse external dir.
const fs = require('fs');
function bundledQuestionsDir(key) {
  const bundled = path.join(ROOT_DIR, 'banks', key);
  return fs.existsSync(bundled) ? bundled : null;
}

module.exports = {
  PORT: process.env.PORT || 3000,
  ROOT_DIR,
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  DATA_DIR: path.join(ROOT_DIR, 'data'),

  SUBJECTS: {
    cs: {
      key: 'cs',
      name: 'Computer Science',
      spec: 'OCR H446',
      icon: '💾',
      accent: '#0A8F64',
      accentHover: '#0FB86E',
      timeMultiplier: 1.07, // ~1.07 min/mark
      questionsDir: path.join(REVISION_DIR, 'Computer Science', 'questions'),
      bundledDir: bundledQuestionsDir('cs'),
      dataDir: path.join(ROOT_DIR, 'data', 'cs')
    },
    maths: {
      key: 'maths',
      name: 'Mathematics',
      spec: 'OCR H240',
      icon: '📐',
      accent: '#156DFF',
      accentHover: '#0D5AE5',
      timeMultiplier: 1.2, // ~1.2 min/mark
      questionsDir: path.join(REVISION_DIR, 'Maths', 'questions'),
      bundledDir: bundledQuestionsDir('maths'),
      dataDir: path.join(ROOT_DIR, 'data', 'maths')
    },
    physics: {
      key: 'physics',
      name: 'Physics',
      spec: 'AQA 7408',
      icon: '⚡',
      accent: '#E7622B',
      accentHover: '#FF7844',
      timeMultiplier: 1.07, // ~1.07 min/mark
      questionsDir: path.join(REVISION_DIR, 'Physics', 'Quiz system', 'questions'),
      bundledDir: bundledQuestionsDir('physics'),
      dataDir: path.join(ROOT_DIR, 'data', 'physics')
    }
  }
};
