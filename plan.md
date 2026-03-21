# Guitar Chord Tone Finder — Implementation Plan

## Overview

A single-page web app (HTML + CSS + vanilla JS, no build tools) that displays 3NPS scale shapes on a fretboard diagram and challenges the player to click on the chord tones (3rd, 5th, 7th) of the diatonic chord for that mode. Runs locally by opening `index.html` in a browser.

---

## Core Concepts & Music Theory

### Scales & Modes

| Scale Family | Modes | # of 3NPS shapes |
|---|---|---|
| **Major** | Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian | 7 |
| **Harmonic Minor** | Harm. minor, Locrian ♮6, Ionian #5, Dorian #4, Phrygian dominant, Lydian #2, Ultralocrian | 7 |
| **Pentatonic** | Major pent. (pos 1–5), Minor pent. (pos 1–5) — standard 2NPS box shapes | 5 |

### Diatonic Chords

Each mode implies a chord quality built on its root degree. The game tells the player "Find the 3, 5, and 7 of the **iii** chord" (for example). The chord tones are simply scale degrees 3, 5, and 7 relative to *that mode's root* — which are already baked into the shape.

### 3NPS Pattern Generation

Rather than hard-coding 19 fingering charts, patterns are **computed algorithmically**:

1. Define each scale as semitone intervals from root (e.g., major = `[0,2,4,5,7,9,11]`).
2. Pick a mode (rotation of the interval set).
3. Starting from string 6, place scale tones per string (3NPS for major/harmonic minor, 2NPS for pentatonic), computing fret positions using standard tuning offsets `[0, 5, 10, 15, 19, 24]`.
4. Allow the pattern to shift position across strings as needed (natural 3NPS behavior).
5. Assign each note its scale degree (1–7) so we know which dots are chord tones.

This handles all scales, all modes, and any future additions with zero manual data entry.

---

## Architecture

```
index.html          — single page, all markup
css/
  style.css         — layout, fretboard styling, animations
js/
  scales.js         — scale/mode definitions, interval data, chord qualities
  fretboard.js      — SVG fretboard rendering, pattern placement, click handling
  game.js           — game loop, scoring, round management, settings state
  app.js            — init, wiring everything together
```

### Data Layer (`scales.js`)

- **Scale intervals**: `{ major: [0,2,4,5,7,9,11], harmonicMinor: [0,2,3,5,7,8,11], pentatonic: [0,2,4,7,9] }`
- **Mode names**: mapped by scale family + index (e.g., major mode 2 = "Dorian")
- **Diatonic chord quality per degree**: derived from the intervals (min7, maj7, dom7, m7b5, etc.)
- **Chord numeral labels**: I, ii, iii, IV, V, vi, vii° etc.
- `getChordToneDegrees(mode)` → returns which scale degrees are the 3, 5, 7 for that mode's diatonic chord

### Fretboard Renderer (`fretboard.js`)

- Draws an SVG fretboard section (typically 5–6 frets wide, 6 strings)
- Renders scale-shape dots at computed positions
- Each dot stores its scale degree as data
- Dots are clickable/tappable — clicking a dot marks it as "selected"
- Visual states: **neutral** (scale tone), **correct** (found chord tone, green), **wrong** (not a chord tone, brief red flash + shake), **root highlight** (slightly different color so player orients)
- Fret numbers shown below the diagram for orientation
- Optional: string names (E A D G B e) on the left

### Game Engine (`game.js`)

**Round flow:**
1. Pick a scale family + mode (random or from user selection)
2. Pick a random starting fret (so the shape appears at different positions each time — reinforces shape recognition, not fret memorization)
3. Compute the 3NPS pattern and render it
4. Display prompt: *"Find the **3rd**, **5th**, and **7th**"* — and show the chord name (e.g., "Dm7 — ii chord")
5. Player clicks dots. Correct chord-tone clicks turn green and stay. Wrong clicks flash red briefly.
6. The player must find **every instance** of each chord tone across the entire shape (not just one of each). For a 3NPS shape (18 notes) or 2NPS pentatonic shape (12 notes), there may be ~7–8 chord tones total spread across the fretboard. A progress tracker shows e.g. "3rds: 2/3  5ths: 1/2  7ths: 0/2" so the player knows how many remain.
7. Once every chord tone in the shape is found, the round completes with a brief success animation, score updates, and next round auto-starts after a short delay.

