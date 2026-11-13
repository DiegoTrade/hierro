export const STORAGE_KEY = 'hierro-strength-v1';
export const APP_VERSION = '1.0.0';

const SCHEMA_VERSION = 1;
const FORTNIGHT = 14 * 24 * 60 * 60 * 1000;

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    settings: {
      theme: 'light', sound: true, awake: false, block: 1, week: 1,
      swaps: {}, cardioGoal: 150, cardioStretch: 180,
      lastExport: null, firstDataAt: null,
    },
    sessions: [],
    activities: [],
    rest: null,
  };
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = value => number(value) && value >= 0;
const integer = value => Number.isInteger(value) && value >= 0;
const text = value => typeof value === 'string';
const identifier = value => text(value) && value.trim().length > 0;
const nullableNumber = value => value === null || nonnegative(value);

function localDate(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function time(value) {
  if (number(value)) return value >= 0 ? value : NaN;
  return text(value) ? Date.parse(value) : NaN;
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function optionalBoolean(record, key, label) {
  if (record[key] !== undefined) requireValue(typeof record[key] === 'boolean', `${label} must be true or false.`);
}

function checkUnique(seen, id, label) {
  requireValue(identifier(id), `${label} is missing an ID.`);
  requireValue(!seen.has(id), `${label} has a duplicate ID (${id}).`);
  seen.add(id);
}

function checkState(value) {
  requireValue(object(value), 'This file does not contain a Hierro backup.');
  requireValue(value.schemaVersion === SCHEMA_VERSION,
    value.schemaVersion > SCHEMA_VERSION
      ? 'This backup uses a newer data format. Update Hierro before restoring it.'
      : 'This data format is not supported. Keep the original file; it has not been changed.');
  requireValue(object(value.settings), 'Backup settings are missing or invalid.');
  requireValue(Array.isArray(value.sessions), 'The session list is missing or invalid.');
  requireValue(value.activities === undefined || Array.isArray(value.activities), 'The cardio activity list is invalid.');

  const settings = value.settings;
  requireValue(integer(settings.block) && settings.block >= 1, 'The programme block must be a positive whole number.');
  requireValue(integer(settings.week) && settings.week >= 1 && settings.week <= 5, 'The programme week must be between 1 and 5.');
  if (settings.theme !== undefined) requireValue(['light', 'dark', 'auto'].includes(settings.theme), 'The theme setting is invalid.');
  optionalBoolean(settings, 'sound', 'Timer sound');
  optionalBoolean(settings, 'awake', 'Screen awake');
  if (settings.swaps !== undefined) {
    requireValue(object(settings.swaps), 'Saved exercise swaps are invalid.');
    for (const choice of Object.values(settings.swaps)) requireValue(identifier(choice), 'A saved exercise swap is invalid.');
  }
  for (const key of ['cardioGoal', 'cardioStretch']) {
    if (settings[key] !== undefined) requireValue(nonnegative(settings[key]), 'Cardio goals must be nonnegative numbers.');
  }
  for (const key of ['lastExport', 'firstDataAt']) {
    if (settings[key] !== undefined && settings[key] !== null) requireValue(Number.isFinite(time(settings[key])), 'An export or first-use date is invalid.');
  }

  const sessionIds = new Set();
  const dateTemplates = new Set();
  for (const session of value.sessions) {
    requireValue(object(session), 'A session record is invalid.');
    checkUnique(sessionIds, session.id, 'A session');
    const label = `Session ${session.date || session.id}`;
    requireValue(identifier(session.day) && localDate(session.date), `${label} has an invalid routine or local date.`);
    const identity = `${session.date}:${session.day}`;
    requireValue(!dateTemplates.has(identity), `${label} duplicates a routine on the same date.`);
    dateTemplates.add(identity);
    requireValue(integer(session.block) && session.block >= 1 && integer(session.week) && session.week >= 1 && session.week <= 5,
      `${label} has an invalid programme block or week.`);
    requireValue(nonnegative(session.started) && (session.finished === null || nonnegative(session.finished)), `${label} has invalid timestamps.`);
    requireValue(session.finished === null || session.finished >= session.started, `${label} finishes before it starts.`);
    requireValue(['active', 'finished'].includes(session.status), `${label} has an invalid status.`);
    requireValue(typeof session.complete === 'boolean' && text(session.note), `${label} has invalid completion or note data.`);
    requireValue(Array.isArray(session.exercises), `${label} has no valid exercise list.`);
    const setIds = new Set();
    for (const exercise of session.exercises) {
      requireValue(object(exercise) && identifier(exercise.slotId) && identifier(exercise.exerciseId) && identifier(exercise.equipmentId),
        `${label} contains an exercise with missing IDs.`);
      const prescription = exercise.prescription;
      requireValue(object(prescription), `${label} contains an invalid exercise prescription.`);
      requireValue(integer(prescription.sets) && prescription.sets >= 1 && nonnegative(prescription.repMin)
        && nonnegative(prescription.repMax) && prescription.repMax >= prescription.repMin,
      `${label} contains an invalid set count or target range.`);
      requireValue(identifier(prescription.unit) && nonnegative(prescription.rest), `${label} contains invalid units or rest time.`);
      requireValue(prescription.rir === null || prescription.rir === undefined || nonnegative(prescription.rir) || text(prescription.rir),
        `${label} contains an invalid effort target.`);
      optionalBoolean(prescription, 'deload', 'Deload');
      optionalBoolean(exercise, 'techniqueIssue', 'Technique issue');
      if (exercise.effort !== undefined && exercise.effort !== null) requireValue(nonnegative(exercise.effort), `${label} contains invalid recorded effort.`);
      requireValue(Array.isArray(exercise.sets), `${label} contains an invalid set list.`);
      for (const set of exercise.sets) {
        requireValue(object(set), `${label} contains an invalid set.`);
        checkUnique(setIds, set.id, `${label}: a set`);
        requireValue(['pending', 'done', 'skipped'].includes(set.status), `${label} contains an invalid set status.`);
        requireValue(nullableNumber(set.kg) && nullableNumber(set.reps), `${label} contains an invalid load, rep, time or distance value.`);
        requireValue(set.status !== 'done' || set.reps !== null, `${label} contains a completed set without recorded reps, time or distance.`);
        if (set.completedAt !== undefined && set.completedAt !== null) requireValue(nonnegative(set.completedAt), `${label} contains an invalid completion time.`);
      }
    }
    if (session.cardio !== null && session.cardio !== undefined) {
      const cardio = session.cardio;
      requireValue(object(cardio) && nonnegative(cardio.minutes) && nullableNumber(cardio.heartRate)
        && typeof cardio.done === 'boolean' && text(cardio.name), `${label} contains invalid cardio data.`);
    }
  }

  const activityIds = new Set();
  for (const activity of value.activities || []) {
    requireValue(object(activity), 'A cardio activity is invalid.');
    checkUnique(activityIds, activity.id, 'A cardio activity');
    requireValue(localDate(activity.date) && ['walk', 'cardio'].includes(activity.type) && text(activity.name)
      && nonnegative(activity.minutes), 'A cardio activity has an invalid date, type, name or duration.');
    if (activity.heartRate !== undefined) requireValue(nullableNumber(activity.heartRate), 'A cardio activity has an invalid heart rate.');
  }

  if (value.rest !== null && value.rest !== undefined) {
    const rest = value.rest;
    requireValue(object(rest) && sessionIds.has(rest.sessionId), 'The rest timer refers to a missing session.');
    const session = value.sessions.find(item => item.id === rest.sessionId);
    requireValue(integer(rest.exerciseIndex) && integer(rest.setIndex)
      && session.exercises[rest.exerciseIndex]?.sets[rest.setIndex], 'The rest timer refers to a missing set.');
    requireValue(nonnegative(rest.endsAt) && nonnegative(rest.startedAt) && nonnegative(rest.duration), 'The rest timer has invalid timestamps.');
  }

  // A JSON clone strips live references without dropping unknown recorded metadata.
  const state = JSON.parse(JSON.stringify(value));
  const defaults = defaultState();
  return {
    ...defaults, ...state,
    settings: { ...defaults.settings, ...state.settings },
    activities: state.activities || [],
    rest: state.rest ?? null,
  };
}

export function readState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { state: defaultState() };
    return { state: checkState(JSON.parse(raw)) };
  } catch (error) {
    return {
      state: defaultState(),
      error: `Saved data could not be opened. ${error.message || 'Storage is unavailable.'} The original has not been changed.`,
      ...(raw !== undefined && raw !== null ? { raw } : {}),
    };
  }
}

