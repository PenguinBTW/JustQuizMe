import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// DATA_DIR must be set before requiring config (flags.js binds FLAGS_FILE at
// require time) — each test file is its own process under node --test.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'jqm-flags-'));
process.env.DATA_DIR = DATA_DIR;

const express = (await import('express')).default;
const { default: createFlagsRouter } = await import('../server/routes/flags.js');

const app = express();
app.use(express.json());
app.use('/api', createFlagsRouter());
const server = await new Promise((r) => {
  const s = app.listen(0, () => r(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const api = (method, path, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const FLAG = { portal: 'cs', fileBase: 'paper1', questionId: 'q3', reason: 'typo', note: 'n' };
const stored = () => JSON.parse(readFileSync(join(DATA_DIR, 'flags.json'), 'utf8'));

test('POST assigns each flag a unique id and persists it', async () => {
  await (await api('POST', '/api/flags', FLAG)).json();
  const [f] = stored();
  assert.match(f.id, /^[0-9a-f-]{36}$/);
  assert.equal(f.portal, 'cs');
});

test('DELETE by id removes exactly that row — even with a colliding twin', async () => {
  // Two reports identical in every field: only id tells them apart.
  writeFileSync(join(DATA_DIR, 'flags.json'), JSON.stringify([
    { id: 'a1', ...FLAG, at: '2026-01-02T03:04:05.000Z' },
    { id: 'b2', ...FLAG, at: '2026-01-02T03:04:05.000Z' },
  ]));
  const res = await api('DELETE', '/api/flags', { id: 'b2' });
  assert.equal(res.status, 200);
  assert.deepEqual(stored().map((f) => f.id), ['a1']);
});

test('DELETE falls back to field identity for pre-id rows', async () => {
  writeFileSync(join(DATA_DIR, 'flags.json'), JSON.stringify([
    { ...FLAG, questionId: 7, at: '2026-01-02T03:04:05.000Z' },
    { ...FLAG, questionId: 'q9', at: '2026-01-03T00:00:00.000Z' },
  ]));
  const res = await api('DELETE', '/api/flags', {
    portal: 'cs', fileBase: 'paper1', questionId: '7', at: '2026-01-02T03:04:05.000Z',
  });
  assert.equal(res.status, 200);
  const rest = stored();
  assert.equal(rest.length, 1);
  assert.equal(rest[0].questionId, 'q9');
});

test('DELETE 404s on no match and 400s on a shapeless body', async () => {
  writeFileSync(join(DATA_DIR, 'flags.json'), '[]');
  const miss = await api('DELETE', '/api/flags', { id: 'nope' });
  assert.equal(miss.status, 404);
  const bad = await api('DELETE', '/api/flags', { portal: 'cs' });
  assert.equal(bad.status, 400);
});
