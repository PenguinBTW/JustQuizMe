// Physics JustQuizMe - Frontend Application Entry Point
import { S, AQA_TOPICS } from './state.js';
import { $ } from './utils.js';
import { loadHome } from './api.js';
import { renderRoom } from './navigation.js';
import { wireModals, closeSynthModal, closeTopicModal } from './modals.js';
import { startMixedSel } from './runner/starters.js';

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
  const ae = document.activeElement;
  // Escape dismisses modals even while a form control (e.g. the
  // target-marks slider) has focus.
  if (e.key === 'Escape'){ closeSynthModal(); closeTopicModal(); }
  // Skip while typing — but let arrows still navigate when a mark-scheme
  // checkbox or radio is focused (they don't consume arrow keys).
  if (ae?.isContentEditable || ae?.matches?.('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"])')) return;
  if (e.key.toLowerCase() === 't') $('#themeBtn')?.click();
  if (S.quiz && !document.querySelector('.modal-backdrop.open')){
    if (e.repeat) return; // held key must not auto-advance / auto-submit
    if (e.key === 'ArrowLeft'){ e.preventDefault(); ($('#prevQ') || $('#backTop'))?.click(); }
    if (e.key === 'ArrowRight'){
      e.preventDefault();
      const fin = $('#finishQ');
      (fin && !fin.hidden ? fin : $('#nextQ'))?.click();
    }
  }
});

initTheme();
wireModals();
const brand = $('#brandHome');
if (brand){
  brand.onclick = () => { S.room = 'past'; renderRoom(); };
  brand.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); brand.click(); }
  };
}

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