**Scoring:**
- +1 point per correct chord tone identified (typically ~7–8 per round if no mistakes)
- −1 for wrong clicks
- Streak counter (consecutive correct clicks without a miss)
- Running total displayed prominently

**Timer:**
- Elapsed timer starts when the round begins (first dot appears), pauses between rounds
- Displays per-round time and cumulative session time
- Per-round time shown on completion so the player can track improvement
- No countdown/pressure timer — the goal is accuracy and pattern recognition, speed comes naturally

**Settings (persisted to localStorage):**
- Scale family: Major / Pentatonic / Harmonic Minor / Random
- Mode: specific mode or Random
- **String set filter**: All strings / High strings (G, B, e) / Low strings (E, A, D) / Middle strings (D, G, B) / Custom — only dots on selected strings are shown and need to be identified. Non-selected strings are grayed out on the fretboard for context but have no interactive dots.
- Show/hide mode name on the diagram (toggle) — useful for learning to visually ID modes
- Show/hide chord name (toggle) — can hide for extra challenge

### UI Layout (`index.html` + `style.css`)

```
┌─────────────────────────────────────────────┐
│  ⚙ Settings bar                             │
│  [Scale: Major ▾] [Mode: Random ▾]         │
│  [☑ Show mode name] [☑ Show chord name]    │
│  [Strings: All ▾]                           │
├─────────────────────────────────────────────┤
│                                             │
│  Mode: Dorian          (if toggled on)      │
│  Find the 3, 5, 7 of: ii (Dm7)             │
│                                             │
│  ┌─── Fretboard ──────────────────────┐     │
│  │  ●───●───────●──────────────────── │ e   │
│  │  ────●───●───────●──────────────── │ B   │
│  │  ●───────●───●──────────────────── │ G   │
│  │  ────●───●───────●──────────────── │ D   │
│  │  ●───────●───●──────────────────── │ A   │
│  │  ────●───●───────●──────────────── │ E   │
│  │  5   6   7   8   9                 │     │
│  └────────────────────────────────────┘     │
│                                             │
│  Score: 12   Streak: 5   Round: 4   ⏱ 1:23  │
│                                             │
│  [3rds: 1/3   5ths: 0/2   7ths: 0/2]       │
│                                             │
└─────────────────────────────────────────────┘
```

- Responsive: works on phone (portrait) and desktop
- Dark background (easier on eyes, looks like a guitar app)
- Large tap targets on dots for mobile

---

## Implementation Steps

### Step 1: Project scaffold
- Create `index.html`, `css/style.css`, `js/scales.js`, `js/fretboard.js`, `js/game.js`, `js/app.js`
- Basic HTML structure with settings bar, fretboard container, score display

### Step 2: Scale data (`scales.js`)
- Define all scale intervals, mode names, and chord qualities
- Implement `computePattern(scaleType, modeIndex, startFret)` → array of `{ string, fret, degree }` objects
- Implement `getChordTones(scaleType, modeIndex)` → which degrees are the 3, 5, 7
- Implement chord label generation (roman numeral + quality)

### Step 3: Fretboard rendering (`fretboard.js`)
- SVG-based fretboard drawing (strings, frets, fret markers, string labels)
- Render pattern dots from computed positions
- Wire up click handlers on dots

### Step 4: Game loop (`game.js`)
- Round generation, prompt display, click validation
- Score/streak tracking
- Settings state management + localStorage persistence
- Round transitions with brief delay

### Step 5: Styling & polish (`style.css`)
- Dark theme, responsive layout
- Dot state animations (correct = green pulse, wrong = red shake)
- Mobile-friendly sizing

### Step 6: Testing & tuning
- Verify all 19 scale shapes compute correctly
- Verify chord tone mapping is accurate for every mode
- Test on mobile viewport
