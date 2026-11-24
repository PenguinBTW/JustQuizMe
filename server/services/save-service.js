const fs = require('fs');
const path = require('path');

class SaveService {
  constructor(subjectKey, dataDir, legacyDataDir = null) {
    this.subjectKey = subjectKey;
    this.dataDir = dataDir;
    this.legacyDataDir = legacyDataDir;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.scoresFile = path.join(this.dataDir, 'scores.json');
    this.saveFile = path.join(this.dataDir, 'save.json');
    this.starsFile = path.join(this.dataDir, 'stars.json');

    this.initStorage();
  }

  initStorage() {
    // If local scores don't exist yet, try to migrate from legacy data dir if present
    if (!fs.existsSync(this.scoresFile)) {
      if (this.legacyDataDir && fs.existsSync(path.join(this.legacyDataDir, 'scores.json'))) {
        try {
          fs.copyFileSync(path.join(this.legacyDataDir, 'scores.json'), this.scoresFile);
        } catch {
          fs.writeFileSync(this.scoresFile, '[]', 'utf8');
        }
      } else {
        fs.writeFileSync(this.scoresFile, '[]', 'utf8');
      }
    }

    if (!fs.existsSync(this.starsFile)) {
      fs.writeFileSync(this.starsFile, '[]', 'utf8');
    }

    if (!fs.existsSync(this.saveFile)) {
      if (this.legacyDataDir && fs.existsSync(path.join(this.legacyDataDir, 'save.json'))) {
        try {
          fs.copyFileSync(path.join(this.legacyDataDir, 'save.json'), this.saveFile);
        } catch {
          fs.writeFileSync(this.saveFile, 'null', 'utf8');
        }
      } else {
        fs.writeFileSync(this.saveFile, 'null', 'utf8');
      }
    }
  }

  readJson(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      const raw = fs.readFileSync(filePath, 'utf8').trim();
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  getScores() {
    const list = this.readJson(this.scoresFile, []);
    return Array.isArray(list) ? list : [];
  }

  addScore(scoreData) {
    const list = this.getScores();
    const entry = {
      date: scoreData.date || new Date().toISOString(),
      ...scoreData
    };
    list.unshift(entry);
    if (list.length > 500) list.length = 500;
    fs.writeFileSync(this.scoresFile, JSON.stringify(list, null, 2), 'utf8');
    return entry;
  }

  getSave() {
    return this.readJson(this.saveFile, null);
  }

  setSave(saveData) {
    const doc = {
      ...saveData,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(this.saveFile, JSON.stringify(doc, null, 2), 'utf8');
    return doc;
  }

  clearSave() {
    fs.writeFileSync(this.saveFile, 'null', 'utf8');
    return true;
  }

  getStars() {
    const list = this.readJson(this.starsFile, []);
    return Array.isArray(list) ? list : [];
  }

  // Toggle a starred question by `key`; a star payload is stored verbatim
  // (plus starredAt) so clients can render lists without re-deriving fields.
  toggleStar(star) {
    const list = this.getStars();
    const idx = list.findIndex(s => s && s.key === star.key);
    if (idx >= 0) {
      list.splice(idx, 1);
      fs.writeFileSync(this.starsFile, JSON.stringify(list, null, 2), 'utf8');
      return { starred: false, stars: list };
    }
    const entry = { ...star, starredAt: new Date().toISOString() };
    list.unshift(entry);
    if (list.length > 500) list.length = 500;
    fs.writeFileSync(this.starsFile, JSON.stringify(list, null, 2), 'utf8');
    return { starred: true, stars: list, entry };
  }
}

module.exports = SaveService;
