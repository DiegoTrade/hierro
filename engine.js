import { DAYS, EXERCISES } from './data.js';

const EFFORT = {
  main: ['4', '3', '2–3', '2'],
  accessory: ['3–4', '3', '2', '1–2'],
  isolation: ['3', '2–3', '2', '1'],
};
const number = value => value !== null && value !== '' && Number.isFinite(Number(value));
const clean = value => Math.round(value * 1000) / 1000;
const workRows = exposure => (exposure.sets || []).filter(row => row.kind !== 'warmup' && row.kind !== 'warm-up');
const doneRows = exposure => workRows(exposure).filter(row => row.status === 'done');
const isDeload = exposure => Number(exposure.week) === 5 || exposure.prescription?.deload === true;
const finiteLoads = exercise => (exercise.availableLoads || []).filter(number).map(Number).sort((a, b) => a - b);

export function getPrescription(slot, exercise, week = 1) {
  const selectedWeek = Math.max(1, Math.min(5, Number(week) || 1));
  const category = slot.category || exercise.category || 'accessory';
  const buildingSets = category === 'isolation' && !slot.fixedSets && slot.muscle !== 'Calves'
    ? (selectedWeek <= 2 ? 2 : 3) : slot.sets;
  return {
    week: selectedWeek,
    sets: selectedWeek === 5 ? Math.max(1, Math.ceil(buildingSets / 2)) : buildingSets,
    repMin: exercise.repMin ?? slot.repMin,
    repMax: exercise.repMax ?? slot.repMax,
    unit: exercise.mode === 'time' ? 'sec' : exercise.mode === 'distance' ? 'm' : 'reps',
    rir: selectedWeek === 5 ? 'Easy' : (EFFORT[category] || EFFORT.accessory)[selectedWeek - 1],
    rest: slot.rest,
    deload: selectedWeek === 5,
  };
}

function roundedDown(exercise, value) {
  const minimum = typeof exercise.barWeight === 'number' ? exercise.barWeight : 0;
  const loads = finiteLoads(exercise).filter(load => load >= minimum && load <= value + 0.0001);
  if (loads.length) return loads.at(-1);
  if (finiteLoads(exercise).length) return Math.max(minimum, finiteLoads(exercise)[0]);
  const step = Number(exercise.increment) > 0 ? Number(exercise.increment) : 2.5;
  return clean(Math.max(minimum, minimum + Math.floor((value - minimum + 0.00001) / step) * step));
}

function nextLoad(exercise, current, direction = 1) {
  const loads = finiteLoads(exercise);
  if (loads.length) {
    return direction > 0 ? (loads.find(load => load > current + 0.0001) ?? current)
      : ([...loads].reverse().find(load => load < current - 0.0001) ?? current);
  }
  return clean(Math.max(0, current + direction * (Number(exercise.increment) || 2.5)));
}

