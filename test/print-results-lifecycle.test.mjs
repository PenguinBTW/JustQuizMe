// Lifecycle test for cs/js/print-results.js: the beforeprint/afterprint
// handlers and the printResults() entry point, under minimal DOM stubs —
// enough for populate()'s getElementById/classList/innerHTML usage.
import test from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const els = new Map();
const makeEl = (id) => ({ id, innerHTML: '' });
const classList = () => {
  const set = new Set();
  return {
    _set: set,
    toggle(c, on) {
      const want = on === undefined ? !set.has(c) : on;
      if (want) set.add(c); else set.delete(c);
      return want;
    },
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c)
  };
};

globalThis.window = {
  addEventListener: (type, fn) => { listeners[type] = fn; },
  printed: 0,
  print() { this.printed += 1; }
};
globalThis.document = {
  body: { classList: classList() },
  getElementById: (id) => els.get(id) ?? null
};

const { S } = await import('../public/cs/js/state.js');
const { printResults } = await import('../public/cs/js/print-results.js');

const host = makeEl('printSheet');
els.set('printSheet', host);
const summaryMarker = makeEl('finishPrintBtn');

const seed = () => {
  S.quiz = { title: 'Lifecycle Quiz', questions: [{ id: 'q1', text: 'Two plus two?', marks: 2 }] };
  S.answers = { q1: { score: 2 } };
  S.runMode = 'exam';
  S.elapsed = 42;
};
seed();

test('beforeprint populates the sheet and tags the body', () => {
  els.set('finishPrintBtn', summaryMarker);
  listeners.beforeprint();
  assert.ok(host.innerHTML.includes('Lifecycle Quiz'));
  assert.ok(host.innerHTML.includes('Total 2 / 2'));
  assert.ok(document.body.classList.contains('printing-sheet'));
});

test('afterprint clears the sheet and the print class', () => {
  // Self-contained: populate first so there is state to clear, otherwise the
  // assertions pass vacuously on an empty sheet.
  els.set('finishPrintBtn', summaryMarker);
  listeners.beforeprint();
  assert.ok(host.innerHTML.includes('Lifecycle Quiz'));
  listeners.afterprint();
  assert.equal(host.innerHTML, '');
  assert.ok(!document.body.classList.contains('printing-sheet'));
});

test('beforeprint with no summary on screen leaves a normal print', () => {
  els.delete('finishPrintBtn'); // navigated back to the question bank
  listeners.beforeprint();
  assert.equal(host.innerHTML, '');
  assert.ok(!document.body.classList.contains('printing-sheet'));
});

test('printResults prints only while the summary is visible', () => {
  const before = window.printed;
  printResults(); // summary hidden — populate() false, no print
  assert.equal(window.printed, before);
  els.set('finishPrintBtn', summaryMarker);
  printResults();
  assert.equal(window.printed, before + 1);
  assert.ok(host.innerHTML.includes('Lifecycle Quiz'));
});
