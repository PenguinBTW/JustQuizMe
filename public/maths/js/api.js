// Maths API Service & Data Loaders
import { S } from './state.js';
import { $, num } from './utils.js';
import { ensurePastFull, buildCaches, topicData } from './taxonomy.js';
import { renderRoom } from './navigation.js';
import './bookmarkGlue.js';

export async function api(p, opt) {
  const url = p.startsWith('/api') ? '/maths' + p : p;
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

export async function loadHome() {
  $('#stage').innerHTML = '<div class="card"><p class="mono" style="color:var(--ink-muted);">Loading mathematical repository…</p></div>';
  const [q, scores, save] = await Promise.all([
    api('/api/quizzes'),
    api('/api/scores'),
    api('/api/save').catch(() => null)
  ]);
  S.quizzes = q || { normal: [], 'past-paper': [] };
  S.scores = Array.isArray(scores) ? scores : [];
  S.save = save;

  await ensurePastFull();
  buildCaches();

  if (!S.mixed._init) {
    S.mixed._init = true;
    const data = topicData();
    data.forEach(t => { if (t.qcount > 0) S.mixed.topics.add(t.topic); });
    data.forEach(t => t.subs.forEach((g, gi) => {
      if (S.mixed.topics.has(t.topic)) S.mixed.subs.add(`${t.topic}|${gi}`);
    }));
    const allMarks = data.reduce((s, t) => s + t.mmarks, 0);
    S.mixed.m = Math.min(25, Math.max(1, Math.min(100, allMarks)));
    const first = data.find(t => t.qcount > 0);
    if (first) S.openTopics.add(first.topic);
  }

  const pq = S.quizzes['past-paper'];
  const pt = pq.reduce((s, m) => s + m.totalMarks, 0);
  const pn = pq.reduce((s, m) => s + m.questionCount, 0);
  $('#bankStats').innerHTML = `<span style="color:var(--accent); font-weight:600;">${num(pn)}</span> Qs · <span style="color:var(--accent); font-weight:600;">${num(pt)}</span> Marks`;

  renderRoom();
}

export function bestFor(uuid) {
  const a = S.scores.filter(s => s.quizUuid === uuid);
  if (!a.length) return null;
  return a.reduce((m, x) => (x.score / m.total > m.score / m.total ? x : m), a[0]);
}

export function fmtSaved(iso) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ', ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  } catch {
    return '';
  }
}