export function suggest({ exercise, prescription, history = [] }) {
  const previous = history.find(exposure => exposure.finished && !isDeload(exposure));
  const mode = exercise.mode;
  const noLoad = ['bodyweight', 'time', 'distance'].includes(mode);
  const unit = mode === 'time' ? 'seconds' : mode === 'distance' ? 'metres' : 'reps';
  const start = {
    kg: mode === 'added' ? 0 : null,
    action: 'start', title: 'Start light. Find your first working set.',
    detail: `Do the bottom of today’s range with smooth technique and roughly ${prescription.rir === 'Easy' ? 'plenty of' : prescription.rir} clean reps left. If unsure, choose lighter.`,
  };
  if (!previous) {
    if (prescription.deload) return { ...start, action: 'deload', title: 'An easy first exposure.', detail: 'Use an easy load or variation and today’s reduced set count. There is no prior building load to calculate from.' };
    if (noLoad) return { ...start, title: 'Start with smooth, controlled work.', detail: `Begin at ${prescription.repMin} ${unit}${exercise.perSide ? ' per side' : ''}. Stop before your position or technique changes.` };
    if (mode === 'added') return { ...start, title: 'Start with bodyweight first.', detail: 'Record only added kilograms. Add weight after comfortable, clean bodyweight sets.' };
    if (mode === 'assistance') return { ...start, title: 'Choose enough assistance for clean reps.', detail: 'More assistance makes this easier. Start at the bottom of the range with the planned reps in reserve.' };
    return start;
  }

  const rows = workRows(previous);
  const done = doneRows(previous);
  const loadValues = done.filter(row => number(row.kg)).map(row => Number(row.kg));
  const uniqueLoads = [...new Set(loadValues)];
  const uniformLoad = uniqueLoads.length === 1 && loadValues.length === done.length;
  const kg = noLoad ? null : (uniformLoad ? uniqueLoads[0] : null);
  const source = { date: previous.date, week: previous.week };
  const hold = detail => ({ kg, action: 'hold', title: noLoad ? 'Keep the movement controlled.' : 'Keep the previous working load.', detail, source });

  if (prescription.deload) {
    if (noLoad) return { kg: null, action: 'deload', title: 'Deload · keep it easy.', detail: 'Use today’s reduced sets. Keep plenty in reserve; shorten time or choose an easier variation if needed.', source };
    if (!uniformLoad) return { kg: null, action: 'deload', title: 'Choose an easy deload load.', detail: 'The last exposure used mixed or incomplete load data. Pick a reference working load, then use roughly 90% where practical.', source };
    if (mode === 'assistance') return { kg, action: 'deload', title: 'Deload · keep or add assistance.', detail: 'More assistance is easier. Use fewer sets and do not reduce assistance this week.', source };
    if (mode === 'added') return { kg: 0, action: 'deload', title: 'Deload · remove the added weight.', detail: 'Use comfortable bodyweight work, fewer sets, or an easier variation. Added weight is separate from body mass.', source };
    const reduced = roundedDown(exercise, kg * 0.9);
    return { kg: reduced, action: 'deload', title: `Deload · try ${reduced} kg.`, detail: reduced >= kg ? 'The equipment minimum prevents a lower load. Keep the work easy and use the reduced sets.' : `About 90% of ${kg} kg, rounded down to an available load. Use ${prescription.sets} easy set${prescription.sets === 1 ? '' : 's'}.`, source };
  }

  if (!done.length) return hold('The latest exposure has no completed work sets. Choose a comfortable load; no automatic increase.');
  if (!noLoad && !uniformLoad) return { ...hold('The latest exposure used mixed loads or is missing a load. Reference the recorded sets and choose today’s load; no automatic increase.'), title: 'Choose a comfortable working load.' };
  if ((number(prescription.block) && number(previous.block) && Number(prescription.block) > Number(previous.block)) || (Number(prescription.week) === 1 && Number(previous.week) > 1)) return hold('A new block starts with a reference load. Settle into week one’s easier effort target before adding weight.');
  const old = previous.prescription || {};
  const expected = Number(old.sets);
  if (!expected || done.length !== expected || rows.length !== expected || rows.some(row => row.status !== 'done')) return hold('The last exposure was partial or had skipped sets. Repeat a comfortable load; no automatic increase.');
  const target = Number.parseFloat(String(old.rir || '').replace('–', '-'));
  if (previous.techniqueIssue || (number(previous.effort) && Number.isFinite(target) && Number(previous.effort) < target)) return hold('The last exposure had an effort or technique warning. Hold the load or choose an easier one.');
  if (Number(old.sets) !== Number(prescription.sets) || Number(old.repMin) !== Number(prescription.repMin) || Number(old.repMax) !== Number(prescription.repMax) || (old.unit && old.unit !== prescription.unit)) return hold('Today’s sets or range changed. Use the previous load as a reference and settle into the new prescription first.');
  if (done.some(row => !number(row.reps) || Number(row.reps) < Number(prescription.repMin))) return hold(`A set fell below the range last time. Hold or choose easier; stay within today’s effort target.`);
  const allTop = done.every(row => Number(row.reps) >= Number(prescription.repMax));
  if (!allTop) return hold(`Same ${noLoad ? 'variation' : 'load'}; try adding ${unit} within today’s range and effort target.`);
  if (noLoad) return { ...hold(`All sets reached the top of the range. Keep clean ${unit}, or deliberately choose a harder variation when ready.`), title: 'Top of the range reached.' };
  if (mode === 'assistance') {
    const next = nextLoad(exercise, kg, -1);
    if (next >= kg) return { ...hold('You are at the lowest available assistance. Keep clean reps or deliberately choose the bodyweight variation.'), title: 'Lowest assistance reached.' };
    return { kg: next, action: 'increase', title: `Try ${next} kg assistance.`, detail: `Every set reached the top. Less assistance is harder; return to ${prescription.repMin} clean reps.`, source };
  }
  const next = nextLoad(exercise, kg);
  if (next <= kg) return hold('You reached the top of the range and the available equipment loads. Keep controlled reps at this load.');
  return { kg: next, action: 'increase', title: `Try ${next} ${mode === 'added' ? 'kg added' : exercise.unitLabel === 'kg each' ? 'kg each' : 'kg'}.`, detail: `Every set reached the top. Rebuild from ${prescription.repMin} reps and keep today’s reps in reserve.`, source };
}

