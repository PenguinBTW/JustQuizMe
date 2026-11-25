// Post-exam self-marking for extended-response questions.
// Exam answers are captured blind (no rubric visible during the paper); honest
// self-assessment happens afterwards with the mark scheme, exactly as students
// use real past papers. This interposes a marking stage before the summary
// whenever essays carry text but no score.
import { esc } from './utils.js';

export function unmarkedEssays(questions, answers, ak) {
  return (questions || []).filter(q => {
    if (q.type !== 'extended-response') return false;
    const ans = answers[ak(q)] || {};
    return (ans.text || '').trim() && ans.score == null;
  });
}

// Renders a per-essay marking stage into #stage; onDone fires when all are marked.
export function renderEssayMarkingStage({ questions, answers, ak, onDone, mountId = 'stage' }) {
  const pending = unmarkedEssays(questions, answers, ak);
  if (!pending.length) { onDone(); return true; }
  let idx = 0;

  const renderOne = () => {
    if (idx >= pending.length) { onDone(); return; }
    const q = pending[idx];
    const ans = answers[ak(q)] || {};
    const levels = (q.levels || []).slice().sort((a, b) => b.level - a.level);
    const words = (ans.text || '').trim().split(/\s+/).filter(Boolean).length;

    document.getElementById(mountId).innerHTML = `
      <div class="card" style="padding:28px;">
        <div class="mono" style="font-size:11.5px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:6px;">
          POST-EXAM SELF-MARKING — ESSAY ${idx + 1} OF ${pending.length}
        </div>
        <h2 class="serif" style="font-size:24px; margin-bottom:4px;">${esc(q.subtopic || q.topic || 'Extended Response')} · ${q.marks} marks</h2>
        <p style="font-size:13.5px; color:var(--ink-secondary); margin-bottom:16px;">${esc((q.prompt || '').replace(/<[^>]*>/g, '').slice(0, 300))}</p>

        <div class="mono" style="font-size:11px; color:var(--ink-muted); margin-bottom:4px;">YOUR ANSWER (${words} words) — written blind during the exam</div>
        <div style="white-space:pre-wrap; font-size:14px; line-height:1.6; border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:20px; max-height:220px; overflow:auto; background:var(--bg-secondary, rgba(0,0,0,.03));">${esc(ans.text || '')}</div>

        ${levels.length ? `
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:10px;">COMPARE AGAINST THE LEVEL DESCRIPTORS — select the band your answer best matches, then refine within it</div>` : `
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:10px;">MARK AGAINST THE SCHEME — tick every point your answer honestly achieves</div>`}
        ${!levels.length && (q.markScheme || []).length ? `
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
          ${q.markScheme.map((m, mi) => `
            <label class="ms-item pem-tick-row" style="cursor:pointer;">
              <input type="checkbox" class="pem-tick" data-pem-tick="${mi}">
              <span><strong>[${esc(m.marks ?? 1)}m]</strong> ${esc(typeof m === 'object' ? m.text : m)}</span>
            </label>
          `).join('')}
        </div>` : ''}
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
          ${levels.map(lvl => `
            <div class="level-card pem-card" data-pem-level="${lvl.level}" tabindex="0" role="button" style="cursor:pointer;">
              <div class="level-card-top">
                <strong style="font-size:14.5px;">${esc(lvl.title)}</strong>
                <span class="format-badge">${lvl.range[0]}–${lvl.range[1]} Marks</span>
              </div>
              <div style="font-size:12.5px; color:var(--ink-secondary); line-height:1.5; margin-top:5px;">
                <div><strong>AO1:</strong> ${esc(lvl.ao1)}</div>
                <div><strong>AO2:</strong> ${esc(lvl.ao2)}</div>
                <div><strong>AO3:</strong> ${esc(lvl.ao3)}</div>
              </div>
              <div class="pem-slider-row" data-pem-row="${lvl.level}" style="display:none; align-items:center; gap:12px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border);">
                <input type="range" class="pem-slider" min="${lvl.range[0]}" max="${lvl.range[1]}" value="${lvl.range[0]}" style="flex:1;" />
                <span class="mono pem-val" style="font-weight:700; color:var(--accent);">${lvl.range[0]}m</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="pem-card pem-zero" data-pem-level="0" tabindex="0" role="button" style="cursor:pointer; margin-bottom:16px; border:1px dashed var(--border); border-radius:8px; padding:10px 14px;">
          <strong style="font-size:13.5px;">No creditable response — 0 marks</strong>
          <div style="font-size:12px; color:var(--ink-secondary); margin-top:3px;">Choose this if the answer is blank, off-topic, or achieves nothing the scheme rewards. Honest zeros are how marking really works.</div>
        </div>

        ${(q.indicativeContent || []).length ? `
          <details style="margin-bottom:16px;">
            <summary style="cursor:pointer; font-size:13px;" class="mono">INDICATIVE CONTENT — points a strong answer may include</summary>
            <ul style="margin:8px 0 0 18px; font-size:13px; line-height:1.6;">${q.indicativeContent.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>
          </details>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="mono" style="font-size:13px;" id="pem-status">No level selected — score cannot be recorded without honest judgement</span>
          <button class="btn btn-primary" id="pem-confirm" disabled>Record ${q.marks ? 'marks' : 'score'} &amp; continue →</button>
        </div>
      </div>
    `;

    let chosen = null;
    const confirmBtn = document.getElementById('pem-confirm');
    const status = document.getElementById('pem-status');

    const update = () => {
      if (chosen == null) return;
      const slider = document.querySelector(`.pem-slider-row[data-pem-row="${chosen}"] .pem-slider`);
      ans.score = slider ? +slider.value : 0;
      ans.selectedLevel = chosen;
      ans.revealed = true;
      status.textContent = `Level ${chosen} selected — ${ans.score} / ${q.marks} marks`;
      confirmBtn.disabled = false;
    };

    document.querySelectorAll('.pem-card').forEach(card => {
      const activate = () => {
        document.querySelectorAll('.pem-card').forEach(c => {
          c.classList.remove('selected');
          const r = c.querySelector('.pem-slider-row');
          if (r) r.style.display = 'none';
        });
        card.classList.add('selected');
        const lvl = +card.dataset.pemLevel;
        chosen = lvl;
        const row = card.querySelector('.pem-slider-row');
        if (lvl === 0) {
          ans.score = 0;
          ans.selectedLevel = 0;
          ans.revealed = true;
          status.textContent = 'Recorded as zero — no creditable content';
          confirmBtn.disabled = false;
          return;
        }
        if (row) {
          row.style.display = 'flex';
          const slider = row.querySelector('.pem-slider');
          slider.oninput = update;
          update();
        }
      };
      card.onclick = activate;
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) activate(); } };
    });

    // point-tick fallback (author-studio essays): score = sum of ticked points, capped
    const ticks = document.querySelectorAll('.pem-tick');
    if (ticks.length) {
      const retally = () => {
        let sum = 0;
        ticks.forEach(t => {
          if (t.checked) {
            const m = (q.markScheme || [])[+t.dataset.pemTick];
            sum += +(m && typeof m === 'object' ? m.marks : 1) || 1;
          }
        });
        ans.score = Math.min(sum, +q.marks || sum);
        ans.revealed = true;
        status.textContent = `${ans.score} / ${q.marks} marks from ticked points`;
        confirmBtn.disabled = false;
      };
      ticks.forEach(t => { t.onchange = retally; });
      // zero-card also valid in fallback mode
    }

    confirmBtn.onclick = () => { idx++; renderOne(); };
  };

  renderOne();
  return false;
}
