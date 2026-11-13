import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DAYS, EXERCISES } from '../data.js';
import { getPrescription, suggest } from '../engine.js';

// Evaluate the actual bounded UI functions with fixture state, without a browser.
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functionSource = name => {
  const match = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} is present`); return match[0];
};
const constSource = name => {
  const match = app.match(new RegExp(`const ${name} = [^\\n]+`));
  assert.ok(match, `${name} is present`); return match[0];
};
function uiFunctions(state) {
  const ctx = vm.createContext({ state, DAYS, EXERCISES, getPrescription, suggest, id: () => 'set-fixture', dayFor: id => DAYS.find(day => day.id === id) });
  vm.runInContext([
    constSource('plannedCount'), constSource('configuredExercise'), constSource('equipmentIdFor'),
    functionSource('historyFor'), functionSource('nextPending'), functionSource('makeRecord'),
    'globalThis.countPlanned = plannedCount;',
  ].join('\n'), ctx);
  return ctx;
}
const slot = DAYS[1].slots[1], exercise = EXERCISES[slot.exerciseId];
const p = getPrescription(slot, exercise, 1);
function session(id, started, slotId, counts, load, prescribed = p) {
  return { id, started, status: 'finished', block: 1, week: 1, date: `2026-11-${String(started).padStart(2, '0')}`, exercises: [{ slotId, exerciseId: exercise.id, equipmentId: exercise.id, prescription: prescribed, sets: counts.map(reps => ({ status: 'done', kg: load, reps })) }] };
}

test('same exercise in two routine slots progresses from the matching slot', () => {
  const state = { settings: { block: 1 }, sessions: [session('upper-a', 1, 'ua-2', [10, 10, 10], 40), session('upper-b', 2, 'ub-4', [12, 12], 60, { ...p, sets: 2, repMin: 10, repMax: 12 })] };
  const ctx = uiFunctions(state);
  const history = ctx.historyFor(exercise.id, exercise.id, 'ua-2');
  assert.equal(history.length, 1);
  assert.equal(suggest({ exercise, prescription: p, history }).kg, 42.5);
  state.sessions.push(session('upper-a-poor', 3, 'ua-2', [10, 8, 5], 40));
  assert.equal(suggest({ exercise, prescription: p, history: ctx.historyFor(exercise.id, exercise.id, 'ua-2') }).action, 'hold');
});

test('editing a past session never displays future work as its previous exposure', () => {
  const ctx = uiFunctions({ settings: {}, sessions: [session('first', 1, 'ua-2', [10, 10, 10], 40), session('future', 3, 'ua-2', [10, 10, 10], 60)] });
  const history = ctx.historyFor(exercise.id, exercise.id, 'ua-2', 2);
  assert.equal(history.length, 1);
  assert.equal(history[0].sets[0].kg, 40);
});

test('an equipment profile starts a separate comparison and prefills the actual bar minimum', () => {
  const benchSlot = DAYS[1].slots[0], bench = EXERCISES[benchSlot.exerciseId];
  const ctx = uiFunctions({ settings: { block: 1, equipment: { [bench.id]: { version: 'bar-25', barWeight: 25, increment: 5 } } }, sessions: [] });
  const record = ctx.makeRecord(benchSlot, bench, 1);
  assert.equal(record.snapshot.barWeight, 25);
  assert.equal(record.snapshot.increment, 5);
  assert.equal(record.equipmentId, `${bench.id}:bar-25`);
  assert.equal(record.sets[0].kg, 25);
  assert.equal(record.prescription.block, 1);
});

test('replaced sets do not inflate session planned totals', () => {
  const ctx = uiFunctions({ settings: {}, sessions: [] });
  const swapped = { exercises: [{ sets: [{ status: 'done' }, { status: 'skipped', skipReason: 'swap' }, { status: 'skipped', skipReason: 'swap' }] }, { sets: [{ status: 'done' }, { status: 'done' }] }] };
  assert.equal(ctx.countPlanned(swapped), 3);
  assert.equal(ctx.countPlanned({ exercises: [{ sets: [{ status: 'done' }, { status: 'skipped' }, { status: 'pending' }] }] }), 3);
});

test('superset next action remains paired after an in-session partial swap', () => {
  const ctx = uiFunctions({ settings: {}, sessions: [] });
  const swapped = { day: 'upper-a', exercises: [
    { slotId: 'ua-5', sets: [{ status: 'done' }, { status: 'skipped', skipReason: 'swap' }, { status: 'skipped', skipReason: 'swap' }] },
    { slotId: 'ua-5', sets: [{ status: 'done' }, { status: 'pending' }] },
    { slotId: 'ua-6', sets: [{ status: 'done' }, { status: 'pending' }, { status: 'pending' }] },
  ] };
  assert.deepEqual(Array.from(ctx.nextPending(swapped, 1, 0)), [2, 1]);
  swapped.exercises[2].sets[1].status = 'done';
  assert.deepEqual(Array.from(ctx.nextPending(swapped, 2, 1)), [1, 1]);
});
