// Mistake heatmap — self-mounts a compact per-topic accuracy block at the top
// of the portal's home/picker view. Reads the existing scores + quiz list only;
// writes no stats of its own. Hidden until a topic clears the min-attempt gate.
import { topicMapModel } from './topicMap.js';

const PORTAL = (location.pathname.match(/^\/(maths|physics|cs)\//) || [])[1];
const STALE_MS = 30000;
const MAX_ROWS = 6;
let model = null;
let lastFetch = 0;
let pending = null;

const style = document.createElement('style');
style.textContent = `
  .topic-map { margin:0 auto 14px; max-width:520px; padding:10px 14px;
    border-radius:10px; background:rgba(255,255,255,0.05); }
  .topic-map .tm-title { font:600 10.5px/1.4 ui-monospace,monospace;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--ink-muted,#9aa);
    margin-bottom:6px; }
  .topic-map .tm-row { display:flex; align-items:center; gap:8px; margin:4px 0;
    font:500 12px/1.4 inherit; color:var(--ink-secondary,#ccd); }
  .topic-map .tm-name { flex:0 0 42%; overflow:hidden; text-overflow:ellipsis;
    white-space:nowrap; }
  .topic-map .tm-bar { flex:1; height:5px; border-radius:3px;
    background:rgba(255,255,255,0.08); overflow:hidden; }
  .topic-map .tm-fill { height:100%; border-radius:3px; }
  .topic-map .tm-n { flex:0 0 auto; font:600 10px/1 ui-monospace,monospace;
    color:var(--ink-muted,#9aa); }
`;
document.head.appendChild(style);

async function load() {
  if (model) return model;
  if (pending) return pending;
  pending = (async () => {
    let scores = [], quizzes = [];
    try {
      const r = await fetch(`/${PORTAL}/api/scores`);
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        scores = await r.json();
      }
      const q = await fetch(`/${PORTAL}/api/quizzes`);
      if (q.ok && (q.headers.get('content-type') || '').includes('json')) {
        quizzes = await q.json();
      }
    } catch {}
    const uuidIndex = {};
    for (const qz of quizzes || []) {
      if (qz && qz.uuid && Array.isArray(qz.topics)) uuidIndex[qz.uuid] = qz.topics;
    }
    model = topicMapModel(scores, uuidIndex);
    lastFetch = Date.now();
    pending = null;
    return model;
  })();
  return pending;
}

function render(block, rows) {
  // compare-before-write so sweeps don't retrigger the observer
  const sig = JSON.stringify(rows.map((r) => [r.topic, r.accuracy.toFixed(3), r.n]));
  if (block.dataset.sig === sig) return;
  block.dataset.sig = sig;
  block.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'tm-title';
  title.textContent = 'Weakest topics';
  block.appendChild(title);
  for (const r of rows.slice(0, MAX_ROWS)) {
    const row = document.createElement('div');
    row.className = 'tm-row';
    const name = document.createElement('span');
    name.className = 'tm-name';
    name.textContent = r.topic;
    name.title = r.topic;
    const bar = document.createElement('span');
    bar.className = 'tm-bar';
    const fill = document.createElement('span');
    fill.className = 'tm-fill';
    fill.style.width = `${Math.round(r.accuracy * 100)}%`;
    fill.style.background = r.color;
    bar.appendChild(fill);
    const n = document.createElement('span');
    n.className = 'tm-n';
    n.textContent = `×${r.n}`;
    row.append(name, bar, n);
    block.appendChild(row);
  }
}

function sweep() {
  if (lastFetch && Date.now() - lastFetch > STALE_MS) model = null;
  if (!model) { load().then(sweep); return; }
  const stage = document.getElementById('stage');
  if (!stage) return;
  // only on the home/picker view — when run-start cards are on stage
  const onHome = stage.querySelector(
    '[data-practice-start], [data-quiz-file], [data-exam-file], [data-practice-explore], .btn-practice-start, [data-idx], .subtopic-card'
  );
  let block = stage.querySelector('.topic-map');
  if (!onHome || !model.length) {
    if (block) block.remove();
    return;
  }
  if (!block) {
    block = document.createElement('div');
    block.className = 'topic-map';
    stage.prepend(block);
  }
  render(block, model);
}

load().then(sweep);
new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
