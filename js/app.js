// App initialization and settings wiring

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initSettingsUI();
  initTabSwitching();
  initTriadQuizUI();
  newRound();

  // Keyboard shortcut: Space/Enter for next round
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && state.roundComplete) {
      e.preventDefault();
      newRound();
    }
  });
});

function initTabSwitching() {
  const tabs = document.querySelectorAll('#tab-bar .tab');
  const views = {
    fretboard: document.getElementById('fretboard-view'),
    'triad-quiz': document.getElementById('triad-quiz-view'),
    dashboard: document.getElementById('dashboard-view')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const view = tab.dataset.view;
      Object.entries(views).forEach(([key, el]) => {
        el.classList.toggle('hidden', key !== view);
      });

      tqStop();
      if (view === 'triad-quiz') tqStart();
      if (view === 'dashboard') renderDashboard();
    });
  });
}

function initSettingsUI() {
  // Scale selector
  const scaleSelect = document.getElementById('scale-select');
  scaleSelect.value = state.scaleKey;
  scaleSelect.addEventListener('change', () => {
    state.scaleKey = scaleSelect.value;
    state.modeIndex = getDefaultModeIndex(state.scaleKey);
    updateModeOptions();
    updatePositionOptions();
    updateChordOptions();
    saveSettings();
    newRound();
  });

  // Key (root note) selector
  const keySelect = document.getElementById('key-select');
  NOTE_NAMES.forEach((name, i) => {
    const el = document.createElement('option');
    el.value = i;
    el.textContent = NOTE_DISPLAY_NAMES[i].replace('\n', '/');
    keySelect.appendChild(el);
  });
  keySelect.value = state.rootNote !== null ? state.rootNote : 'random';
  keySelect.addEventListener('change', () => {
    state.rootNote = keySelect.value === 'random' ? null : parseInt(keySelect.value);
    saveSettings();
    newRound();
  });

  // Mode selector
  updateModeOptions();
  document.getElementById('mode-select').addEventListener('change', () => {
    const val = document.getElementById('mode-select').value;
    if (val === 'random') {
      state.modeIndex = null;
    } else if (val.includes(':')) {
      const [key, idx] = val.split(':');
      state.scaleKey = key;
      state.modeIndex = parseInt(idx);
      document.getElementById('scale-select').value = key;
    } else {
      state.modeIndex = parseInt(val);
    }
    updatePositionOptions();
    updateChordOptions();
    saveSettings();
    newRound();
  });

  // Position selector
  updatePositionOptions();
  document.getElementById('position-select').addEventListener('change', () => {
    state.positionOffset = parseInt(document.getElementById('position-select').value);
    saveSettings();
    newRound();
  });

  // Chord selector
  updateChordOptions();
  document.getElementById('chord-select').addEventListener('change', () => {
    const val = document.getElementById('chord-select').value;
    state.chordDegree = val === 'random' ? null : parseInt(val);
    saveSettings();
    newRound();
  });

  // String preset selector
  const stringPreset = document.getElementById('string-preset');
  stringPreset.addEventListener('change', () => {
    const val = stringPreset.value;
    const presets = {
      all:    [true, true, true, true, true, true],
      top4:   [true, true, true, true, false, false],
      mid4:   [false, true, true, true, true, false],
      high:   [true, true, true, false, false, false],
      highMid: [false, true, true, true, false, false],
      lowMid: [false, false, true, true, true, false],
      low:    [false, false, false, true, true, true]
    };
    state.activeStrings = presets[val];
    saveSettings();
    newRound();
  });

  // Toggle buttons
  const showChord = document.getElementById('show-chord');
  if (state.showChordName) showChord.classList.add('active');
  showChord.addEventListener('click', () => {
    showChord.blur();
    state.showChordName = !state.showChordName;
    showChord.classList.toggle('active', state.showChordName);
    saveSettings();
    newRound();
  });

  const hardModeEl = document.getElementById('hard-mode');
  if (state.hardMode) hardModeEl.classList.add('active');
  hardModeEl.addEventListener('click', () => {
    hardModeEl.blur();
    state.hardMode = !state.hardMode;
    hardModeEl.classList.toggle('active', state.hardMode);
    saveSettings();
    newRound();
  });

  // Next button
  document.getElementById('next-btn').addEventListener('click', () => {
    newRound();
  });

  // Detect initial string preset
  detectStringPreset();
}

