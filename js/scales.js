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

// Pentatonic modes map to these parent major scale degrees (for roman numerals)
const PENTATONIC_NUMERALS = ['I', 'ii', 'iii', 'V', 'vi'];

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

// Get chord info for a mode: which degree indices are chord tones, quality, roman numeral
function getChordInfo(scaleKey, modeIndex) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const numNotes = intervals.length;

  if (numNotes === 7) {
    // For 7-note scales, chord tones are always at degree indices 2, 4, 6 (3rd, 5th, 7th)
    const third = intervals[2];
    const fifth = intervals[4];
    const seventh = intervals[6];

    return {
      chordDegreeIndices: [2, 4, 6],
      third, fifth, seventh,
      quality: computeQuality(third, fifth, seventh),
      romanNumeral: computeRoman(modeIndex, third, fifth)
    };
  }

  if (scaleKey === 'pentatonic') {
    // Determine which pentatonic indices correspond to chord tones by interval
    const chordDegreeIndices = [];
    let third, fifth, seventh;

    for (let i = 1; i < numNotes; i++) {
      const interval = intervals[i];
      if ((interval === 3 || interval === 4) && third === undefined) {
        third = interval;
        chordDegreeIndices.push(i);
      } else if (interval === 7 && fifth === undefined) {
        fifth = interval;
        chordDegreeIndices.push(i);
      } else if ((interval === 10 || interval === 11) && seventh === undefined) {
        seventh = interval;
        chordDegreeIndices.push(i);
      }
    }

    return {
      chordDegreeIndices,
      third, fifth, seventh,
      quality: computeQuality(third, fifth, seventh),
      romanNumeral: PENTATONIC_NUMERALS[modeIndex]
    };
  }

  return { chordDegreeIndices: [], quality: '', romanNumeral: '' };
}

function computeQuality(third, fifth, seventh) {
  // Full 7th chords
  if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
  if (third === 4 && fifth === 7 && seventh === 10) return '7';
  if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
  if (third === 3 && fifth === 6 && seventh === 10) return 'm7♭5';
  if (third === 3 && fifth === 6 && seventh === 9) return '°7';
  if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7';
  if (third === 4 && fifth === 8 && seventh === 11) return 'maj7♯5';
  if (third === 4 && fifth === 8 && seventh === 10) return '7♯5';
  // Incomplete chords (pentatonic)
  if (third === 3 && fifth === 7) return 'm';
  if (third === 4 && fifth === 7) return '';
  if (third === 3 && seventh === 10) return 'm';
  if (fifth === 7 && seventh === 10) return '7sus';
  if (fifth === 7 && !third && !seventh) return '5';
  if (third === 4 && !fifth && !seventh) return '';
  if (third === 3 && !fifth && !seventh) return 'm';
  return '';
}

function computeRoman(degreeIndex, third, fifth) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let numeral = numerals[degreeIndex];
  if (third === 3) numeral = numeral.toLowerCase();
  if (fifth === 6) numeral += '°';
  if (fifth === 8) numeral += '+';
  return numeral;
}

// Returns display label for a chord tone interval
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
    default: return '';
  }
}

// Returns chord tone type for display grouping
function getChordToneType(interval) {
  const i = ((interval % 12) + 12) % 12;
  if (i === 0) return 'root';
  if (i === 3 || i === 4) return '3rd';
  if (i === 6 || i === 7 || i === 8) return '5th';
  if (i === 9 || i === 10 || i === 11) return '7th';
  return null;
}

// Compute NPS pattern for a given scale/mode/rootFret
function computePattern(scaleKey, modeIndex, rootFret) {
  const intervals = getModeIntervals(scaleKey, modeIndex);
  const nps = SCALE_DEFS[scaleKey].notesPerString;
  const numNotes = intervals.length;
  const chordInfo = getChordInfo(scaleKey, modeIndex);
  const notes = [];

  for (let s = 0; s < 6; s++) {
    const stringIdx = 5 - s; // start from low E (5) up to high e (0)
    for (let n = 0; n < nps; n++) {
      const noteIndex = s * nps + n;
      const degreeIdx = noteIndex % numNotes;
      const octave = Math.floor(noteIndex / numNotes);
      const semitones = intervals[degreeIdx] + octave * 12;
      const fret = rootFret + semitones - STRING_SEMITONES[stringIdx];

      let chordTone = null;
      let label = '';

      if (degreeIdx === 0) {
        chordTone = 'root';
        label = 'R';
      } else if (chordInfo.chordDegreeIndices.includes(degreeIdx)) {
        chordTone = getChordToneType(intervals[degreeIdx]);
        label = getChordToneLabel(intervals[degreeIdx]);
      }

      notes.push({
        string: stringIdx,
        fret,
        interval: intervals[degreeIdx],
        degreeIndex: degreeIdx,
        chordTone,
        label,
        id: `s${stringIdx}f${fret}`
      });
    }
  }

  return notes;
}

function getRootNoteName(rootFret) {
  return NOTE_NAMES[(4 + rootFret) % 12]; // low E open = E = semitone 4
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
