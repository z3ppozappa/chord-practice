# Feature Plan: Hard Mode + Triad Quiz

## Feature 1: Hard Mode (Fretboard Game Enhancement)

### Concept
A toggle that hides all scale-position dots on the fretboard. The user must tap/click where they think chord tones are on a blank fretboard (only fret markers and strings visible). This forces true fretboard memorization rather than pattern recognition.

### Behavior Changes
- **Dots hidden by default**: Scale notes are not rendered as visible circles. The fretboard looks "empty" — just strings, frets, and fret markers.
- **Tap to reveal**: When the user clicks/taps a fret position, it checks if a chord tone is there. Correct → green dot appears. Wrong → red flash at that position, strike counted.
- **Chord name always shown**: Hard mode forces `showChordName = true` so the user knows what they're looking for (e.g. "Find ii (D - F - A)"). Without this it's impossible.
- **Scale degrees hidden**: The degree labels are irrelevant when dots aren't shown, so `showScaleDegrees` is effectively off in hard mode.

### Implementation

**State**: Add `hardMode: false` to state, persist in localStorage.

**UI**: Add checkbox `<label><input type="checkbox" id="hard-mode"> Hard mode</label>` in the settings row. When toggled on, force chord name visible (update `showChordName` checkbox to checked & disabled).

**Fretboard rendering** (`fretboard.js`):
- Add a `hardMode` parameter to `renderFretboard()`.
- In hard mode: render invisible hit areas at ALL fret/string intersections within the visible fret range (not just where scale notes are). The circles themselves start fully transparent/hidden.
- On correct tap → animate the dot appearing (green).
- On wrong tap → flash red at that position briefly, no dot remains.

**Game logic** (`game.js`):
- `handleNoteClick` already handles correct/wrong — the main change is that in hard mode, we need hit targets everywhere, not just on scale notes.
- Actually, rethinking: we can keep the existing dots but just make them invisible (fill=transparent, stroke=transparent). The hit areas are already there. This is simpler.
- In hard mode, ALL dots (not just chord tones) need to be clickable hit targets, and clicking a scale-but-not-chord-tone counts as wrong (same as current behavior for non-chord tones). Clicking completely off any scale note position also needs handling — we'd need hit areas at every fret/string combo OR we accept that only scale positions are clickable (simpler, and honestly fine since adjacent frets would be close enough).

