// Per-question dwell-time helpers: recording + median-relative heat strip.
// Pure functions only — safe to drive from Node with synthetic entries.

// Credit the question that was on screen since `shownAt` with the elapsed
// dwell, then return the fresh clock state for the newly shown question.
export function noteDwell(dwell, shownKey, shownAt, now) {
  if (shownKey && shownAt > 0) {
    const secs = Math.max(0, (now - shownAt) / 1000);
    dwell[shownKey] = (dwell[shownKey] || 0) + secs;
  }
  return dwell;
}

export function median(nums) {
  const a = nums.filter(n => n > 0).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// ratio < 1 (faster than median) → dim slate; ratio ≥ 1 → warm, deepening
// toward 2x the median and beyond.
export function heatColor(seconds, med) {
  if (!med) return 'rgba(148, 158, 170, 0.30)';
  const ratio = seconds / med;
  if (ratio < 1) {
    const a = 0.22 + 0.30 * ratio;
    return `rgba(148, 158, 170, ${a.toFixed(2)})`;
  }
  const hot = Math.min((ratio - 1) / 1.2, 1); // saturates at ~2.2x median
  const r = Math.round(160 + 85 * hot);
  const g = Math.round(120 - 20 * hot);
  const b = Math.round(70 - 25 * hot);
  const alpha = 0.55 + 0.45 * hot;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

// questionTimes: [{ q: 'qid', s: seconds }] in quiz order → compact bar strip.
export function timeStripHtml(questionTimes) {
  const list = (questionTimes || []).filter(t => t && typeof t.s === 'number');
  if (!list.length) return '';
  const med = median(list.map(t => t.s));
  const max = Math.max(...list.map(t => t.s), 1);
  const ticks = list.map((t, i) => {
    const h = 4 + Math.round(10 * (t.s / max));
    const col = heatColor(t.s, med);
    const secs = Math.round(t.s);
    return `<span class="time-tick" style="height:${h}px;background:${col};" title="Q${i + 1} · ${secs}s"></span>`;
  }).join('');
  return `<div class="time-strip" title="Time per question — warm = slower than the session median">${ticks}</div>`;
}
