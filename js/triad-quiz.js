// Triad Quiz: memorize notes in triads

const NOTE_DISPLAY_NAMES = [
  'C', 'C♯\nD♭', 'D', 'D♯\nE♭', 'E', 'F', 'F♯\nG♭', 'G', 'G♯\nA♭', 'A', 'A♯\nB♭', 'B'
];

const TRIAD_INTERVALS = {
  '': [0, 4, 7],       // major
  'm': [0, 3, 7],      // minor
  '°': [0, 3, 6],      // diminished
  '+': [0, 4, 8]       // augmented
};

const tqState = {
  mode: 'random',         // 'random' or 'keyDrill'
  drillScaleKey: 'major',
  drillModeIndex: 0,
  drillRoot: 0,           // root note (0-11)
  drillDegreeIndex: 0,    // current chord in key drill cycle
  drillOrder: [],         // shuffled order for key drill

  currentChord: null,     // { root, quality, name, thirdNote, fifthNote }
  foundThird: false,
  foundFifth: false,

  streak: 0,
  bestStreak: 0,
  strikes: 0,
  roundPerfect: true,
  round: 0,
  roundStartTime: null,
  bestRoundTime: null,
  timerInterval: null,
  active: false           // is the quiz view active
};

// Scale/mode options for the drill dropdowns
function getTqScaleOptions() {
  const options = [];
  SCALE_DEFS.major.modes.forEach((name, i) => {
    options.push({ label: name, scaleKey: 'major', modeIndex: i });
  });
  SCALE_DEFS.harmonicMinor.modes.forEach((name, i) => {
    options.push({ label: name, scaleKey: 'harmonicMinor', modeIndex: i });
  });
  return options;
}

function tqPickChord() {
  if (tqState.mode === 'keyDrill') {
    return tqPickKeyDrillChord();
  }
  return tqPickRandomChord();
}

function tqPickRandomChord() {
  // Pick a random diatonic chord from a random key
  const scaleKey = Math.random() < 0.5 ? 'major' : 'harmonicMinor';
  const modeIndex = Math.floor(Math.random() * 7);
  const root = Math.floor(Math.random() * 12);
  const degree = Math.floor(Math.random() * 7);

  return tqBuildChord(scaleKey, modeIndex, root, degree);
}

function tqPickKeyDrillChord() {
  // Cycle through all 7 degrees in shuffled order
  if (tqState.drillOrder.length === 0 || tqState.drillDegreeIndex >= tqState.drillOrder.length) {
    tqState.drillOrder = [0, 1, 2, 3, 4, 5, 6];
    // Shuffle
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tqState.drillOrder[i], tqState.drillOrder[j]] = [tqState.drillOrder[j], tqState.drillOrder[i]];
    }
    tqState.drillDegreeIndex = 0;
  }

  const degree = tqState.drillOrder[tqState.drillDegreeIndex];
  tqState.drillDegreeIndex++;

  return tqBuildChord(tqState.drillScaleKey, tqState.drillModeIndex, tqState.drillRoot, degree);
}

function tqBuildChord(scaleKey, modeIndex, rootNote, degree) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const triad = buildTriad(intervals, degree);
  const chordRootSemitone = (rootNote + triad.rootSemitones) % 12;
  const chordRootName = NOTE_NAMES[chordRootSemitone];

  // Compute the actual 3rd and 5th notes
  const quality = triad.quality;
  const triadSemitones = TRIAD_INTERVALS[quality] || [0, 4, 7];
  const thirdNote = (chordRootSemitone + triadSemitones[1]) % 12;
  const fifthNote = (chordRootSemitone + triadSemitones[2]) % 12;

  // Display name
  const name = chordRootName + quality;

  // Quality label for display
  const qualityLabels = { '': 'major', 'm': 'minor', '°': 'dim', '+': 'aug' };
  const qualityLabel = qualityLabels[quality] || '';

  return {
    root: chordRootSemitone,
    quality,
    qualityLabel,
    name,
    thirdNote,
    fifthNote,
    romanNumeral: triad.romanNumeral
  };
}

function tqNewRound() {
  tqState.foundThird = false;
  tqState.foundFifth = false;
  tqState.strikes = 0;
  tqState.roundPerfect = true;
  tqState.round++;

  tqState.currentChord = tqPickChord();
  tqRender();
  tqStartTimer();
  tqUpdateStrikesDisplay();
}

function tqRender() {
  const chord = tqState.currentChord;

  // Prompt
  const promptEl = document.getElementById('tq-prompt');
  promptEl.innerHTML = `<span class="tq-chord-name">${chord.name}</span><span class="tq-quality-label">${chord.qualityLabel}</span>`;

  // Note grid
  const gridEl = document.getElementById('tq-note-grid');
  gridEl.innerHTML = '';

  for (let i = 0; i < 12; i++) {
    const btn = document.createElement('button');
    btn.className = 'tq-note-btn';
    btn.dataset.note = i;

    const display = NOTE_DISPLAY_NAMES[i];
    if (display.includes('\n')) {
      const [top, bottom] = display.split('\n');
      btn.innerHTML = `<span class="note-name-top">${top}</span><span class="note-name-alt">${bottom}</span>`;
    } else {
      btn.textContent = display;
    }

    if (i === chord.root) {
      // Root is auto-selected
      btn.classList.add('root-selected');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => tqHandleNoteTap(i, btn));
    }

    gridEl.appendChild(btn);
  }

  // Feedback
  document.getElementById('tq-feedback').textContent = '';

  // Update streak
  document.getElementById('tq-streak').textContent = tqState.streak;
}

