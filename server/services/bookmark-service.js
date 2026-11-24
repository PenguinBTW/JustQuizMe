const fs = require('fs');
const path = require('path');

// JSON-file bookmark store — same dataDir / readJson convention as scores.
class BookmarkService {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.bookmarksFile = path.join(this.dataDir, 'bookmarks.json');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.bookmarksFile)) {
      fs.writeFileSync(this.bookmarksFile, '[]', 'utf8');
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

  list() {
    const list = this.readJson(this.bookmarksFile, []);
    return Array.isArray(list) ? list : [];
  }

  // Toggle by `key`; payload stored verbatim so clients can render the list
  // without re-deriving fields.
  toggle(bookmark) {
    const list = this.list();
    const idx = list.findIndex(b => b && b.key === bookmark.key);
    if (idx >= 0) {
      list.splice(idx, 1);
      fs.writeFileSync(this.bookmarksFile, JSON.stringify(list, null, 2), 'utf8');
      return { bookmarked: false, bookmarks: list };
    }
    list.push({ ...bookmark });
    fs.writeFileSync(this.bookmarksFile, JSON.stringify(list, null, 2), 'utf8');
    return { bookmarked: true, bookmarks: list };
  }

  remove(key) {
    const list = this.list().filter(b => b && b.key !== key);
    fs.writeFileSync(this.bookmarksFile, JSON.stringify(list, null, 2), 'utf8');
    return { bookmarks: list };
  }
}

module.exports = BookmarkService;
