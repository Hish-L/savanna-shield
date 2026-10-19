import type { Option } from './types';

// The computer opponent is beatable: best answer half the time, otherwise a weaker one.
const RANK_WEIGHTS = [0.5, 0.3, 0.2];

export function aiPick(options: Option[], random = Math.random): Option {
  const ranked = [...options].sort((a, b) => b.score - a.score);
  let roll = random();
  for (let i = 0; i < ranked.length; i++) {
    roll -= RANK_WEIGHTS[i] ?? 0;
    if (roll < 0) return ranked[i];
  }
  return ranked[ranked.length - 1];
}

/** Seconds the AI "thinks" before locking in, so it doesn't feel instant. */
export function aiDelay(random = Math.random): number {
  return 1.2 + random() * 2.3;
}
