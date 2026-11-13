import test from 'node:test';
import assert from 'node:assert/strict';
import { DAYS, EXERCISES, PROGRAM_VERSION } from '../data.js';
import { getPrescription, suggest, warmupSets, platesFor, estimate1RM, volumeForWeek } from '../engine.js';

const squat = EXERCISES['back-squat'];
const squatSlot = DAYS[0].slots[0];
const p = getPrescription(squatSlot, squat, 1);
const exposure = (counts = [10, 10, 10], extra = {}) => ({ date: '2026-11-02', week: 1, finished: true, prescription: { ...p }, sets: counts.map(reps => ({ kind: 'work', status: 'done', kg: 40, reps })), ...extra });
const advice = (record, extra = {}) => suggest({ exercise: squat, prescription: p, history: [record], ...extra });

test('programme has valid IDs, alternatives, translated cues, and no Nordic curls', () => {
  assert.ok(PROGRAM_VERSION);
  assert.equal(Object.keys(EXERCISES).length, 45);
  assert.equal(DAYS.length, 5);
  const ids = new Set();
  for (const day of DAYS) {
    assert.ok(day.slots.length <= 6);
    for (const slot of day.slots) {
      assert.ok(!ids.has(slot.id)); ids.add(slot.id);
      for (const id of [slot.exerciseId, ...slot.alternatives]) {
        assert.ok(EXERCISES[id], `Missing exercise ${id}`);
        assert.ok(EXERCISES[id].spanish && EXERCISES[id].cue);
        assert.ok(!/nordic/i.test(id));
      }
    }
  }
});

test('weekly sets, deload rounding, effort categories, and time override', () => {
  const isolation = DAYS[1].slots[4];
  const lateral = EXERCISES[isolation.exerciseId];
  assert.equal(getPrescription(isolation, lateral, 1).sets, 2);
  assert.equal(getPrescription(isolation, lateral, 3).sets, 3);
  assert.equal(getPrescription(isolation, lateral, 5).sets, 2);
  const calf = DAYS[0].slots[3];
  assert.equal(getPrescription(calf, EXERCISES[calf.exerciseId], 1).sets, 3);
  assert.equal(getPrescription(calf, EXERCISES[calf.exerciseId], 5).sets, 2);
  assert.equal(getPrescription(squatSlot, squat, 3).rir, '2–3');
  assert.equal(getPrescription(squatSlot, squat, 5).rir, 'Easy');
  const plank = getPrescription(DAYS[2].slots[1], EXERCISES['front-plank'], 1);
  assert.deepEqual([plank.unit, plank.repMin, plank.repMax], ['sec', 30, 45]);
});

test('double progression requires all sets and permits performance beyond the top', () => {
  assert.equal(advice(exposure()).kg, 42.5);
  assert.equal(advice(exposure([11, 10, 12])).action, 'increase');
  assert.equal(advice(exposure([10, 10, 9])).kg, 40);
  assert.equal(advice(exposure([10, 10, 9])).action, 'hold');
  assert.equal(advice(exposure([10, 8, 5])).action, 'hold');
  assert.equal(advice(exposure([10, 8, 0])).action, 'hold');
  assert.equal(advice(exposure([10, 10])).action, 'hold');
});

test('latest poor or partial result is not skipped in favour of an older success', () => {
  const partial = exposure([10, 10]);
  assert.equal(suggest({ exercise: squat, prescription: p, history: [partial, exposure()] }).action, 'hold');
  const draft = exposure([10, 10, 10], { finished: false });
  assert.equal(suggest({ exercise: squat, prescription: p, history: [draft] }).action, 'start');
});

test('warmups do not affect progression; skipped, mixed and missing load data block increases', () => {
  const record = exposure();
  record.sets.unshift({ kind: 'warmup', status: 'done', kg: 20, reps: 8 });
  assert.equal(advice(record).action, 'increase');
  record.sets[2].kg = 42.5;
  assert.equal(advice(record).action, 'hold');
  assert.equal(advice(record).kg, null);
  const skipped = exposure(); skipped.sets[1].status = 'skipped';
  assert.equal(advice(skipped).action, 'hold');
  const missing = exposure(); missing.sets[1].kg = null;
  assert.equal(advice(missing).action, 'hold');
});

test('effort warning uses historical range lower bound, and technique warning blocks increase', () => {
  const old = exposure([], { prescription: { ...p, rir: '3–4' } });
  old.sets = exposure().sets;
  old.effort = 3;
  assert.equal(advice(old).action, 'increase');
  old.effort = 2;
  assert.equal(advice(old).action, 'hold');
  old.effort = 3; old.techniqueIssue = true;
  assert.equal(advice(old).action, 'hold');
});

test('new set count or rep range holds rather than raising load and volume together', () => {
  assert.equal(advice(exposure(), { prescription: { ...p, sets: 4 } }).action, 'hold');
  assert.equal(advice(exposure(), { prescription: { ...p, repMin: 8, repMax: 12 } }).action, 'hold');
});

