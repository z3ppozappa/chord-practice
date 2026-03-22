// SVG fretboard rendering and interaction

function createSVGElement(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val);
  }
  return el;
}

function renderFretboard(containerId, pattern, activeStrings, onNoteClick, showDegrees) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const frets = pattern.map(n => n.fret);
  const minFret = Math.min(...frets);
  const maxFret = Math.max(...frets);

  const firstWireFret = Math.max(0, minFret - 1);
  const lastWireFret = maxFret + 1;
  const numSpaces = lastWireFret - firstWireFret;
  const numWires = numSpaces + 1;

  const pad = { top: 35, bottom: 55, left: 45, right: 25 };
  const stringSpacing = 36;
  const fretSpacing = 65;
  const width = pad.left + numSpaces * fretSpacing + pad.right;
  const height = pad.top + 5 * stringSpacing + pad.bottom;

  const svg = createSVGElement('svg', {
    class: 'fretboard-svg',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet'
  });

  // Fret markers (dots at 3,5,7,9,12,15,17,19,21,24)
  const singleMarkers = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleMarkers = [12, 24];

  for (let i = 0; i < numSpaces; i++) {
    const fretNum = firstWireFret + i + 1;
    const cx = pad.left + (i + 0.5) * fretSpacing;

    if (doubleMarkers.includes(fretNum)) {
      svg.appendChild(createSVGElement('circle', {
        cx, cy: pad.top + 1.5 * stringSpacing, r: 4, fill: '#252535'
      }));
      svg.appendChild(createSVGElement('circle', {
        cx, cy: pad.top + 3.5 * stringSpacing, r: 4, fill: '#252535'
      }));
    } else if (singleMarkers.includes(fretNum)) {
      svg.appendChild(createSVGElement('circle', {
        cx, cy: pad.top + 2.5 * stringSpacing, r: 4, fill: '#252535'
      }));
    }
  }

  // Fret wires
  for (let i = 0; i < numWires; i++) {
    const fretNum = firstWireFret + i;
    const x = pad.left + i * fretSpacing;
    const isNut = fretNum === 0;
    svg.appendChild(createSVGElement('line', {
      x1: x, y1: pad.top,
      x2: x, y2: pad.top + 5 * stringSpacing,
      stroke: isNut ? '#ccc' : '#444',
      'stroke-width': isNut ? 5 : 1.5
    }));
  }

  // Strings
  for (let s = 0; s < 6; s++) {
    const y = pad.top + s * stringSpacing;
    const active = activeStrings[s];
    const thickness = 0.8 + (5 - s) * 0.25;
    svg.appendChild(createSVGElement('line', {
      x1: pad.left, y1: y,
      x2: pad.left + numSpaces * fretSpacing, y2: y,
      stroke: active ? '#888' : '#333',
      'stroke-width': thickness
    }));

    // String label
    const label = createSVGElement('text', {
      x: pad.left - 22, y: y + 5,
      fill: active ? '#777' : '#333',
      'font-size': '13',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle'
    });
    label.textContent = STRING_LABELS[s];
    svg.appendChild(label);
  }

  // Note dots
  const dots = [];
  pattern.forEach((note, idx) => {
    const active = activeStrings[note.string];
    const cx = pad.left + (note.fret - firstWireFret - 0.5) * fretSpacing;
    const cy = pad.top + note.string * stringSpacing;

    const group = createSVGElement('g', {
      class: 'note-dot',
      'data-index': idx
    });

    // Invisible hit area for better touch targets
    if (active) {
      const hitArea = createSVGElement('circle', {
        cx, cy, r: 22, fill: 'transparent', class: 'hit-area'
      });
      group.appendChild(hitArea);
    }

    const circle = createSVGElement('circle', {
      cx, cy, r: 16, class: 'dot-circle'
    });

    if (!active) {
      circle.setAttribute('fill', '#1e1e2e');
      circle.setAttribute('stroke', '#2a2a3a');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('opacity', '0.3');
    } else {
      circle.setAttribute('fill', '#2a2a3a');
      circle.setAttribute('stroke', '#4a4a5a');
      circle.setAttribute('stroke-width', '1.5');
    }

    group.appendChild(circle);

    // Chord function label (centered if no degree, offset up if dual)
    const chordLabelY = showDegrees ? cy - 1 : cy + 5;
    const labelChord = createSVGElement('text', {
      x: cx, y: chordLabelY,
      fill: '#fff',
      'font-size': '11',
      'font-weight': 'bold',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle',
      'pointer-events': 'none',
      class: 'dot-label-chord'
    });
    labelChord.textContent = note.label;
    labelChord.setAttribute('opacity', '0');
    group.appendChild(labelChord);

    // Scale degree label (bottom, hidden until revealed)
    const labelDegree = createSVGElement('text', {
      x: cx, y: cy + 11,
      fill: '#fff',
      'font-size': '9',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle',
      'pointer-events': 'none',
      class: 'dot-label-degree'
    });
    labelDegree.textContent = '';
    labelDegree.setAttribute('opacity', '0');
    group.appendChild(labelDegree);

    if (active) {
      group.style.cursor = 'pointer';
      group.addEventListener('click', () => {
        onNoteClick(idx, note, group);
      });
    }

    svg.appendChild(group);
    dots.push({ group, circle, labelChord, labelDegree, note, index: idx });
  });

  // Fret numbers (rendered after dots so they appear on top)
  for (let i = 0; i < numSpaces; i++) {
    const fretNum = firstWireFret + i + 1;
    const x = pad.left + (i + 0.5) * fretSpacing;
    const label = createSVGElement('text', {
      x, y: pad.top + 5 * stringSpacing + 30,
      fill: '#555',
      'font-size': '11',
      'font-family': 'system-ui, sans-serif',
      'text-anchor': 'middle',
      'pointer-events': 'none'
    });
    label.textContent = fretNum;
    svg.appendChild(label);
  }

  container.appendChild(svg);
  return dots;
}

function markDotCorrect(dot, showDegree) {
  const circle = dot.group.querySelector('.dot-circle');
  const labelChord = dot.group.querySelector('.dot-label-chord');
  const labelDegree = dot.group.querySelector('.dot-label-degree');
  const isRoot = dot.note.chordTone === 'root';

  if (isRoot) {
    circle.setAttribute('fill', '#1a6b3a');
    circle.setAttribute('stroke', '#38d878');
    circle.setAttribute('stroke-width', '3');
    labelChord.setAttribute('fill', '#c0ffd8');
    labelDegree.setAttribute('fill', '#80d0a0');
  } else {
    circle.setAttribute('fill', '#1a5c3a');
    circle.setAttribute('stroke', '#48bb78');
    circle.setAttribute('stroke-width', '2.5');
    labelChord.setAttribute('fill', '#a8f0c8');
    labelDegree.setAttribute('fill', '#70c8a0');
  }

  labelChord.setAttribute('opacity', '1');
  if (showDegree) {
    labelDegree.setAttribute('opacity', '1');
  }
  dot.group.classList.add('correct');
  dot.group.style.cursor = 'default';
}

function flashDotWrong(dot) {
  const circle = dot.group.querySelector('.dot-circle');
  dot.group.classList.add('wrong');
  circle.setAttribute('fill', '#5c1a1a');
  circle.setAttribute('stroke', '#f56565');

  setTimeout(() => {
    dot.group.classList.remove('wrong');
    circle.setAttribute('fill', '#2a2a3a');
    circle.setAttribute('stroke', '#4a4a5a');
  }, 400);
}
