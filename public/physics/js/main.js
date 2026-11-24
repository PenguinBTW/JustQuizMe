// Physics JustQuizMe - Frontend Application Entry Point
import { S, AQA_TOPICS } from './state.js';
import { $ } from './utils.js';
import { loadHome } from './api.js';
import { renderRoom } from './navigation.js';
import { wireModals, closeSynthModal, closeTopicModal } from './modals.js';
import { startMixedSel } from './runner/starters.js';
import './practiceMount.js';

// ---------- theme (dark default) ----------
export function initTheme(){
  const t = localStorage.getItem('pjq-theme') || 'dark';
  document.documentElement.dataset.theme = t;
  const btn = $('#themeBtn');
  if (btn) btn.textContent = t === 'dark' ? 'Paper' : 'Darkroom';
  if (btn) btn.onclick = () => {
    const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    localStorage.setItem('pjq-theme', n);
    btn.textContent = n === 'dark' ? 'Paper' : 'Darkroom';
  };
}

// ---------- boot ----------
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA'].includes(tag)) return;
  if (e.key === 'Escape'){ closeSynthModal(); closeTopicModal(); }
  if (e.key.toLowerCase() === 't') $('#themeBtn')?.click();
});

initTheme();
wireModals();
const brand = $('#brandHome');
if (brand) brand.onclick = () => { S.room = 'past'; renderRoom(); };

loadHome().then(() => {
  // Check for URL launch parameters from Homepage Synthesizer
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'custom') {
    const marks = parseInt(params.get('marks'), 10) || 50;
    const topicsParam = params.get('topics');
    if (topicsParam) {
      const requested = topicsParam.split(',').map(s => s.trim().toLowerCase());
      S.mixed.topics.clear();
      S.mixed.subs.clear();
      (S._topicData || []).forEach(t => {
        const matches = requested.some(r => 
          r === t.topic.toLowerCase() || 
          t.topic.toLowerCase().includes(r) ||
          r.includes(t.topic.toLowerCase())
        );
        if (matches && t.qcount > 0) {
          S.mixed.topics.add(t.topic);
          t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
        }
      });
      // Fallback: if no topics matched, select all
      if (S.mixed.topics.size === 0) {
        (S._topicData || []).forEach(t => {
          if (t.qcount > 0) {
            S.mixed.topics.add(t.topic);
            t.subs.forEach((g, gi) => S.mixed.subs.add(`${t.topic}|${gi}`));
          }
        });
      }
    }
    S.mixed.m = marks;
    // Launch synthesized exam
    startMixedSel(true);
  }
}).catch(() => {
  $('#stage').innerHTML = '<div class="card"><p style="color:var(--ink-secondary);">Could not reach the server. Start it with <span class="mono">node main/server/index.js</span>, then reload.</p></div>';
});
