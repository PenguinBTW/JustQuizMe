import test from 'node:test';
import assert from 'node:assert';
import { validateQuestion, validateBank } from '../public/shared/js/questionSchema.js';

test('valid MCQ passes; missing correctIndex/options flagged', () => {
  assert.deepEqual(validateQuestion({
    id: 'q1', type: 'multiple-choice', marks: 1, prompt: 'p', topic: 'T',
    options: ['a', 'b'], correctIndex: 1,
  }), []);
  const errs = validateQuestion({ id: 'q1', type: 'multiple-choice', marks: 1, prompt: 'p', topic: 'T', options: ['a'], correctIndex: 5 });
  assert.ok(errs.some(e => e.includes('options')));
  assert.ok(errs.some(e => e.includes('correctIndex')));
});

test('mark scheme sum mismatch flagged; calculation numeric answer enforced', () => {
  const errs = validateQuestion({
    id: 'q1', type: 'written', marks: 3, prompt: 'p', topic: 'T',
    markScheme: [{ marks: 1, text: 'x' }],
  });
  assert.ok(errs.some(e => e.includes('sum')));
  assert.ok(validateQuestion({ id: 'q', type: 'calculation', marks: 1, prompt: 'p', topic: 'T' }).some(e => e.includes('numeric')));
});

test('mistakes annotations: optionIndex range + pattern/optionIndex presence', () => {
  const errs = validateQuestion({
    id: 'q1', type: 'multiple-choice', marks: 1, prompt: 'p', topic: 'T',
    options: ['a', 'b'], correctIndex: 0,
    mistakes: [{ optionIndex: 9, misconception: 'm' }, { misconception: 'x' }],
  });
  assert.ok(errs.some(e => e.includes('out of range')));
  assert.ok(errs.some(e => e.includes('needs optionIndex')));
});

test('validateBank catches duplicate ids and missing metadata', () => {
  const errs = validateBank({ uuid: 'u', title: 't', questions: [
    { id: 'q1', type: 'written', marks: 1, prompt: 'a', topic: 'T', markScheme: [{ marks: 1, text: 'x' }] },
    { id: 'q1', type: 'written', marks: 1, prompt: 'b', topic: 'T', markScheme: [{ marks: 1, text: 'y' }] },
  ]});
  assert.ok(errs.some(e => e.includes('duplicate')));
  assert.ok(validateBank({}).length >= 2);
});
