const fs = require('fs');
const path = require('path');

// Student-reported question issues, appended to data/flags.json per data dir.
// One flat list across portals — the launchpad reads them all.
class FlagService {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'flags.json');
  }
  list() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return []; }
  }
  add(flag) {
    const flags = this.list();
    const entry = {
      id: `fl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      ...flag,
    };
    flags.push(entry);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(flags, null, 1));
    return entry;
  }
}
module.exports = FlagService;
