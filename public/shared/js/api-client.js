// Universal API Client for JustQuizMe Endpoints

export class ApiClient {
  constructor(subjectPrefix) {
    this.prefix = `/api/${subjectPrefix}`;
  }

  async request(path, options = {}) {
    const url = `${this.prefix}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`API Error [${res.status}] at ${url}`);
    }
    return res.json();
  }

  async getQuizzes() {
    return this.request('/quizzes');
  }

  async getQuiz(category, file) {
    return this.request(`/quiz?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
  }

  async getScores() {
    return this.request('/scores');
  }

  async saveScore(entry) {
    return this.request('/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  }

  async getSave() {
    return this.request('/save');
  }

  async setSave(saveDoc) {
    return this.request('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saveDoc)
    });
  }

  async clearSave() {
    return this.request('/save', { method: 'DELETE' });
  }
}
