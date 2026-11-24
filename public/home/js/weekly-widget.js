// "Your week" launchpad widget — cross-portal activity summary.
// Mounts itself into the landing page via MutationObserver: no edits to the
// landing markup are needed, and the card survives later DOM re-renders —
// any mutation that drops the node re-triggers the mount pass.
import { weeklySummary } from '../../shared/js/weeklyStats.js';

const PORTALS = [
  { id: 'cs', name: 'Computer Science', route: '/cs', accent: 'var(--cs)', soft: 'var(--cs-soft)', border: 'var(--cs-border)' },
  { id: 'maths', name: 'Mathematics', route: '/maths', accent: 'var(--math)', soft: 'var(--math-soft)', border: 'var(--math-border)' },
  { id: 'physics', name: 'Physics', route: '/physics', accent: 'var(--phys)', soft: 'var(--phys-soft)', border: 'var(--phys-border)' },
];

const CARD_ID = 'weekly-widget-card';
const STYLE_ID = 'weekly-widget-style';

const CSS = `
#${CARD_ID} {
  grid-column: 1 / -1;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--surface-glass, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.10));
  box-shadow: var(--shadow-sm, none);
  display: flex; flex-direction: column; gap: 12px;
}
#${CARD_ID} .ww-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
#${CARD_ID} .ww-title { font-family: 'Instrument Serif', serif; font-size: 22px; margin: 0; color: var(--ink, inherit); }
#${CARD_ID} .ww-total { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-muted, #8b95a5); }
#${CARD_ID} .ww-spark { width: 100%; height: 30px; display: block; }
#${CARD_ID} .ww-rows { display: flex; flex-direction: column; gap: 6px; }
#${CARD_ID} .ww-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; text-decoration: none; color: var(--ink, inherit);
  padding: 7px 10px; border-radius: 8px;
}
#${CARD_ID} .ww-row:hover { filter: brightness(1.15); }
#${CARD_ID} .ww-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
#${CARD_ID} .ww-name { flex: 1; font-weight: 600; }
#${CARD_ID} .ww-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-muted, #8b95a5); display: flex; gap: 10px; }
#${CARD_ID} .ww-streak { color: var(--ink-secondary, #a8b0bd); }
#${CARD_ID} .ww-empty { font-size: 13px; color: var(--ink-muted, #8b95a5); }
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

async function fetchScores() {
  const out = await Promise.all(PORTALS.map(async p => {
    try {
      const res = await fetch(`/api/${p.id}/scores`);
      return { ...p, scores: res.ok ? await res.json() : [] };
    } catch {
      return { ...p, scores: [] };
    }
  }));
  return out;
}

function rowHtml(p, isLeader) {
  return `<a class="ww-row" href="${p.route}" style="background:${p.soft}; border:1px solid ${p.border};">
    <span class="ww-dot" style="background:${p.accent}"></span>
    <span class="ww-name">${p.name}</span>
    <span class="ww-meta">
      <span>${p.runs} run${p.runs === 1 ? '' : 's'}</span>
      <span>${p.attempted ? p.pct + '%' : '—'}</span>
      ${p.streak ? `<span class="ww-streak" style="${isLeader ? `color:${p.accent}` : ''}">▲ ${p.streak}d</span>` : ''}
    </span>
  </a>`;
}

function cardHtml(sum) {
  const rows = sum.portals
    .map(pp => ({ ...PORTALS.find(x => x.id === pp.id), ...pp }))
    .map(pp => rowHtml(pp, sum.streakLeader?.id === pp.id))
    .join('');
  return `<div class="ww-head">
      <h3 class="ww-title">Your week</h3>
      <span class="ww-total">${sum.runs} runs · ${sum.attempted ? sum.pct + '%' : 'no marks yet'}</span>
    </div>
    <svg class="ww-spark" viewBox="0 0 132 30" preserveAspectRatio="none" aria-label="runs per day, last 7 days">
      <polyline points="${sum.spark}" fill="none" stroke="var(--ink-muted, #8b95a5)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    ${sum.runs === 0 ? '<p class="ww-empty">No runs yet this week — pick a portal and start.</p>' : ''}
    <div class="ww-rows">${rows}</div>`;
}

async function refreshCard(card) {
  try {
    const portals = await fetchScores();
    card.innerHTML = cardHtml(weeklySummary(portals));
  } catch {
    card.innerHTML = '<p class="ww-empty">Weekly stats unavailable.</p>';
  }
}

async function mount() {
  if (document.getElementById(CARD_ID)) return;
  // Anchor: the fleet strip is the first full-width section on the landing
  // page; fall back to the top of .shell. Either may render late — the
  // observer below retries until one appears.
  const anchor = document.querySelector('.fleet-strip') || document.querySelector('.shell');
  if (!anchor) return;
  const card = document.createElement('section');
  card.id = CARD_ID;
  card.setAttribute('aria-label', 'Your week across all portals');
  card.innerHTML = '<p class="ww-empty">Loading your week…</p>';
  anchor.parentNode.insertBefore(card, anchor);
  if (!document.getElementById(CARD_ID)) return; // raced with a re-render
  await refreshCard(card);
}

export function initWeeklyWidget() {
  if (typeof document === 'undefined') return;
  ensureStyle();
  mount();
  const mo = new MutationObserver(() => {
    if (!document.getElementById(CARD_ID)) mount();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // bfcache restores the launchpad with a stale card after a quiz — re-pull
  // scores on a persisted pageshow instead of waiting for a full reload.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    const card = document.getElementById(CARD_ID);
    if (card) refreshCard(card);
    else mount();
  });
}
