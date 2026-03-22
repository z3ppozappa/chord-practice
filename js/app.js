// App initialization and settings wiring

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initSettingsUI();
  newRound();

  // Keyboard shortcut: Space/Enter for next round
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && state.roundComplete) {
      e.preventDefault();
      newRound();
    }
  });
});

function initSettingsUI() {
  // Scale selector
  const scaleSelect = document.getElementById('scale-select');
  scaleSelect.value = state.scaleKey;
  scaleSelect.addEventListener('change', () => {
    state.scaleKey = scaleSelect.value;
    updateModeOptions();
    updatePositionOptions();
    updateChordOptions();
    saveSettings();
    newRound();
  });

  // Key center (mode) selector
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
  const customStrings = document.getElementById('custom-strings');
  stringPreset.addEventListener('change', () => {
    const val = stringPreset.value;
    if (val === 'custom') {
      customStrings.classList.remove('hidden');
    } else {
      customStrings.classList.add('hidden');
      const presets = {
        all:    [true, true, true, true, true, true],
        high:   [true, true, true, false, false, false],
        middle: [false, true, true, true, false, false],
        low:    [false, false, false, true, true, true]
      };
      state.activeStrings = presets[val];
      updateStringCheckboxes();
      saveSettings();
      newRound();
    }
  });

  // Individual string checkboxes
  initStringCheckboxes();

  // Show/hide toggles
  const showMode = document.getElementById('show-mode');
  showMode.checked = state.showModeName;
  showMode.addEventListener('change', () => {
    state.showModeName = showMode.checked;
    saveSettings();
    document.getElementById('mode-name').classList.toggle('hidden', !state.showModeName);
  });

  const showChord = document.getElementById('show-chord');
  showChord.checked = state.showChordName;
  showChord.addEventListener('change', () => {
    state.showChordName = showChord.checked;
    saveSettings();
    newRound();
  });

  const showDegrees = document.getElementById('show-degrees');
  showDegrees.checked = state.showScaleDegrees;
  showDegrees.addEventListener('change', () => {
    state.showScaleDegrees = showDegrees.checked;
    saveSettings();
    newRound();
  });

  const parentKey = document.getElementById('parent-key-degrees');
  parentKey.checked = state.parentKeyDegrees;
  parentKey.addEventListener('change', () => {
    state.parentKeyDegrees = parentKey.checked;
    // Auto-enable scale degrees when parent key is turned on
    if (parentKey.checked && !state.showScaleDegrees) {
      state.showScaleDegrees = true;
      showDegrees.checked = true;
    }
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

function initStringCheckboxes() {
  const container = document.getElementById('custom-strings');
  container.innerHTML = '';
  STRING_LABELS.forEach((label, idx) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'string-checkbox';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.activeStrings[idx];
    cb.dataset.string = idx;
    cb.addEventListener('change', () => {
      state.activeStrings[idx] = cb.checked;
      // Ensure at least one string is active
      if (!state.activeStrings.some(s => s)) {
        state.activeStrings[idx] = true;
        cb.checked = true;
      }
      detectStringPreset();
      saveSettings();
      newRound();
    });
    wrapper.appendChild(cb);
    wrapper.appendChild(document.createTextNode(label));
    container.appendChild(wrapper);
  });
}

function updateStringCheckboxes() {
  const checkboxes = document.querySelectorAll('#custom-strings input[type="checkbox"]');
  checkboxes.forEach((cb, idx) => {
    cb.checked = state.activeStrings[idx];
  });
}

function detectStringPreset() {
  const s = state.activeStrings;
  const stringPreset = document.getElementById('string-preset');
  const customStrings = document.getElementById('custom-strings');

  if (s.every(v => v)) {
    stringPreset.value = 'all';
    customStrings.classList.add('hidden');
  } else if (s[0] && s[1] && s[2] && !s[3] && !s[4] && !s[5]) {
    stringPreset.value = 'high';
    customStrings.classList.add('hidden');
  } else if (!s[0] && s[1] && s[2] && s[3] && !s[4] && !s[5]) {
    stringPreset.value = 'middle';
    customStrings.classList.add('hidden');
  } else if (!s[0] && !s[1] && !s[2] && s[3] && s[4] && s[5]) {
    stringPreset.value = 'low';
    customStrings.classList.add('hidden');
  } else {
    stringPreset.value = 'custom';
    customStrings.classList.remove('hidden');
  }
}

function updatePositionOptions() {
  const posSelect = document.getElementById('position-select');
  posSelect.innerHTML = '';

  // Root option (same as key center)
  const rootOpt = document.createElement('option');
  rootOpt.value = '0';
  rootOpt.textContent = 'Root';
  posSelect.appendChild(rootOpt);

  // Random option
  const randOpt = document.createElement('option');
  randOpt.value = '-1';
  randOpt.textContent = 'Random';
  posSelect.appendChild(randOpt);

  // Position options depend on the scale and key center
  const scaleKey = state.scaleKey;
  if (scaleKey !== 'random' && state.modeIndex !== null) {
    const def = SCALE_DEFS[scaleKey];
    const numModes = def.modes.length;
    for (let offset = 1; offset < numModes; offset++) {
      const shapeModeIdx = (state.modeIndex + offset) % numModes;
      const opt = document.createElement('option');
      opt.value = offset;
      opt.textContent = `Pos ${offset + 1} — ${def.modes[shapeModeIdx]}`;
      posSelect.appendChild(opt);
    }
  }

  // Restore selection
  posSelect.value = state.positionOffset;
  // If the value wasn't found (e.g., offset out of range after scale change), reset to root
  if (posSelect.value !== String(state.positionOffset)) {
    state.positionOffset = 0;
    posSelect.value = '0';
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

  // Show specific chords when key center is fixed and scale is not random
  const scaleKey = state.scaleKey;
  if (scaleKey !== 'random' && state.modeIndex !== null) {
    const chords = getAvailableChords(scaleKey, state.modeIndex);
    chords.forEach((chord, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = chord.romanNumeral;
      chordSelect.appendChild(opt);
    });
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