function tqHandleNoteTap(noteIndex, btn) {
  const chord = tqState.currentChord;
  if (tqState.foundThird && tqState.foundFifth) return;

  const isThird = noteIndex === chord.thirdNote && !tqState.foundThird;
  const isFifth = noteIndex === chord.fifthNote && !tqState.foundFifth;

  if (isThird || isFifth) {
    // Correct
    btn.classList.add('correct');
    btn.disabled = true;
    if (isThird) tqState.foundThird = true;
    if (isFifth) tqState.foundFifth = true;

    if (tqState.foundThird && tqState.foundFifth) {
      tqCompleteRound();
    }
  } else {
    // Wrong
    tqState.roundPerfect = false;
    tqState.strikes++;
    btn.classList.add('wrong');
    setTimeout(() => btn.classList.remove('wrong'), 400);
    tqUpdateStrikesDisplay();

    if (tqState.strikes >= 3) {
      tqStrikeOut();
    }
  }
}

function tqStrikeOut() {
  const chord = tqState.currentChord;
  const gridEl = document.getElementById('tq-note-grid');
  const btns = gridEl.querySelectorAll('.tq-note-btn');

  // Reveal correct answers
  btns.forEach(btn => {
    const n = parseInt(btn.dataset.note);
    if ((n === chord.thirdNote && !tqState.foundThird) || (n === chord.fifthNote && !tqState.foundFifth)) {
      btn.classList.add('revealed');
    }
    btn.disabled = true;
  });

  // Reset after delay
  setTimeout(() => {
    tqState.foundThird = false;
    tqState.foundFifth = false;
    tqState.strikes = 0;
    tqRender();
    tqUpdateStrikesDisplay();
  }, 1500);
}

function tqCompleteRound() {
  const elapsed = Date.now() - tqState.roundStartTime;

  if (tqState.roundPerfect) {
    tqState.streak++;
  } else {
    tqState.streak = 0;
  }
  if (tqState.streak > tqState.bestStreak) tqState.bestStreak = tqState.streak;

  const isNewBest = tqState.bestRoundTime === null || elapsed < tqState.bestRoundTime;
  if (isNewBest) tqState.bestRoundTime = elapsed;

  document.getElementById('tq-streak').textContent = tqState.streak;
  document.getElementById('tq-timer').textContent = tqFormatTime(elapsed);

  // Auto-advance after short delay
  setTimeout(() => {
    if (tqState.active) tqNewRound();
  }, 800);
}

function tqStartTimer() {
  tqState.roundStartTime = Date.now();
  if (tqState.timerInterval) clearInterval(tqState.timerInterval);
  tqState.timerInterval = setInterval(() => {
    if (tqState.roundStartTime) {
      document.getElementById('tq-timer').textContent = tqFormatTime(Date.now() - tqState.roundStartTime);
    }
  }, 200);
}

function tqFormatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function tqUpdateStrikesDisplay() {
  const el = document.getElementById('tq-strikes');
  if (!el) return;
  const pips = el.querySelectorAll('.strike-pip');
  pips.forEach((pip, i) => {
    pip.classList.toggle('active', i < tqState.strikes);
  });
}

function tqStop() {
  tqState.active = false;
  if (tqState.timerInterval) {
    clearInterval(tqState.timerInterval);
    tqState.timerInterval = null;
  }
}

function tqStart() {
  tqState.active = true;
  tqNewRound();
}

function initTriadQuizUI() {
  const modeSelect = document.getElementById('tq-mode');
  const rootSelect = document.getElementById('tq-root');
  const scaleSelect = document.getElementById('tq-scale');

  // Populate root note options
  NOTE_NAMES.forEach((name, i) => {
    const el = document.createElement('option');
    el.value = i;
    el.textContent = NOTE_DISPLAY_NAMES[i].replace('\n', '/');
    rootSelect.appendChild(el);
  });

  // Populate scale/mode options
  const scaleOptions = getTqScaleOptions();
  const majorGroup = document.createElement('optgroup');
  majorGroup.label = 'Major Modes';
  const hmGroup = document.createElement('optgroup');
  hmGroup.label = 'Harmonic Minor Modes';

  scaleOptions.forEach((opt, i) => {
    const el = document.createElement('option');
    el.value = i;
    el.textContent = opt.label;
    if (opt.scaleKey === 'major') majorGroup.appendChild(el);
    else hmGroup.appendChild(el);
  });
  scaleSelect.appendChild(majorGroup);
  scaleSelect.appendChild(hmGroup);

  function applyDrillSettings() {
    tqState.drillRoot = parseInt(rootSelect.value);
    const opt = scaleOptions[parseInt(scaleSelect.value)];
    if (opt) {
      tqState.drillScaleKey = opt.scaleKey;
      tqState.drillModeIndex = opt.modeIndex;
    }
    tqState.drillDegreeIndex = 0;
    tqState.drillOrder = [];
    if (tqState.active) tqNewRound();
  }

  modeSelect.addEventListener('change', () => {
    tqState.mode = modeSelect.value;
    const show = tqState.mode === 'keyDrill' ? '' : 'none';
    rootSelect.parentElement.style.display = show;
    scaleSelect.parentElement.style.display = show;
    if (tqState.active) {
      tqState.drillDegreeIndex = 0;
      tqState.drillOrder = [];
      tqNewRound();
    }
  });

  rootSelect.addEventListener('change', applyDrillSettings);
  scaleSelect.addEventListener('change', applyDrillSettings);

  // Default: hide drill selectors in random mode
  rootSelect.parentElement.style.display = 'none';
  scaleSelect.parentElement.style.display = 'none';
}
