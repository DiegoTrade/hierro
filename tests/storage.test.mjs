import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, readState, saveState, validateBackup, exportJSON, exportCSV, backupDue, STORAGE_KEY,
} from '../storage.js';

let stored;
beforeEach(() => {
  stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  };
});

function fixture() {
  const state = defaultState();
  state.settings.swaps['ua-2'] = 'assisted-pull-up';
  state.settings.equipment = { bench: { barWeight: 20, increment: 2.5, version: 'bar-1' } };
  state.sessions.push({
    id: 'session-1', day: 'upper-a', date: '2026-11-13', block: 1, week: 1, programmeVersion: 'starter-1',
    started: 1000, finished: null, status: 'active', complete: false, note: 'Máquina 4; felt smooth.',
    exercises: [{
      slotId: 'ua-1', exerciseId: 'bench', equipmentId: 'bench:bar-1',
      snapshot: { name: 'Bench press', spanish: 'Press de banca', barWeight: 20 },
      prescription: { sets: 3, repMin: 6, repMax: 10, unit: 'reps', rir: '3–4', rest: 120, deload: false },
      sets: [
        { id: 'set-1', kg: 40, reps: 10, status: 'done', completedAt: 2000 },
        { id: 'set-2', kg: 40, reps: null, status: 'pending' },
        { id: 'set-3', kg: 40, reps: null, status: 'pending' },
      ],
    }],
    cardio: { name: 'Incline walk', minutes: 20, heartRate: null, done: false },
  });
  state.activities.push({ id: 'walk-1', date: '2026-11-13', type: 'walk', name: 'Brisk walk', minutes: 30, heartRate: 120 });
  state.rest = { sessionId: 'session-1', exerciseIndex: 0, setIndex: 0, endsAt: 122000, startedAt: 2000, duration: 120 };
  return state;
}

test('empty state and separate defaults are safe to save and reload', () => {
  const first = defaultState();
  first.settings.swaps.test = 'bench';
  assert.deepEqual(defaultState().settings.swaps, {});
  assert.equal(readState().state.sessions.length, 0);
  assert.equal(saveState(defaultState()).ok, true);
  assert.deepEqual(readState().state, defaultState());
});

test('round trip retains draft, live rest, equipment and historical snapshots', () => {
  const state = fixture();
  assert.equal(saveState(state).ok, true);
  assert.deepEqual(readState().state, state);
  const backup = validateBackup(stored.get(STORAGE_KEY));
  assert.equal(backup.ok, true);
  assert.equal(backup.state.rest, null);
  assert.equal(state.rest.endsAt, 122000, 'validating a restore does not mutate live state');
  assert.equal(backup.state.sessions[0].exercises[0].snapshot.spanish, 'Press de banca');
  assert.deepEqual(backup.summary, {
    exportedAt: null, sessions: 1, activities: 1, firstDate: '2026-11-13', lastDate: '2026-11-13', hasDraft: true,
  });
});

test('invalid restores leave the entire existing stored document unchanged', () => {
  const state = fixture();
  saveState(state);
  const original = stored.get(STORAGE_KEY);
  const duplicate = structuredClone(state);
  duplicate.sessions.push(structuredClone(duplicate.sessions[0]));
  const badDate = structuredClone(state);
  badDate.sessions[0].date = '2026-02-30';
  const brokenReference = structuredClone(state);
  brokenReference.rest.setIndex = 99;
  const badSet = structuredClone(state);
  badSet.sessions[0].exercises[0].sets[0].reps = null;
  for (const invalid of ['{broken', { ...state, schemaVersion: 2 }, duplicate, badDate, brokenReference, badSet]) {
    assert.equal(validateBackup(invalid).ok, false);
    assert.equal(stored.get(STORAGE_KEY), original);
  }
});

test('corrupt reads preserve recoverable raw data instead of silently resetting storage', () => {
  stored.set(STORAGE_KEY, '{broken');
  const result = readState();
  assert.ok(result.error);
  assert.equal(result.raw, '{broken');
  assert.equal(result.state.sessions.length, 0);
  assert.equal(stored.get(STORAGE_KEY), '{broken');
});

test('quota failures report unsaved work and leave the previous snapshot intact', () => {
  saveState(defaultState());
  const original = stored.get(STORAGE_KEY);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const result = saveState(fixture());
  assert.equal(result.ok, false);
  assert.match(result.error, /Couldn’t save/);
  assert.equal(stored.get(STORAGE_KEY), original);
});

test('JSON export can restore a cleared logbook, and CSV preserves text and timed units', async t => {
  let blob, filename;
  t.mock.method(URL, 'createObjectURL', value => { blob = value; return 'blob:fixture'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(globalThis, 'setTimeout', () => 0);
  globalThis.document = {
    body: { appendChild() {} },
    createElement() { return { remove() {}, click() { filename = this.download; } }; },
  };
  t.after(() => { delete globalThis.document; });
  const state = fixture();
  const exportedAt = exportJSON(state);
  assert.equal(typeof exportedAt, 'string');
  assert.match(filename, /^hierro-backup-.*\.json$/);
  const serialized = await blob.text();
  assert.equal(JSON.parse(serialized).exportedAt, exportedAt);
  stored.clear();
  const restored = validateBackup(serialized);
  assert.equal(saveState(restored.state).ok, true);
  assert.equal(readState().state.sessions[0].id, 'session-1');
  assert.equal(readState().state.activities[0].minutes, 30);

  state.sessions[0].exercises[0].name = '=formula, "text"';
  state.sessions[0].exercises[0].prescription.unit = 'sec';
  assert.equal(exportCSV(state), true);
  assert.match(filename, /^hierro-sets-.*\.csv$/);
  const csv = await blob.text();
  assert.ok(csv.includes("'=formula, \"\"text\"\""));
  assert.ok(csv.includes('"seconds"'));
});

test('backup reminder starts with meaningful data and JSON export resets it', t => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const state = defaultState();
  assert.equal(backupDue(state), false);
  state.settings.firstDataAt = now - 14 * 86400000;
  assert.equal(backupDue(state), true);
  state.settings.lastExport = new Date(now).toISOString();
  assert.equal(backupDue(state), false);
});
