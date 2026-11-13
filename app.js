import { DAYS, EXERCISES, PROGRAM_VERSION } from './data.js';
import { getPrescription, suggest, warmupSets, platesFor, estimate1RM, volumeForWeek } from './engine.js';
import { STORAGE_KEY, APP_VERSION, readState, saveState, validateBackup, exportJSON, exportCSV, backupDue } from './storage.js';

const root = document.querySelector('#app');
const dialog = document.querySelector('#sheet');
const loaded = readState();
let state = loaded.state;
let saveError = loaded.error || '';
let storageBlocked = !!loaded.error;
let externalChange = false;
let waitingWorker = null;
let wakeLock = null;
let audio = null;
let toastTimeout;
let alarmedDeadline = null;
const ui = { tab: 'today', day: null, expanded: new Set(), warmup: false, summary: null };
const paths = {
  today: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
  plan: '<path d="M8 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="5" rx="1.5"/><path d="M8 12h8m-8 4h5"/>',
  progress: '<path d="M4 4v16h17M8 15l4-5 4 2 5-7"/>',
  settings: '<path d="m9 3-.5 2-2 .9-1.8-.6-2 3.4 1.4 1.5v2.4l-1.4 1.5 2 3.4 1.8-.6 2 .9.5 2h4l.5-2 2-.9 1.8.6 2-3.4-1.4-1.5v-2.4l1.4-1.5-2-3.4-1.8.6-2-.9-.5-2z"/><circle cx="11" cy="11.4" r="3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dumbbell: '<path d="M8 12h8M3 8v8m3-10v12m12-12v12m3-10v8M3 12h3m12 0h3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  heart: '<path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.3a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  leaf: '<path d="M20 3C9 2 3 7 5 15c2 7 16 6 15-12ZM5 20 16 9m-6 6v-5m0 5h5"/>',
  spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',
  swap: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-5 2h10"/>',
  walk: '<circle cx="14" cy="4" r="2"/><path d="m10 21 2-7-3-3 2-4 4 2 3 3h3m-11-1-4 2m6 1 4 3 1 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  minus: '<path d="M5 12h14"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.dumbbell}</svg>`;
const brand = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M4 6h5v7h14V6h5v20h-5v-8H9v8H4z"/><path fill="currentColor" d="M0 10h3v12H0zm29 0h3v12h-3z"/></svg><span class="wordmark">HIERRO</span>';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDate = (value, options = { month: 'short', day: 'numeric' }) => new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', options);
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const parseNumber = value => value.trim() === '' ? null : Number(value.replace(',', '.'));
const active = () => state.sessions.find(session => session.status === 'active');
const dayFor = value => DAYS.find(day => day.id === value) || DAYS[0];
const exerciseFor = record => ({ ...(EXERCISES[record.exerciseId] || {}), ...(record.snapshot || {}) });
const chosenExercise = slot => EXERCISES[state.settings.swaps[slot.id]] || EXERCISES[slot.exerciseId];
const configuredExercise = exercise => ({ ...exercise, ...(state.settings.equipment?.[exercise.id] || {}) });
const equipmentIdFor = exercise => state.settings.equipment?.[exercise.id]?.version ? `${exercise.id}:${state.settings.equipment[exercise.id].version}` : exercise.id;
const weekFinished = day => state.sessions.some(s => s.day === day.id && s.block === state.settings.block && s.week === state.settings.week && s.status === 'finished');
const nextDay = () => DAYS.find(day => day.id !== 'engine' && !weekFinished(day)) || DAYS[0];
const currentDay = () => dayFor(ui.day);
const workCount = session => session.exercises.reduce((n, item) => n + item.sets.filter(set => set.status === 'done').length, 0);
const plannedCount = session => session.exercises.reduce((n, item) => n + item.sets.filter(set => set.skipReason !== 'swap').length, 0);
function sessionMinutes(session, now = Date.now()) {
  const base = session.durationOverride ?? ((session.finished ?? now) - session.started) / 60000;
  const resumed = session.status === 'active' && Number.isFinite(session.resumedAt) ? (now - session.resumedAt) / 60000 : 0;
  return Math.max(0, base + resumed);
}
const elapsed = session => Math.round(sessionMinutes(session));
const range = p => `${p.repMin}–${p.repMax}${p.unit === 'sec' ? 's' : p.unit === 'm' ? 'm' : ''}`;
function historyFor(exerciseId, equipmentId = exerciseId, slotId = null, beforeStarted = Infinity) {
  return state.sessions.filter(s => s.status === 'finished' && s.started < beforeStarted).sort((a, b) => b.started - a.started).flatMap(s => s.exercises.filter(e => e.exerciseId === exerciseId && e.equipmentId === equipmentId && (!slotId || e.slotId === slotId)).map(e => ({ ...e, date: s.date, week: s.week, block: s.block, finished: true })));
}
function weekCardio() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const from = localDate(start), to = localDate(end);
  return state.sessions.filter(s => s.date >= from && s.date <= to && s.cardio?.done).reduce((n, s) => n + s.cardio.minutes, 0) + state.activities.filter(a => a.date >= from && a.date <= to).reduce((n, a) => n + a.minutes, 0);
}
function persist() {
  if (storageBlocked) { renderSaveError(); toast(externalChange ? 'Export your work or reload the latest notebook before editing.' : 'Restore or recover your stored data in Settings first.'); return false; }
  const result = saveState(state);
  saveError = result.ok ? '' : result.error;
  renderSaveError();
  if (!result.ok) toast('Couldn’t save. Keep this window open and export your notebook.');
  return result.ok;
}
function saveErrorMarkup() {
  return saveError ? `<div class="banner error"><span>${esc(saveError)} Keep this window open to recover your work.</span><button data-action="recovery">Recovery options</button></div>` : '';
}
function renderSaveError() {
  const host = document.querySelector('#save-error-host');
  if (host) host.innerHTML = saveErrorMarkup();
}
function meaningful() { if (!state.settings.firstDataAt) state.settings.firstDataAt = new Date().toISOString(); }
function applyTheme() {
  const theme = state.settings.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.settings.theme;
  document.body.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#1d221e' : '#f6f5f1';
}
function toast(message) {
  const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => node.classList.remove('show'), 3500);
}
function shell() {
  const headings = { today: ['Make today count', 'A little stronger, one session at a time.'], plan: ['A plan with purpose', 'Four days of strength. Room to find your rhythm.'], progress: ['See how far you’ve come', 'Your effort adds up. Here’s the bigger picture.'], settings: ['Make it yours', 'Your programme, your preferences, your notebook.'] };
  const [title, subtitle] = headings[ui.tab];
  root.innerHTML = `<aside class="sidebar"><a class="brand" href="#today" aria-label="Hierro home">${brand}</a><p class="brand-caption">Your training, in progress.</p><nav class="navigation" aria-label="Main navigation">${['today','plan','progress','settings'].map(tab => `<button class="nav-button ${tab === ui.tab ? 'active' : ''}" data-action="tab" data-tab="${tab}" ${tab === ui.tab ? 'aria-current="page"' : ''}>${icon(tab)}<span>${tab[0].toUpperCase() + tab.slice(1)}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('leaf')}<strong>Built for the long run.</strong><p>Consistency beats intensity.<br>Show up. Do the work. Repeat.</p></div><div class="profile"><span class="avatar">D</span><div><div class="profile-name">Diego’s notebook</div><div class="profile-sub">One session at a time</div></div></div></div></aside><main class="main" id="main"><div class="topline"><div class="breadcrumb"><span>YOUR TRAINING</span><span>/</span><span>${ui.tab.toUpperCase()}</span></div><div class="mobile-brand">${brand}</div><button class="block-select" data-action="week" aria-label="Choose programme week">Block <strong>${String(state.settings.block).padStart(2, '0')}</strong><span>·</span>Week <strong>${String(state.settings.week).padStart(2, '0')}</strong>${icon('chevron')}</button></div><div class="page-heading"><div><h1>${title}<span class="period">.</span></h1><p>${subtitle}</p></div><div class="heading-date">${icon('today', 'icon-sm')}${new Date().toLocaleDateString('en-GB', { weekday:'long',day:'numeric',month:'long' })}</div></div><div id="save-error-host">${saveErrorMarkup()}</div>${waitingWorker ? `<div class="banner"><span>A fresh version of Hierro is ready.</span><button data-action="update">${active() ? 'After your workout' : 'Update now'}</button></div>` : ''}${backupDue(state) && ui.tab !== 'settings' ? `<div class="banner"><span>Your notebook is worth keeping. It’s time for a JSON backup.</span><button data-action="export-json">Export backup</button></div>` : ''}<div id="page-content">${ui.tab === 'today' ? renderToday() : ui.tab === 'plan' ? renderPlan() : ui.tab === 'progress' ? renderProgress() : renderSettings()}</div></main><div id="timer-host"></div>`;
  applyTheme(); renderTimer();
}
function weekStrip() {
  return `<div class="week-area"><div class="week-label"><span class="eyebrow">Your week</span><span class="small muted">${state.settings.week === 5 ? 'A little room to recover' : `Week ${state.settings.week} of 5`} <span class="accent">↗</span></span></div><div class="week-strip">${DAYS.map(day => { const done = state.sessions.find(s => s.day === day.id && s.block === state.settings.block && s.week === state.settings.week && s.status === 'finished'); return `<button class="day-button ${ui.day === day.id ? 'selected' : ''}" data-action="day" data-day="${day.id}" aria-pressed="${ui.day === day.id}" aria-label="${day.label}${done ? done.complete ? ', completed' : ', partial workout' : ''}"><span class="day-top"><span class="day-name">${day.day}${done?.complete ? '<span class="dot"></span>' : ''}</span>${ui.day === day.id ? icon('arrow','day-indicator') : done ? icon(done.complete?'check':'minus','day-indicator') : ''}</span><span class="day-label">${day.label}${done&&!done.complete ? '<small class="day-optional">partial</small>' : day.id === 'engine' ? '<small class="day-optional">optional</small>' : ''}</span></button>`; }).join('')}</div></div>`;
}
function renderToday() {
  const day = currentDay(); const session = active()?.day === day.id ? active() : null;
  const finished = state.sessions.find(s => s.day === day.id && s.date === localDate() && s.status === 'finished');
  const records = session ? session.exercises : day.slots.map(slot => { const exercise = configuredExercise(chosenExercise(slot)); return { slotId: slot.id, exerciseId: exercise.id, equipmentId: equipmentIdFor(exercise), snapshot: exercise, prescription: { ...getPrescription(slot, exercise, state.settings.week), block: state.settings.block }, sets: [] }; });
  const count = records.reduce((n,e) => n + e.prescription.sets, 0);
  return `${ui.summary ? renderSummary(ui.summary) : ''}${active() && !session ? `<div class="banner"><span>Your ${esc(dayFor(active().day).label)} session is ready to resume.</span><button data-action="resume">Resume workout</button></div>` : ''}${weekStrip()}<div class="today-grid"><section class="card workout-card" aria-label="${esc(day.label)} workout"><div class="workout-heading"><div class="between"><div><p class="eyebrow">${session ? 'In your session' : day.id === 'engine' ? 'Your optional session' : 'Your next session'} <span class="accent">/</span> ${session ? `WEEK ${session.week}` : `WEEK ${state.settings.week}`}</p><h2>${day.label}</h2><p class="workout-focus">${esc(day.focus)}</p></div><span class="session-symbol">${icon(day.id === 'engine' ? 'heart' : 'dumbbell')}</span></div><div class="workout-meta"><span>${icon('clock')}${day.duration}</span><span>${icon('layers')}${records.length} exercises</span><span>${icon('target')}${session ? `${workCount(session)} / ${plannedCount(session)} sets` : `${count} work sets`}</span></div></div>${session ? `<div class="workout-progress"><span style="width:${workCount(session)/plannedCount(session)*100}%"></span></div>` : ''}<div class="exercise-list"><button class="warmup-toggle" data-action="warmup-toggle" aria-expanded="${ui.warmup}"><span class="inline">${icon('spark','icon-sm')}A few minutes to get ready</span>${icon('chevron','icon-sm')}</button>${ui.warmup ? `<div class="warmup-content"><ul>${day.warmup.map(line => `<li>${esc(line)}</li>`).join('')}</ul></div>` : ''}${records.map((record,i) => renderExercise(record,i,session)).join('')}</div>${session ? renderSessionCardio(session,day) : ''}<div class="workout-footer">${session ? `<div class="session-notes"><label for="session-note">Anything to remember?</label><textarea id="session-note" data-field="note" placeholder="How it felt, a machine setting, a small win…">${esc(session.note)}</textarea></div><div style="height:15px"></div><button class="button full" data-action="finish"><span class="button-label">Finish session</span>${icon('check')}</button><div class="between" style="margin-top:10px"><span class="tiny muted">Partial workouts count, too.</span><button class="text-button muted" data-action="discard">Discard</button></div>` : `<button class="button full" data-action="start"><span class="button-label">${finished ? 'Review today’s session' : active() ? 'Resume active workout' : 'Let’s train'}</span>${icon(finished ? 'progress' : 'arrow')}</button><p class="start-note">${finished ? 'Your work is in the notebook. Nice one.' : 'Start light. Move well. Make it yours.'}</p>`}</div></section><aside class="rail">${renderRail(day)}</aside></div>${isIOS() && !standalone() && !state.settings.installDismissed ? `<div class="banner install-hint"><span>Add Hierro to your Home Screen for your next gym visit.</span><button data-action="install">Show me</button></div>` : ''}`;
}
function renderExercise(record,index,session) {
  const exercise = exerciseFor(record); const p = record.prescription;
  const isOpen = ui.expanded.has(index); const done = session && record.sets.every(s => s.status === 'done');
  const previous = historyFor(record.exerciseId,record.equipmentId,record.slotId,session?.started ?? Infinity); const advice = suggest({exercise,prescription:p,history:previous});
  const labelUnit = exercise.perSide ? `${p.unit === 'sec' ? 'sec' : p.unit}/side` : p.unit;
  return `<article class="exercise-item ${isOpen ? 'open' : ''}"><button class="exercise-trigger" data-action="exercise" data-index="${index}" aria-expanded="${isOpen}"><span class="exercise-index ${done ? 'done' : ''}">${done ? icon('check','icon-sm') : String(index+1).padStart(2,'0')}</span><span class="exercise-names"><strong>${esc(exercise.name)}</strong><small>${esc(exercise.spanish)}</small></span><span class="exercise-prescription">${p.sets} <span class="muted">×</span> ${range(p)}${exercise.perSide ? '<small>/side</small>' : ''}</span>${icon('chevron')}</button>${isOpen ? `<div class="exercise-body"><div class="exercise-chips"><span class="pill">${icon('clock','icon-sm')}${p.rest >= 60 ? `${p.rest/60} min` : `${p.rest}s`} rest</span><span class="pill orange">${p.deload ? 'Easy effort' : `Leave ${esc(p.rir)} clean reps`}</span>${dayFor(session?.day || ui.day).slots.find(s => s.id === record.slotId)?.superset ? '<span class="pill">Paired set</span>' : ''}</div><p class="cue">${esc(exercise.cue)}</p><div class="suggestion">${icon('spark')}<span><strong>${esc(advice.title)}</strong><br>${esc(advice.detail)}</span></div>${session ? `<div class="sets-head"><span>Set</span><span>Last time</span><span>${['bodyweight','time','distance'].includes(exercise.mode) ? 'Load' : esc(exercise.unitLabel)}</span><span>${esc(labelUnit)}</span><span></span></div>${record.sets.map((set,j) => { const last = previous[0]?.sets[j]; return `<div class="set-row ${set.status === 'done' ? 'is-done' : set.status === 'skipped' ? 'is-skipped' : ''}"><span class="set-number">${j+1}</span><span class="previous-set">${last?.status === 'done' ? `${last.kg !== null ? `${last.kg} × ` : ''}${last.reps}${p.unit === 'sec' ? 's' : ''}` : '—'}</span>${['bodyweight','time','distance'].includes(exercise.mode) ? '<span class="tiny muted" style="text-align:center">BW</span>' : `<input type="text" inputmode="decimal" autocomplete="off" aria-label="${esc(exercise.name)} set ${j+1}, ${esc(exercise.unitLabel)}" data-field="set" data-index="${index}" data-set="${j}" data-key="kg" value="${set.kg ?? ''}" placeholder="—">`}<input type="text" inputmode="numeric" autocomplete="off" aria-label="${esc(exercise.name)} set ${j+1}, ${esc(labelUnit)}" data-field="set" data-index="${index}" data-set="${j}" data-key="reps" value="${set.reps ?? ''}" placeholder="${p.repMin}"><button class="set-complete ${set.status === 'done' ? 'done' : ''}" data-action="complete" data-index="${index}" data-set="${j}" aria-label="${set.status === 'done' ? 'Undo' : 'Complete'} ${esc(exercise.name)} set ${j+1}" aria-pressed="${set.status === 'done'}">${set.status === 'skipped' ? icon('minus') : icon('check')}</button></div>`; }).join('')}<div class="set-footer"><button class="text-button" data-action="skip" data-index="${index}">Skip remaining sets</button><select class="effort-select" aria-label="Reps in reserve after ${esc(exercise.name)}" data-field="effort" data-index="${index}"><option value="">Last set: reps left?</option>${[0,1,2,3,4,5].map(n => `<option value="${n}" ${record.effort === n ? 'selected' : ''}>${n === 5 ? '5+' : n} clean reps left</option>`).join('')}</select></div>` : '<div class="preview-guide">Your set-by-set log will appear when you start. Every exercise, load and rep stays editable.</div>'}<div class="exercise-tools"><button data-action="warmup" data-index="${index}">${icon('layers')}Warm-up sets</button><button data-action="swap" data-index="${index}">${icon('swap')}Swap exercise</button><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name.replace(' · heavy','')+' form')}" target="_blank" rel="noopener noreferrer">${icon('play')}Form video</a></div></div>` : ''}</article>`;
}
function renderSessionCardio(session,day) {
  const c = session.cardio;
  return `<div class="cardio-inline"><div class="between"><strong class="inline">${icon('walk','icon-sm')}${esc(c.name)}</strong><span class="pill">After lifting</span></div><p>${session.week === 5 && day.cardio.kind === 'intervals' ? 'Deload: easy cardio in place of intervals.' : esc(day.cardio.detail)}</p><div class="cardio-inputs"><label>Actual minutes<input type="text" inputmode="decimal" data-field="cardio-minutes" value="${c.minutes}" aria-label="Cardio minutes"></label><label>Average bpm · optional<input type="text" inputmode="numeric" data-field="cardio-hr" value="${c.heartRate ?? ''}" placeholder="—" aria-label="Average heart rate"></label><button class="set-complete ${c.done ? 'done' : ''}" data-action="cardio-done" aria-label="${c.done ? 'Undo' : 'Complete'} cardio" aria-pressed="${c.done}">${icon('check')}</button></div></div>`;
}
function renderRail(day) {
  const w = state.settings.week; const minutes = weekCardio(), goal = state.settings.cardioGoal || 150;
  const focus = [null,['Find your rhythm.','This week is about good reps, not big numbers. Start light and get comfortable.','4 reps left'],['Build the habit.','Keep the same smooth technique. Add a rep where last week felt comfortable.','3 reps left'],['Quiet progress.','A little more confidence. A few more reps. Keep something in reserve.','2–3 reps left'],['Make it count.','Your strongest week of the block. Stay controlled and finish well.','2 reps left'],['Room to recover.','Less volume, easier loads. Give your next block a stronger starting point.','Easy effort']][w];
  const next = DAYS[(DAYS.findIndex(d => d.id === day.id)+1)%DAYS.length];
  return `<section class="focus-card"><p class="eyebrow">This week’s focus</p><svg class="focus-art" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor"/><rect x="23" y="2" width="14" height="14" rx="2" stroke="currentColor"/><rect x="2" y="23" width="14" height="14" rx="2" stroke="currentColor"/><rect x="23" y="23" width="14" height="14" rx="2" fill="currentColor" opacity=".4"/></svg><h3>${focus[0]}</h3><p>${focus[1]}</p><div class="focus-bottom"><span>ON YOUR MAIN LIFTS</span><strong>${focus[2]}</strong></div></section><section class="card cardio-card"><h3 class="rail-title between">Your engine${icon('heart')}</h3><div class="cardio-ring-wrap">${ring(minutes,goal)}<div class="cardio-copy"><strong>${Math.max(0,goal-minutes)} min</strong><p>${minutes >= goal ? 'Goal reached. Keep it enjoyable.' : 'to your weekly goal.<br>Every walk counts.'}</p></div></div><button class="button secondary full" data-action="log-cardio">${icon('plus')}Log cardio or a walk</button><div class="cardio-stretch"><span>Weekly goal: ${goal} min</span><span>Stretch: ${state.settings.cardioStretch || 180}</span></div></section><section class="next-card"><p class="eyebrow">On the horizon</p><h3>${next.label}</h3><p>${next.slots.length} exercises · ${next.duration}</p><button class="icon-button" data-action="day" data-day="${next.id}" aria-label="View ${next.label}">${icon('arrow')}</button></section><p class="rail-foot">${icon('info')}Cardio totals are actual minutes logged, across Monday–Sunday.</p>`;
}
function ring(minutes,goal) {
  return `<div class="progress-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43"/><circle class="value" cx="50" cy="50" r="43" stroke-dasharray="270.18" stroke-dashoffset="${270.18*(1-Math.min(1,minutes/goal))}"/></svg><div class="ring-label"><strong>${minutes}</strong><small>of ${goal} min</small></div></div>`;
}
function renderSummary(session) {
  const prs = sessionRecords(session);
  return `<section class="card summary-card"><div class="between"><span class="summary-check">${icon('check')}</span><button class="icon-button" data-action="dismiss-summary" aria-label="Dismiss workout summary">${icon('close')}</button></div><h2>That’s work in the bank.</h2><p>${esc(dayFor(session.day).label)} · ${saveError ? 'Session kept in this window' : session.complete ? 'Session complete' : 'Partial session saved'}. Your next session starts here.</p><div class="summary-stats"><div><strong>${elapsed(session)}<small> min</small></strong><small>Session duration</small></div><div><strong>${workCount(session)}<small> / ${plannedCount(session)}</small></strong><small>Work sets done</small></div><div><strong>${session.cardio?.done ? session.cardio.minutes : 0}<small> min</small></strong><small>Cardio logged</small></div></div>${prs.map(pr => `<p class="summary-record">${icon('trophy')}${esc(pr)}</p>`).join('')}<div class="button-row"><button class="button secondary compact" data-action="history" data-id="${session.id}">View your session${icon('arrow','icon-sm')}</button><button class="button ghost compact" data-action="correct-duration" data-id="${session.id}">Edit duration</button></div></section>`;
}
function renderPlan() {
  const volume = volumeForWeek(state.settings.week,state.settings.swaps); const max = Math.max(...volume.map(v=>v.sets),1);
  return `${weekStrip()}<section class="card plan-intro"><span class="plan-number">4+1</span><div><p class="eyebrow" style="color:#bdc6b8">Your five-week block</p><h2>Build. Practice. Repeat.</h2><p>Four strength days, an optional engine day, and a lighter fifth week. The aim is steady, repeatable progress with good technique.</p></div></section><div class="content-grid"><div class="stack">${DAYS.map(day => `<section class="card plan-day"><div class="plan-day-heading between"><div><p class="eyebrow" style="font-size:9px;margin-bottom:5px">${day.day}${day.id==='engine' ? ' · OPTIONAL' : ''}</p><h3>${day.label}</h3></div><span class="pill">${day.duration}</span></div>${day.slots.map(slot => { const ex = chosenExercise(slot),p=getPrescription(slot,ex,state.settings.week); return `<div class="plan-exercise"><span class="exercise-names"><strong>${esc(ex.name)}</strong><small>${esc(ex.spanish)}</small></span><span class="exercise-prescription">${p.sets} × ${range(p)}</span></div>`; }).join('')}<div class="plan-exercise"><span class="exercise-names"><strong>${icon('heart','icon-sm')} ${day.cardio.minutes} min ${state.settings.week===5 && day.cardio.kind==='intervals' ? 'easy cardio' : esc(day.cardio.name.toLowerCase())}</strong><small>After your lifting</small></span></div></section>`).join('')}</div><aside class="stack"><section class="card plan-note"><h3>A little left in the tank.</h3><p>RIR means the clean reps you could still do. It’s a useful guide, not a test. Choose lighter if you’re unsure.</p><table class="effort-table"><thead><tr><th>Week</th><th>Main</th><th>Accessory</th><th>Isolation</th></tr></thead><tbody>${[[1,'4','3–4','3'],[2,'3','3','2–3'],[3,'2–3','2','2'],[4,'2','1–2','1'],[5,'Easy','Easy','Easy']].map(r => `<tr class="${r[0]===state.settings.week?'current':''}">${r.map((c,i)=>`<td>${i===0?'0':''}${c}</td>`).join('')}</tr>`).join('')}</tbody></table></section><section class="card plan-note"><h3>Progress, one rep at a time.</h3><p>Work within the rep range. When every prescribed set reaches the top with controlled technique, try the next available load and return to the bottom of the range.</p><div class="rule"></div><p>Partial sets, changed prescriptions and hard technique days keep the load steady. Week five uses fewer sets and easier loads. A new block keeps your history.</p></section><section class="card plan-note"><div class="between"><h3>Work across the week.</h3><span class="pill">W${state.settings.week}</span></div><p>Planned direct sets, including optional Engine. Warm-ups aren’t counted.</p>${volume.map(v=>`<div class="volume-row"><span>${esc(v.muscle)}</span><div class="volume-bar"><span style="width:${v.sets/max*100}%"></span></div><strong class="number">${v.sets}</strong></div>`).join('')}</section><section class="card plan-note"><h3>Make room for a walk.</h3><p>The four gym days provide 74 cardio minutes. Add walks or the optional Engine day to work toward your ${state.settings.cardioGoal}-minute goal.</p><button class="text-button" data-action="log-cardio" style="margin-top:13px">Log a walk${icon('arrow','icon-sm')}</button></section></aside></div>`;
}
function eligibleSeries() {
  const map = new Map();
  for (const s of [...state.sessions].filter(s=>s.status==='finished'&&s.week!==5).sort((a,b)=>a.started-b.started)) for (const e of s.exercises) {
    const ex=exerciseFor(e); if(ex.category!=='main'||ex.mode!=='load')continue;
    const vals=e.sets.filter(r=>r.status==='done').map(r=>estimate1RM(r.kg,r.reps)).filter(v=>v!==null);if(!vals.length)continue;
    const key=`${e.exerciseId}:${e.equipmentId}`;if(!map.has(key))map.set(key,{exercise:ex,points:[]});map.get(key).points.push({date:s.date,value:Math.max(...vals)});
  }
  return [...map.values()];
}
function renderProgress() {
  const finished=state.sessions.filter(s=>s.status==='finished').sort((a,b)=>b.started-a.started), totalSets=finished.reduce((n,s)=>n+workCount(s),0), minutes=weekCardio();
  const series=eligibleSeries();
  return `<div class="stat-grid"><section class="card stat-card"><span class="eyebrow">Sessions logged</span><strong>${finished.length}</strong><p>Every visit is a step forward.</p></section><section class="card stat-card"><span class="eyebrow">Working sets</span><strong>${totalSets}</strong><p>Good reps, on the record.</p></section><section class="card stat-card"><span class="eyebrow">This week’s cardio</span><strong>${minutes}<span class="tiny muted"> min</span></strong><p>${Math.max(0,state.settings.cardioGoal-minutes)} minutes to your goal.</p></section></div><div class="content-grid"><div class="stack"><div><div class="section-label"><h2>Your training history</h2><span class="eyebrow">The work adds up</span></div><section class="card">${finished.length ? finished.map(s=>`<button class="history-row" data-action="history" data-id="${s.id}"><div><h3>${esc(dayFor(s.day).label)}</h3><p>${formatDate(s.date,{weekday:'short',day:'numeric',month:'short'})} · Block ${s.block}, week ${s.week}</p></div><div class="history-summary"><span class="pill ${s.complete?'green':''}">${workCount(s)}/${plannedCount(s)} sets</span>${icon('right')}</div></button>`).join('') : `<div class="empty"><div class="empty-icon">${icon('progress')}</div><h2>Your story starts here.</h2><p>Finish your first session and this becomes a record of the work you’ve put in.</p><button class="button" data-action="tab" data-tab="today">Go to your workout${icon('arrow','icon-sm')}</button></div>`}</section></div>${series.length ? `<div><div class="section-label"><h2>Estimated strength trends</h2><span class="eyebrow">Same lift. Same setup.</span></div><div class="stack">${series.map(renderChart).join('')}</div><p class="tiny muted" style="margin-top:12px;line-height:1.6">Epley estimate from work sets of 1–12 reps. Reps in reserve and technique affect comparisons. Deloads are omitted.</p></div>` : ''}</div><aside class="stack"><section class="card cardio-card"><h3 class="rail-title between">This week’s engine${icon('heart')}</h3><div class="cardio-ring-wrap">${ring(minutes,state.settings.cardioGoal)}<div class="cardio-copy"><strong>${Math.max(0,state.settings.cardioGoal-minutes)} min</strong><p>remaining to your goal</p></div></div><button class="button secondary full" data-action="log-cardio">${icon('plus')}Log cardio or a walk</button><div class="cardio-stretch"><span>Actual minutes · Mon–Sun</span><span>${state.settings.cardioStretch} stretch</span></div></section>${state.activities.length?`<section class="card plan-note"><h3>Outside the weight room.</h3>${[...state.activities].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<div class="history-setline"><span>${esc(a.name)}<br><small>${formatDate(a.date)}</small></span><span>${a.minutes} min <button class="text-button" data-action="delete-activity" data-id="${a.id}" aria-label="Delete ${esc(a.name)} on ${a.date}">${icon('close','icon-sm')}</button></span></div>`).join('')}</section>`:''}<section class="card plan-note"><h3>Progress has a few forms.</h3><p>More reps. Better control. Showing up on a difficult day. A graph only tells part of the story.</p></section></aside></div>`;
}
function renderChart(series) {
  const pts=series.points, values=pts.map(p=>p.value), low=Math.min(...values)*.9, high=Math.max(...values)*1.1, last=pts.at(-1).value, change=last-pts[0].value;
  const coords=pts.map((p,i)=>`${pts.length===1?150:10+i/(pts.length-1)*280},${110-(p.value-low)/(high-low)*90}`);
  return `<section class="card chart-card"><div class="between"><div><p class="small">${esc(series.exercise.name)}</p><p class="tiny muted" style="margin-top:5px">${esc(series.exercise.unitLabel)}</p></div><div class="chart-heading"><strong>${last.toFixed(1)}<span class="tiny muted"> kg</span></strong><p class="tiny ${change>0?'accent':'muted'}" style="margin-top:5px;text-align:right">${pts.length===1?'Your baseline':`${change>=0?'+':''}${change.toFixed(1)} kg since first`}</p></div></div><svg class="line-chart" viewBox="0 0 300 130" role="img" aria-label="Estimated strength: ${pts.map(p=>`${formatDate(p.date)} ${p.value.toFixed(1)} kg`).join(', ')}"><path d="M0 35h300M0 75h300M0 115h300" stroke="var(--line)" stroke-dasharray="3 5" fill="none"/><polyline points="${coords.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${coords.map(c=>{const[x,y]=c.split(',');return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--accent)"/>`;}).join('')}</svg><div class="chart-caption"><span>${formatDate(pts[0].date)}</span><span>${pts.length===1?'1 session':formatDate(pts.at(-1).date)}</span></div></section>`;
}
function renderSettings() {
  return `<div class="settings-grid"><div class="stack"><section class="card settings-card"><h3>A space that feels right.</h3><p>Small preferences for your time in the gym.</p><div class="setting-row"><div class="setting-copy"><strong>Appearance</strong><p>Match your surroundings.</p></div><select data-field="theme" aria-label="Appearance">${['light','dark','auto'].map(t=>`<option value="${t}" ${state.settings.theme===t?'selected':''}>${t==='auto'?'System':t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div><div class="setting-row"><div class="setting-copy"><strong>Rest timer sound</strong><p>A gentle cue when your rest is up.</p></div><button class="switch ${state.settings.sound?'on':''}" role="switch" aria-checked="${state.settings.sound}" aria-label="Rest timer sound" data-action="toggle-setting" data-key="sound"></button></div><div class="setting-row"><div class="setting-copy"><strong>Keep screen awake</strong><p>During a visible, active workout, when supported.</p></div><button class="switch ${state.settings.awake?'on':''}" role="switch" aria-checked="${state.settings.awake}" aria-label="Keep screen awake" data-action="toggle-setting" data-key="awake"></button></div><div class="setting-row"><div class="setting-copy"><strong>Make room on your Home Screen</strong><p>Your notebook, one tap away.</p></div><button class="text-button" data-action="install">How to${icon('arrow','icon-sm')}</button></div></section><section class="card settings-card"><h3>Your training block.</h3><p>Advancing the plan keeps every previous session intact.</p><div class="backup-info">${icon('layers')}Block ${state.settings.block} · Week ${state.settings.week} of 5</div><div class="button-row"><button class="button secondary" data-action="next-week">${state.settings.week===5?'Start next block':'Start next week'}${icon('arrow','icon-sm')}</button><button class="button ghost" data-action="next-block">New block</button></div><div class="rule"></div><div class="setting-row" style="border:0;padding:0"><div class="setting-copy"><strong>Weekly cardio goal</strong><p>Actual minutes. A personal time target.</p></div><select data-field="cardioGoal" aria-label="Weekly cardio goal">${[90,120,150,180,210,240,300].map(n=>`<option value="${n}" ${state.settings.cardioGoal===n?'selected':''}>${n} min</option>`).join('')}</select></div></section><section class="card settings-card"><h3>Your equipment.</h3><p>Make the numbers match your gym. Each different setup keeps its own history.</p><button class="button secondary" data-action="equipment">Set bar weight & load steps${icon('arrow','icon-sm')}</button></section></div><div class="stack"><section class="card settings-card"><h3>Keep the work you put in.</h3><p>Your training lives on this device. Export a JSON backup to keep a copy somewhere safe.</p><div class="backup-info">${icon('shield')}<span>${state.settings.lastExport ? `Last export: ${new Date(state.settings.lastExport).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}` : 'Your first backup is still ahead of you.'}</span></div><div class="button-row"><button class="button" data-action="export-json">${icon('download','icon-sm')}Export backup</button><button class="button secondary" data-action="export-csv">Export sets as CSV</button></div><div class="rule"></div><div class="setting-row" style="border:0;padding:0"><div class="setting-copy"><strong>Restore a notebook</strong><p>Preview a JSON backup before replacing this device’s data.</p></div><button class="text-button" data-action="restore">Choose file${icon('upload','icon-sm')}</button></div></section><section class="card settings-card"><h3>Simple by design.</h3><p>A personal notebook for four days of strength, an optional engine day, and progress that feels sustainable.</p><div class="setting-row"><div class="setting-copy"><strong>Works offline</strong><p>Open online once to prepare the app. Videos need a connection.</p></div>${icon('check','icon-sm')}</div><div class="setting-row"><div class="setting-copy"><strong>Honest rest timer</strong><p>Elapsed time recovers after lock. iPhone sound is best while the app stays open.</p></div>${icon('clock','icon-sm')}</div><div class="setting-row"><div class="setting-copy"><strong>Starter programme</strong><p>Reconstructed from your brief. Exercise choices and loads stay editable.</p></div>${icon('plan','icon-sm')}</div><div class="settings-footer"><span class="wordmark">HIERRO</span><span>Version ${APP_VERSION} · Made for the work.</span></div></section></div></div>`;
}
function renderTimer() {
  const host=document.querySelector('#timer-host');if(!host)return;
  if(!state.rest){host.innerHTML='';delete host.dataset.timerKey;document.body.classList.remove('has-timer');return;}
  const r=state.rest,seconds=Math.max(0,Math.ceil((r.endsAt-Date.now())/1000)),session=state.sessions.find(s=>s.id===r.sessionId);
  if(!session){state.rest=null;host.innerHTML='';delete host.dataset.timerKey;document.body.classList.remove('has-timer');if(!storageBlocked)persist();return;}
  const next=nextPending(session,r.exerciseIndex,r.setIndex); const nextLabel=next?`${exerciseFor(session.exercises[next[0]]).name} · set ${next[1]+1}`:'Your cardio or finish';
  const timerKey=`${r.sessionId}:${r.exerciseIndex}:${r.setIndex}`;
  if(host.dataset.timerKey!==timerKey||!host.querySelector('.timer')){
    host.innerHTML='<section class="timer" aria-label="Rest timer"><span class="timer-number" aria-live="off"></span><div class="timer-copy"><strong></strong><small></small></div><div class="timer-actions"><button data-action="timer-add">+30s</button><button data-action="timer-skip">Skip</button></div></section>';
    host.dataset.timerKey=timerKey;
  }
  // Updating text preserves focused timer buttons and never replaces set inputs.
  host.querySelector('.timer').classList.toggle('expired',seconds===0);
  host.querySelector('.timer-number').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  host.querySelector('.timer-copy strong').textContent=seconds===0?'Ready when you are.':'Take a breath.';
  host.querySelector('.timer-copy small').textContent=`Next: ${nextLabel}`;
  host.querySelector('[data-action="timer-skip"]').textContent=seconds===0?'Done':'Skip';
  document.body.classList.add('has-timer');
  if(seconds===0&&alarmedDeadline!==r.endsAt){alarmedDeadline=r.endsAt;if(document.visibilityState==='visible')beep();}
}
function nextPending(session,ei,si) {
  const day=dayFor(session.day),slot=day.slots.find(s=>s.id===session.exercises[ei]?.slotId);
  if(slot?.superset){const partner=session.exercises.findIndex(e=>e.slotId!==slot.id&&day.slots.find(s=>s.id===e.slotId)?.superset===slot.superset&&e.sets.some(r=>r.status==='pending'));if(partner>=0)return[partner,session.exercises[partner].sets.findIndex(r=>r.status==='pending')];}
  if(session.exercises[ei]?.sets[si+1]?.status==='pending')return[ei,si+1];
  for(let i=ei+1;i<session.exercises.length;i++){const j=session.exercises[i].sets.findIndex(s=>s.status==='pending');if(j>=0)return[i,j];}
  for(let i=0;i<session.exercises.length;i++){const j=session.exercises[i].sets.findIndex(s=>s.status==='pending');if(j>=0)return[i,j];}
  return null;
}
function beep() {
  if(!state.settings.sound)return;
  try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=660;gain.gain.setValueAtTime(0,audio.currentTime);gain.gain.linearRampToValueAtTime(.12,audio.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.5);osc.start();osc.stop(audio.currentTime+.5);}catch{}
  if(navigator.vibrate)navigator.vibrate([100,60,100]);
}
function unlockAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}}
async function awake(){try{if(state.settings.awake&&active()&&document.visibilityState==='visible'&&navigator.wakeLock){wakeLock=await navigator.wakeLock.request('screen');}else if(wakeLock){await wakeLock.release();wakeLock=null;}}catch{}}
function makeRecord(slot,exercise,week) {
  const adjusted=configuredExercise(exercise);
  const equipmentId=equipmentIdFor(exercise);
  const prescription={...getPrescription(slot,adjusted,week),block:state.settings.block}; const advice=suggest({exercise:adjusted,prescription,history:historyFor(exercise.id,equipmentId,slot.id)});
  return{slotId:slot.id,exerciseId:exercise.id,equipmentId,snapshot:adjusted,prescription,sets:Array.from({length:prescription.sets},()=>({id:id(),kg:['bodyweight','time','distance'].includes(exercise.mode)?null:(advice.kg??(typeof adjusted.barWeight==='number'?adjusted.barWeight:exercise.mode==='added'?0:null)),reps:null,status:'pending'}))};
}
function start() {
  if(storageBlocked){showRecovery();return;}
  if(active()){ui.day=active().day;ui.expanded=new Set([0]);ui.summary=null;shell();return;}
  const day=currentDay(),existing=state.sessions.find(s=>s.day===day.id&&s.date===localDate());
  if(existing){showHistory(existing.id);return;}
  const session={id:id(),day:day.id,date:localDate(),block:state.settings.block,week:state.settings.week,programmeVersion:PROGRAM_VERSION,started:Date.now(),finished:null,status:'active',complete:false,note:'',exercises:day.slots.map(slot=>makeRecord(slot,chosenExercise(slot),state.settings.week)),cardio:{name:state.settings.week===5&&day.cardio.kind==='intervals'?'Easy cardio':day.cardio.name,minutes:day.cardio.minutes,heartRate:null,done:false}};
  state.sessions.push(session);meaningful();persist();ui.expanded=new Set([0]);ui.summary=null;unlockAudio();awake();shell();toast('Your session is ready. Start light and settle in.');
}
function completeSet(ei,si) {
  const s=active();if(!s)return;const record=s.exercises[ei],set=record.sets[si],ex=exerciseFor(record);
  if(set.status==='done'){set.status='pending';delete set.completedAt;if(state.rest?.sessionId===s.id&&state.rest.exerciseIndex===ei&&state.rest.setIndex===si)state.rest=null;persist();shell();return;}
  const repsInput=document.querySelector(`[data-field="set"][data-index="${ei}"][data-set="${si}"][data-key="reps"]`);
  const kgInput=document.querySelector(`[data-field="set"][data-index="${ei}"][data-set="${si}"][data-key="kg"]`);
  const reps=repsInput?parseNumber(repsInput.value):set.reps,kg=kgInput?parseNumber(kgInput.value):set.kg;
  if(reps===null||!Number.isFinite(reps)||reps<0||(!['time','distance'].includes(ex.mode)&&!Number.isInteger(reps))){toast(`Enter ${record.prescription.unit==='reps'?'whole reps':record.prescription.unit==='sec'?'seconds':'metres'} first.`);repsInput?.focus();return;}
  if(!['bodyweight','time','distance'].includes(ex.mode)&&(kg===null||!Number.isFinite(kg)||kg<0)){toast('Enter the load before completing this set.');kgInput?.focus();return;}
  if(typeof ex.barWeight==='number'&&kg<ex.barWeight){toast(`Total load includes this ${ex.barWeight} kg bar. Swap to a lighter variant if needed.`);kgInput?.focus();return;}
  set.reps=reps;set.kg=kg;
  set.status='done';set.completedAt=Date.now();s.updated=Date.now();unlockAudio();
  const slot=dayFor(s.day).slots.find(slot=>slot.id===record.slotId);const firstInPair=slot?.superset&&dayFor(s.day).slots.find(item=>item.superset===slot.superset)?.id===record.slotId;
  if(!firstInPair){const duration=record.prescription.rest;state.rest={sessionId:s.id,exerciseIndex:ei,setIndex:si,endsAt:Date.now()+duration*1000,startedAt:Date.now(),duration};alarmedDeadline=null;}else{state.rest=null;const next=nextPending(s,ei,si);if(next)ui.expanded.add(next[0]);}
  if(record.sets.every(r=>r.status!=='pending')){ui.expanded.delete(ei);const next=nextPending(s,ei,si);if(next)ui.expanded.add(next[0]);}
  persist();shell();
}
function finish(partialConfirmed=false) {
  const s=active();if(!s)return;const complete=s.exercises.every(e=>e.sets.every(r=>r.status==='done'||r.skipReason==='swap'));
  if(!complete&&!partialConfirmed){sheet('Finish what you did.','A partial session is still progress.',`<p>You’ve recorded <strong>${workCount(s)} of ${plannedCount(s)} working sets</strong>. Save this visit and move forward, or keep going.</p><div class="button-row"><button class="button" data-action="finish-partial">Save partial session</button><button class="button secondary" data-action="close">Keep training</button></div>`);return;}
  s.durationOverride=sessionMinutes(s);delete s.resumedAt;s.status='finished';s.finished=Date.now();s.complete=complete;s.updated=Date.now();state.rest=null;persist();awake();closeSheet();ui.summary=s;ui.day=nextDay().id;ui.expanded.clear();shell();window.scrollTo({top:0,behavior:'smooth'});
}
function sessionRecords(session) {
  const list=[];
  if(session.week===5)return list;
  for(const e of session.exercises){const ex=exerciseFor(e);if(ex.mode!=='load')continue;
    const prior=state.sessions.filter(s=>s.id!==session.id&&s.started<session.started&&s.status==='finished').flatMap(s=>s.exercises.filter(r=>r.exerciseId===e.exerciseId&&r.equipmentId===e.equipmentId).flatMap(r=>r.sets.filter(t=>t.status==='done')));
    if(!prior.length)continue;
    const record=e.sets.find(r=>r.status==='done'&&r.kg!==null&&prior.some(t=>t.kg===r.kg)&&r.reps>Math.max(...prior.filter(t=>t.kg===r.kg).map(t=>t.reps)));
    if(record)list.push(`${ex.name}: ${record.reps} reps at ${record.kg} ${ex.unitLabel}`);
  }return list.slice(0,4);
}
function sheet(title,subtitle,body,eyebrow='YOUR NOTEBOOK') {
  dialog.innerHTML=`<header class="sheet-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="sheet-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></header><div class="sheet-body">${body}</div>`;if(!dialog.open)dialog.showModal();
}
function closeSheet(){if(dialog.open)dialog.close();}
function showSwap(ei) {
  const day=currentDay(),session=active()?.day===day.id?active():null,record=session?.exercises[ei],slot=day.slots.find(s=>s.id===(record?.slotId||day.slots[ei]?.id));if(!slot)return;
  const current=record?.exerciseId||chosenExercise(slot).id,ids=[slot.exerciseId,...slot.alternatives];
  sheet('Same slot. A different way.','Each variation keeps its own training history.',`${record?.sets.some(s=>s.status==='done')?'<p>Recorded sets stay as they are. The new exercise receives only the remaining sets.</p>':''}${ids.map(key=>{const ex=EXERCISES[key];return `<button class="swap-option ${key===current?'selected':''}" data-action="choose-swap" data-index="${ei}" data-exercise="${key}"><span class="exercise-names"><strong>${esc(ex.name)}</strong><small>${esc(ex.spanish)} · ${esc(ex.unitLabel)}</small></span>${key===current?icon('check','icon-sm'):icon('arrow','icon-sm')}</button>`;}).join('')}`,'EXERCISE OPTIONS');
}
function chooseSwap(ei,exerciseId) {
  const day=currentDay(),s=active()?.day===day.id?active():null,slot=day.slots.find(t=>t.id===(s?.exercises[ei]?.slotId||day.slots[ei]?.id));if(!slot)return;
  state.settings.swaps[slot.id]=exerciseId;
  if(s){const old=s.exercises[ei];if(old.exerciseId===exerciseId){closeSheet();return;}const fresh=makeRecord(slot,EXERCISES[exerciseId],s.week),done=old.sets.some(r=>r.status==='done');
    if(done){const remaining=old.sets.filter(r=>r.status==='pending').length;if(!remaining){toast('All sets in this slot are already recorded. Future sessions will use your swap.');}else{old.sets.filter(r=>r.status==='pending').forEach(r=>{r.status='skipped';r.skipReason='swap';});old.techniqueIssue=true;fresh.prescription.sets=remaining;fresh.sets=fresh.sets.slice(0,remaining);fresh.techniqueIssue=true;s.exercises.splice(ei+1,0,fresh);ui.expanded=new Set([ei+1]);}}
    else{s.exercises[ei]=fresh;ui.expanded=new Set([ei]);}
  }persist();closeSheet();shell();toast('Exercise updated. Its history stays separate.');
}
function showWarmup(ei) {
  const s=active()?.day===ui.day?active():null,record=s?.exercises[ei],slot=currentDay().slots.find(item=>item.id===(record?.slotId||currentDay().slots[ei]?.id));if(!slot)return;
  const ex=record?exerciseFor(record):configuredExercise(chosenExercise(slot));
  const kg=record?.sets.find(r=>r.kg!==null)?.kg??suggest({exercise:ex,prescription:record?.prescription||{...getPrescription(slot,ex,state.settings.week),block:state.settings.block},history:historyFor(ex.id,record?.equipmentId||equipmentIdFor(ex),slot.id,s?.started??Infinity)}).kg;
  const rows=warmupSets(ex,kg);
  sheet('Ease into the work.',esc(ex.name),`<p>Practice the movement first. These are warm-up sets and won’t count toward your working sets or records.</p>${ex.barWeight===null?'<div class="banner">Confirm your trap-bar weight in Settings before using total-load or plate calculations.</div>':''}${kg===null||kg===undefined?'<p>Enter a working load during your session to see an achievable ramp.</p>':rows.length?rows.map(row=>{const plates=typeof ex.barWeight==='number'?platesFor(row.kg,ex.barWeight):null;return `<div class="warmup-row"><div><strong>${row.kg} <small class="tiny">${esc(ex.unitLabel)}</small> × ${row.reps}</strong><p>${plates?`${ex.barWeight} kg bar · plates per side`:'Light practice set'}</p></div>${plates?`<div class="plates" aria-label="${plates.plates.join(', ')||'No'} plates per side">${plates.plates.map(p=>`<span class="plate p${Math.floor(p)}">${p}</span>`).join('')}<span class="bar-end"></span></div>`:''}</div>`;}).join(''):'<p>Use easy practice reps for this movement. Your working load is already near the equipment minimum, or this variation doesn’t use a weighted ramp.</p>'}<div class="button-row"><button class="button secondary full" data-action="close">Back to the workout</button></div>`,'WARM-UP SETS');
}
function logCardio() {
  sheet('A little movement adds up.','A walk, a ride, or time on your favourite machine.',`<form id="cardio-form"><label class="field"><span>Activity</span><select name="activity"><option value="Brisk walk">Brisk walk</option><option value="Hike">Hike</option><option value="Easy bike">Easy bike</option><option value="Steady cardio">Steady cardio</option><option value="Intervals">Intervals</option></select></label><div class="field-row"><label class="field"><span>Minutes</span><input name="minutes" type="number" min="1" max="1440" step="1" value="30" required inputmode="numeric"></label><label class="field"><span>Date</span><input name="date" type="date" value="${localDate()}" required max="${localDate()}"></label></div><label class="field"><span>Average heart rate · optional</span><input name="heartRate" type="number" min="30" max="250" placeholder="bpm" inputmode="numeric"></label><button class="button full" type="submit">Save activity${icon('check','icon-sm')}</button></form>`,'YOUR ENGINE');
}
function showWeek() {
  sheet('Give your training a rhythm.',`Block ${state.settings.block}. Choosing a week changes future sessions; your active workout stays as it is.`,`<div class="week-options">${[1,2,3,4,5].map(w=>`<button class="week-option ${w===state.settings.week?'active':''}" data-action="set-week" data-week="${w}"><strong>0${w}</strong><small>${w===5?'Deload':w<=2?'Practice':'Build'}</small></button>`).join('')}</div><p>Weeks 1–2: learn the movements. Weeks 3–4: build gradually. Week 5: make room to recover.</p>`,'YOUR FIVE-WEEK BLOCK');
}
function showHistory(sessionId) {
  const s=state.sessions.find(s=>s.id===sessionId);if(!s)return;
  sheet(esc(dayFor(s.day).label),`${formatDate(s.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · Block ${s.block}, week ${s.week}`,`<div class="between"><span class="pill ${s.complete?'green':''}">${s.complete?'Complete':'Partial'} · ${workCount(s)} / ${plannedCount(s)} sets</span><span class="tiny muted">${elapsed(s)} min</span></div>${s.exercises.map(e=>`<section class="history-exercise"><h3>${esc(exerciseFor(e).name)}</h3><p class="tiny muted">${esc(exerciseFor(e).unitLabel)} · ${esc(e.prescription.rir)} reps left</p>${e.sets.map((r,i)=>`<div class="history-setline"><span>Set ${i+1}</span><span>${r.status==='done'?`${r.kg!==null?`${r.kg} × `:''}${r.reps} ${e.prescription.unit}`:r.status==='skipped'?'Skipped':'Not recorded'}</span></div>`).join('')}</section>`).join('')}${s.cardio?.done?`<section class="history-exercise"><h3>${esc(s.cardio.name)}</h3><p class="small muted">${s.cardio.minutes} minutes${s.cardio.heartRate?` · ${s.cardio.heartRate} bpm`:''}</p></section>`:''}${s.note?`<p style="margin-top:18px;white-space:pre-wrap">${esc(s.note)}</p>`:''}<div class="button-row"><button class="button secondary" data-action="reopen" data-id="${s.id}">${s.complete?'Edit session':'Continue remaining work'}${icon('arrow','icon-sm')}</button><button class="button ghost danger" data-action="delete-session" data-id="${s.id}">Delete</button></div>`,'IN THE NOTEBOOK');
}
function confirmAction(title,copy,action,label='Continue',extra='') {sheet(title,'',`<p>${copy}</p><div class="button-row"><button class="button" data-action="${action}" ${extra}>${label}</button><button class="button secondary" data-action="close">Cancel</button></div>`);}
function showRecovery(){sheet('Keep your notebook safe.','No damaged data will be silently overwritten.',`<p>${esc(saveError||'A save did not complete. Keep this window open and export your current work before retrying.')}</p><div class="button-row"><button class="button" data-action="export-json">Export current work</button>${loaded.raw?'<button class="button secondary" data-action="export-raw">Export original data</button>':''}<button class="button secondary" data-action="restore">Restore a JSON backup</button>${externalChange?'<button class="button secondary" data-action="reload">Reload latest notebook</button>':'<button class="button ghost" data-action="retry-save">Retry save</button>'}</div>`);}
function showEquipment(){sheet('Make the numbers yours.','A different bar or load convention starts a separate comparison history.',`<form id="equipment-form"><label class="field"><span>Exercise setup</span><select name="exercise" id="equipment-exercise">${Object.values(EXERCISES).filter(e=>e.mode==='load'||e.mode==='assistance').map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><label class="field"><span>Available load increase · kg</span><input name="increment" type="number" inputmode="decimal" min="0.25" max="50" step="0.25" value="2.5" required><small>For dumbbells, this is the increase per hand.</small></label><label class="field"><span>Bar weight · kg, where applicable</span><input name="barWeight" type="number" inputmode="decimal" min="0" max="50" step="0.5" value="20"><small>Leave blank for machines and dumbbells. Confirm the trap-bar mass from its label.</small></label><button class="button full" type="submit">Save equipment setup${icon('check','icon-sm')}</button></form>`,'YOUR EQUIPMENT');syncEquipmentForm();}
function syncEquipmentForm(){const form=document.querySelector('#equipment-form');if(!form)return;const ex=EXERCISES[form.elements.exercise.value],profile=state.settings.equipment?.[ex.id]||{};form.elements.increment.value=profile.increment??ex.increment;form.elements.barWeight.value=profile.barWeight??ex.barWeight??'';}
function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone;}
function isIOS(){return /iPhone|iPad|iPod/.test(navigator.userAgent);}
function showInstall(){sheet('Your notebook. One tap away.',standalone()?'Hierro is already running as an app.':'Install Hierro for a focused gym experience.',`<p>${isIOS()?'In Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>. Open Hierro from its new icon.':'Use your browser’s install option or “Add to Home Screen.” On iPhone, open in Safari, tap Share, then Add to Home Screen.'}</p><p>Open once while online to prepare offline use. Remember to export a backup before changing device or browser.</p><button class="button full" data-action="dismiss-install">Got it</button>`,'TAKE HIERRO WITH YOU');}

async function action(event) {
  const button=event.target.closest('[data-action]');if(!button)return;const a=button.dataset.action,ei=Number(button.dataset.index),si=Number(button.dataset.set),session=active();
  const readOnlyActions=['tab','day','exercise','warmup-toggle','dismiss-summary','history','warmup','close','recovery','export-json','export-csv','export-raw','restore','restore-confirm','install','retry-save','reload'];
  if(storageBlocked&&!readOnlyActions.includes(a)){event.preventDefault();showRecovery();return;}
  switch(a){
    case'tab':ui.tab=button.dataset.tab;ui.summary=null;shell();window.scrollTo(0,0);break;
    case'day':ui.day=button.dataset.day;ui.expanded.clear();ui.warmup=false;ui.summary=null;shell();break;
    case'exercise':ui.expanded.has(ei)?ui.expanded.delete(ei):ui.expanded.add(ei);shell();break;
    case'warmup-toggle':ui.warmup=!ui.warmup;shell();break;
    case'start':case'resume':start();break;
    case'complete':completeSet(ei,si);break;
    case'cardio-done':if(session?.cardio){
      const c=session.cardio;
      if(c.done)c.done=false;
      else{
        const minutesInput=document.querySelector('[data-field="cardio-minutes"]'),hrInput=document.querySelector('[data-field="cardio-hr"]');
        const minutes=minutesInput?parseNumber(minutesInput.value):c.minutes,heartRate=hrInput?parseNumber(hrInput.value):c.heartRate;
        if(minutes===null||!Number.isFinite(minutes)||minutes<=0){toast('Enter actual cardio minutes first.');minutesInput?.focus();break;}
        if(heartRate!==null&&(!Number.isFinite(heartRate)||heartRate<0)){toast('Enter a valid average heart rate or leave it blank.');hrInput?.focus();break;}
        c.minutes=minutes;c.heartRate=heartRate;c.done=true;meaningful();
      }
      session.updated=Date.now();persist();shell();
    }break;
    case'skip':if(session){session.exercises[ei].sets.filter(s=>s.status==='pending').forEach(s=>s.status='skipped');persist();shell();}break;
    case'finish':finish();break;
    case'finish-partial':finish(true);break;
    case'dismiss-summary':ui.summary=null;shell();break;
    case'discard':confirmAction('Leave this session behind?','This removes the unfinished session and its recorded sets. You can export first in Settings.','discard-confirm','Discard session');break;
    case'discard-confirm':if(session){state.sessions=state.sessions.filter(s=>s.id!==session.id);state.rest=null;persist();closeSheet();awake();ui.expanded.clear();shell();}break;
    case'timer-add':if(state.rest){state.rest.endsAt=Math.max(Date.now(),state.rest.endsAt)+30000;alarmedDeadline=null;persist();renderTimer();}break;
    case'timer-skip':state.rest=null;persist();renderTimer();break;
    case'swap':showSwap(ei);break;
    case'choose-swap':chooseSwap(ei,button.dataset.exercise);break;
    case'warmup':showWarmup(ei);break;
    case'log-cardio':logCardio();break;
    case'week':showWeek();break;
    case'set-week':state.settings.week=Number(button.dataset.week);persist();ui.day=active()?.day||nextDay().id;ui.expanded.clear();closeSheet();shell();break;
    case'next-week':confirmAction('Ready for the next chapter?',`This moves future sessions to ${state.settings.week===5?'week 1 of a new block':`week ${state.settings.week+1}`}. Your recorded and active sessions keep their prescriptions.`,'advance-week','Start next week');break;
    case'advance-week':if(state.settings.week===5){state.settings.block++;state.settings.week=1;}else state.settings.week++;persist();ui.day=active()?.day||nextDay().id;closeSheet();shell();break;
    case'next-block':confirmAction('A fresh block. Same notebook.','Start week one of the next block. Your history and building loads remain available.','advance-block','Start next block');break;
    case'advance-block':state.settings.block++;state.settings.week=1;persist();ui.day=active()?.day||nextDay().id;closeSheet();shell();break;
    case'toggle-setting':state.settings[button.dataset.key]=!state.settings[button.dataset.key];if(button.dataset.key==='sound'){unlockAudio();if(state.settings.sound)beep();}persist();awake();shell();break;
    case'export-json':{const when=exportJSON(state);if(when){if(!storageBlocked){state.settings.lastExport=when;persist();}shell();toast('JSON export started. Keep the file somewhere safe.');}else toast('Export couldn’t start. Please try again.');break;}
    case'export-csv':toast(exportCSV(state)?'Your set history is ready to download.':'CSV export couldn’t start. Please try again.');break;
    case'restore':{
      const input=document.createElement('input');input.type='file';input.accept='.json,application/json';delete window.__hierroRestore;
      input.onchange=async()=>{
        const file=input.files[0];if(!file)return;
        try{
          const result=validateBackup(await file.text());
          if(!result.ok){sheet('This backup needs a check.','Your current notebook has not changed.',`<p class="sheet-error">${esc(result.error)}</p><button class="button secondary" data-action="close">Keep current data</button>`);return;}
          window.__hierroRestore=result.state;const s=result.summary;
          sheet('A notebook, ready to return.','Review before replacing the data on this device.',`<div class="backup-info">${icon('shield')}${s.sessions} sessions · ${s.activities} extra activities</div><p>${s.firstDate?`${formatDate(s.firstDate)} – ${formatDate(s.lastDate)}`:'An empty notebook'}${s.hasDraft?'<br>Includes an unfinished session.':''}</p>${s.exportedAt&&Number.isFinite(new Date(s.exportedAt).getTime())?`<p>Exported ${new Date(s.exportedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}.</p>`:''}<p>Restoring replaces your current notebook. Export your current work first if you want to keep both.</p><div class="button-row"><button class="button secondary" data-action="export-json">Export current</button><button class="button" data-action="restore-confirm">Replace and restore</button></div>`);
        }catch(error){sheet('This file couldn’t be read.','Your current notebook has not changed.',`<p class="sheet-error">${esc(error.message||'Choose the backup file again.')}</p><button class="button secondary" data-action="restore">Choose another file</button>`);}
      };input.click();break;
    }
    case'restore-confirm':if(window.__hierroRestore){const replacement=window.__hierroRestore,result=saveState(replacement);if(result.ok){state=replacement;storageBlocked=false;externalChange=false;saveError='';state.rest=null;alarmedDeadline=null;ui.summary=null;ui.day=active()?.day||nextDay().id;ui.expanded.clear();closeSheet();shell();awake();toast('Your notebook is back. Everything is in place.');delete window.__hierroRestore;}else{saveError=result.error;renderSaveError();toast(result.error);}}break;
    case'history':showHistory(button.dataset.id);break;
    case'reopen':{if(session&&session.id!==button.dataset.id){toast('Finish or discard the current session first.');break;}const s=state.sessions.find(s=>s.id===button.dataset.id);if(s){if(s.status!=='active'){s.durationOverride=sessionMinutes(s);s.resumedAt=Date.now();}s.status='active';s.finished=null;state.rest=null;ui.tab='today';ui.day=s.day;ui.summary=null;ui.expanded=new Set([0]);persist();closeSheet();shell();awake();}break;}
    case'delete-session':confirmAction('Remove this session?','Its sets, cardio and notes will be removed from this device.','delete-session-confirm','Delete session',`data-id="${button.dataset.id}"`);break;
    case'delete-session-confirm':state.sessions=state.sessions.filter(s=>s.id!==button.dataset.id);if(state.rest?.sessionId===button.dataset.id)state.rest=null;{const saved=persist();closeSheet();ui.summary=null;shell();awake();if(saved)toast('Session removed.');}break;
    case'delete-activity':confirmAction('Remove this activity?','Its minutes will also be removed from your weekly total.','delete-activity-confirm','Remove activity',`data-id="${button.dataset.id}"`);break;
    case'delete-activity-confirm':state.activities=state.activities.filter(a=>a.id!==button.dataset.id);persist();closeSheet();shell();break;
    case'correct-duration':{const s=state.sessions.find(s=>s.id===button.dataset.id);sheet('Time in the gym.','Correct a session that was accidentally left running.',`<form id="duration-form" data-id="${s.id}"><label class="field"><span>Session duration · minutes</span><input name="minutes" type="number" min="1" max="1440" value="${elapsed(s)}" required></label><button class="button full">Save duration</button></form>`);break;}
    case'equipment':showEquipment();break;
    case'install':showInstall();break;
    case'dismiss-install':state.settings.installDismissed=true;persist();closeSheet();shell();break;
    case'recovery':showRecovery();break;
    case'retry-save':if(storageBlocked){toast('Keep the original data. Restore a valid backup to recover.');}else if(persist()){closeSheet();shell();toast('Your notebook is saved.');}break;
    case'reload':location.reload();break;
    case'export-raw':{const blob=new Blob([loaded.raw||''],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`hierro-recovery-${localDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
    case'update':if(active()){toast('Finish your workout, then update from this banner.');}else if(waitingWorker&&persist()){waitingWorker.postMessage({type:'SKIP_WAITING'});}break;
    case'close':closeSheet();break;
  }
}
document.addEventListener('click',action);
document.addEventListener('input',event=>{
  const el=event.target,field=el.dataset.field,s=active();if(!field)return;
  if(storageBlocked){event.preventDefault();showRecovery();return;}
  if(field==='set'&&s){
    const ei=Number(el.dataset.index),si=Number(el.dataset.set),record=s.exercises[ei],set=record?.sets[si];if(!set)return;
    if(set.status==='done'){
      set.status='pending';delete set.completedAt;s.complete=false;
      const row=el.closest('.set-row'),button=row?.querySelector('.set-complete');row?.classList.remove('is-done');
      if(button){button.classList.remove('done');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`Complete ${exerciseFor(record).name} set ${si+1}`);}
      if(state.rest?.sessionId===s.id&&state.rest.exerciseIndex===ei&&state.rest.setIndex===si){state.rest=null;renderTimer();}
    }
    const value=parseNumber(el.value),whole=el.dataset.key==='reps'&&!['time','distance'].includes(exerciseFor(record).mode);
    const valid=value===null||(Number.isFinite(value)&&value>=0&&(!whole||Number.isInteger(value)));
    el.setAttribute('aria-invalid',String(!valid));el.setCustomValidity(valid?'':whole?'Enter whole reps, zero or more.':'Enter a number, zero or more.');
    if(valid)set[el.dataset.key]=value;
    s.updated=Date.now();persist();
  }
  if(field==='note'&&s){s.note=el.value;s.updated=Date.now();persist();}
  if(field==='cardio-minutes'&&s){const value=parseNumber(el.value);s.cardio.done=false;const button=document.querySelector('[data-action="cardio-done"]');if(button){button.classList.remove('done');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Complete cardio');}if(value===null)s.cardio.minutes=0;else if(Number.isFinite(value)&&value>=0)s.cardio.minutes=value;persist();}
  if(field==='cardio-hr'&&s){const value=parseNumber(el.value);if(value===null||(Number.isFinite(value)&&value>=0)){s.cardio.heartRate=value;persist();}}
});
document.addEventListener('change',event=>{
  const el=event.target,field=el.dataset.field;if(storageBlocked&&['theme','cardioGoal','effort'].includes(field)){event.preventDefault();showRecovery();return;}if(field==='theme'){state.settings.theme=el.value;persist();applyTheme();}
  if(field==='cardioGoal'){state.settings.cardioGoal=Number(el.value);state.settings.cardioStretch=Math.max(180,state.settings.cardioGoal);persist();shell();}
  if(field==='effort'&&active()){const record=active().exercises[Number(el.dataset.index)];if(el.value==='')delete record.effort;else record.effort=Number(el.value);persist();}
  if(el.id==='equipment-exercise')syncEquipmentForm();
});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['cardio-form','duration-form','equipment-form'].includes(form.id))return;event.preventDefault();
  if(storageBlocked){showRecovery();return;}
  if(!form.reportValidity())return;
  if(form.id==='cardio-form'){const data=new FormData(form),minutes=Number(data.get('minutes')),date=data.get('date'),name=data.get('activity'),hr=data.get('heartRate');if(!Number.isFinite(minutes)||minutes<=0||minutes>1440||!date)return;state.activities.push({id:id(),date,type:['Brisk walk','Hike'].includes(name)?'walk':'cardio',name,minutes,heartRate:hr?Number(hr):null});meaningful();const saved=persist();closeSheet();shell();if(saved)toast(`${minutes} minutes in the notebook. Nice work.`);}
  if(form.id==='duration-form'){const s=state.sessions.find(s=>s.id===form.dataset.id),minutes=Number(form.elements.minutes.value);if(!s||!Number.isFinite(minutes)||minutes<1||minutes>1440)return;s.durationOverride=minutes;if(s.status==='active'&&s.resumedAt)s.resumedAt=Date.now();const saved=persist();closeSheet();shell();if(saved)toast('Session duration updated.');}
  if(form.id==='equipment-form'){const data=new FormData(form),key=data.get('exercise'),bar=data.get('barWeight'),step=Number(data.get('increment'));state.settings.equipment||={};state.settings.equipment[key]={increment:step,...(bar!==''?{barWeight:Number(bar)}:{}),version:id()};const saved=persist();closeSheet();if(saved)toast('Equipment saved for future sessions.');}
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSheet();}});
document.addEventListener('visibilitychange',()=>{renderTimer();awake();});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){storageBlocked=true;externalChange=true;saveError='Your notebook changed in another window. Export any work here, then reload before editing.';shell();}});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
setInterval(()=>{if(document.visibilityState==='visible')renderTimer();},1000);
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').then(reg=>{if(reg.waiting){waitingWorker=reg.waiting;shell();}reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){waitingWorker=worker;shell();}});});}).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(waitingWorker&&!active())location.reload();});}
ui.day=active()?.day||nextDay().id;
if(active())ui.expanded.add(Math.max(0,active().exercises.findIndex(e=>e.sets.some(s=>s.status==='pending'))));
shell();awake();
