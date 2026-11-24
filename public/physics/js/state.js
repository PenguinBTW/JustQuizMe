// Physics State Store & Controlled Specification

export const AQA_TOPICS = [
  'Particle Physics',
  'Waves',
  'Mechanics',
  'Materials',
  'Electricity',
  'Further mechanics',
  'Thermal physics',
  'Fields',
  'Nuclear physics',
  'Astrophysics',
  'Practical Knowledge'
];

export const MIXED_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

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
  runMode: 'quiz',
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
  mixed: { open: true, topics: new Set(), subs: new Set(), m: 20, mode: 'standard', set: [] },
  topicModal: null,
};

// Retry-missed-results button — runner imports are hoisted but only used on
// results-screen clicks, so the module cycle (state → assessment → state)
// stays harmless.
import { beginRun } from './runner/assessment.js';
import { ak } from './utils.js';
import { registerRetryMissed } from '../../shared/js/mountRetryMissed.js';
import { registerShareResult } from '../../shared/js/mountShare.js';
registerRetryMissed({ S, beginRun, keyOf: ak });
registerShareResult({ S, portal: 'physics', keyOf: ak });
