// Master Homepage Controller & Universal Synthesizer
import { initTheme, toggleTheme } from '../../shared/js/theme.js';
import { num } from '../../shared/js/utils.js';
import { wireModalA11y } from '../../shared/js/modalA11y.js';
wireModalA11y();
import { initHeroWave } from './demos/wave-canvas.js';
import { initAsciiEngine } from './demos/ascii-engine.js';
import { initMathCanvas } from './demos/math-canvas.js';
import { initPhysicsChamber } from './demos/physics-chamber.js';
import { renderOverview } from './overview.js';

const SUBJECT_CONFIG = {
  maths: {
    name: 'Mathematics',
    spec: 'OCR H240',
    route: '/maths',
    timeMultiplier: 1.2,
    topics: [
      { id: 'Algebra, Polynomials & Proof', name: 'Pure Algebra & Polynomials' },
      { id: 'Functions & Graphs', name: 'Functions & Graphs' },
      { id: 'Coordinate Geometry & Vectors', name: 'Coordinate Geometry & Vectors' },
      { id: 'Sequences & Series', name: 'Sequences & Series' },
      { id: 'Trigonometry', name: 'Trigonometry & Identities' },
      { id: 'Differentiation', name: 'Differentiation & Rates of Change' },
      { id: 'Integration', name: 'Integration & Differential Equations' },
      { id: 'Numerical Methods', name: 'Numerical Methods' },
      { id: 'Statistical Sampling & Data', name: 'Statistical Sampling & Data' },
      { id: 'Probability & Hypothesis Testing', name: 'Probability & Hypothesis Testing' },
      { id: 'Kinematics & Projectiles', name: 'Kinematics & Projectiles' },
      { id: 'Forces, Moments & Equilibrium', name: 'Forces & Equilibrium' }
    ]
  },
  cs: {
    name: 'Computer Science',
    spec: 'OCR H446',
    route: '/cs',
    timeMultiplier: 1.07,
    topics: [
      { id: 'Systems Architecture', name: 'Systems Architecture (Unit 1.1)' },
      { id: 'Software & Development', name: 'Software & Development (Unit 1.2)' },
      { id: 'Exchanging Data', name: 'Exchanging Data & Networks (Unit 1.3)' },
      { id: 'Data Types & Structures', name: 'Data Types & Structures (Unit 1.4)' },
      { id: 'Legal, Moral & Cultural', name: 'Legal, Moral & Cultural Issues (Unit 1.5)' },
      { id: 'Computational Thinking', name: 'Computational Thinking (Unit 2.1)' },
      { id: 'Programming Techniques', name: 'Programming Techniques (Unit 2.2)' },
      { id: 'Algorithms & Complexity', name: 'Algorithms & Complexity (Unit 2.3)' }
    ]
  },
  physics: {
    name: 'Physics',
    spec: 'AQA 7408',
    route: '/physics',
    timeMultiplier: 1.07,
    topics: [
      { id: 'Particle Physics', name: 'Particle Physics' },
      { id: 'Waves', name: 'Waves & Optics' },
      { id: 'Mechanics', name: 'Mechanics' },
      { id: 'Materials', name: 'Materials' },
      { id: 'Electricity', name: 'Electricity & Circuits' },
      { id: 'Further mechanics', name: 'Further Mechanics' },
      { id: 'Thermal physics', name: 'Thermal Physics' },
      { id: 'Fields', name: 'Gravitational & Electric Fields' },
      { id: 'Nuclear physics', name: 'Nuclear Physics' },
      { id: 'Astrophysics', name: 'Astrophysics' },
      { id: 'Practical Knowledge', name: 'Practical Knowledge' }
    ]
  }
};

let activeSubject = 'maths';
let selectedTopics = new Set();
let targetMarks = 50;

// Fetch Live Database Metrics
async function loadLiveMetrics() {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) return;
    const data = await res.json();

    // Update Strip Counters
    const qCountEl = document.getElementById('metricQuestions');
    const mCountEl = document.getElementById('metricMarks');
    const pCountEl = document.getElementById('metricPapers');
    const tCountEl = document.getElementById('metricTopics');

    if (qCountEl) qCountEl.textContent = num(data.totals.questions);
    if (mCountEl) mCountEl.textContent = num(data.totals.marks);
    if (pCountEl) pCountEl.textContent = num(data.totals.papers);
    if (tCountEl) tCountEl.textContent = num(data.totals.topics);

    // Update Fleet Cards
    for (const [key, subj] of Object.entries(data.subjects)) {
      const qEl = document.getElementById(`card-q-${key}`);
      const mEl = document.getElementById(`card-m-${key}`);
      const pEl = document.getElementById(`card-p-${key}`);
      if (qEl) qEl.textContent = num(subj.questions);
      if (mEl) mEl.textContent = num(subj.marks);
      if (pEl) pEl.textContent = num(subj.papers);
    }
  } catch (err) {
    console.warn('Could not load live metrics:', err);
  }
}