**Simpler approach**: Keep current dot rendering but make dots invisible in hard mode:
- Set circle fill to transparent, stroke to transparent (or match background).
- Keep hit areas as-is (they're already invisible 22px targets on scale positions).
- Click behavior stays the same — correct chord tone → reveal green, wrong scale note → flash red.
- This means user can only click scale positions (not arbitrary frets), but since dots are invisible they don't know which positions are scale notes vs empty. Close enough fret spacing makes this feel like "anywhere on the fretboard."

**Verdict**: Go with the simpler approach. The existing invisible hit areas on scale note positions are sufficient. Just hide the dot visuals.

### Files Changed
- `index.html` — add checkbox
- `js/game.js` — add state, save/load, pass to renderer
- `js/app.js` — wire checkbox, force showChordName when hard mode on
- `js/fretboard.js` — accept hardMode param, hide dots initially when true
- `css/style.css` — no major changes needed

---

## Feature 2: Triad Quiz (Separate Activity)

### Concept
A new standalone activity (separate view from the fretboard game) focused on memorizing which notes make up triads. Given a chord name (e.g. "Dm"), the user selects the 3rd and 5th from a list of note buttons. The root is auto-selected since it's obvious from the chord name.

### Modes of Operation

**Mode A — "Random Chord"**: Shows a random triad (from any diatonic chord in any key). User picks the notes. Covers all 4 qualities: major, minor, diminished, augmented.

**Mode B — "Diatonic Key Drill"**: User picks a key (e.g. "C Major" or "A Harmonic Minor"). The quiz cycles through all 7 diatonic triads of that key one at a time. Good for learning all chords in a key together.

### Chord Coverage

**From Major scale modes** (7 modes × 7 chords each, but same chord set per parent key):
- Major (I, IV, V)
- Minor (ii, iii, vi)
- Diminished (vii°)

**From Harmonic Minor modes** (7 modes × 7 chords):
- Minor (i, iv)
- Diminished (ii°, vii°)
- Augmented (III+)
- Major (V, VI)

**Total unique quality types**: Major, Minor, Diminished, Augmented — all 4 triad types.

### Data Model

Build a lookup of all triads. For any root note + quality, the notes are deterministic:
- **Major**: root, root+4, root+7 (semitones)
- **Minor**: root, root+3, root+7
- **Diminished**: root, root+3, root+6
- **Augmented**: root, root+4, root+8

For the diatonic key drill, generate the 7 triads from the scale intervals (reuse existing `buildTriad` logic from scales.js).

### UI Layout

**Navigation**: Add a simple tab/view switcher at the top of the app. Two tabs: "Fretboard" (current game) and "Triad Quiz" (new). Only one is visible at a time. Keep it minimal — just two buttons/tabs.

**Triad Quiz View**:
```
[Settings Bar]
  Mode: [Random | Key Drill]
  Key selector (for Key Drill mode): [C Major ▾] [A Harmonic Minor ▾] etc.

[Chord Prompt]
  "What notes are in Dm?"
  or "Dm (D minor)"

[Note Grid]
  12 note buttons in a row (or 2 rows of 6):
  C  C♯  D  D♯  E  F  F♯  G  G♯  A  A♯  B

  Root button auto-selected (highlighted, non-interactive).
  User taps 3rd, then 5th (order doesn't matter).

[Feedback]
  Correct → green flash, auto-advance after brief delay
  Wrong → red flash on wrong note, show correct answer briefly

[Score]
  Streak counter (reuse same streak concept)
  Round timer
```

### Game Flow

1. Pick a chord (random or next in diatonic cycle)
2. Display chord name (e.g. "E°" or "F+" or "Am")
3. Auto-highlight root note
4. User taps two more notes (3rd and 5th)
5. Each tap: if correct → highlight green; if wrong → flash red, mark strike
6. After both found → short pause → next chord
7. Track streak of perfect rounds

### Implementation

**New files**:
- `js/triad-quiz.js` — quiz state, logic, chord generation, note checking
- `css/triad-quiz.css` (or add to style.css) — quiz-specific styles

**Modified files**:
- `index.html` — add tab switcher, add quiz view HTML, include new script
- `js/scales.js` — possibly extract/export triad interval logic (or just reuse NOTE_NAMES and the semitone math)
- `css/style.css` — add tab navigation styles

**State** (separate from fretboard game state):
```javascript
const quizState = {
  mode: 'random',        // 'random' or 'keyDrill'
  drillScaleKey: 'major', // which scale for key drill
  drillRoot: 0,          // root note index (0-11) for key drill
  drillModeIndex: 0,     // which mode
  drillDegreeIndex: 0,   // current position in diatonic cycle

  currentChord: null,    // { root, quality, third, fifth, name }
  foundThird: false,
  foundFifth: false,

  streak: 0,
  bestStreak: 0,
  strikes: 0,
  round: 0,
  roundStartTime: null,
  bestRoundTime: null,
};
```

**Chord generation for random mode**:
- Pick random root (0-11)
- Pick random quality from [major, minor, diminished, augmented]
- But weight toward diatonic chords (optional — or just pure random)
- Better approach: pick a random key + random scale type + random degree, build the triad. This ensures only real diatonic chords appear (no random "C augmented" which isn't diatonic to anything common... actually C+ is diatonic to Ab harmonic minor. All 4 qualities appear in harmonic minor, so this works).

**Chord generation for key drill mode**:
- User selects root note + scale type (major or harmonic minor) + mode
- Cycle through degrees 0-6, building each triad
- Shuffle order or go in order (user preference, or just sequential for learning)

### View Switching

Simple approach — no router needed:
```html
<div id="tab-bar">
  <button class="tab active" data-view="fretboard">Fretboard</button>
  <button class="tab" data-view="triad-quiz">Triad Quiz</button>
</div>
<main id="fretboard-view">...</main>
<main id="triad-quiz-view" class="hidden">...</main>
```

Tab clicks toggle `hidden` class on the two views. Minimal JS in app.js.

---

## Implementation Order

1. **Hard Mode** first (smaller scope, touches existing code)
   - Add state + checkbox
   - Modify fretboard rendering for hidden dots
   - Force chord name visible
   - Test

2. **Triad Quiz** second (new feature, mostly additive)
   - Add tab navigation
   - Build quiz HTML structure
   - Implement triad-quiz.js (chord gen, note checking, scoring)
   - Style the quiz view
   - Test

## Summary of All File Changes

| File | Hard Mode | Triad Quiz |
|------|-----------|------------|
| `index.html` | checkbox | tabs, quiz HTML, script tag |
| `js/game.js` | state, save/load | — |
| `js/app.js` | wire checkbox | tab switching |
| `js/fretboard.js` | hide dots param | — |
| `js/triad-quiz.js` | — | NEW: all quiz logic |
| `css/style.css` | minor | tabs + quiz styles |
