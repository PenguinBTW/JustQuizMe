const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REVISION_DIR = path.resolve(ROOT_DIR, '..');

// Questions live in the sibling revision folders when present; otherwise the
// server falls back to the banks/ directory tracked inside this repo, so a
// fresh clone has usable content out of the box.
const fs = require('fs');
function resolveQuestionsDir(externalDir, key) {
  try {
    const normalDir = path.join(externalDir, 'normal');
    if (fs.existsSync(normalDir) && fs.readdirSync(normalDir).some(f => f.endsWith('.json'))) {
      return externalDir;
    }
  } catch {}
  const bundled = path.join(ROOT_DIR, 'banks', key);
  if (fs.existsSync(bundled)) return bundled;
  return externalDir;
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
      questionsDir: resolveQuestionsDir(path.join(REVISION_DIR, 'Computer Science', 'questions'), 'cs'),
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
      questionsDir: resolveQuestionsDir(path.join(REVISION_DIR, 'Maths', 'questions'), 'maths'),
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
      questionsDir: resolveQuestionsDir(path.join(REVISION_DIR, 'Physics', 'Quiz system', 'questions'), 'physics'),
      dataDir: path.join(ROOT_DIR, 'data', 'physics')
    }
  }
};
