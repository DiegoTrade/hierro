// Reconstructed starter programme. The original reference HTML was not supplied.
// Exercise cues are reminders, not a substitute for learning a movement in person.
export const PROGRAM_VERSION = 'hierro-starter-1';

const exercise = (id, name, spanish, category, mode, primaryMuscle, cue, extra = {}) => ({
  id, name, spanish, category, mode, primaryMuscle, cue,
  unitLabel: mode === 'time' ? 'seconds per side' : mode === 'distance' ? 'metres' : mode === 'bodyweight' ? 'bodyweight' : mode === 'assistance' ? 'assistance kg' : mode === 'added' ? 'added kg' : 'total kg',
  increment: 2.5, ...extra,
});
const db = { unitLabel: 'kg each', increment: 1 };
const stack = { unitLabel: 'stack kg', increment: 2.5 };

export const EXERCISES = Object.fromEntries([
  exercise('back-squat', 'Back squat', 'Sentadilla con barra', 'main', 'load', 'Quadriceps', 'Brace before each rep. Sit between your hips and keep your whole foot planted.', { barWeight: 20 }),
  exercise('goblet-squat', 'Goblet squat', 'Sentadilla goblet', 'main', 'load', 'Quadriceps', 'Hold one dumbbell close to your chest. Descend only as far as you can keep a steady torso.', { unitLabel: 'one dumbbell kg', increment: 2, repMin: 8, repMax: 12 }),
  exercise('romanian-deadlift', 'Romanian deadlift', 'Peso muerto rumano', 'accessory', 'load', 'Hamstrings', 'Soften your knees and push your hips back. Keep the bar close; stop before your lower back rounds.', { barWeight: 20 }),
  exercise('dumbbell-rdl', 'Dumbbell Romanian deadlift', 'Peso muerto rumano con mancuernas', 'accessory', 'load', 'Hamstrings', 'Slide the dumbbells beside your legs as your hips move back. Stand by driving your feet into the floor.', db),
  exercise('walking-lunge', 'Walking lunge', 'Zancadas caminando', 'accessory', 'load', 'Quadriceps', 'Take controlled steps with a stable front foot. Use bodyweight first if balance limits the movement.', { ...db, perSide: true }),
  exercise('bulgarian-split-squat', 'Bulgarian split squat', 'Sentadilla búlgara', 'accessory', 'load', 'Quadriceps', 'Use a low rear-foot support and keep most of your weight on the front leg. Start with bodyweight.', { ...db, perSide: true }),
  exercise('smith-split-squat', 'Smith split squat', 'Zancada en máquina Smith', 'accessory', 'load', 'Quadriceps', 'Set the safety stops and find a comfortable stance. Lower slowly with the front knee tracking over your foot.', { unitLabel: 'added plates kg', increment: 2.5, perSide: true }),
  exercise('standing-calf-raise', 'Standing calf raise', 'Elevación de gemelos de pie', 'isolation', 'load', 'Calves', 'Rise through the balls of your feet without bouncing. Pause briefly at the top and lower with control.', { ...stack }),
  exercise('seated-calf-raise', 'Seated calf raise', 'Elevación de gemelos sentado', 'isolation', 'load', 'Calves', 'Keep the pads secure and move through a comfortable ankle range. Avoid bouncing out of the bottom.', { unitLabel: 'added plates kg', increment: 2.5 }),
  exercise('seated-leg-curl', 'Seated leg curl', 'Curl femoral sentado', 'isolation', 'load', 'Hamstrings', 'Align your knee with the machine pivot and secure the thigh pad. Curl without lifting your hips.', stack),
  exercise('lying-leg-curl', 'Lying leg curl', 'Curl femoral tumbado', 'isolation', 'load', 'Hamstrings', 'Keep your hips on the pad. Curl smoothly and lower without letting the stack crash.', stack),
  exercise('bench-press', 'Bench press', 'Press de banca', 'main', 'load', 'Chest', 'Set your shoulder blades, plant your feet, and lower the bar under control. Use safeties or a spotter.', { barWeight: 20 }),
  exercise('dumbbell-bench', 'Dumbbell bench press', 'Press de banca con mancuernas', 'accessory', 'load', 'Chest', 'Keep your wrists above your elbows. Lower to a comfortable depth and press without clashing the dumbbells.', db),
  exercise('lat-pulldown', 'Lat pulldown · heavy', 'Jalón al pecho', 'main', 'load', 'Back', 'Keep your chest lifted and pull your elbows toward your sides. Do not turn the pull into a backward swing.', stack),
  exercise('assisted-pull-up', 'Assisted pull-up', 'Dominadas asistidas', 'main', 'assistance', 'Back', 'Choose enough assistance to move smoothly. Pull without kicking and control the return; less assistance is harder.', { ...stack, unitLabel: 'assistance kg', repMin: 6, repMax: 10 }),
  exercise('pull-up', 'Pull-up', 'Dominadas', 'main', 'bodyweight', 'Back', 'Use this option when you can do six clean reps. Start from a comfortable hang and avoid swinging.', { increment: 0, repMin: 6, repMax: 10 }),
  exercise('chest-supported-row', 'Chest-supported row', 'Remo con apoyo de pecho', 'accessory', 'load', 'Back', 'Keep your chest on the pad and pull your elbows back. Let your shoulders reach forward gently between reps.', stack),
  exercise('seated-cable-row', 'Seated cable row', 'Remo sentado en polea', 'accessory', 'load', 'Back', 'Keep your torso quiet and pull toward your lower ribs. Return slowly without rounding your lower back.', stack),
  exercise('one-arm-row', 'One-arm dumbbell row', 'Remo con mancuerna a una mano', 'accessory', 'load', 'Back', 'Support yourself firmly and pull your elbow toward your hip. Keep your shoulders level instead of twisting.', { ...db, unitLabel: 'one dumbbell kg', perSide: true }),
  exercise('dumbbell-shoulder-press', 'Dumbbell shoulder press', 'Press de hombros con mancuernas', 'accessory', 'load', 'Shoulders', 'Use a supported seat and keep your ribs down. Press through a comfortable range without arching your back.', db),
  exercise('machine-shoulder-press', 'Machine shoulder press', 'Press de hombros en máquina', 'accessory', 'load', 'Shoulders', 'Adjust the seat so the handles begin near shoulder height. Keep your back supported throughout.', stack),
  exercise('lateral-raise', 'Dumbbell lateral raise', 'Elevaciones laterales con mancuernas', 'isolation', 'load', 'Shoulders', 'Lift with soft elbows and a quiet torso. Stop around shoulder height and lower slowly.', db),
  exercise('cable-lateral-raise', 'Cable lateral raise', 'Elevación lateral en polea', 'isolation', 'load', 'Shoulders', 'Stand steadily and lead with your elbow. Keep the movement small enough that you do not need to lean.', { ...stack, perSide: true }),
  exercise('cable-curl', 'Cable curl', 'Curl de bíceps en polea', 'isolation', 'load', 'Biceps', 'Keep your upper arms still and curl without leaning back. Control the return to a comfortable elbow extension.', stack),
  exercise('dumbbell-curl', 'Dumbbell curl', 'Curl de bíceps con mancuernas', 'isolation', 'load', 'Biceps', 'Keep your elbows near your sides. Choose a weight that does not require a swing.', db),
  exercise('trap-bar-deadlift', 'Trap-bar deadlift', 'Peso muerto con barra hexagonal', 'main', 'load', 'Glutes', 'Brace, push the floor away and stand tall. Keep the handles level; confirm this bar’s weight before calculating a total.', { barWeight: null, increment: 5 }),
  exercise('conventional-deadlift', 'Conventional deadlift', 'Peso muerto convencional', 'main', 'load', 'Glutes', 'Set the bar over midfoot, brace and keep it close as you stand. Reset between reps; do not bounce.', { barWeight: 20, increment: 5 }),
  exercise('sumo-deadlift', 'Sumo deadlift', 'Peso muerto sumo', 'main', 'load', 'Glutes', 'Use a comfortable wide stance with knees following your toes. Brace and push the floor apart as you stand.', { barWeight: 20, increment: 5 }),
  exercise('leg-press', 'Leg press', 'Prensa de piernas', 'accessory', 'load', 'Quadriceps', 'Keep your hips and lower back against the pad. Lower only as far as that position stays steady; do not slam your knees straight.', { unitLabel: 'added plates kg', increment: 5 }),
  exercise('hack-squat', 'Hack squat', 'Sentadilla hack', 'accessory', 'load', 'Quadriceps', 'Set the safety stops and keep your back on the pad. Use a comfortable stance and controlled depth.', { unitLabel: 'added plates kg', increment: 5 }),
  exercise('hip-thrust', 'Hip thrust', 'Empuje de cadera', 'accessory', 'load', 'Glutes', 'Pad the bar and keep your chin gently tucked. Finish with your hips, without arching your lower back.', { barWeight: 20, increment: 2.5 }),
  exercise('glute-bridge', 'Dumbbell glute bridge', 'Puente de glúteos con mancuerna', 'accessory', 'load', 'Glutes', 'Place one padded dumbbell across your hips. Drive through your feet and pause without arching your back.', { unitLabel: 'one dumbbell kg', increment: 2 }),
  exercise('overhead-press', 'Overhead press', 'Press militar con barra', 'main', 'load', 'Shoulders', 'Brace your legs and trunk before pressing. Move the bar past your face without leaning backward.', { barWeight: 20 }),
  exercise('machine-chest-press', 'Machine chest press', 'Press de pecho en máquina', 'accessory', 'load', 'Chest', 'Set the seat so the handles are around mid-chest. Keep your shoulder blades supported and press smoothly.', stack),
  exercise('dip', 'Dip · bodyweight', 'Fondos en paralelas', 'accessory', 'bodyweight', 'Chest', 'Begin with bodyweight only and a comfortable depth. Keep your shoulders controlled; choose the machine press if this feels awkward.', { increment: 0, repMin: 6, repMax: 10 }),
  exercise('triceps-pushdown', 'Triceps pushdown', 'Extensión de tríceps en polea', 'isolation', 'load', 'Triceps', 'Keep your upper arms close to your sides. Extend your elbows without throwing your body into the handle.', stack),
  exercise('overhead-cable-triceps', 'Overhead cable extension', 'Extensión de tríceps sobre la cabeza', 'isolation', 'load', 'Triceps', 'Keep your ribs down and upper arms steady. Move only through a comfortable elbow range.', stack),
  exercise('face-pull', 'Face pull', 'Tirón a la cara en polea', 'isolation', 'load', 'Shoulders', 'Pull the rope toward eye level with control. Keep your neck relaxed and avoid leaning backward.', stack),
  exercise('reverse-pec-deck', 'Reverse pec deck', 'Aperturas inversas en máquina', 'isolation', 'load', 'Shoulders', 'Set the handles near shoulder height. Open your arms smoothly without shrugging or driving your chest off the pad.', stack),
  exercise('dead-bug', 'Dead bug', 'Bicho muerto', 'accessory', 'bodyweight', 'Core', 'Keep your lower back gently supported by the floor. Reach opposite arm and leg only as far as you can stay steady.', { increment: 0, perSide: true, repMin: 8, repMax: 12 }),
  exercise('ball-rollout', 'Stability-ball rollout', 'Rodamiento con balón de estabilidad', 'accessory', 'bodyweight', 'Core', 'Kneel with forearms on the ball and brace your trunk. Roll forward a little, then return before your lower back sags.', { increment: 0, repMin: 8, repMax: 12 }),
  exercise('ab-wheel', 'Ab-wheel rollout', 'Rueda abdominal', 'accessory', 'bodyweight', 'Core', 'Start from your knees with a short range. Keep your ribs down and stop before your lower back arches.', { increment: 0, repMin: 6, repMax: 10 }),
  exercise('front-plank', 'Front plank', 'Plancha frontal', 'accessory', 'time', 'Core', 'Make a straight line through shoulders, hips and ankles. Breathe steadily; finish when you cannot hold that position.', { unitLabel: 'seconds', increment: 5, repMin: 30, repMax: 45 }),
  exercise('side-plank', 'Side plank', 'Plancha lateral', 'accessory', 'time', 'Core', 'Place your elbow beneath your shoulder and lift your hips. Use bent knees if needed; record time for each side.', { unitLabel: 'seconds per side', increment: 5, perSide: true, repMin: 30, repMax: 45 }),
  exercise('pallof-press', 'Pallof press', 'Press Pallof', 'accessory', 'load', 'Core', 'Stand side-on to the cable and keep your hips still. Press the handle forward without letting your trunk rotate.', { ...stack, perSide: true, repMin: 10, repMax: 12 }),
].map(item => [item.id, item]));

