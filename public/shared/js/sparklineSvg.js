// Hand-rolled SVG sparkline — zero dependencies, returns an SVG string.
// points: [{t, pct|mastery|null}] — nulls break the line honestly (gaps, not interpolation).

export function sparkline(points, { width = 220, height = 40, color = 'var(--accent)' } = {}) {
  const val = (p => p.pct ?? p.mastery);
  const pts = (points || []).map((p, i) => ({ x: i, y: val(p) }));
  const n = pts.length;
  if (!n) return '';
  const px = i => n === 1 ? width / 2 : (i / (n - 1)) * (width - 8) + 4;
  const py = v => height - 4 - Math.max(0, Math.min(1, v)) * (height - 8);
  // build segments, breaking at nulls
  let d = '';
  let pen = false;
  const dots = [];
  pts.forEach(p => {
    if (p.y == null) { pen = false; return; }
    const x = px(p.x).toFixed(1);
    const y = py(p.y).toFixed(1);
    d += pen ? ` L${x} ${y}` : `M${x} ${y}`;
    pen = true;
    dots.push([x, y]);
  });
  const last = dots[dots.length - 1];
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block; overflow:visible;" role="img" aria-label="trend sparkline">
    ${d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${last ? `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/>` : ''}
  </svg>`;
}
