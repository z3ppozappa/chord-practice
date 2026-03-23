// Game logic, state management, scoring, timer

const state = {
  // Settings
  scaleKey: 'major',
  modeIndex: null,           // null = random (key center mode)
  positionOffset: 0,         // 0 = root (same as key center), -1 = random, 1-6 = offset from key center
  chordDegree: null,         // null = random, 0-6 = specific chord degree
  activeStrings: [true, true, true, true, true, true],
  showModeName: true,
  showChordName: true,
  showScaleDegrees: false,   // show scale degree labels on dots
  parentKeyDegrees: false,   // use parent key degrees instead of modal

  // Current round
  currentScale: null,
  currentMode: null,          // key center mode index for this round
  currentShapeMode: null,     // shape/position mode index for this round
  currentRootFret: null,      // key center root fret
  currentShapeRootFret: null, // shape root fret (may differ from key center)
  currentChordInfo: null,
  pattern: [],
  dots: [],
  chordToneIndices: [],
  foundIndices: new Set(),
  roundComplete: false,

  // Scoring
  streak: 0,
  bestStreak: 0,
  round: 0,

  // Timer
  sessionStartTime: null,
  roundStartTime: null,
  lastRoundTime: null,
  bestRoundTime: null,
  roundTimes: [],        // history of completed round times
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

  if (state.roundStartTime && !state.roundComplete) {
    roundEl.textContent = formatTime(Date.now() - state.roundStartTime);
  }
}

function pickRound() {
  let scaleKey = state.scaleKey;
  let keyCenterMode = state.modeIndex;

  if (scaleKey === 'random') {
    const keys = Object.keys(SCALE_DEFS);
    scaleKey = keys[Math.floor(Math.random() * keys.length)];
  }

  const numModes = SCALE_DEFS[scaleKey].modes.length;

  if (keyCenterMode === null) {
    keyCenterMode = Math.floor(Math.random() * numModes);
  }

  // Determine shape mode from position offset
  let shapeMode;
  if (state.positionOffset === -1) {
    // Random position
    shapeMode = Math.floor(Math.random() * numModes);
  } else {
    shapeMode = (keyCenterMode + state.positionOffset) % numModes;
  }

  // Pick root fret for the key center
  const range = getValidFretRange(scaleKey, keyCenterMode);
  const rootFret = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  // Compute shape root fret
  const shapeRootFret = getShapeRootFret(rootFret, scaleKey, keyCenterMode, shapeMode);

  return { scaleKey, keyCenterMode, shapeMode, rootFret, shapeRootFret };
}

function newRound() {
  state.roundComplete = false;
  state.foundIndices = new Set();
  state.round++;

  const { scaleKey, keyCenterMode, shapeMode, rootFret, shapeRootFret } = pickRound();
  state.currentScale = scaleKey;
  state.currentMode = keyCenterMode;
  state.currentShapeMode = shapeMode;
  state.currentRootFret = rootFret;
  state.currentShapeRootFret = shapeRootFret;

  // Get chords relative to the key center mode
  const chords = getAvailableChords(scaleKey, keyCenterMode);

  // Pick chord: fixed degree or random
  if (state.chordDegree !== null && state.chordDegree < chords.length) {
    state.currentChordInfo = chords[state.chordDegree];
  } else {
    state.currentChordInfo = chords[Math.floor(Math.random() * chords.length)];
  }

  // Compute pattern using the SHAPE mode and shape root fret
  state.pattern = computePattern(scaleKey, shapeMode, shapeRootFret);

  // Mark chord tones with degree conversion (shape → key center)
  markChordTones(state.pattern, state.currentChordInfo, shapeMode, keyCenterMode);

  // Assign scale degrees (modal degrees relative to key center)
  assignScaleDegrees(state.pattern, scaleKey, shapeMode, keyCenterMode);

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
  updatePrompt(scaleKey, keyCenterMode, shapeMode, rootFret);
  updateProgress();
  updateScoreDisplay();
  updateBatchDots();

  // Start timer
  startTimers();

  // Hide next button
  document.getElementById('next-btn').classList.add('hidden');
}