function updateModeOptions() {
  const modeSelect = document.getElementById('mode-select');
  const scaleKey = state.scaleKey;
  modeSelect.innerHTML = '<option value="random">Random</option>';

  if (scaleKey === 'random') {
    // Show all modes grouped by scale
    for (const [key, def] of Object.entries(SCALE_DEFS)) {
      const group = document.createElement('optgroup');
      group.label = def.name;
      def.modes.forEach((mode, idx) => {
        const opt = document.createElement('option');
        opt.value = `${key}:${idx}`;
        opt.textContent = mode;
        group.appendChild(opt);
      });
      modeSelect.appendChild(group);
    }
  } else {
    SCALE_DEFS[scaleKey].modes.forEach((mode, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = mode;
      modeSelect.appendChild(opt);
    });
  }

  // Restore selection
  if (state.modeIndex !== null) {
    modeSelect.value = state.modeIndex;
  } else {
    modeSelect.value = 'random';
  }

}

function detectStringPreset() {
  const s = state.activeStrings;
  const stringPreset = document.getElementById('string-preset');

  if (s.every(v => v)) {
    stringPreset.value = 'all';
  } else if (s[0] && s[1] && s[2] && s[3] && !s[4] && !s[5]) {
    stringPreset.value = 'top4';
  } else if (!s[0] && s[1] && s[2] && s[3] && s[4] && !s[5]) {
    stringPreset.value = 'mid4';
  } else if (s[0] && s[1] && s[2] && !s[3] && !s[4] && !s[5]) {
    stringPreset.value = 'high';
  } else if (!s[0] && s[1] && s[2] && s[3] && !s[4] && !s[5]) {
    stringPreset.value = 'highMid';
  } else if (!s[0] && !s[1] && s[2] && s[3] && s[4] && !s[5]) {
    stringPreset.value = 'lowMid';
  } else if (!s[0] && !s[1] && !s[2] && s[3] && s[4] && s[5]) {
    stringPreset.value = 'low';
  } else {
    stringPreset.value = 'all';
  }
}

function updatePositionOptions() {
  const posSelect = document.getElementById('position-select');
  posSelect.innerHTML = '';

  // Random option
  const randOpt = document.createElement('option');
  randOpt.value = '-1';
  randOpt.textContent = 'Random';
  posSelect.appendChild(randOpt);

  // Root option (same as key center)
  const rootOpt = document.createElement('option');
  rootOpt.value = '0';
  rootOpt.textContent = 'Root';
  posSelect.appendChild(rootOpt);

  // Determine how many positions to show based on the effective scale
  const scaleKey = state.scaleKey;
  // For a specific scale, use its mode count; for 'random', default to 7 (most common)
  const effectiveScaleKey = scaleKey !== 'random' ? scaleKey : 'major';
  const def = SCALE_DEFS[effectiveScaleKey];
  const numModes = def.modes.length;

  if (scaleKey !== 'random' && state.modeIndex !== null) {
    // Key center is fixed: show position offsets with mode shape names
    for (let offset = 1; offset < numModes; offset++) {
      const shapeModeIdx = (state.modeIndex + offset) % numModes;
      const opt = document.createElement('option');
      opt.value = offset;
      opt.textContent = `Pos ${offset + 1} — ${def.modes[shapeModeIdx]}`;
      posSelect.appendChild(opt);
    }
  } else {
    // Key center is random: show generic position numbers
    for (let offset = 1; offset < numModes; offset++) {
      const opt = document.createElement('option');
      opt.value = offset;
      opt.textContent = `Position ${offset + 1}`;
      posSelect.appendChild(opt);
    }
  }

  // Restore selection
  posSelect.value = state.positionOffset;
  if (posSelect.value !== String(state.positionOffset)) {
    state.positionOffset = -1;
    posSelect.value = '-1';
  }
}

function updateChordOptions() {
  const chordSelect = document.getElementById('chord-select');
  chordSelect.innerHTML = '';

  // Random option
  const randOpt = document.createElement('option');
  randOpt.value = 'random';
  randOpt.textContent = 'Random';
  chordSelect.appendChild(randOpt);

  const scaleKey = state.scaleKey;
  if (scaleKey !== 'random' && state.modeIndex !== null) {
    // Key center is fixed: show actual chord numerals
    const chords = getAvailableChords(scaleKey, state.modeIndex);
    chords.forEach((chord, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = chord.romanNumeral;
      chordSelect.appendChild(opt);
    });
  } else {
    // Key center is random: show generic degree numbers
    const effectiveScaleKey = scaleKey !== 'random' ? scaleKey : 'major';
    const numDegrees = SCALE_DEFS[effectiveScaleKey].intervals.length;
    // For pentatonic, only 2 chords are available; for 7-note scales, 7
    const numChords = effectiveScaleKey === 'pentatonic' ? 2 : numDegrees;
    for (let i = 0; i < numChords; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Degree ${i + 1}`;
      chordSelect.appendChild(opt);
    }
  }

  // Restore selection
  if (state.chordDegree !== null) {
    chordSelect.value = state.chordDegree;
    if (chordSelect.value !== String(state.chordDegree)) {
      state.chordDegree = null;
      chordSelect.value = 'random';
    }
  } else {
    chordSelect.value = 'random';
  }
}
