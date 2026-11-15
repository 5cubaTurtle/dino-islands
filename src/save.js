// Progress (crowns + last chosen dinosaur) kept in the browser's localStorage.
const KEY = 'dinoIsland.v1';

export function loadSave() {
  const fresh = { species: 'trex', crowns: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { ...fresh, ...s, crowns: { ...(s.crowns || {}) } };
  } catch { /* storage blocked or empty */ }
  return fresh;
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
