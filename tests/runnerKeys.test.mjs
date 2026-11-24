import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BINDINGS, decide } from '../public/cs/js/runnerKeys.js';

const inRun = { runner: true, canPrev: true, canNext: true, optionCount: 4, optionsEnabled: true };

test('binding table covers the documented keys', () => {
  const flat = BINDINGS.flatMap(b => b.keys);
  for (const k of ['ArrowLeft', 'ArrowRight', 'j', 'k', 'Enter', '?', '1', '9']) {
    assert.ok(flat.includes(k), `missing binding for ${k}`);
  }
  assert.ok(BINDINGS.every(b => b.action && b.label), 'every binding needs an action + label');
});

test('ignored outside a run and in inputs/modals/mod-keys', () => {
  assert.equal(decide('ArrowRight', { ...inRun, runner: false }).action, 'none');
  assert.equal(decide('ArrowRight', { ...inRun, inputFocused: true }).action, 'none');
  assert.equal(decide('ArrowRight', { ...inRun, modKey: true }).action, 'none');
  assert.equal(decide('ArrowRight', { ...inRun, modalOpen: true }).action, 'none');
  assert.equal(decide('1', { ...inRun, inputFocused: true }).action, 'none');
});

test('arrow / j / k navigation honours question edges', () => {
  assert.equal(decide('ArrowLeft', inRun).action, 'prev');
  assert.equal(decide('k', inRun).action, 'prev');
  assert.equal(decide('ArrowLeft', { ...inRun, canPrev: false }).action, 'none');
  assert.equal(decide('k', { ...inRun, canPrev: false }).action, 'none');
  assert.equal(decide('ArrowRight', inRun).action, 'next');
  assert.equal(decide('j', inRun).action, 'next');
  assert.equal(decide('ArrowRight', { ...inRun, canNext: false }).action, 'none');
});

test('Enter always maps to the primary action', () => {
  assert.equal(decide('Enter', inRun).action, 'primary');
  assert.equal(decide('Enter', { ...inRun, canNext: false }).action, 'primary');
});

test('digits pick MCQ options only when unlocked and in range', () => {
  assert.deepEqual(decide('2', inRun), { action: 'select', index: 1 });
  assert.deepEqual(decide('4', inRun), { action: 'select', index: 3 });
  assert.equal(decide('5', inRun).action, 'none');          // only 4 options
  assert.equal(decide('1', { ...inRun, optionsEnabled: false }).action, 'none');
  assert.equal(decide('0', inRun).action, 'none');
  assert.equal(decide('x', inRun).action, 'none');
});

test('? toggles the hint; Escape only dismisses an open popover', () => {
  assert.equal(decide('?', inRun).action, 'hint');
  assert.equal(decide('Escape', { ...inRun, popoverOpen: true }).action, 'dismiss');
  assert.equal(decide('Escape', inRun).action, 'none');
});
