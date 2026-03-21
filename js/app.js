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
    saveSettings();
    newRound();
  });

  // Mode selector
  updateModeOptions();

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
    document.getElementById('chord-info').classList.toggle('hidden', !state.showChordName);
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

  modeSelect.addEventListener('change', () => {
    const val = modeSelect.value;
    if (val === 'random') {
      state.modeIndex = null;
      state.scaleKey = state.scaleKey; // keep current
    } else if (val.includes(':')) {
      // Grouped mode from "random" scale
      const [key, idx] = val.split(':');
      state.scaleKey = key;
      state.modeIndex = parseInt(idx);
      document.getElementById('scale-select').value = key;
    } else {
      state.modeIndex = parseInt(val);
    }
    saveSettings();
    newRound();
  });
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
