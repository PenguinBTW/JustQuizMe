import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/cs/js/state.js';
import { initRunnerKeys } from '../public/cs/js/runnerKeysWiring.js';

// Minimal fake DOM — just enough surface for the wiring's selectors.
function el(tag = 'div', id = null) {
  const e = {
    tagName: tag.toUpperCase(), id, children: [], parentNode: null,
    disabled: false, isContentEditable: false, clicks: 0,
    className: '', type: '', textContent: '', title: '', innerHTML: '',
    click() { this.clicks++; if (this.onclick) this.onclick({}); },
    appendChild(c) { c.parentNode = e; e.children.push(c); if (c.id) e._doc.byId.set(c.id, c); return c; },
    remove() {
      const i = e.parentNode ? e.parentNode.children.indexOf(e) : -1;
      if (i >= 0) e.parentNode.children.splice(i, 1);
      if (e.id) e._doc.byId.delete(e.id);
      e.parentNode = null;
    },
  };
  return e;
}

function fakeDoc() {
  const byId = new Map();
  const stage = el('main', 'stage');
  byId.set('stage', stage);
  const optBtns = [];
  const chrome = el('div'); chrome._cls = 'q-chrome';
  const modal = el('div'); modal.open = false;
  const body = el('body');
  const listeners = {};
  const doc = {
    byId, optBtns, chrome, modal, body,
    activeElement: null,
    getElementById: (id) => byId.get(id) ?? null,
    querySelector(sel) {
      if (sel.startsWith('#')) return byId.get(sel.slice(1)) ?? null;
      if (sel === '.q-chrome') return chrome;
      if (sel === '.modal-backdrop.open') return modal.open ? modal : null;
      const m = sel.match(/^\[data-opt-idx="(\d+)"\]$/);
      if (m) return optBtns[+m[1]] ?? null;
      if (sel === '[data-opt-idx]:not([disabled])') return optBtns.find(b => !b.disabled) ?? null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-opt-idx]') return optBtns;
      return [];
    },
    createElement: (tag) => { const e = el(tag); e._doc = doc; return e; },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    keydown(key, extra = {}) {
      const e = { key, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
      listeners.keydown(e);
      return e;
    },
  };
  body._doc = doc; chrome._doc = doc;
  return doc;
}

function fakeMO() {
  const insts = [];
  return {
    insts,
    MutationObserver: class {
      constructor(cb) { this.cb = cb; insts.push(this); }
      observe() {}
      fire() { this.cb([]); }
    },
  };
}

function put(id, tag = 'button') { const e = el(tag, id); e._doc = DOC; DOC.byId.set(id, e); return e; }
let DOC, MO;

function setup() {
  DOC = fakeDoc(); MO = fakeMO();
  S.room = 'runner';
  initRunnerKeys({ doc: DOC, MutationObserver: MO.MutationObserver });
  return DOC;
}

test('chip mounts on runner chrome and popover toggles on ?', () => {
  const doc = setup();
  const next = put('nextQ');
  MO.insts[0].fire();
  assert.ok(doc.byId.get('runnerKeysChip'), 'chip should mount');
  doc.keydown('?');
  assert.ok(doc.byId.get('runnerKeysPop'), 'popover should open');
  doc.keydown('Escape');
  assert.equal(doc.byId.get('runnerKeysPop') ?? null, null, 'Escape closes popover');
  assert.equal(next.clicks, 0);
});

test('chip remounts after the runner re-renders its chrome', () => {
  const doc = setup();
  put('nextQ');
  MO.insts[0].fire();
  const chip = doc.byId.get('runnerKeysChip');
  chip.remove();
  MO.insts[0].fire(); // simulate renderQ wiping + re-adding chrome
  assert.ok(doc.byId.get('runnerKeysChip'), 'chip should remount after re-render');
});

test('Enter on a focused answer button clicks it — never advances', () => {
  const doc = setup();
  const next = put('nextQ');
  const opt = el('button'); opt._doc = doc; doc.optBtns.push(opt);
  doc.activeElement = opt;
  const e = doc.keydown('Enter');
  assert.equal(opt.clicks, 0, 'native activation owns the focused button');
  assert.equal(next.clicks, 0, 'Enter must not advance');
  assert.equal(e.prevented, false, 'the key must be left for native activation');
});

test('key repeat cannot chain-advance or auto-submit', () => {
  const doc = setup();
  const next = put('nextQ');
  doc.keydown('Enter', { repeat: true });
  doc.keydown('Enter', { repeat: true });
  assert.equal(next.clicks, 0);
  doc.keydown('Enter');
  assert.equal(next.clicks, 1);
});

test('results screen: keys inactive once footer buttons are gone', () => {
  const doc = setup();
  const next = put('nextQ');
  doc.keydown('ArrowRight');
  assert.equal(next.clicks, 1);
  // finish: results screen keeps S.room === 'runner' but drops the footer
  next.remove();
  doc.keydown('Enter');
  doc.keydown('?');
  assert.equal(next.clicks, 1, 'no primary action on results');
  assert.equal(doc.byId.get('runnerKeysPop') ?? null, null, 'no hint popover on results');
});

test('arrow nav + digit selection hit the real buttons', () => {
  const doc = setup();
  const prev = put('prevQ'); const next = put('nextQ');
  doc.optBtns.push(el('button'), el('button'));
  doc.optBtns.forEach(b => { b._doc = doc; });
  doc.keydown('ArrowLeft'); doc.keydown('j');
  assert.equal(prev.clicks, 1); assert.equal(next.clicks, 1);
  doc.keydown('2');
  assert.equal(doc.optBtns[1].clicks, 1);
  // locked options: all disabled → digits inert
  doc.optBtns.forEach(b => { b.disabled = true; });
  doc.keydown('1');
  assert.equal(doc.optBtns[0].clicks, 0);
});
