// Game settings, editable from the Settings screen and kept in this browser's localStorage.
// Rounds end early once both sides have locked in. Before the answer timer starts, players get
// time to read the question: its words at `readingWordsPerSecond`, plus `readingBufferSeconds`.
export const DEFAULTS = {
  questionsPerGame: 4,
  roundSeconds: 15,
  readingWordsPerSecond: 3,
  readingBufferSeconds: 3,
  briefingSeconds: 3,
  /** 0 = each reveal waits for Space (or both phones tapping Next). */
  autoContinueSeconds: 0,
};
export type Settings = typeof DEFAULTS;

const KEY = 'savannah-shield-settings';

function load(): Partial<Settings> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return Object.fromEntries(Object.keys(DEFAULTS).filter((k) => Number.isFinite(saved[k])).map((k) => [k, saved[k]]));
  } catch {
    return {};
  }
}

/** Live settings: read these at use time, not at import, so changes apply to the next game. */
export const settings: Settings = { ...DEFAULTS, ...load() };

export function saveSettings(next: Settings): void {
  Object.assign(settings, next);
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function resetSettings(): void {
  Object.assign(settings, DEFAULTS);
  localStorage.removeItem(KEY);
}

/** Pacing of the reveal animations (not a setting: the scene is tuned to it). */
export const REVEAL_SECONDS = 10;

export const DEFENDER_TITLE = 'Westpac Cyber Defender';
