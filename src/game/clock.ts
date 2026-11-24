/**
 * Game time that stands still while a local game is paused. Everything timed in a game (answer
 * timers, reading time, the computer's picks, tour captions, auto-continue) goes through this so
 * one pause freezes it all. Outside a pause it is just performance.now() and setTimeout.
 */
type Timer = { due: number; fn: () => void; id: number };

let pausedAt: number | null = null;
let lost = 0; // total ms spent paused
const timers = new Set<Timer>();

function arm(t: Timer): void {
  t.id = window.setTimeout(() => {
    timers.delete(t);
    t.fn();
  }, t.due - now());
}

export function now(): number {
  return (pausedAt ?? performance.now()) - lost;
}

export function isPaused(): boolean {
  return pausedAt !== null;
}

/** Runs `fn` after `ms` of game time. Returns a cancel function. */
export function after(ms: number, fn: () => void): () => void {
  const t: Timer = { due: now() + ms, fn, id: 0 };
  timers.add(t);
  if (!isPaused()) arm(t);
  return () => {
    clearTimeout(t.id);
    timers.delete(t);
  };
}

export function pause(): void {
  if (isPaused()) return;
  pausedAt = performance.now();
  timers.forEach((t) => clearTimeout(t.id));
}

export function resume(): void {
  if (pausedAt === null) return;
  lost += performance.now() - pausedAt;
  pausedAt = null;
  timers.forEach(arm);
}