const slot = (id, exerciseId, alternatives, sets, repMin, repMax, rest, category, muscle, extra = {}) => ({ id, exerciseId, alternatives, sets, repMin, repMax, rest, category, muscle, ...extra });
const incline = { name: 'Incline walk', minutes: 20, kind: 'walk', detail: 'Conversational effort. Starting reference: 8–12% incline, 4.5–5.5 km/h; adjust to how you feel.' };

export const DAYS = [
  {
    id: 'lower-a', label: 'Lower A', day: 'MON', focus: 'Squat · legs · steady cardio', duration: '60–75 min',
    warmup: ['5 min easy bike or treadmill.', '8 comfortable bodyweight squats and 8 hip hinges.', 'Use gradual warm-up sets before the squat and Romanian deadlift.'],
    slots: [
      slot('la-1', 'back-squat', ['goblet-squat'], 3, 6, 10, 150, 'main', 'Quadriceps'),
      slot('la-2', 'romanian-deadlift', ['dumbbell-rdl'], 3, 8, 12, 120, 'accessory', 'Hamstrings'),
      slot('la-3', 'walking-lunge', ['bulgarian-split-squat', 'smith-split-squat'], 2, 8, 12, 90, 'accessory', 'Quadriceps'),
      slot('la-4', 'standing-calf-raise', ['seated-calf-raise'], 3, 10, 15, 60, 'isolation', 'Calves', { fixedSets: true }),
      slot('la-5', 'seated-leg-curl', ['lying-leg-curl'], 2, 10, 15, 60, 'isolation', 'Hamstrings'),
    ], cardio: { ...incline },
  },
  {
    id: 'upper-a', label: 'Upper A', day: 'TUE', focus: 'Bench · vertical pull · intervals', duration: '60–75 min',
    warmup: ['4–5 min easy cardio.', '8 gentle shoulder circles each way and 10 light cable rows.', 'Build up with light practice sets before the bench and pulldown.'],
    slots: [
      slot('ua-1', 'bench-press', ['dumbbell-bench', 'machine-chest-press'], 3, 6, 10, 150, 'main', 'Chest'),
      slot('ua-2', 'lat-pulldown', ['assisted-pull-up', 'pull-up'], 3, 8, 10, 120, 'main', 'Back'),
      slot('ua-3', 'chest-supported-row', ['seated-cable-row', 'one-arm-row'], 3, 8, 12, 90, 'accessory', 'Back'),
      slot('ua-4', 'dumbbell-shoulder-press', ['machine-shoulder-press'], 2, 8, 12, 90, 'accessory', 'Shoulders'),
      slot('ua-5', 'lateral-raise', ['cable-lateral-raise'], 2, 12, 15, 60, 'isolation', 'Shoulders', { superset: 'ua-finish' }),
      slot('ua-6', 'cable-curl', ['dumbbell-curl'], 2, 10, 15, 60, 'isolation', 'Biceps', { superset: 'ua-finish' }),
    ], cardio: { name: 'Easy / hard intervals', minutes: 14, kind: 'intervals', detail: '2 min easy, then 5 rounds of 1 min hard / 1 min easy, then 2 min easy. Controlled hard effort, not an all-out sprint.' },
  },
  {
    id: 'engine', label: 'Engine', day: 'WED', focus: 'Optional · easy engine · trunk control', duration: '50–60 min', optional: true,
    warmup: ['3–5 min easy movement.', 'Keep the core work comfortable and leave plenty in reserve.', 'The steady cardio is the priority; this day should leave you refreshed.'],
    slots: [
      slot('en-1', 'dead-bug', ['pallof-press'], 2, 8, 12, 45, 'accessory', 'Core'),
      slot('en-2', 'ball-rollout', ['ab-wheel', 'front-plank'], 2, 8, 12, 45, 'accessory', 'Core'),
      slot('en-3', 'side-plank', ['pallof-press'], 2, 30, 45, 45, 'accessory', 'Core'),
    ], cardio: { name: 'Easy steady cardio', minutes: 40, kind: 'steady', detail: 'Any comfortable machine. Conversational effort; the original 115–130 bpm is a reference, not a personalized heart-rate zone.' },
  },
  {
    id: 'lower-b', label: 'Lower B', day: 'THU', focus: 'Hinge · glutes · steady cardio', duration: '60–75 min',
    warmup: ['5 min easy bike or treadmill.', '8 bodyweight hip hinges and 8 gentle glute bridges.', 'Use gradual practice sets before the deadlift and leg press.'],
    slots: [
      slot('lb-1', 'trap-bar-deadlift', ['conventional-deadlift', 'sumo-deadlift'], 3, 5, 8, 150, 'main', 'Glutes'),
      slot('lb-2', 'leg-press', ['hack-squat', 'goblet-squat'], 3, 10, 15, 120, 'accessory', 'Quadriceps'),
      slot('lb-3', 'hip-thrust', ['glute-bridge'], 2, 8, 12, 90, 'accessory', 'Glutes'),
      slot('lb-4', 'lying-leg-curl', ['seated-leg-curl'], 2, 10, 15, 60, 'isolation', 'Hamstrings'),
      slot('lb-5', 'seated-calf-raise', ['standing-calf-raise'], 3, 10, 15, 60, 'isolation', 'Calves', { fixedSets: true }),
    ], cardio: { ...incline },
  },
  {
    id: 'upper-b', label: 'Upper B', day: 'FRI', focus: 'Press · row · steady cardio', duration: '60–75 min',
    warmup: ['4–5 min easy cardio.', '8 gentle shoulder circles each way and 10 light rows.', 'Practice the overhead press with a light load; keep every rep smooth.'],
    slots: [
      slot('ub-1', 'overhead-press', ['dumbbell-shoulder-press', 'machine-shoulder-press'], 3, 6, 10, 150, 'main', 'Shoulders'),
      slot('ub-2', 'seated-cable-row', ['chest-supported-row', 'one-arm-row'], 3, 8, 12, 90, 'accessory', 'Back'),
      slot('ub-3', 'machine-chest-press', ['dumbbell-bench', 'dip'], 3, 8, 12, 90, 'accessory', 'Chest'),
      slot('ub-4', 'lat-pulldown', ['assisted-pull-up', 'pull-up'], 2, 10, 12, 90, 'accessory', 'Back'),
      slot('ub-5', 'triceps-pushdown', ['overhead-cable-triceps'], 2, 10, 15, 60, 'isolation', 'Triceps', { superset: 'ub-finish' }),
      slot('ub-6', 'face-pull', ['reverse-pec-deck'], 2, 12, 15, 60, 'isolation', 'Shoulders', { superset: 'ub-finish' }),
    ], cardio: { ...incline },
  },
];
