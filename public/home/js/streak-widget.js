// Practice-streak card on the launchpad — merges attempt dates from all three
// portals' /api/<subject>/scores feeds and renders the streak summary plus a
// 7-day activity strip. Pure-read: only GETs the existing scores endpoints.
import { computeStreak } from '../../shared/js/streak.js';

const PORTALS = ['cs', 'maths', 'physics'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

async function fetchPortalDates(portal) {
  try {
    const res = await fetch(`/api/${portal}/scores`);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => r && (r.date || r.createdAt || r.timestamp)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function initStreakWidget(rootId = 'streakWidget') {
  const root = document.getElementById(rootId);
  if (!root) return;

  const dateLists = await Promise.all(PORTALS.map(fetchPortalDates));
  const dates = dateLists.flat();
  const s = computeStreak(dates);
  // Scores are capped per portal; a best computed from data already saved
  // must never shrink when old attempts roll out of the cap.
  let best = s.best;
  try {
    const stored = Number(localStorage.getItem('jqm.streak.best') || 0);
    best = Math.max(best, stored);
    if (best > stored) localStorage.setItem('jqm.streak.best', String(best));
  } catch { /* storage unavailable — just show the computed best */ }
  const now = new Date();

  const strip = s.last7
    .map((n, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      const label = `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
      const cls = n === 0 ? 'empty' : '';
      return `<span class="streak-dot ${cls}" title="${label}: ${n} attempt${n === 1 ? '' : 's'}"></span>`;
    })
    .join('');

  // Screen-reader mirror of the strip — the dots are decorative dots, so the
  // daily breakdown also lives in visually-hidden text.
  const stripText = s.last7
    .map((n, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      return `${DAY_LABELS[d.getDay()]} ${d.getDate()}: ${n} attempt${n === 1 ? '' : 's'}`;
    })
    .join(', ');

  root.innerHTML = `
    <div class="streak-card" role="status" aria-label="Practice streak">
      <div class="streak-figures">
        <div class="streak-figure">
          <span class="streak-num">${s.current}</span>
          <span class="streak-label">day streak</span>
        </div>
        <div class="streak-figure">
          <span class="streak-num">${best}</span>
          <span class="streak-label">best</span>
        </div>
        <div class="streak-figure">
          <span class="streak-num">${s.last7Total}</span>
          <span class="streak-label">attempts / 7d</span>
        </div>
        <div class="streak-figure">
          <span class="streak-num">${s.total}</span>
          <span class="streak-label">quizzes total</span>
        </div>
      </div>
      <div class="streak-strip" aria-hidden="true">${strip}</div>
      <span class="visually-hidden">Last 7 days — ${stripText}</span>
    </div>`;
}

initStreakWidget();
