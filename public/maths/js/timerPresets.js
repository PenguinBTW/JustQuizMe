// Exam timer presets — map a preset key + paper marks to a time limit in
// minutes. 'standard' matches the historical 1.5×-marks exam clock, so it
// stays the default; anything else is additive.
export const TIMER_PRESETS = [
  { key: 'standard', label: 'Standard · 1.5m/mark' },
  { key: 'relaxed', label: 'Relaxed · 2m/mark' },
  { key: 'strict', label: 'Strict · 1m/mark' },
  { key: 'custom', label: 'Custom minutes' },
  { key: 'none', label: 'No timer' },
];

export function presetMinutes(preset, marks, customMinutes) {
  const m = +marks || 0;
  switch (preset) {
    case 'relaxed': return m * 2;
    case 'standard': return m * 1.5;
    case 'strict': return m * 1;
    case 'custom': {
      const c = Math.round(+customMinutes || 0);
      return c > 0 ? Math.min(c, 600) : null;
    }
    default: return null; // 'none' and unknown keys → untimed
  }
}

// Button caption for the exam start action, e.g. "Start Exam · 68m ⏱".
export function examStartLabel(preset, marks, customMinutes) {
  const mins = presetMinutes(preset, marks, customMinutes);
  return mins == null ? 'Start Exam · no timer' : `Start Exam · ${Math.round(mins)}m ⏱`;
}