function updatePrompt(scaleKey, keyCenterMode, shapeMode, rootFret) {
  const keyCenterName = SCALE_DEFS[scaleKey].modes[keyCenterMode];
  const shapeName = SCALE_DEFS[scaleKey].modes[shapeMode];
  const chordInfo = state.currentChordInfo;
  const chordRootName = getChordRootName(rootFret, chordInfo.rootSemitones);
  const chordName = chordRootName + chordInfo.quality;
  const numeral = chordInfo.romanNumeral;

  // Key center mode name
  const modeEl = document.getElementById('mode-name');
  modeEl.textContent = keyCenterName;
  modeEl.classList.toggle('hidden', !state.showModeName);

  // Shape/position info (show when shape differs from key center)
  const shapeEl = document.getElementById('shape-info');
  if (shapeEl) {
    if (shapeMode !== keyCenterMode) {
      shapeEl.textContent = `${shapeName} shape`;
      shapeEl.classList.remove('hidden');
    } else {
      shapeEl.classList.add('hidden');
    }
  }

  // Merged prompt: always show chord, optionally hide name
  const findEl = document.getElementById('find-prompt');
  if (state.chordToneIndices.length === 0) {
    findEl.textContent = 'No chord tones on these strings';
  } else if (state.showChordName) {
    findEl.textContent = `Find ${numeral} (${chordName})`;
  } else {
    findEl.textContent = `Find ${numeral}`;
  }

  // Chord list for the key
  const chordListEl = document.getElementById('chord-list');
  if (chordListEl) {
    const allChords = getAvailableChords(scaleKey, keyCenterMode);
    chordListEl.innerHTML = allChords.map(c => {
      const active = c.romanNumeral === numeral;
      return `<span class="chord-item${active ? ' active' : ''}">${c.romanNumeral}</span>`;
    }).join(' ');
  }

  // Parent key info
  const parentEl = document.getElementById('parent-key-info');
  if (parentEl) {
    if (state.parentKeyDegrees) {
      const parentRoot = getParentKeyRootName(rootFret, scaleKey, keyCenterMode);
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
  document.getElementById('streak').textContent = state.streak;
}

function updateBatchDots() {
  const container = document.getElementById('batch-dots');
  if (!container) return;

  container.classList.remove('batch-complete');
  const batchPos = (state.round - 1) % 10;

  container.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('span');
    dot.className = 'batch-dot';
    if (i < batchPos) dot.classList.add('filled');
    if (i === batchPos) dot.classList.add('current');
    container.appendChild(dot);
  }
}

function handleNoteClick(idx, note, group) {
  if (state.roundComplete) return;
  if (state.foundIndices.has(idx)) return;

  const dot = state.dots.find(d => d.index === idx);
  if (!dot) return;

  if (note.chordTone) {
    // Correct!
    state.foundIndices.add(idx);
    markDotCorrect(dot, state.showScaleDegrees);
    updateProgress();
    updateScoreDisplay();
    updateStreakDisplay();

    if (state.foundIndices.size === state.chordToneIndices.length) {
      completeRound();
    }
  } else {
    // Wrong
    state.streak = 0;
    flashDotWrong(dot);
    updateScoreDisplay();
    updateStreakDisplay();
  }
}

function completeRound() {
  state.roundComplete = true;
  state.lastRoundTime = Date.now() - state.roundStartTime;

  const isNewBest = state.bestRoundTime === null || state.lastRoundTime < state.bestRoundTime;
  if (isNewBest) state.bestRoundTime = state.lastRoundTime;

  state.roundTimes.push(state.lastRoundTime);

  const roundTimeEl = document.getElementById('round-timer');
  roundTimeEl.textContent = formatTime(state.lastRoundTime);

  // Update best time display
  const bestDisplay = document.getElementById('best-time-display');
  const bestEl = document.getElementById('best-time');
  if (bestEl) {
    bestEl.textContent = formatTime(state.bestRoundTime);
    if (isNewBest && state.roundTimes.length > 1 && bestDisplay) {
      bestDisplay.classList.add('new-best');
      setTimeout(() => bestDisplay.classList.remove('new-best'), 1500);
    }
  }

  // Update batch dots — fill current dot and flash at 10
  const batchContainer = document.getElementById('batch-dots');
  if (batchContainer) {
    const dots = batchContainer.querySelectorAll('.batch-dot');
    const completedInBatch = ((state.round - 1) % 10) + 1;
    dots.forEach((dot, i) => {
      dot.classList.remove('current');
      if (i < completedInBatch) dot.classList.add('filled');
    });
    if (completedInBatch === 10) {
      batchContainer.classList.add('batch-complete');
    }
  }

  updateBadges();

  const nextBtn = document.getElementById('next-btn');
  nextBtn.classList.remove('hidden');
  nextBtn.focus();
}

function updateStreakDisplay() {
  // Streak bar: fills toward next multiple of 10
  const container = document.getElementById('streak-display');
  if (!container) return;

  const streak = state.streak;
  const barEl = container.querySelector('.streak-bar-fill');
  const progressInTen = streak % 10;
  const pct = (progressInTen / 10) * 100;
  barEl.style.width = (streak > 0 && progressInTen === 0) ? '100%' : pct + '%';

  // Color intensifies with level
  const level = Math.floor(streak / 10);
  if (level >= 3) barEl.className = 'streak-bar-fill bar-lvl3';
  else if (level >= 2) barEl.className = 'streak-bar-fill bar-lvl2';
  else if (level >= 1) barEl.className = 'streak-bar-fill bar-lvl1';
  else barEl.className = 'streak-bar-fill';

  if (streak > 0) {
    container.classList.add('streak-pulse');
    setTimeout(() => container.classList.remove('streak-pulse'), 300);
  }

  updateBadges();
}

function updateBadges() {
  const container = document.getElementById('badges');
  if (!container) return;

  container.innerHTML = '';

  // Streak badges: one per 10 streak
  const streakLevel = Math.floor(state.bestStreak / 10);
  if (streakLevel > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-streak';
    badge.textContent = `${streakLevel}0 streak`;
    container.appendChild(badge);
  }

  // Speed badges: count of rounds completed under 10s
  const fastCount = state.roundTimes.filter(t => t < 10000).length;
  if (fastCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-speed';
    badge.textContent = `${fastCount} under 10s`;
    container.appendChild(badge);
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('chordGameSettings'));
    if (saved) {
      state.scaleKey = saved.scaleKey || 'major';
      state.modeIndex = saved.modeIndex !== undefined ? saved.modeIndex : null;
      state.positionOffset = saved.positionOffset !== undefined ? saved.positionOffset : 0;
      state.chordDegree = saved.chordDegree !== undefined ? saved.chordDegree : null;
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
    positionOffset: state.positionOffset,
    chordDegree: state.chordDegree,
    activeStrings: state.activeStrings,
    showModeName: state.showModeName,
    showChordName: state.showChordName,
    showScaleDegrees: state.showScaleDegrees,
    parentKeyDegrees: state.parentKeyDegrees
  }));
}

function resetGame() {
  state.streak = 0;
  state.bestStreak = 0;
  state.round = 0;
  state.sessionStartTime = null;
  state.lastRoundTime = null;
  state.bestRoundTime = null;
  state.roundTimes = [];
  newRound();
}
