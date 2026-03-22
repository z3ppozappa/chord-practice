// Game logic, state management, scoring, timer

const state = {
  // Settings
  scaleKey: 'major',
  modeIndex: null, // null = random
  activeStrings: [true, true, true, true, true, true],
  showModeName: true,
  showChordName: true,
  showScaleDegrees: false,   // show scale degree labels on dots
  parentKeyDegrees: false,   // use parent key degrees instead of modal

  // Current round
  currentScale: null,
  currentMode: null,
  currentRootFret: null,
  currentChordInfo: null,
  pattern: [],
  dots: [],
  chordToneIndices: [],
  foundIndices: new Set(),
  roundComplete: false,

  // Scoring
  score: 0,
  streak: 0,
  round: 0,

  // Timer
  sessionStartTime: null,
  roundStartTime: null,
  lastRoundTime: null,
  timerInterval: null
};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startTimers() {
  if (!state.sessionStartTime) {
    state.sessionStartTime = Date.now();
  }
  state.roundStartTime = Date.now();

  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimerDisplay, 200);
}

function updateTimerDisplay() {
  const roundEl = document.getElementById('round-timer');
  const sessionEl = document.getElementById('session-timer');

  if (state.roundStartTime && !state.roundComplete) {
    roundEl.textContent = formatTime(Date.now() - state.roundStartTime);
  }
  if (state.sessionStartTime) {
    sessionEl.textContent = formatTime(Date.now() - state.sessionStartTime);
  }
}

function pickRound() {
  let scaleKey = state.scaleKey;
  let modeIndex = state.modeIndex;

  if (scaleKey === 'random') {
    const keys = Object.keys(SCALE_DEFS);
    scaleKey = keys[Math.floor(Math.random() * keys.length)];
  }

  if (modeIndex === null) {
    const numModes = SCALE_DEFS[scaleKey].modes.length;
    modeIndex = Math.floor(Math.random() * numModes);
  }

  const range = getValidFretRange(scaleKey, modeIndex);
  const rootFret = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  return { scaleKey, modeIndex, rootFret };
}

function newRound() {
  state.roundComplete = false;
  state.foundIndices = new Set();
  state.round++;

  const { scaleKey, modeIndex, rootFret } = pickRound();
  state.currentScale = scaleKey;
  state.currentMode = modeIndex;
  state.currentRootFret = rootFret;

  // Pick a random diatonic triad from the available chords
  const chords = getAvailableChords(scaleKey, modeIndex);
  state.currentChordInfo = chords[Math.floor(Math.random() * chords.length)];

  // Compute pattern and mark chord tones
  state.pattern = computePattern(scaleKey, modeIndex, rootFret);
  markChordTones(state.pattern, state.currentChordInfo);
  assignScaleDegrees(state.pattern, scaleKey, modeIndex);

  // Identify chord tone indices to find (on active strings)
  state.chordToneIndices = [];
  state.pattern.forEach((note, idx) => {
    if (state.activeStrings[note.string] && note.chordTone) {
      state.chordToneIndices.push(idx);
    }
  });

  // Render fretboard
  state.dots = renderFretboard('fretboard-container', state.pattern, state.activeStrings, handleNoteClick, state.showScaleDegrees);

  // Set scale degree text on dots
  if (state.showScaleDegrees) {
    const useParent = state.parentKeyDegrees;
    state.dots.forEach(dot => {
      if (dot.note.chordTone) {
        const deg = useParent ? dot.note.parentDegree : dot.note.modalDegree;
        dot.labelDegree.textContent = deg;
      }
    });
  }

  // Update prompt
  updatePrompt(scaleKey, modeIndex, rootFret);
  updateProgress();
  updateScoreDisplay();
  updateRoundDisplay();

  // Start timer
  startTimers();

  // Hide next button
  document.getElementById('next-btn').classList.add('hidden');
}

