// Physics streak chip — mounts the shared streak badge on the nav row.
import { S } from './state.js';
import { streakModel } from '../../shared/js/streak.js';
import { mountStreakChip } from '../../shared/js/mountStreak.js';

mountStreakChip({
  getModel: () => streakModel((S.scores || []).map(s => s.date ?? s.at ?? s.when))
});
