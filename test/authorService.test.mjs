import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { saveAuthoredBank, upsertQuestion, safeFileName } = require('../server/services/author-service.js');

const validBank = {
  uuid: 'test-bank', version: 1, title: 'Test', subject: 'cs', topics: ['T'],
  questions: [{ id: 'q1', type: 'multiple-choice', marks: 1, prompt: 'p', topic: 'T', options: ['a', 'b'], correctIndex: 0 }],
};

test('atomic save writes valid bank; invalid bank rejected with details', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
  const out = saveAuthoredBank(dir, validBank, 'My Bank!');
  assert.equal(out.file, 'my-bank.json');
  const written = JSON.parse(fs.readFileSync(path.join(dir, out.file), 'utf8'));
  assert.equal(written.uuid, 'test-bank');
  assert.throws(() => saveAuthoredBank(dir, { uuid: 'x' }, 'bad'), e => e.errors && e.errors.length > 0);
});

test('upsertQuestion replaces by id, appends new; invalid question rejected', () => {
  const q2 = { id: 'q1', type: 'multiple-choice', marks: 2, prompt: 'revised', topic: 'T', options: ['a', 'b'], correctIndex: 1 };
  const merged = upsertQuestion(validBank, q2);
  assert.equal(merged.questions.length, 1);
  assert.equal(merged.questions[0].prompt, 'revised');
  const q3 = { ...q2, id: 'q2' };
  assert.equal(upsertQuestion(validBank, q3).questions.length, 2);
  assert.throws(() => upsertQuestion(validBank, { id: 'bad' }));
});

test('safeFileName strips traversal and specials', () => {
  assert.equal(safeFileName('../../etc/passwd'), 'etc-passwd');
  assert.equal(safeFileName(''), 'untitled');
});