function updatePrompt(scaleKey, modeIndex, rootFret) {
  const modeName = SCALE_DEFS[scaleKey].modes[modeIndex];
  const chordInfo = state.currentChordInfo;
  const chordRootName = getChordRootName(rootFret, chordInfo.rootSemitones);
  const chordName = chordRootName + chordInfo.quality;
  const numeral = chordInfo.romanNumeral;

  const modeEl = document.getElementById('mode-name');
  modeEl.textContent = modeName;
  modeEl.classList.toggle('hidden', !state.showModeName);

  // Merged prompt: "Find iv (Dm)" or just "Find the chord tones"
  const findEl = document.getElementById('find-prompt');
  if (state.chordToneIndices.length === 0) {
    findEl.textContent = 'No chord tones on these strings';
  } else if (state.showChordName) {
    findEl.textContent = `Find ${numeral} (${chordName})`;
  } else {
    findEl.textContent = 'Find the chord tones';
  }

  // Parent key info
  const parentEl = document.getElementById('parent-key-info');
  if (parentEl) {
    if (state.parentKeyDegrees && state.showScaleDegrees && modeIndex > 0) {
      const parentRoot = getParentKeyRootName(rootFret, scaleKey, modeIndex);
      const parentLabel = getParentKeyLabel(scaleKey);
      parentEl.textContent = `Parent: ${parentRoot} ${parentLabel}`;
      parentEl.classList.remove('hidden');
    } else {
      parentEl.classList.add('hidden');
    }
  }
}

function updateProgress() {
  const progressEl = document.getElementById('progress');

  // Count by chord tone label
  const counts = {};
  state.chordToneIndices.forEach(idx => {
    const note = state.pattern[idx];
    const type = note.label;
    if (!counts[type]) counts[type] = { total: 0, found: 0 };
    counts[type].total++;
    if (state.foundIndices.has(idx)) counts[type].found++;
  });

  progressEl.innerHTML = '';
  for (const [type, { total, found }] of Object.entries(counts)) {
    const span = document.createElement('span');
    span.className = 'progress-item';
    if (found === total) span.classList.add('complete');
    span.textContent = `${type}: ${found}/${total}`;
    progressEl.appendChild(span);
  }
}

function updateScoreDisplay() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('streak').textContent = state.streak;
}

function updateRoundDisplay() {
  document.getElementById('round-num').textContent = state.round;
}

function handleNoteClick(idx, note, group) {
  if (state.roundComplete) return;
  if (state.foundIndices.has(idx)) return;

  const dot = state.dots.find(d => d.index === idx);
  if (!dot) return;

  if (note.chordTone) {
    // Correct!
    state.foundIndices.add(idx);
    state.score++;
    state.streak++;
    markDotCorrect(dot, state.showScaleDegrees);
    updateProgress();
    updateScoreDisplay();

    if (state.foundIndices.size === state.chordToneIndices.length) {
      completeRound();
    }
  } else {
    // Wrong
    state.score = Math.max(0, state.score - 1);
    state.streak = 0;
    flashDotWrong(dot);
    updateScoreDisplay();
  }
}

function completeRound() {
  state.roundComplete = true;
  state.lastRoundTime = Date.now() - state.roundStartTime;

  const roundTimeEl = document.getElementById('round-timer');
  roundTimeEl.textContent = formatTime(state.lastRoundTime);

  const nextBtn = document.getElementById('next-btn');
  nextBtn.classList.remove('hidden');
  nextBtn.focus();
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('chordGameSettings'));
    if (saved) {
      state.scaleKey = saved.scaleKey || 'major';
      state.modeIndex = saved.modeIndex !== undefined ? saved.modeIndex : null;
      state.activeStrings = saved.activeStrings || [true, true, true, true, true, true];
      state.showModeName = saved.showModeName !== undefined ? saved.showModeName : true;
      state.showChordName = saved.showChordName !== undefined ? saved.showChordName : true;
      state.showScaleDegrees = saved.showScaleDegrees !== undefined ? saved.showScaleDegrees : false;
      state.parentKeyDegrees = saved.parentKeyDegrees !== undefined ? saved.parentKeyDegrees : false;
    }
  } catch (e) { /* ignore */ }
}

function saveSettings() {
  localStorage.setItem('chordGameSettings', JSON.stringify({
    scaleKey: state.scaleKey,
    modeIndex: state.modeIndex,
    activeStrings: state.activeStrings,
    showModeName: state.showModeName,
    showChordName: state.showChordName,
    showScaleDegrees: state.showScaleDegrees,
    parentKeyDegrees: state.parentKeyDegrees
  }));
}

function resetGame() {
  state.score = 0;
  state.streak = 0;
  state.round = 0;
  state.sessionStartTime = null;
  state.lastRoundTime = null;
  newRound();
}
