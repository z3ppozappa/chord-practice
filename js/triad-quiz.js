// Triad Quiz: memorize notes in triads

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

// Generate all diatonic key options: root × (major modes + harmonic minor modes)
function getTqKeyOptions() {
  const options = [];
  for (let root = 0; root < 12; root++) {
    // Major modes
    for (let m = 0; m < 7; m++) {
      const modeName = SCALE_DEFS.major.modes[m];
      const rootName = NOTE_NAMES[root];
      options.push({
        label: `${rootName} ${modeName}`,
        scaleKey: 'major',
        modeIndex: m,
        root
      });
    }
    // Harmonic minor modes
    for (let m = 0; m < 7; m++) {
      const modeName = SCALE_DEFS.harmonicMinor.modes[m];
      const rootName = NOTE_NAMES[root];
      options.push({
        label: `${rootName} ${modeName}`,
        scaleKey: 'harmonicMinor',
        modeIndex: m,
        root
      });
    }
  }
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
    btn.textContent = NOTE_NAMES[i];
    btn.dataset.note = i;

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
  const keySelect = document.getElementById('tq-key');

  // Populate key options
  function populateKeyOptions() {
    keySelect.innerHTML = '';
    const options = getTqKeyOptions();

    // Group by scale
    const majorGroup = document.createElement('optgroup');
    majorGroup.label = 'Major Modes';
    const hmGroup = document.createElement('optgroup');
    hmGroup.label = 'Harmonic Minor Modes';

    options.forEach((opt, i) => {
      const el = document.createElement('option');
      el.value = i;
      el.textContent = opt.label;
      if (opt.scaleKey === 'major') majorGroup.appendChild(el);
      else hmGroup.appendChild(el);
    });

    keySelect.appendChild(majorGroup);
    keySelect.appendChild(hmGroup);
  }

  populateKeyOptions();
  const allKeyOptions = getTqKeyOptions();

  modeSelect.addEventListener('change', () => {
    tqState.mode = modeSelect.value;
    keySelect.parentElement.style.display = tqState.mode === 'keyDrill' ? '' : 'none';
    if (tqState.active) {
      tqState.drillDegreeIndex = 0;
      tqState.drillOrder = [];
      tqNewRound();
    }
  });

  keySelect.addEventListener('change', () => {
    const opt = allKeyOptions[parseInt(keySelect.value)];
    if (opt) {
      tqState.drillScaleKey = opt.scaleKey;
      tqState.drillModeIndex = opt.modeIndex;
      tqState.drillRoot = opt.root;
      tqState.drillDegreeIndex = 0;
      tqState.drillOrder = [];
      if (tqState.active) tqNewRound();
    }
  });

  // Default: hide key selector in random mode
  keySelect.parentElement.style.display = 'none';
}
