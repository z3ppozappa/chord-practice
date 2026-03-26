// Game logic, state management, scoring, timer

function getDefaultModeIndex(scaleKey) {
  // major → Ionian (0), harmonicMinor → Harmonic Minor (0), pentatonic → random (null)
  if (scaleKey === 'pentatonic' || scaleKey === 'random') return null;
  return 0;
}

const state = {
  // Settings
  scaleKey: 'major',
  modeIndex: 0,              // 0 = Ionian for major (default)
  rootNote: null,            // null = random, 0-11 = specific root note (C=0)
  positionOffset: -1,        // -1 = random, 0 = root (same as key center), 1-6 = offset from key center
  chordDegree: null,         // null = random, 0-6 = specific chord degree
  activeStrings: [true, true, true, true, true, true],
  showChordName: false,
  showScaleDegrees: true,    // always show scale degree labels on dots
  hardMode: false,           // hide scale dots, tap blind

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
  lastRoundCompleted: false,

  // Scoring
  streak: 0,
  bestStreak: 0,
  round: 0,
  strikes: 0,
  roundPerfect: true,

  // Timer
  roundStartTime: null,
  lastRoundTime: null,
  bestRoundTime: null,
  roundTimes: [],        // history of completed round times
  timerInterval: null,

  // Session totals
  perfectFastCount: 0,   // perfect rounds under 15s
  totalCompleted: 0       // all completed rounds
};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startTimers() {
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
  let rootFret;
  if (state.rootNote !== null) {
    // Find all frets in valid range where the note matches the selected root
    // Low E open = semitone 4 (E), so fret N = (4 + N) % 12
    const validFrets = [];
    for (let f = range.min; f <= range.max; f++) {
      if ((4 + f) % 12 === state.rootNote) validFrets.push(f);
    }
    if (validFrets.length > 0) {
      rootFret = validFrets[Math.floor(Math.random() * validFrets.length)];
    } else {
      // Widen search to full fretboard, then clamp via getShapeRootFret
      const allFrets = [];
      for (let f = 0; f <= 24; f++) {
        if ((4 + f) % 12 === state.rootNote) allFrets.push(f);
      }
      rootFret = allFrets[Math.floor(Math.random() * allFrets.length)];
    }
  } else {
    rootFret = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  // Compute shape root fret (adjusts position so the shape is playable)
  const shapeRootFret = getShapeRootFret(rootFret, scaleKey, keyCenterMode, shapeMode);

  return { scaleKey, keyCenterMode, shapeMode, rootFret, shapeRootFret };
}

function newRound() {
  state.roundComplete = false;
  state.foundIndices = new Set();
  state.strikes = 0;
  state.roundPerfect = true;

  // Only increment round counter for actual new rounds, not settings refreshes
  if (state.round === 0 || state.lastRoundCompleted) {
    state.round++;
  }
  state.lastRoundCompleted = false;

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
  state.dots = renderFretboard('fretboard-container', state.pattern, state.activeStrings, handleNoteClick, state.showScaleDegrees && !state.hardMode, state.hardMode);

  // Set scale degree text on dots
  if (state.showScaleDegrees) {
    state.dots.forEach(dot => {
      if (dot.note.chordTone) {
        dot.labelDegree.textContent = dot.note.modalDegree;
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

  // Update strikes display
  updateStrikesDisplay();

  // Disable next button
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = true;
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

  // Shape/position info
  const shapeEl = document.getElementById('shape-info');
  if (shapeEl) {
    if (shapeMode !== keyCenterMode) {
      shapeEl.textContent = `${shapeName} shape`;
    } else {
      shapeEl.textContent = 'root shape';
    }
    shapeEl.classList.remove('hidden');
  }

  // Merged prompt: always show chord, optionally hide name
  const findEl = document.getElementById('find-prompt');
  if (state.chordToneIndices.length === 0) {
    findEl.textContent = 'No chord tones on these strings';
  } else if (state.showChordName) {
    // Show triad notes in R-3-5 order
    const modeIntervals = getModeIntervals(scaleKey, keyCenterMode);
    const triadNotes = chordInfo.chordDegreeIndices.map(di =>
      NOTE_NAMES[(4 + rootFret + modeIntervals[di]) % 12]
    );
    findEl.textContent = `Find ${numeral} (${triadNotes.join(' - ')})`;
  } else {
    findEl.textContent = `Find ${numeral}`;
  }

  // Chord list for the key (chord names above Roman numerals)
  const chordListEl = document.getElementById('chord-list');
  if (chordListEl) {
    const allChords = getAvailableChords(scaleKey, keyCenterMode);
    chordListEl.innerHTML = allChords.map(c => {
      const active = c.romanNumeral === numeral;
      const name = getChordRootName(rootFret, c.rootSemitones) + c.quality;
      return `<span class="chord-item${active ? ' active' : ''}"><span class="chord-name">${name}</span><span class="chord-numeral">${c.romanNumeral}</span></span>`;
    }).join(' ');
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
  const order = ['R', 'b3', '3', 'b5', '5'];
  const sortedTypes = Object.keys(counts).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const type of sortedTypes) {
    const { total, found } = counts[type];
    const span = document.createElement('span');
    span.className = 'progress-item';
    if (found === total) span.classList.add('complete');
    span.textContent = `${type}: ${found}/${total}`;
    progressEl.appendChild(span);
  }
}

function updateScoreDisplay() {
  document.getElementById('streak').textContent = state.streak;
  document.getElementById('perfect-fast-count').textContent = state.perfectFastCount;
  document.getElementById('total-completed').textContent = state.totalCompleted;
}

function updateBatchDots() {
  const container = document.getElementById('batch-dots');
  if (!container) return;

  container.classList.remove('batch-complete');
  const streakInBatch = state.streak % 5;

  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('span');
    dot.className = 'batch-dot';
    if (i < streakInBatch) dot.classList.add('filled');
    if (i === streakInBatch && state.streak > 0) dot.classList.add('current');
    container.appendChild(dot);
  }

  // Flash when a batch of 5 is complete
  if (state.streak > 0 && streakInBatch === 0) {
    // Just crossed a multiple of 5 — fill all and flash
    container.querySelectorAll('.batch-dot').forEach(d => d.classList.add('filled'));
    container.classList.add('batch-complete');
  }
}

function handleNoteClick(idx, note, group) {
  if (state.roundComplete) return;
  if (idx >= 0 && state.foundIndices.has(idx)) return;

  // Hard mode: tap on non-scale-note position
  if (idx === -1) {
    state.roundPerfect = false;
    state.strikes++;
    flashWrongAtPosition(group);
    updateScoreDisplay();

    updateStrikesDisplay();
    if (state.strikes >= 3) strikeOut();
    return;
  }

  const dot = state.dots.find(d => d.index === idx);
  if (!dot) return;

  if (note.chordTone) {
    // Correct!
    state.foundIndices.add(idx);
    markDotCorrect(dot, state.showScaleDegrees && !state.hardMode);
    updateProgress();
    updateScoreDisplay();


    if (state.foundIndices.size === state.chordToneIndices.length) {
      completeRound();
    }
  } else {
    // Wrong
    state.roundPerfect = false;
    state.strikes++;
    flashDotWrong(dot, state.hardMode);
    updateScoreDisplay();

    updateStrikesDisplay();

    if (state.strikes >= 3) {
      strikeOut();
    }
  }
}

function strikeOut() {
  // Flash the whole fretboard red briefly, then reset all found progress
  const container = document.getElementById('fretboard-container');
  container.classList.add('strike-out');

  // Reveal all chord tones briefly so the user can see what they missed
  state.dots.forEach(dot => {
    if (dot.note.chordTone && state.activeStrings[dot.note.string]) {
      const circle = dot.group.querySelector('.dot-circle');
      const labelChord = dot.group.querySelector('.dot-label-chord');
      circle.setAttribute('fill', '#5c1a1a');
      circle.setAttribute('stroke', '#f56565');
      labelChord.setAttribute('opacity', '0.6');
    }
  });

  // After a delay, reset the round (same chord, same position — try again)
  setTimeout(() => {
    container.classList.remove('strike-out');
    state.foundIndices = new Set();
    state.strikes = 0;

    // Reset all dots to default appearance
    state.dots.forEach(dot => {
      if (state.activeStrings[dot.note.string]) {
        const circle = dot.group.querySelector('.dot-circle');
        const labelChord = dot.group.querySelector('.dot-label-chord');
        const labelDegree = dot.group.querySelector('.dot-label-degree');
        if (state.hardMode) {
          circle.setAttribute('fill', 'transparent');
          circle.setAttribute('stroke', 'transparent');
          circle.setAttribute('stroke-width', '0');
        } else {
          circle.setAttribute('fill', '#2a2a3a');
          circle.setAttribute('stroke', '#4a4a5a');
          circle.setAttribute('stroke-width', '1.5');
        }
        labelChord.setAttribute('opacity', '0');
        labelDegree.setAttribute('opacity', '0');
        dot.group.classList.remove('correct');
        if (dot.note.chordTone) {
          dot.group.style.cursor = 'pointer';
        }
      }
    });

    updateProgress();
    updateStrikesDisplay();
  }, 1200);
}

function updateStrikesDisplay() {
  const el = document.getElementById('strikes');
  if (!el) return;
  const indicators = el.querySelectorAll('.strike-pip');
  indicators.forEach((pip, i) => {
    pip.classList.toggle('active', i < state.strikes);
  });
}

function completeRound() {
  state.roundComplete = true;
  state.lastRoundCompleted = true;
  state.lastRoundTime = Date.now() - state.roundStartTime;

  if (state.roundPerfect) {
    state.streak++;
  } else {
    state.streak = 0;
  }
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;

  state.totalCompleted++;
  if (state.roundPerfect && state.lastRoundTime < 15000) {
    state.perfectFastCount++;
  }

  const isNewBest = state.bestRoundTime === null || state.lastRoundTime < state.bestRoundTime;
  if (isNewBest) state.bestRoundTime = state.lastRoundTime;

  state.roundTimes.push(state.lastRoundTime);
  updateScoreDisplay();

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

  updateBatchDots();
  updateBadges();

  // Log to history
  historyAdd({
    game: 'scale',
    ts: Date.now(),
    time: state.lastRoundTime,
    perfect: state.roundPerfect,
    strikes: state.strikes,
    scaleType: state.currentScale,
    keyCenter: state.currentMode,
    shape: state.currentShapeMode,
    chordQuality: state.currentChordInfo.quality,
    chordNumeral: state.currentChordInfo.romanNumeral,
    hardMode: state.hardMode
  });

  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = false;
  nextBtn.focus();
}


function updateBadges() {
  const container = document.getElementById('badges');
  if (!container) return;

  container.innerHTML = '';

  // Streak badges: one per 5 perfect rounds
  const streakLevel = Math.floor(state.bestStreak / 5);
  if (streakLevel > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-streak';
    badge.textContent = `${streakLevel * 5} streak`;
    container.appendChild(badge);
  }

  // Speed badges — exclusive buckets, under 7s first then 7-9s as "under 10s"
  const under7Count = state.roundTimes.filter(t => t < 7000).length;
  if (under7Count > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-speed';
    badge.textContent = `${under7Count} under 7s`;
    container.appendChild(badge);
  }

  const under10Count = state.roundTimes.filter(t => t >= 7000 && t < 10000).length;
  if (under10Count > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-speed';
    badge.textContent = `${under10Count} under 10s`;
    container.appendChild(badge);
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('chordGameSettings'));
    if (saved) {
      state.scaleKey = saved.scaleKey || 'major';
      state.modeIndex = saved.modeIndex !== undefined ? saved.modeIndex : getDefaultModeIndex(state.scaleKey);
      state.rootNote = saved.rootNote !== undefined ? saved.rootNote : null;
      state.positionOffset = saved.positionOffset !== undefined ? saved.positionOffset : -1;
      state.chordDegree = saved.chordDegree !== undefined ? saved.chordDegree : null;
      state.activeStrings = saved.activeStrings || [true, true, true, true, true, true];

      state.showChordName = saved.showChordName !== undefined ? saved.showChordName : false;

      state.hardMode = saved.hardMode !== undefined ? saved.hardMode : false;
    }
  } catch (e) { /* ignore */ }
}

function saveSettings() {
  localStorage.setItem('chordGameSettings', JSON.stringify({
    scaleKey: state.scaleKey,
    modeIndex: state.modeIndex,
    rootNote: state.rootNote,
    positionOffset: state.positionOffset,
    chordDegree: state.chordDegree,
    activeStrings: state.activeStrings,

    showChordName: state.showChordName,

    hardMode: state.hardMode
  }));
}

function resetGame() {
  state.streak = 0;
  state.bestStreak = 0;
  state.round = 0;
  state.lastRoundTime = null;
  state.bestRoundTime = null;
  state.roundTimes = [];
  newRound();
}
