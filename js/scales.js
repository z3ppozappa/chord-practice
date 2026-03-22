// Scale definitions, mode computation, pattern generation, chord identification

const SCALE_DEFS = {
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    notesPerString: 3,
    modes: ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian']
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    notesPerString: 3,
    modes: ['Harmonic Minor', 'Locrian ♮6', 'Ionian ♯5', 'Dorian ♯4', 'Phrygian Dominant', 'Lydian ♯2', 'Ultralocrian']
  },
  pentatonic: {
    name: 'Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    notesPerString: 2,
    modes: ['Major Pentatonic', 'Position 2', 'Position 3', 'Position 4', 'Minor Pentatonic']
  }
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// Semitones from low E open for each string (index 0 = high e, index 5 = low E)
const STRING_SEMITONES = [24, 19, 15, 10, 5, 0];
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

function getModeIntervals(scaleKey, modeIndex) {
  const base = SCALE_DEFS[scaleKey].intervals;
  const n = base.length;
  const root = base[modeIndex];
  const intervals = [];
  for (let i = 0; i < n; i++) {
    intervals.push((base[(modeIndex + i) % n] - root + 12) % 12);
  }
  return intervals;
}

// Build a diatonic triad on a given degree of a 7-note scale
function buildTriad(intervals, chordDegree) {
  const numNotes = intervals.length;
  const chordIndices = [
    chordDegree,
    (chordDegree + 2) % numNotes,
    (chordDegree + 4) % numNotes
  ];

  const rootInterval = intervals[chordDegree];
  const relIntervals = chordIndices.map(idx =>
    (intervals[idx] - rootInterval + 12) % 12
  );

  const third = relIntervals[1];
  const fifth = relIntervals[2];

  const degreeLabels = {};
  const degreeToneTypes = {};
  chordIndices.forEach((degIdx, i) => {
    const rel = relIntervals[i];
    degreeLabels[degIdx] = i === 0 ? 'R' : getChordToneLabel(rel);
    degreeToneTypes[degIdx] = i === 0 ? 'root' : getChordToneType(rel);
  });

  return {
    chordDegreeIndices: chordIndices,
    degreeLabels,
    degreeToneTypes,
    quality: computeTriadQuality(third, fifth),
    romanNumeral: computeRoman(chordDegree, third, fifth),
    rootSemitones: rootInterval
  };
}

// Get all available triads for a given scale/mode
function getAvailableChords(scaleKey, modeIndex) {
  const intervals = getModeIntervals(scaleKey, modeIndex);

  if (intervals.length === 7) {
    // 7 diatonic triads, one per degree
    return Array.from({ length: 7 }, (_, d) => buildTriad(intervals, d));
  }

  if (scaleKey === 'pentatonic') {
    return getPentatonicTriads(modeIndex);
  }

  return [];
}

// Pentatonic: only the parent major key's I and vi triads are fully
// present within the 5 pentatonic notes. Compute them per mode.
function getPentatonicTriads(modeIndex) {
  const modeIntervals = getModeIntervals('pentatonic', modeIndex);

  // Which parent major scale degrees each pentatonic index maps to
  const parentMaps = [
    [0, 1, 2, 4, 5], // mode 0: major pent
    [1, 2, 4, 5, 0], // mode 1
    [2, 4, 5, 0, 1], // mode 2
    [4, 5, 0, 1, 2], // mode 3
    [5, 0, 1, 2, 4], // mode 4: minor pent
  ];

  const parentMap = parentMaps[modeIndex];

  // The two parent-key triads whose notes are all in the pentatonic
  // I = parent degrees {0, 2, 4}, vi = parent degrees {5, 0, 2}
  const parentTriads = [
    [0, 2, 4],
    [5, 0, 2]
  ];

  const triads = [];

  for (const parentDegrees of parentTriads) {
    const pentIndices = parentDegrees.map(pd => parentMap.indexOf(pd));
    if (pentIndices.includes(-1)) continue;

    const rootPentIdx = pentIndices[0];
    const rootInterval = modeIntervals[rootPentIdx];

    const relIntervals = pentIndices.map(pi =>
      (modeIntervals[pi] - rootInterval + 12) % 12
    );

    const third = relIntervals[1];
    const fifth = relIntervals[2];

    const degreeLabels = {};
    const degreeToneTypes = {};
    pentIndices.forEach((pi, i) => {
      const rel = relIntervals[i];
      degreeLabels[pi] = i === 0 ? 'R' : getChordToneLabel(rel);
      degreeToneTypes[pi] = i === 0 ? 'root' : getChordToneType(rel);
    });

    triads.push({
      chordDegreeIndices: pentIndices,
      degreeLabels,
      degreeToneTypes,
      quality: computeTriadQuality(third, fifth),
      romanNumeral: romanFromInterval(rootInterval, third, fifth),
      rootSemitones: rootInterval
    });
  }

  return triads;
}

function computeTriadQuality(third, fifth) {
  if (third === 4 && fifth === 7) return '';       // major
  if (third === 3 && fifth === 7) return 'm';      // minor
  if (third === 3 && fifth === 6) return '°';      // diminished
  if (third === 4 && fifth === 8) return '+';      // augmented
  return '';
}

// Roman numeral from scale degree index (for 7-note scales)
function computeRoman(degreeIndex, third, fifth) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let numeral = numerals[degreeIndex];
  if (third === 3) numeral = numeral.toLowerCase();
  if (fifth === 6) numeral += '°';
  if (fifth === 8) numeral += '+';
  return numeral;
}

