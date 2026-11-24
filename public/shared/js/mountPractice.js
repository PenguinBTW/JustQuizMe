// Practice mount — injects a "Practice" button beside each start-quiz button
// and runs a simplified self-check overlay: one question at a time, Reveal,
// then "got it / missed it". Never touches stats, anchors or history.
import { practiceSpec, reveal, mark, summary, questionText, questionOptions, questionAnswer, questionMaterial } from './practice.js';

const CSS = `
.practice-btn { margin-left: 6px; padding: 6px 10px; font-size: 12px; }
.practice-overlay {
  position: fixed; inset: 0; z-index: 900; background: var(--bg, #0f1115);
  display: flex; flex-direction: column; align-items: center; overflow: auto;
  color: var(--ink, #e8e8ea); font-family: inherit;
}
.practice-card {
  width: min(720px, 92vw); margin: 8vh auto; background: var(--card, #181b22);
  border: 1px solid var(--border, #2a2e38); border-radius: 12px; padding: 28px 30px;
}
.practice-card h3 { margin: 0 0 4px; font-size: 15px; opacity: .8; }
.practice-q { font-size: 17px; line-height: 1.5; margin: 14px 0 18px; white-space: pre-wrap; }
.practice-opts { list-style: none; padding: 0; margin: 0 0 14px; }
.practice-opts li { padding: 8px 12px; margin: 6px 0; border: 1px solid var(--border, #2a2e38); border-radius: 8px; }
.practice-answer {
  background: var(--bg2, #12151c); border-left: 3px solid var(--accent, #6ea8ff);
  padding: 12px 14px; border-radius: 6px; margin: 12px 0; white-space: pre-wrap; font-size: 14px;
}
.practice-row { display: flex; gap: 10px; margin-top: 18px; }
.practice-row .btn { flex: 1; }
`;

function el(tag, cls, text) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}

function typeset(card) {
  try {
    if (window.renderMathInElement) {
      window.renderMathInElement(card, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ]
      });
    }
  } catch { /* katex not loaded — raw text still readable */ }
}

function openOverlay(title, questions) {
  const spec0 = practiceSpec(questions);
  const ov = el('div', 'practice-overlay');
  ov.tabIndex = -1;
  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      const btns = [...ov.querySelectorAll('button')].filter(b => !b.disabled);
      if (!btns.length) { e.preventDefault(); return; }
      const i = btns.indexOf(document.activeElement);
      const next = btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length];
      e.preventDefault();
      next.focus();
    }
  });
  const prevFocus = document.activeElement;
  const close = () => { ov.remove(); try { prevFocus?.focus?.(); } catch {} };
  setTimeout(() => ov.focus(), 0);
  const card = el('div', 'practice-card');
  ov.appendChild(card);
  document.body.appendChild(ov);

  const render = (spec) => {
    card.textContent = '';
    if (spec.done) {
      const s = summary(spec);
      card.appendChild(el('h3', null, title));
      card.appendChild(el('div', 'practice-q', `got ${s.got}/${s.total}`));
      card.appendChild(el('div', null, 'practice — not counted in stats'));
      const row = el('div', 'practice-row');
      const closeBtn = el('button', 'btn btn-primary', 'Close');
      close.onclick = close;
      row.appendChild(closeBtn);
      card.appendChild(row);
      return;
    }
    const item = spec.items[spec.idx];
    card.appendChild(el('h3', null, `${title} · ${spec.idx + 1}/${spec.items.length}`));
    const mats = questionMaterial(item.q);
    for (const m of mats) card.appendChild(el('div', 'practice-answer', m));
    card.appendChild(el('div', 'practice-q', questionText(item.q)));
    const opts = questionOptions(item.q);
    if (opts) {
      const ul = el('ul', 'practice-opts');
      for (const o of opts) ul.appendChild(el('li', null, typeof o === 'string' ? o : (o.text || o.label || String(o))));
      card.appendChild(ul);
    }
    const row = el('div', 'practice-row');
    if (!item.shown) {
      const rv = el('button', 'btn btn-primary', 'Reveal');
      rv.onclick = () => render(reveal(spec));
      row.appendChild(rv);
    } else {
      card.appendChild(el('div', 'practice-answer', questionAnswer(item.q)));
      const g = el('button', 'btn btn-primary', 'Got it');
      const m = el('button', 'btn', 'Missed it');
      g.onclick = () => render(mark(spec, true));
      m.onclick = () => render(mark(spec, false));
      row.append(g, m);
    }
    const quit = el('button', 'btn-ghost', '✕');
    quit.style.cssText = 'position:absolute;top:14px;right:16px;';
    quit.onclick = close;
    card.appendChild(quit);
    card.appendChild(row);
    typeset(card);
    // keep focus inside after the re-render swapped buttons
    const first = card.querySelector('button');
    first?.focus();
  };
  render(spec0);
}

export function mountPractice({ portal, selector, collect, title }) {
  let styleDone = false;
  const scan = () => {
    if (!styleDone) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      styleDone = true;
    }
    document.querySelectorAll(selector).forEach(btn => {
      if (btn.dataset.practiceWired) return;
      btn.dataset.practiceWired = '1';
      const p = el('button', 'btn practice-btn', 'Practice');
      p.onclick = async (e) => {
        e.stopPropagation();
        p.disabled = true;
        try {
          const qs = await collect(btn);
          if (qs && qs.length) {
            openOverlay(title || `${portal} practice`, qs);
          } else {
            p.textContent = 'No questions';
            setTimeout(() => { p.textContent = 'Practice'; }, 1800);
          }
        } catch {
          p.textContent = 'Load failed';
          setTimeout(() => { p.textContent = 'Practice'; }, 1800);
        } finally { p.disabled = false; }
      };
      btn.insertAdjacentElement('afterend', p);
    });
  };
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });
  scan();
}
