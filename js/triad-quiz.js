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

// Top 4 strings: D(3), G(2), B(1), e(0) — indices into STRING_SEMITONES/STRING_LABELS
const TQ_STRINGS = [0, 1, 2, 3]; // high e, B, G, D
const TQ_STRING_LABELS = ['e', 'B', 'G', 'D'];

const tqState = {
  mode: 'random',         // 'random' or 'keyDrill'
  drillScaleKey: 'major',
  drillModeIndex: 0,
  drillRoot: 0,           // root note (0-11)
  drillDegreeIndex: 0,    // current chord in key drill cycle
  drillOrder: [],         // shuffled order for key drill

  currentChord: null,     // { root, quality, name, thirdNote, fifthNote }
  foundRoot: false,
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
  active: false,

  fretMin: 0,
  fretMax: 6
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
  tqState.foundRoot = false;
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

// Get the note (0-11) at a given string index and fret
function tqNoteAt(stringIdx, fret) {
  return (STRING_SEMITONES[stringIdx] + fret) % 12;
}

// Get display name for a note index (short, single line with enharmonic)
function tqNoteName(noteIdx) {
  return NOTE_DISPLAY_NAMES[noteIdx].replace('\n', '/');
}

function tqRender() {
  const chord = tqState.currentChord;

  // Prompt
  const promptEl = document.getElementById('tq-prompt');
  promptEl.innerHTML = `<span class="tq-chord-name">${chord.name}</span><span class="tq-quality-label">${chord.qualityLabel}</span>`;

  // Fretboard
  const container = document.getElementById('tq-fretboard');
  container.innerHTML = '';

  const fretMin = tqState.fretMin;
  const fretMax = tqState.fretMax;
  const numFrets = fretMax - fretMin;
  const numStrings = TQ_STRINGS.length; // 4

  const pad = { top: 40, bottom: 58, left: 52, right: 26 };
  const stringSpacing = 52;
  const fretSpacing = 78;
  const width = pad.left + numFrets * fretSpacing + pad.right;
  const height = pad.top + (numStrings - 1) * stringSpacing + pad.bottom;

  const svg = createSVGElement('svg', {
    class: 'tq-fretboard-svg',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet'
  });

  // Fret markers (dots at 3,5,7,9,12,15,17,19,21,24)
  const singleMarkers = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleMarkers = [12, 24];
  const midY = pad.top + (numStrings - 1) * stringSpacing / 2;

  for (let i = 0; i < numFrets; i++) {
    const fretNum = fretMin + i + 1;
    const cx = pad.left + (i + 0.5) * fretSpacing;

    if (doubleMarkers.includes(fretNum)) {
      svg.appendChild(createSVGElement('circle', {
        cx, cy: midY - stringSpacing * 0.6, r: 4, fill: '#252535'
      }));
      svg.appendChild(createSVGElement('circle', {
        cx, cy: midY + stringSpacing * 0.6, r: 4, fill: '#252535'
      }));
    } else if (singleMarkers.includes(fretNum)) {
      svg.appendChild(createSVGElement('circle', {
        cx, cy: midY, r: 4, fill: '#252535'
      }));
    }
  }

  // Fret wires
  const numWires = numFrets + 1;
  for (let i = 0; i < numWires; i++) {
    const fretNum = fretMin + i;
    const x = pad.left + i * fretSpacing;
    const isNut = fretNum === 0;
    svg.appendChild(createSVGElement('line', {
      x1: x, y1: pad.top,
      x2: x, y2: pad.top + (numStrings - 1) * stringSpacing,
      stroke: isNut ? '#ccc' : '#444',
      'stroke-width': isNut ? 5 : 1.5
    }));
  }

  // Strings
  for (let si = 0; si < numStrings; si++) {
    const y = pad.top + si * stringSpacing;
    const globalStringIdx = TQ_STRINGS[si];
    const thickness = 0.8 + (5 - globalStringIdx) * 0.25;
    svg.appendChild(createSVGElement('line', {
      x1: pad.left, y1: y,
      x2: pad.left + numFrets * fretSpacing, y2: y,
      stroke: '#888',
      'stroke-width': thickness
    }));

    // String label
    const label = createSVGElement('text', {
      x: pad.left - 20, y: y + 5,
      fill: '#777',
      'font-size': '13',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle'
    });
    label.textContent = TQ_STRING_LABELS[si];
    svg.appendChild(label);
  }

  // Fret numbers
  const markerFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  for (let i = 0; i < numFrets; i++) {
    const fretNum = fretMin + i + 1;
    const x = pad.left + (i + 0.5) * fretSpacing;
    const isMarker = markerFrets.includes(fretNum);
    const label = createSVGElement('text', {
      x, y: pad.top + (numStrings - 1) * stringSpacing + 45,
      fill: isMarker ? '#99a' : '#3a3a4a',
      'font-size': isMarker ? '13' : '10',
      'font-weight': isMarker ? '600' : '400',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle',
      'pointer-events': 'none'
    });
    label.textContent = fretNum;
    svg.appendChild(label);
  }

  // Note dots — one at every fret/string intersection
  for (let si = 0; si < numStrings; si++) {
    const globalStringIdx = TQ_STRINGS[si];
    const y = pad.top + si * stringSpacing;

    for (let i = 0; i < numFrets; i++) {
      const fretNum = fretMin + i + 1;
      const cx = pad.left + (i + 0.5) * fretSpacing;
      const noteIdx = tqNoteAt(globalStringIdx, fretNum);
      const displayName = tqNoteName(noteIdx);

      const group = createSVGElement('g', {
        class: 'tq-dot',
        'data-note': noteIdx,
        'data-string': si,
        'data-fret': fretNum
      });

      // Hit area
      const hitArea = createSVGElement('circle', {
        cx, cy: y, r: 28, fill: 'transparent', class: 'hit-area'
      });
      group.appendChild(hitArea);

      // Visible circle
      const circle = createSVGElement('circle', {
        cx, cy: y, r: 22, class: 'tq-dot-circle',
        fill: '#1e1e35', stroke: '#333355', 'stroke-width': '1.5'
      });
      group.appendChild(circle);

      // Note name label
      const text = createSVGElement('text', {
        x: cx, y: y + 5,
        fill: '#c0c0d8',
        'font-size': '14',
        'font-weight': '600',
        'font-family': 'system-ui, sans-serif',
        'text-anchor': 'middle',
        'pointer-events': 'none'
      });
      text.textContent = displayName;
      group.appendChild(text);

      group.style.cursor = 'pointer';
      group.addEventListener('click', () => tqHandleDotTap(noteIdx, group));

      svg.appendChild(group);
    }
  }

  container.appendChild(svg);

  // Feedback
  document.getElementById('tq-feedback').textContent = '';

  // Update streak
  document.getElementById('tq-streak').textContent = tqState.streak;
}

function tqHandleDotTap(noteIndex, group) {
  const chord = tqState.currentChord;
  if (tqState.foundRoot && tqState.foundThird && tqState.foundFifth) return;

  const isRoot = noteIndex === chord.root && !tqState.foundRoot;
  const isThird = noteIndex === chord.thirdNote && !tqState.foundThird;
  const isFifth = noteIndex === chord.fifthNote && !tqState.foundFifth;

  if (isRoot || isThird || isFifth) {
    // Mark ALL dots with this note as correct
    if (isRoot) tqState.foundRoot = true;
    if (isThird) tqState.foundThird = true;
    if (isFifth) tqState.foundFifth = true;

    const allDots = document.querySelectorAll(`#tq-fretboard .tq-dot[data-note="${noteIndex}"]`);
    allDots.forEach(dot => {
      const circle = dot.querySelector('.tq-dot-circle');
      const text = dot.querySelector('text');
      circle.setAttribute('fill', '#1a5c3a');
      circle.setAttribute('stroke', '#48bb78');
      circle.setAttribute('stroke-width', '2');
      text.setAttribute('fill', '#a8f0c8');
      dot.classList.add('correct');
      dot.style.cursor = 'default';
    });

    if (tqState.foundRoot && tqState.foundThird && tqState.foundFifth) {
      tqCompleteRound();
    }
  } else {
    // Wrong
    tqState.roundPerfect = false;
    tqState.strikes++;

    // Flash this specific dot red
    const circle = group.querySelector('.tq-dot-circle');
    const text = group.querySelector('text');
    circle.setAttribute('fill', '#5c1a1a');
    circle.setAttribute('stroke', '#f56565');
    text.setAttribute('fill', '#fca5a5');
    setTimeout(() => {
      if (!group.classList.contains('correct') && !group.classList.contains('root-selected')) {
        circle.setAttribute('fill', '#1e1e35');
        circle.setAttribute('stroke', '#333355');
        text.setAttribute('fill', '#c0c0d8');
      }
    }, 400);

    tqUpdateStrikesDisplay();

    if (tqState.strikes >= 3) {
      tqStrikeOut();
    }
  }
}

function tqStrikeOut() {
  const chord = tqState.currentChord;

  // Reveal correct answers
  const revealNotes = [];
  if (!tqState.foundRoot) revealNotes.push(chord.root);
  if (!tqState.foundThird) revealNotes.push(chord.thirdNote);
  if (!tqState.foundFifth) revealNotes.push(chord.fifthNote);

  revealNotes.forEach(noteIdx => {
    const dots = document.querySelectorAll(`#tq-fretboard .tq-dot[data-note="${noteIdx}"]`);
    dots.forEach(dot => {
      const circle = dot.querySelector('.tq-dot-circle');
      const text = dot.querySelector('text');
      circle.setAttribute('fill', '#3a3a1a');
      circle.setAttribute('stroke', '#d4a048');
      circle.setAttribute('stroke-width', '2');
      text.setAttribute('fill', '#f6d88a');
      dot.classList.add('revealed');
    });
  });

  // Disable all dots
  document.querySelectorAll('#tq-fretboard .tq-dot').forEach(dot => {
    dot.style.cursor = 'default';
    dot.style.pointerEvents = 'none';
  });

  // Reset after delay
  setTimeout(() => {
    tqState.foundRoot = false;
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
  const posSelect = document.getElementById('tq-position');

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

  // Position dropdown handler
  function applyPosition() {
    const [min, max] = posSelect.value.split('-').map(Number);
    tqState.fretMin = min;
    tqState.fretMax = max;
    if (tqState.active) tqRender();
  }
  posSelect.addEventListener('change', applyPosition);
  applyPosition(); // set initial

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
