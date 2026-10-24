// Universal Assessment Timer & Exam Countdown Controller
import { fmtClock } from './utils.js';

export class AssessmentTimer {
  constructor(options = {}) {
    this.isExam = !!options.exam;
    this.timeLimitSeconds = (options.timeLimitMinutes || 0) * 60;
    this.elapsedSeconds = options.initialElapsed || 0;
    this.onTick = options.onTick || (() => {});
    this.onTimeUp = options.onTimeUp || (() => {});
    this.intervalId = null;
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => {
      this.elapsedSeconds++;

      let displayString = fmtClock(this.elapsedSeconds);
      if (this.isExam && this.timeLimitSeconds > 0) {
        const remaining = Math.max(0, this.timeLimitSeconds - this.elapsedSeconds);
        displayString = `${fmtClock(remaining)} ⏱`;
        if (remaining <= 0) {
          this.stop();
          this.onTimeUp();
          return;
        }
      }

      this.onTick(displayString, this.elapsedSeconds);
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getElapsed() {
    return this.elapsedSeconds;
  }
}
