// Tests for the pure share-result encode/parse helpers (no DOM needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeResult, parseResult, SHARE_HASH, resultCardHtml } from '../public/shared/js/shareResult.js';

const MODEL = { portal: 'cs', title: 'OCR CS Paper 1', score: 42, marks: 60, date: 1764000000000 };
const wrap = (payload) => `#/share?p=${payload}`;

test('encode/parse round-trips a valid model', () => {
  const m = parseResult(wrap(encodeResult(MODEL)), 'cs');
  assert.equal(m.portal, 'cs');
  assert.equal(m.title, MODEL.title);
  assert.equal(m.score, 42);
  assert.equal(m.marks, 60);
  assert.equal(m.date, MODEL.date);
  assert.equal(m.pct, 70);
});

test('round-trips unicode titles and fractional marks', () => {
  const m = parseResult(wrap(encodeResult({ portal: 'maths', title: 'Trig & Séries — épreuve', score: 7.5, marks: 12.5, date: 1 })), 'maths');
  assert.equal(m.title, 'Trig & Séries — épreuve');
  assert.equal(m.score, 7.5);
  assert.equal(m.pct, 60);
});

test('parseResult accepts hash with leading path junk and trailing params', () => {
  const h = `#/share?p=${encodeResult(MODEL)}&x=1#extra`;
  assert.equal(parseResult(h, 'cs')?.score, 42);
});

test('wrong portal is rejected', () => {
  assert.equal(parseResult(wrap(encodeResult(MODEL)), 'physics'), null);
  assert.equal(parseResult(wrap(encodeResult(MODEL)), 'maths'), null);
});

test('tampered payload is rejected', () => {
  const good = encodeResult(MODEL);
  // flip a character mid-payload → JSON garbage
  const bad = good.slice(0, 10) + (good[10] === 'A' ? 'B' : 'A') + good.slice(11);
  assert.equal(parseResult(wrap(bad), 'cs'), null);
  // re-packed JSON with score > marks → rejected
  const forged = Buffer.from(JSON.stringify({ p: 'cs', t: 'x', s: 99, m: 10, d: 1 })).toString('base64url');
  assert.equal(parseResult(wrap(forged), 'cs'), null);
  // portal field spoofed to another portal → rejected for both
  const spoof = Buffer.from(JSON.stringify({ p: 'physics', t: 'x', s: 5, m: 10, d: 1 })).toString('base64url');
  assert.equal(parseResult(wrap(spoof), 'cs'), null);
});

test('empty/missing hash returns null', () => {
  assert.equal(parseResult('', 'cs'), null);
  assert.equal(parseResult('#/home', 'cs'), null);
  assert.equal(parseResult(null, 'cs'), null);
});

test('pct edge cases: 0 marks → 0%, full marks → 100%, rounds', () => {
  const zero = parseResult(wrap(encodeResult({ portal: 'cs', title: 'x', score: 0, marks: 0, date: 1 })), 'cs');
  assert.equal(zero.pct, 0);
  const full = parseResult(wrap(encodeResult({ portal: 'cs', title: 'x', score: 60, marks: 60, date: 1 })), 'cs');
  assert.equal(full.pct, 100);
  const third = parseResult(wrap(encodeResult({ portal: 'cs', title: 'x', score: 1, marks: 3, date: 1 })), 'cs');
  assert.equal(third.pct, 33);
});

test('encodeResult throws on bad input', () => {
  assert.throws(() => encodeResult({ portal: 'latin', title: 'x', score: 1, marks: 2 }));
  assert.throws(() => encodeResult({ portal: 'cs', title: 'x', score: 5, marks: 2 }));
  assert.throws(() => encodeResult({ portal: 'cs', title: 'x', score: -1, marks: 2 }));
});

test('resultCardHtml escapes the title', () => {
  const html = resultCardHtml({ portal: 'cs', title: '<img src=x onerror=alert(1)>', score: 1, marks: 2, pct: 50, date: 1764000000000 }, '/cs/');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Take this quiz'));
});

test('SHARE_HASH is a stable contract for links', () => {
  assert.equal(SHARE_HASH, '#/share?p=');
});
