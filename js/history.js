// Practice history storage: save, load, prune, export, import, query

const HISTORY_KEY = 'chordPracticeHistory';
const HISTORY_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function historyLoad() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function historySave(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function historyPrune(entries) {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  return entries.filter(e => e.ts >= cutoff);
}

function historyAdd(entry) {
  const entries = historyLoad();
  entries.push(entry);
  historySave(historyPrune(entries));
}

function historyExport() {
  const entries = historyLoad();
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `chord-practice-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function historyImport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        if (!Array.isArray(incoming)) {
          reject(new Error('Invalid file format'));
          return;
        }
        const existing = historyLoad();
        const existingTs = new Set(existing.map(e => e.ts));
        const merged = [...existing];
        let added = 0;
        for (const entry of incoming) {
          if (entry.ts && !existingTs.has(entry.ts)) {
            merged.push(entry);
            added++;
          }
        }
        historySave(historyPrune(merged));
        resolve(added);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// Query helpers

function historyFilter(game) {
  return historyLoad().filter(e => e.game === game && e.time <= 60000);
}

function historyGroupBy(entries, key) {
  const groups = {};
  for (const e of entries) {
    const k = e[key];
    if (k === undefined || k === null) continue;
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  }
  return groups;
}

function historyStats(entries) {
  if (entries.length === 0) return { count: 0, successRate: 0, avgTime: 0 };
  const perfect = entries.filter(e => e.perfect).length;
  const totalTime = entries.reduce((sum, e) => sum + e.time, 0);
  return {
    count: entries.length,
    successRate: Math.round((perfect / entries.length) * 100),
    avgTime: Math.round(totalTime / entries.length)
  };
}