// Roman numeral from semitone interval above mode root (for pentatonic)
function romanFromInterval(semitones, third, fifth) {
  const majorNumerals = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const minorNumerals = ['i', '♭ii', 'ii', '♭iii', 'iii', 'iv', '♭v', 'v', '♭vi', 'vi', '♭vii', 'vii'];
  let numeral = (third === 3) ? minorNumerals[semitones % 12] : majorNumerals[semitones % 12];
  if (fifth === 6) numeral += '°';
  if (fifth === 8) numeral += '+';
  return numeral;
}

function getChordToneLabel(interval) {
  const i = ((interval % 12) + 12) % 12;
  switch (i) {
    case 0: return 'R';
    case 3: return '♭3';
    case 4: return '3';
    case 6: return '♭5';
    case 7: return '5';
    case 8: return '♯5';
    case 10: return '♭7';
    case 11: return '7';
    default: return '';
  }
}

function getChordToneType(interval) {
  const i = ((interval % 12) + 12) % 12;
  if (i === 0) return 'root';
  if (i === 3 || i === 4) return '3rd';
  if (i === 6 || i === 7 || i === 8) return '5th';
  if (i === 10 || i === 11) return '7th';
  return null;
}

// Compute NPS pattern — positions and degree indices only
function computePattern(scaleKey, modeIndex, rootFret) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const nps = SCALE_DEFS[scaleKey].notesPerString;
  const numNotes = intervals.length;
  const notes = [];

  for (let s = 0; s < 6; s++) {
    const stringIdx = 5 - s;
    for (let n = 0; n < nps; n++) {
      const noteIndex = s * nps + n;
      const degreeIdx = noteIndex % numNotes;
      const octave = Math.floor(noteIndex / numNotes);
      const semitones = intervals[degreeIdx] + octave * 12;
      const fret = rootFret + semitones - STRING_SEMITONES[stringIdx];

      notes.push({
        string: stringIdx,
        fret,
        interval: intervals[degreeIdx],
        degreeIndex: degreeIdx,
        chordTone: null,
        label: '',
        id: `s${stringIdx}f${fret}`
      });
    }
  }

  return notes;
}

// Mark chord tones in a pattern based on a chord
function markChordTones(pattern, chordInfo) {
  pattern.forEach(note => {
    if (chordInfo.chordDegreeIndices.includes(note.degreeIndex)) {
      note.chordTone = chordInfo.degreeToneTypes[note.degreeIndex];
      note.label = chordInfo.degreeLabels[note.degreeIndex];
    } else {
      note.chordTone = null;
      note.label = '';
    }
  });
}

// Compute scale degree labels for all notes in a pattern.
// modalDegree: degreeIndex + 1 (1-7, relative to mode root)
// parentDegree: degree relative to parent key root
function assignScaleDegrees(pattern, scaleKey, modeIndex) {
  const numNotes = SCALE_DEFS[scaleKey].intervals.length;

  if (scaleKey === 'pentatonic') {
    const parentMaps = [
      [0, 1, 2, 4, 5], // mode 0: major pent → parent degrees 1,2,3,5,6
      [1, 2, 4, 5, 0],
      [2, 4, 5, 0, 1],
      [4, 5, 0, 1, 2],
      [5, 0, 1, 2, 4], // mode 4: minor pent
    ];
    const parentMap = parentMaps[modeIndex];
    pattern.forEach(note => {
      note.modalDegree = note.degreeIndex + 1;
      note.parentDegree = parentMap[note.degreeIndex] + 1;
    });
  } else {
    pattern.forEach(note => {
      note.modalDegree = note.degreeIndex + 1;
      note.parentDegree = (note.degreeIndex + modeIndex) % numNotes + 1;
    });
  }
}

// Get the parent key root name
function getParentKeyRootName(rootFret, scaleKey, modeIndex) {
  if (scaleKey === 'pentatonic') {
    // Parent major key: offset by the pentatonic mode's relation to major
    const parentOffsets = [0, 2, 4, 7, 9]; // semitones of each pent degree in parent major
    const offsetSemitones = parentOffsets[modeIndex];
    return NOTE_NAMES[(4 + rootFret - offsetSemitones + 120) % 12];
  }
  // For 7-note scales: parent root is modeIndex steps back
  const intervals = SCALE_DEFS[scaleKey].intervals;
  const offsetSemitones = intervals[modeIndex];
  return NOTE_NAMES[(4 + rootFret - offsetSemitones + 120) % 12];
}

// Get parent key type label
function getParentKeyLabel(scaleKey) {
  if (scaleKey === 'major' || scaleKey === 'pentatonic') return 'Major';
  if (scaleKey === 'harmonicMinor') return 'Harm. Min.';
  return SCALE_DEFS[scaleKey].name;
}

function getRootNoteName(rootFret) {
  return NOTE_NAMES[(4 + rootFret) % 12];
}

function getChordRootName(rootFret, chordRootSemitones) {
  return NOTE_NAMES[(4 + rootFret + chordRootSemitones) % 12];
}

function getValidFretRange(scaleKey, modeIndex) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const nps = SCALE_DEFS[scaleKey].notesPerString;
  const numNotes = intervals.length;

  let minOffset = Infinity, maxOffset = -Infinity;

  for (let s = 0; s < 6; s++) {
    const stringIdx = 5 - s;
    for (let n = 0; n < nps; n++) {
      const noteIndex = s * nps + n;
      const degreeIdx = noteIndex % numNotes;
      const octave = Math.floor(noteIndex / numNotes);
      const semitones = intervals[degreeIdx] + octave * 12;
      const offset = semitones - STRING_SEMITONES[stringIdx];
      minOffset = Math.min(minOffset, offset);
      maxOffset = Math.max(maxOffset, offset);
    }
  }

  const minFret = Math.max(1, -minOffset);
  const maxFret = Math.max(minFret, 24 - maxOffset);

  return { min: minFret, max: maxFret };
}