export function warmupSets(exercise, kg) {
  if (exercise.mode !== 'load' || !number(kg) || Number(kg) <= 0 || exercise.barWeight === null) return [];
  const working = Number(kg);
  const bar = typeof exercise.barWeight === 'number' ? exercise.barWeight : 0;
  if (working < bar) return [];
  const candidates = bar > 0
    ? [{ kg: bar, reps: 8 }, { kg: roundedDown(exercise, working * 0.5), reps: 5 }, { kg: roundedDown(exercise, working * 0.7), reps: 3 }, { kg: roundedDown(exercise, working * 0.85), reps: 1 }]
    : [{ kg: roundedDown(exercise, working * 0.5), reps: 8 }, { kg: roundedDown(exercise, working * 0.75), reps: 4 }];
  const seen = new Set();
  return candidates.filter(row => {
    if (row.kg <= 0 || row.kg > working || (row.kg === working && working !== bar) || seen.has(row.kg)) return false;
    seen.add(row.kg); return true;
  });
}

export function platesFor(kg, barWeight = 20) {
  const requested = Number(kg);
  const bar = Number(barWeight);
  if (!Number.isFinite(requested) || !Number.isFinite(bar) || bar < 0) return { plates: [], achieved: 0, remainder: Number.isFinite(requested) ? requested : 0 };
  let perSide = Math.max(0, (requested - bar) / 2);
  const plates = [];
  for (const plate of [25, 20, 15, 10, 5, 2.5, 1.25]) {
    while (perSide + 0.00001 >= plate) { plates.push(plate); perSide = clean(perSide - plate); }
  }
  const achieved = clean(bar + 2 * plates.reduce((sum, plate) => sum + plate, 0));
  return { plates, achieved, remainder: clean(requested - achieved) };
}

export function estimate1RM(kg, reps) {
  if (!number(kg) || Number(kg) <= 0 || !number(reps) || !Number.isInteger(Number(reps)) || Number(reps) < 1 || Number(reps) > 12) return null;
  return Number(kg) * (1 + Number(reps) / 30);
}

export function volumeForWeek(week, swaps = {}) {
  const totals = new Map();
  for (const day of DAYS) for (const slot of day.slots) {
    const exercise = EXERCISES[swaps[slot.id]] || EXERCISES[slot.exerciseId];
    const muscle = exercise.primaryMuscle || slot.muscle;
    const { sets } = getPrescription(slot, exercise, week);
    totals.set(muscle, (totals.get(muscle) || 0) + sets);
  }
  return [...totals].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}
