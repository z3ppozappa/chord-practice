# Triad Quiz Enhancements Plan

## Feature 1: Hidden Notes Mode (v5.3)

**Toggle button** in triad quiz settings. Fretboard structure stays visible (fret numbers, string labels, fret wires) but all note dots are invisible until tapped. Correct taps reveal with green styling (identical to current "found" look). Wrong taps flash red briefly then disappear.

### Changes

**`index.html`** — Add toggle: `<button id="tq-hidden" class="settings-toggle">Hidden</button>`

**`js/triad-quiz.js`**
- Add `tqState.hiddenMode: false`
- `tqRender()`: when `hiddenMode` is true, render dots with transparent fill/stroke and invisible text (same hit areas, same SVG structure)
- `tqHandleDotTap()`: correct → `tqMarkDotCorrect()` reveals note with green styling. Wrong → flash red briefly then hide again
- `initTriadQuizUI()`: wire toggle click handler, toggle `.active`, re-render if active

---

## Feature 2: Grid Mode (v5.4)

**Toggle button** in triad quiz settings. Replaces fretboard with a 3×4 grid of all 12 chromatic notes ordered A through G#:

```
  A    A#    B    C
  C#   D     D#   E
  F    F#    G    G#
```

Player taps the 3 chord tones in any order. No fretboard, no strings, no frets.

### Changes

**`index.html`** — Add toggle: `<button id="tq-grid" class="settings-toggle">Grid</button>`

**`js/triad-quiz.js`**
- Add `tqState.gridMode: false`
- New `tqRenderGrid()`: builds HTML grid into `#tq-fretboard`, 12 cells with note names, click handlers
- Note order: A(9), A#(10), B(11), C(0), C#(1), D(2), D#(3), E(4), F(5), F#(6), G(7), G#(8)
- New `tqHandleGridTap(noteIndex, cell)`: match against chord.root/thirdNote/fifthNote. Correct → green. Wrong → flash red + strike. 3 found → complete round
- `tqRender()`: if `gridMode`, call `tqRenderGrid()` instead of SVG fretboard
- Grid mode: always 3 notes to find (ignores find-all cap), ignores hidden mode, ignores position selector
- `initTriadQuizUI()`: wire toggle, re-render if active

**`css/style.css`**
- `.tq-note-grid`: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 400px; margin: 0 auto;`
- `.tq-grid-cell`: rounded box, ~60px height, centered text, dark bg (`#1e1e35`), border (`#333355`), pointer cursor
- `.tq-grid-cell.correct`: green bg (`#1a5c3a`), green border (`#48bb78`), light text
- `.tq-grid-cell.wrong`: brief red flash via class + setTimeout removal

---

## Implementation Order

1. Hidden notes mode (simpler — visibility changes to existing render)
2. Grid mode (new render path, new tap handler, new CSS)
