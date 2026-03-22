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

// Get a diatonic chord built on any degree of the current mode.
// chordDegree is 0-indexed (0 = I chord, 1 = ii chord, etc.)
// Returns which scale degree indices belong to the chord, their labels, quality, numeral.
function getDiatonicChord(scaleKey, modeIndex, chordDegree) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const numNotes = intervals.length;

  // Build chord by stacking thirds (every other scale degree)
  // 7-note scales: 4-note chords (R, 3, 5, 7)
  // 5-note scales: 3-note chords (R, 3, 5) — no clean 7th available
  const chordSize = numNotes === 7 ? 4 : 3;
  const chordIndices = [];
  for (let i = 0; i < chordSize; i++) {
    chordIndices.push((chordDegree + i * 2) % numNotes);
  }

  // Compute intervals relative to chord root
  const rootInterval = intervals[chordDegree];
  const relativeIntervals = chordIndices.map(idx =>
    (intervals[idx] - rootInterval + 12) % 12
  );

  // Build labels and types for each chord tone degree
  const degreeLabels = {};
  const degreeToneTypes = {};
  chordIndices.forEach((degIdx, i) => {
    const rel = relativeIntervals[i];
    degreeLabels[degIdx] = i === 0 ? 'R' : getChordToneLabel(rel);
    degreeToneTypes[degIdx] = i === 0 ? 'root' : getChordToneType(rel);
  });

  const third = relativeIntervals[1];
  const fifth = relativeIntervals[2];
  const seventh = chordSize >= 4 ? relativeIntervals[3] : undefined;

  return {
    chordDegreeIndices: chordIndices,
    degreeLabels,
    degreeToneTypes,
    quality: computeQuality(third, fifth, seventh),
    romanNumeral: computeRoman(chordDegree, third, fifth),
    rootSemitones: rootInterval
  };
}

function computeQuality(third, fifth, seventh) {
  if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
  if (third === 4 && fifth === 7 && seventh === 10) return '7';
  if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
  if (third === 3 && fifth === 6 && seventh === 10) return 'm7♭5';
  if (third === 3 && fifth === 6 && seventh === 9) return '°7';
  if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7';
  if (third === 4 && fifth === 8 && seventh === 11) return 'maj7♯5';
  if (third === 4 && fifth === 8 && seventh === 10) return '7♯5';
  // Triads (pentatonic)
  if (third === 4 && fifth === 7) return '';
  if (third === 3 && fifth === 7) return 'm';
  if (third === 3 && fifth === 6) return '°';
  if (third === 4 && fifth === 8) return '+';
  // Unusual pentatonic stacks
  if (third === 3 && fifth === 8) return 'm(♯5)';
  if (third === 2 && fifth === 7) return 'sus2';
  if (third === 5 && fifth === 7) return 'sus4';
  return '';
}

function computeRoman(degreeIndex, third, fifth) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let numeral = numerals[degreeIndex] || (degreeIndex + 1).toString();
  if (third === 3 || third === 2) numeral = numeral.toLowerCase();
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
    case 9: return '𝄫7';
    case 10: return '♭7';
    case 11: return '7';
    case 2: return '2';
    case 5: return '4';
    default: return '';
  }
}

function getChordToneType(interval) {
  const i = ((interval % 12) + 12) % 12;
  if (i === 0) return 'root';
  if (i === 2 || i === 3 || i === 4 || i === 5) return '3rd';
  if (i === 6 || i === 7 || i === 8) return '5th';
  if (i === 9 || i === 10 || i === 11) return '7th';
  return null;
}

// Compute NPS pattern — just positions and degree indices, no chord tone assignment
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

// Mark chord tones in a pattern based on a diatonic chord
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
