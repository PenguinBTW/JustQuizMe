// Topic-mastery heatmap — mounts a "Topic mastery" grid into the Stats view.
// Self-contained: watches #stage and appends after the stats cards.
import { mountMastery } from '../../shared/js/mountMastery.js';
import { MATHS_TOPICS } from './state.js';

mountMastery('maths', { order: MATHS_TOPICS });
