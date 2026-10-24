// Maths Virtual KaTeX Keypad
import { S } from '../state.js';
import { esc } from '../utils.js';

export function mathKeypadHtml(targetId) {
  const symbols = [
    { label: 'π', val: '\\pi ' },
    { label: '√x', val: '\\sqrt{}' },
    { label: 'x²', val: '^2' },
    { label: 'xⁿ', val: '^{}' },
    { label: 'a/b', val: '/' },
    { label: '∫', val: '\\int ' },
    { label: 'dx', val: 'dx' },
    { label: 'ln', val: '\\ln(' },
    { label: 'eˣ', val: 'e^' },
    { label: 'sin', val: '\\sin(' },
    { label: 'cos', val: '\\cos(' },
    { label: 'tan', val: '\\tan(' },
    { label: 'θ', val: '\\theta ' },
    { label: '≤', val: '<=' },
    { label: '≥', val: '>=' },
    { label: '≠', val: '!=' }
  ];
  return `
    <div class="math-symbol-bar">
      ${symbols.map(s => `<button type="button" class="math-symbol-btn" data-math-ins="${esc(s.val)}" data-target="${targetId}">${esc(s.label)}</button>`).join('')}
    </div>
  `;
}

export function wireKeypad() {
  document.querySelectorAll('[data-math-ins]').forEach(btn => {
    btn.onclick = () => {
      const ins = btn.dataset.mathIns;
      const targetId = btn.dataset.target || S._activeInputId;
      const inp = document.getElementById(targetId) || document.activeElement;
      if (inp && (inp.tagName === 'INPUT' || inp.tagName === 'TEXTAREA')) {
        const start = inp.selectionStart ?? inp.value.length;
        const end = inp.selectionEnd ?? inp.value.length;
        const prev = inp.value;
        inp.value = prev.substring(0, start) + ins + prev.substring(end);
        inp.focus();
        inp.setSelectionRange(start + ins.length, start + ins.length);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
  });
}