export function saveState(state) {
  try {
    const checked = checkState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Couldn’t save on this device. ${error.message || 'Storage is unavailable.'} Export your data before closing Hierro.` };
  }
}

export function validateBackup(rawStringOrObject) {
  try {
    const source = text(rawStringOrObject) ? JSON.parse(rawStringOrObject) : rawStringOrObject;
    const state = checkState(source);
    // A timer from a backup must not restart a stale countdown after restoration.
    state.rest = null;
    const dates = [...state.sessions.map(session => session.date), ...state.activities.map(activity => activity.date)].sort();
    return {
      ok: true, state,
      summary: {
        exportedAt: source.exportedAt ?? null,
        sessions: state.sessions.length,
        activities: state.activities.length,
        firstDate: dates[0] || null,
        lastDate: dates.at(-1) || null,
        hasDraft: state.sessions.some(session => session.status === 'active'),
      },
    };
  } catch (error) {
    return { ok: false, error: `This backup cannot be restored. ${error.message || 'Invalid backup data.'} Your current data has not been changed.` };
  }
}

function download(content, type, filename) {
  let url;
  let link;
  try {
    url = URL.createObjectURL(new Blob([content], { type }));
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    // Safari needs the URL to remain live until it has handled the download.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    if (url) URL.revokeObjectURL(url);
    return false;
  } finally {
    link?.remove();
  }
}

export function exportJSON(state) {
  try {
    const exportedAt = new Date().toISOString();
    const payload = { ...state, appVersion: APP_VERSION, exportedAt };
    const ok = download(`${JSON.stringify(payload, null, 2)}\n`, 'application/json', `hierro-backup-${exportedAt.slice(0, 10)}.json`);
    return ok ? exportedAt : false;
  } catch {
    return false;
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let cell = String(value);
  // Imported/user-entered names must remain text when opened in a spreadsheet.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function exportCSV(state) {
  const columns = ['session_id', 'date', 'day', 'block', 'week', 'programme_version', 'session_status',
    'session_complete', 'slot_id', 'exercise_id', 'exercise_name', 'equipment_id', 'load_convention',
    'set_id', 'set_number', 'set_kind', 'set_status', 'kg', 'reps', 'seconds', 'metres', 'effort', 'technique_issue'];
  const rows = [columns];
  for (const session of state.sessions || []) {
    for (const exercise of session.exercises || []) {
      const unit = (exercise.prescription?.unit || 'reps').toLowerCase();
      const timed = ['s', 'sec', 'seconds', 'second', 'time', 'timed'].includes(unit);
      const distance = ['m', 'metres', 'meters', 'metre', 'meter', 'distance'].includes(unit);
      for (const [index, set] of (exercise.sets || []).entries()) {
        rows.push([
          session.id, session.date, session.day, session.block, session.week, session.programmeVersion,
          session.status, session.complete, exercise.slotId, exercise.exerciseId,
          exercise.nameEn || exercise.name || exercise.exerciseName || exercise.exerciseId,
          exercise.equipmentId, exercise.loadConvention || exercise.prescription?.loadConvention || '',
          set.id, index + 1, set.kind || 'work', set.status, set.kg,
          !timed && !distance ? set.reps : '', timed ? set.reps : '', distance ? set.reps : '',
          exercise.effort ?? '', exercise.techniqueIssue ?? false,
        ]);
      }
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return download(`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
    'text/csv;charset=utf-8', `hierro-sets-${stamp}.csv`);
}

export function backupDue(state) {
  const settings = state?.settings || {};
  let since = time(settings.lastExport ?? settings.firstDataAt);
  if (!Number.isFinite(since)) {
    const dates = [
      ...(state?.sessions || []).map(session => session.started),
      ...(state?.activities || []).map(activity => Date.parse(`${activity.date}T12:00:00`)),
    ].filter(Number.isFinite);
    since = dates.length ? Math.min(...dates) : NaN;
  }
  return Number.isFinite(since) && Date.now() - since >= FORTNIGHT;
}
