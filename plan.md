# Analytics Dashboard Plan

## Storage

**localStorage** with JSON, keyed as `chordPracticeHistory`.

**Data model — one entry per completed round:**

```js
{
  game: 'scale' | 'triad',
  ts: 1711000000000,        // timestamp (used for dedup on import)
  time: 8234,               // ms to complete
  perfect: true,            // no strikes
  strikes: 0,               // 0-2

  // Scale Finder only:
  scaleType: 'major',       // major, harmonicMinor, pentatonic
  keyCenter: 2,             // mode index (0=Ionian, 1=Dorian, etc.)
  shape: 3,                 // shape mode index
  chordQuality: 'm',        // '', 'm', '°', '+'
  chordNumeral: 'ii',       // roman numeral
  hardMode: false,

  // Triad Quiz only:
  tqChordQuality: 'm',     // '', 'm', '°', '+'
  tqChordRoot: 0,           // 0-11
  tqFretRegion: '0-6',      // fret range string
  tqFindAll: true
}
```

**90-day rolling retention** — prune entries older than 90 days on each save.

## Export/Import

- **Export**: JSON file download. Button on Dashboard tab.
- **Import**: File picker that loads JSON and merges entries (deduplicate by timestamp).
- Format: `chord-practice-YYYY-MM-DD.json`

## Dashboard Tab

Third tab in the tab bar: **Scale Finder | Triad Quiz | Dashboard**

### Scale Finder Stats
1. **By Key Center** — success rate + avg time per mode name (Ionian, Dorian, etc.). Sorted worst-first.
2. **By Shape** — same breakdown by shape/position played.
3. **By Chord Quality** — success rate for major/minor/dim/aug.
4. **Summary** — total rounds, overall success rate, avg time.

### Triad Quiz Stats
1. **By Chord Quality** — success rate + avg time for major/minor/dim/aug.
2. **By Fret Region** — success rate per position range.
3. **Summary** — total rounds, overall success rate, avg time.

### Visual Style
- Same dark theme
- CSS-only horizontal bar charts showing success % with count labels
- Color coding: green (>80%), yellow (60-80%), red (<60%)

## Implementation Order

1. **js/history.js** — save, load, prune, export, import, query helpers
2. **Hook completeRound()** in game.js — log scale finder rounds
3. **Hook tqCompleteRound()** in triad-quiz.js — log triad quiz rounds
4. **Dashboard HTML** — new tab view with sections
5. **js/dashboard.js** — aggregate + render
6. **Export/Import UI** — buttons + file handling
7. **CSS** — bar charts, layout, color coding
