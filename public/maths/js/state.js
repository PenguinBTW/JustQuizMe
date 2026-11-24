// Maths State Store & OCR Controlled Specification (H240)
export const OCR_MATHS_TOPIC_SPECS = [
  // Component 01: Pure Mathematics
  { topic: 'Algebra, Polynomials & Proof', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '01' },
  { topic: 'Functions & Graphs', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '02' },
  { topic: 'Coordinate Geometry & Vectors', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '03' },
  { topic: 'Sequences & Series', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '04' },
  { topic: 'Trigonometry', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '05' },
  { topic: 'Differentiation', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '06' },
  { topic: 'Integration', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '07' },
  { topic: 'Numerical Methods', component: 'Pure', compName: 'Pure Mathematics', specCode: 'H240/01', unit: '08' },
  // Component 02: Applied Statistics
  { topic: 'Statistical Sampling & Data', component: 'Stats', compName: 'Applied Statistics', specCode: 'H240/02', unit: '09' },
  { topic: 'Probability & Hypothesis Testing', component: 'Stats', compName: 'Applied Statistics', specCode: 'H240/02', unit: '10' },
  // Component 03: Applied Mechanics
  { topic: 'Kinematics & Projectiles', component: 'Mech', compName: 'Applied Mechanics', specCode: 'H240/03', unit: '11' },
  { topic: 'Forces, Moments & Equilibrium', component: 'Mech', compName: 'Applied Mechanics', specCode: 'H240/03', unit: '12' }
];

export const MATHS_TOPICS = OCR_MATHS_TOPIC_SPECS.map(s => s.topic);
export const MIXED_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

export const S = {
  quizzes: { normal: [], 'past-paper': [] },
  scores: [],
  save: null,
  saveDismissed: false,
  room: 'past', // 'past' | 'practice' | 'history' | 'runner' | 'results' | 'explore'
  historySrc: 'past',
  exploreCtx: null,
  returnRoom: 'past',
  quiz: null,
  quizMeta: null,
  runMode: 'quiz', // 'quiz' | 'explore'
  idx: 0,
  answers: {},
  startedAt: null,
  elapsed: 0,
  timerId: null,
  pastFull: {},
  openTopics: new Set(),
  retrySpec: null,
  topicDrafts: {},
  topicSets: {},
  _topicCache: new Map(),
  _subCache: new Map(),
  _activeInputId: null,
  mixed: { open: true, _init: false, topics: new Set(), subs: new Set(), m: 20, mode: 'standard', set: [] },
  topicModal: null
};

// Retry-missed-results button — runner imports are hoisted but only used on
// results-screen clicks, so the module cycle (state → assessment → state)
// stays harmless.
import { beginRun } from './runner/assessment.js';
import { ak } from './utils.js';
import { registerRetryMissed } from '../../shared/js/mountRetryMissed.js';
registerRetryMissed({ S, beginRun, keyOf: ak });
