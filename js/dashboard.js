// Dashboard rendering

function renderDashboard() {
  renderScaleDashboard();
  renderTriadDashboard();
  initDashboardActions();
}

// --- Scale Finder ---

function getModeName(scaleType, modeIndex) {
  const def = SCALE_DEFS[scaleType];
  if (!def) return `${scaleType} #${modeIndex}`;
  return def.modes[modeIndex] || `Mode ${modeIndex}`;
}

const QUALITY_LABELS = { '': 'Major', 'm': 'Minor', '°': 'Dim', '+': 'Aug' };

function renderScaleDashboard() {
  const entries = historyFilter('scale');
  const summary = historyStats(entries);

  // Summary
  const sumEl = document.getElementById('dash-scale-summary');
  sumEl.innerHTML = entries.length === 0
    ? '<div class="dash-empty">No scale finder data yet. Play some rounds!</div>'
    : renderSummary(summary);

  if (entries.length === 0) {
    document.getElementById('dash-scale-keycenter').innerHTML = '';
    document.getElementById('dash-scale-shape').innerHTML = '';
    document.getElementById('dash-scale-quality').innerHTML = '';
    return;
  }

  // By Key Center
  const byKC = historyGroupBy(entries, 'keyCenter');
  const kcRows = Object.entries(byKC).map(([idx, group]) => {
    const scaleType = group[0].scaleType;
    return { label: getModeName(scaleType, parseInt(idx)), ...historyStats(group) };
  });
  document.getElementById('dash-scale-keycenter').innerHTML = renderBarChart(kcRows);

  // By Shape
  const byShape = historyGroupBy(entries, 'shape');
  const shapeRows = Object.entries(byShape).map(([idx, group]) => {
    const scaleType = group[0].scaleType;
    return { label: getModeName(scaleType, parseInt(idx)) + ' shape', ...historyStats(group) };
  });
  document.getElementById('dash-scale-shape').innerHTML = renderBarChart(shapeRows);

  // By Chord Quality
  const byQuality = historyGroupBy(entries, 'chordQuality');
  const qualityRows = Object.entries(byQuality).map(([q, group]) => ({
    label: QUALITY_LABELS[q] || q, ...historyStats(group)
  }));
  document.getElementById('dash-scale-quality').innerHTML = renderBarChart(qualityRows);
}

// --- Triad Quiz ---

const FRET_REGION_LABELS = {
  '0-6': 'Frets 1–6',
  '4-11': 'Frets 5–11',
  '8-15': 'Frets 9–15',
  '11-19': 'Frets 12–19',
  '14-24': 'Frets 15+'
};

function renderTriadDashboard() {
  const entries = historyFilter('triad');
  const summary = historyStats(entries);

  const sumEl = document.getElementById('dash-triad-summary');
  sumEl.innerHTML = entries.length === 0
    ? '<div class="dash-empty">No triad quiz data yet. Play some rounds!</div>'
    : renderSummary(summary);

  if (entries.length === 0) {
    document.getElementById('dash-triad-quality').innerHTML = '';
    document.getElementById('dash-triad-region').innerHTML = '';
    return;
  }

  // By Chord Quality
  const byQuality = historyGroupBy(entries, 'tqChordQuality');
  const qualityRows = Object.entries(byQuality).map(([q, group]) => ({
    label: QUALITY_LABELS[q] || q, ...historyStats(group)
  }));
  document.getElementById('dash-triad-quality').innerHTML = renderBarChart(qualityRows);

  // By Fret Region
  const byRegion = historyGroupBy(entries, 'tqFretRegion');
  const regionRows = Object.entries(byRegion).map(([r, group]) => ({
    label: FRET_REGION_LABELS[r] || r, ...historyStats(group)
  }));
  document.getElementById('dash-triad-region').innerHTML = renderBarChart(regionRows);
}

// --- Shared rendering ---

function renderSummary(stats) {
  return `<div class="dash-summary-row">
    <span class="dash-stat"><span class="dash-stat-value">${stats.count}</span><span class="dash-stat-label">rounds</span></span>
    <span class="dash-stat"><span class="dash-stat-value">${stats.successRate}%</span><span class="dash-stat-label">perfect</span></span>
    <span class="dash-stat"><span class="dash-stat-value">${formatDashTime(stats.avgTime)}</span><span class="dash-stat-label">avg time</span></span>
  </div>`;
}

function formatDashTime(ms) {
  const sec = (ms / 1000).toFixed(1);
  return sec + 's';
}

function renderBarChart(rows) {
  // Sort worst-first
  rows.sort((a, b) => a.successRate - b.successRate);

  return rows.map(row => {
    const color = row.successRate >= 80 ? 'bar-green'
      : row.successRate >= 60 ? 'bar-yellow' : 'bar-red';
    return `<div class="dash-bar-row">
      <span class="dash-bar-label">${row.label}</span>
      <div class="dash-bar-track">
        <div class="dash-bar-fill ${color}" style="width:${row.successRate}%"></div>
      </div>
      <span class="dash-bar-stats">${row.successRate}% <span class="dash-bar-count">(${row.count})</span> ${formatDashTime(row.avgTime)}</span>
    </div>`;
  }).join('');
}

// --- Export/Import ---

function initDashboardActions() {
  const exportBtn = document.getElementById('dash-export');
  const exportCsvBtn = document.getElementById('dash-export-csv');
  const importBtn = document.getElementById('dash-import-btn');
  const clearBtn = document.getElementById('dash-clear');
  const importInput = document.getElementById('dash-import');
  const statusEl = document.getElementById('dash-import-status');

  exportBtn.onclick = () => historyExport();
  exportCsvBtn.onclick = () => historyExportCSV();

  clearBtn.onclick = () => {
    if (confirm('Clear all practice history? This cannot be undone.')) {
      historySave([]);
      renderDashboard();
    }
  };

  importBtn.onclick = () => importInput.click();

  importInput.onchange = async () => {
    if (!importInput.files.length) return;
    try {
      const added = await historyImport(importInput.files[0]);
      statusEl.textContent = `Imported ${added} new entries`;
      statusEl.className = 'dash-import-success';
      renderDashboard();
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      statusEl.className = 'dash-import-error';
    }
    importInput.value = '';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  };
}
