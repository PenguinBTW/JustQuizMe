// Computer Science State Store & OCR Controlled Specification (H446)

export const OCR_TOPIC_SPECS = [
  { topic: 'Systems Architecture', component: '01', compName: 'Computer Systems', specCode: 'H446/01', unit: '1.1', hex: '0x01' },
  { topic: 'Software & Development', component: '01', compName: 'Computer Systems', specCode: 'H446/01', unit: '1.2', hex: '0x02' },
  { topic: 'Exchanging Data', component: '01', compName: 'Computer Systems', specCode: 'H446/01', unit: '1.3', hex: '0x03' },
  { topic: 'Data Types & Structures', component: '01', compName: 'Computer Systems', specCode: 'H446/01', unit: '1.4', hex: '0x04' },
  { topic: 'Legal, Moral & Cultural', component: '01', compName: 'Computer Systems', specCode: 'H446/01', unit: '1.5', hex: '0x05' },
  { topic: 'Computational Thinking', component: '02', compName: 'Algorithms & Problem Solving', specCode: 'H446/02', unit: '2.1', hex: '0x06' },
  { topic: 'Programming Techniques', component: '02', compName: 'Algorithms & Problem Solving', specCode: 'H446/02', unit: '2.2', hex: '0x07' },
  { topic: 'Algorithms & Complexity', component: '02', compName: 'Algorithms & Problem Solving', specCode: 'H446/02', unit: '2.3', hex: '0x08' }
];

export const OCR_TOPICS = OCR_TOPIC_SPECS.map(s => s.topic);
export const MIXED_UUID = 'cccccccc-aaaa-4aaa-aaaa-cccccccccccc';

export const S = {
  quizzes: { normal: [], 'past-paper': [] },
  scores: [],
  save: null,
  saveDismissed: false,
  room: 'past',
  historySrc: 'past',
  exploreCtx: null,
  returnRoom: 'past',
  quiz: null,
  quizMeta: null,
  runMode: 'quiz', // 'quiz' | 'exam' | 'explore'
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
  mixed: { open: true, topics: new Set(), subs: new Set(), m: 30, mode: 'standard', set: [] },
  topicModal: null
};

// Retry-missed-results button — runner imports are hoisted but only used on
// results-screen clicks, so the module cycle (state → assessment → state)
// stays harmless.
import { beginRun } from './runner/assessment.js';
import { ak } from './utils.js';
import { registerRetryMissed } from '../../shared/js/mountRetryMissed.js';
import { registerShareResult } from '../../shared/js/mountShare.js';
registerRetryMissed({ S, beginRun, keyOf: ak });
registerShareResult({ S, portal: 'cs', keyOf: ak });