test('explicit new block holds even if the prior block ended in week one', () => {
  const record = exposure([10, 10, 10], { block: 1 });
  assert.equal(advice(record, { prescription: { ...p, block: 2 } }).action, 'hold');
});

test('assistance progression reverses direction and deload never reduces assistance', () => {
  const assisted = EXERCISES['assisted-pull-up'];
  const result = advice(exposure(), { exercise: assisted });
  assert.equal(result.kg, 37.5);
  assert.equal(result.action, 'increase');
  assert.equal(advice(exposure(), { exercise: assisted, prescription: { ...p, deload: true } }).kg, 40);
  const zero = exposure(); zero.sets.forEach(row => { row.kg = 0; });
  assert.equal(advice(zero, { exercise: assisted }).action, 'hold');
  const profiled = { ...assisted, availableLoads: [0, 10, 20, 30, 40] };
  assert.equal(advice(exposure(), { exercise: profiled }).kg, 30);
});

test('bodyweight, added-weight and time modes do not invent external-load estimates', () => {
  assert.equal(suggest({ exercise: EXERCISES['pull-up'], prescription: p }).kg, null);
  const timed = EXERCISES['side-plank'];
  const timedP = { ...p, repMin: 30, repMax: 45, unit: 'sec' };
  const timedHistory = exposure([45, 45, 45], { prescription: timedP });
  assert.equal(advice(timedHistory, { exercise: timed, prescription: timedP }).action, 'hold');
  assert.equal(advice(timedHistory, { exercise: timed, prescription: timedP }).kg, null);
  const added = { ...squat, mode: 'added' };
  assert.equal(suggest({ exercise: added, prescription: p }).kg, 0);
  const zero = exposure(); zero.sets.forEach(row => { row.kg = 0; });
  assert.equal(advice(zero, { exercise: added }).kg, 2.5);
  assert.equal(advice(exposure(), { exercise: added, prescription: { ...p, deload: true } }).kg, 0);
});

test('deload uses latest building load and achievable total, with no new-block increase', () => {
  const building = exposure(); building.sets.forEach(row => { row.kg = 60; }); building.week = 4;
  const deload = { ...exposure(), week: 5, prescription: { ...p, deload: true } };
  const deloadP = getPrescription(squatSlot, squat, 5);
  const result = suggest({ exercise: squat, prescription: deloadP, history: [deload, building] });
  assert.equal(result.kg, 52.5);
  assert.equal(result.action, 'deload');
  const resumed = suggest({ exercise: squat, prescription: p, history: [deload, building] });
  assert.equal(resumed.kg, 60);
  assert.equal(resumed.action, 'hold');
  const light = exposure(); light.sets.forEach(row => { row.kg = 20; });
  assert.equal(advice(light, { prescription: deloadP }).kg, 20);
});

test('warmup ramps are achievable, deduplicated, no heavier than work, and respect unknown bar mass', () => {
  const ramps = warmupSets(squat, 100);
  assert.ok(ramps.length >= 3);
  assert.equal(ramps[0].kg, 20);
  assert.equal(new Set(ramps.map(row => row.kg)).size, ramps.length);
  assert.ok(ramps.every(row => row.kg <= 100 && platesFor(row.kg).remainder === 0));
  assert.deepEqual(warmupSets(EXERCISES['trap-bar-deadlift'], 80), []);
  assert.deepEqual(warmupSets(EXERCISES['front-plank'], 40), []);
  assert.deepEqual(warmupSets(squat, 15), []);
});

test('plate math reports actual total, mismatch, actual bar mass and coloured-plate values', () => {
  assert.deepEqual(platesFor(70), { plates: [25], achieved: 70, remainder: 0 });
  assert.deepEqual(platesFor(67.5), { plates: [20, 2.5, 1.25], achieved: 67.5, remainder: 0 });
  assert.deepEqual(platesFor(54), { plates: [15, 1.25], achieved: 52.5, remainder: 1.5 });
  assert.equal(platesFor(60, 25).achieved, 60);
  assert.deepEqual(platesFor(15), { plates: [], achieved: 20, remainder: -5 });
});

test('Epley estimate rejects zero, missing, timed-looking high counts and invalid reps', () => {
  assert.equal(estimate1RM(60, 6), 72);
  assert.equal(estimate1RM(60, 10), 80);
  for (const [kg, reps] of [[0, 8], [null, 8], [60, 0], [60, 13], [60, 1.5], [60, null]]) assert.equal(estimate1RM(kg, reps), null);
});

test('volume is derived from actual weekly prescriptions and includes optional core clearly', () => {
  const first = volumeForWeek(1), third = volumeForWeek(3), deload = volumeForWeek(5);
  assert.equal(first.find(row => row.muscle === 'Core').sets, 6);
  assert.equal(first.find(row => row.muscle === 'Calves').sets, 6);
  assert.equal(third.find(row => row.muscle === 'Calves').sets, 6);
  assert.equal(deload.find(row => row.muscle === 'Calves').sets, 4);
  assert.ok(third.reduce((sum, row) => sum + row.sets, 0) > first.reduce((sum, row) => sum + row.sets, 0));
});
