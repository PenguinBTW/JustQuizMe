// Physics Technical Diagram Crop Embedder
import { esc } from '../../../../shared/js/utils.js';

export function renderDiagram(q) {
  if (!q.image && !q.images && !q.figure) return '';

  const imgFile = q.image || (Array.isArray(q.images) ? q.images[0] : null) || q.figure;
  if (!imgFile) return '';

  const folder = q.imageFolder ? `${q.imageFolder}/` : '';
  const src = `/physics/images/past-paper/${folder}${imgFile}`;

  return `
    <div class="diagram-figure-box">
      <img src="${esc(src)}" alt="Technical Figure Diagram" class="diagram-img" onerror="this.parentElement.style.display='none';" />
      <div class="mono" style="font-size: 11px; color: var(--ink-muted); margin-top: 8px;">
        Figure Reference · AQA Technical Crop
      </div>
    </div>
  `;
}