// Synthesizer Topic Grid
function switchSubject(subjKey) {
  activeSubject = subjKey;

  const tabMath = document.getElementById('tabMath');
  const tabCs = document.getElementById('tabCs');
  const tabPhys = document.getElementById('tabPhys');

  if (tabMath) tabMath.className = `synth-tab-btn tab-math ${subjKey === 'maths' ? 'active' : ''}`;
  if (tabCs) tabCs.className = `synth-tab-btn tab-cs ${subjKey === 'cs' ? 'active' : ''}`;
  if (tabPhys) tabPhys.className = `synth-tab-btn tab-phys ${subjKey === 'physics' ? 'active' : ''}`;

  const subj = SUBJECT_CONFIG[subjKey];
  selectedTopics = new Set(subj.topics.map(t => t.id));

  renderTopicGrid();
  updateTelemetry();
}

function renderTopicGrid() {
  const container = document.getElementById('topicGridContainer');
  if (!container) return;
  container.innerHTML = '';

  const subj = SUBJECT_CONFIG[activeSubject];
  subj.topics.forEach(t => {
    const isSelected = selectedTopics.has(t.id);
    const tile = document.createElement('div');
    tile.className = `topic-tile ${isSelected ? 'selected' : ''}`;
    tile.onclick = () => {
      if (selectedTopics.has(t.id)) selectedTopics.delete(t.id);
      else selectedTopics.add(t.id);
      renderTopicGrid();
      updateTelemetry();
    };

    tile.innerHTML = `
      <div class="topic-tile-left">
        <div class="topic-checkbox">${isSelected ? '✓' : ''}</div>
        <span class="topic-tile-title">${t.name}</span>
      </div>
    `;
    container.appendChild(tile);
  });
}

function updateTelemetry() {
  const subj = SUBJECT_CONFIG[activeSubject];
  const examMins = Math.round(targetMarks * subj.timeMultiplier);
  const estQuestions = Math.max(1, Math.round(targetMarks / 4.5));

  const counterText = document.getElementById('synthCounterText');
  if (counterText) {
    counterText.textContent = `${selectedTopics.size} / ${subj.topics.length} Canonical Topics Selected`;
  }

  const estQEl = document.getElementById('estQuestionsVal');
  if (estQEl) estQEl.textContent = `~${estQuestions} Questions`;

  const examTimeEl = document.getElementById('examTimeVal');
  if (examTimeEl) examTimeEl.textContent = `${examMins} Minutes`;

  const launchBtn = document.getElementById('synthLaunchBtn');
  if (launchBtn) {
    launchBtn.textContent = `Synthesize & Launch ${subj.name} (${targetMarks}m / ${examMins} mins) ↗`;
  }
}

function launchSynthesizedPaper() {
  const subj = SUBJECT_CONFIG[activeSubject];
  if (selectedTopics.size === 0) {
    alert('Please select at least one topic to synthesize a practice exam.');
    return;
  }
  const topicList = Array.from(selectedTopics).join(',');
  const targetUrl = `${subj.route}/?mode=custom&marks=${targetMarks}&topics=${encodeURIComponent(topicList)}`;
  window.location.href = targetUrl;
}

// Window bindings for inline events
window.toggleTheme = () => toggleTheme('themeToggleBtn');
window.switchSubject = switchSubject;
window.selectAllTopics = () => {
  selectedTopics = new Set(SUBJECT_CONFIG[activeSubject].topics.map(t => t.id));
  renderTopicGrid();
  updateTelemetry();
};
window.deselectAllTopics = () => {
  selectedTopics.clear();
  renderTopicGrid();
  updateTelemetry();
};
window.launchSynthesizedPaper = launchSynthesizedPaper;

window.addEventListener('DOMContentLoaded', () => {
  initTheme('themeToggleBtn');
  initHeroWave();
  initAsciiEngine();
  initMathCanvas();
  initPhysicsChamber();

  loadLiveMetrics();
  const ovRoot = document.getElementById('overviewRoot');
  if (ovRoot) renderOverview(ovRoot);
  switchSubject('maths');

  const slider = document.getElementById('marksSlider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      targetMarks = Number(e.target.value);
      const valReadout = document.getElementById('sliderValReadout');
      if (valReadout) valReadout.textContent = `${targetMarks} Marks`;
      updateTelemetry();
    });
  }
});

// Student-reported question flags, aggregated across the three portals.
async function renderFlagsStrip() {
  const hostEl = document.getElementById('overviewRoot') || document.body;
  try {
    const all = [];
    for (const portal of ['cs', 'maths', 'physics']) {
      const list = await fetch(`/api/${portal}/flags`).then(r => r.ok ? r.json() : []).catch(() => []);
      all.push(...list);
    }
    if (!all.length) return;
    const strip = document.createElement('div');
    strip.className = 'flags-strip';
    strip.style.cssText = 'margin:10px 0; padding:10px 14px; border:1px solid var(--border); border-radius:8px; font-size:12.5px;';
    const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const recent = all.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
    strip.innerHTML = `<strong>⚑ ${all.length} flagged question issue${all.length === 1 ? '' : 's'}</strong> ` +
      recent.map(f =>
        `<div style="margin-top:6px; opacity:0.85;"><span class="mono" style="font-size:11px;">[${escHtml(f.portal)}] ${escHtml(f.questionId)}</span> — ${escHtml(f.issue).slice(0, 140)}</div>`
      ).join('');
    hostEl.parentNode.insertBefore(strip, hostEl.nextSibling);
  } catch {}
}
renderFlagsStrip();
