import { settings } from '../config';
import { buildScenario, dealQuestions } from '../scenarios';
import type { Savanna } from '../scene/world';
import { KEYS, isHuman, localSide, type Played, type Totals, type UI } from '../ui/ui';
import { aiDelay, aiPick } from './ai';
import * as clock from './clock';
import { readingSeconds } from './reading';
import { resolveRound, type RoundResult } from './scoring';
import type { Mode, Option, Round, Scenario, Side } from './types';

const SIDES: Side[] = ['ranger', 'predator'];

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Picks = Record<Side, Option | null>;

/** Routes keyboard and tap input to `pick` for the sides played on this device. Returns a cleanup function. */
function listenForInput(mode: Mode, ui: UI, pick: (side: Side, index: number) => void): () => void {
  const humanPick = (side: Side, index: number) => {
    if (isHuman(mode, side)) pick(side, index);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const key = e.key.toUpperCase();
    for (const side of SIDES) {
      const index = KEYS[side].indexOf(key);
      if (index >= 0) humanPick(side, index);
    }
    // Single players can also use the number keys.
    const n = ['1', '2', '3', '4'].indexOf(key);
    const side = localSide(mode);
    if (n >= 0 && side) humanPick(side, n);
  };
  window.addEventListener('keydown', onKey);
  ui.onPick = humanPick;
  return () => {
    window.removeEventListener('keydown', onKey);
    ui.onPick = () => {};
  };
}

/** Animates the round timer bar until the returned function is called. It stays full for `readSeconds`, then drains. */
export function runTimer(ui: UI, readSeconds: number): () => void {
  const start = clock.now();
  let frame = 0;
  const tick = () => {
    const elapsed = (clock.now() - start) / 1000;
    ui.timer(Math.min(1, 1 - (elapsed - readSeconds) / settings.roundSeconds), Math.max(0, readSeconds - elapsed));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(frame);
}

/**
 * Connects the inputs for one round. Call `choose` with a side's option index as picks arrive,
 * or `end` to finish the round early. Returns cleanups to run when the round is over.
 */
export type PickWiring = (choose: (side: Side, index: number) => void, end: () => void) => (() => void)[];

/**
 * Resolves when both sides have locked in or the round timer runs out (missing picks are null).
 * The answer timer starts after the `readSeconds` reading time. Picks are accepted during reading
 * too; each wiring decides whether to allow them (local play blocks them, as the answers are hidden).
 */
export function collectPicks(
  options: Record<Side, Option[]>,
  readSeconds: number,
  ui: UI,
  wire: PickWiring,
  onLock?: (side: Side, index: number) => void,
  signal?: AbortSignal,
): Promise<Picks> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const picks: Partial<Picks> = {};
    let cleanups: (() => void)[] = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanups.forEach((f) => f());
      resolve({ ranger: picks.ranger ?? null, predator: picks.predator ?? null });
    };
    const choose = (side: Side, index: number) => {
      const option = options[side][index];
      if (done || !option || picks[side]) return;
      picks[side] = option;
      ui.lock(side);
      onLock?.(side, index);
      if (picks.ranger && picks.predator) finish();
    };
    const cancel = clock.after((readSeconds + settings.roundSeconds) * 1000, finish);
    cleanups = [...wire(choose, finish), runTimer(ui, readSeconds), cancel];
    // Quitting mid-round: tear the round down without scoring it.
    signal?.addEventListener('abort', () => {
      if (done) return;
      done = true;
      cleanups.forEach((f) => f());
      reject(signal.reason);
    }, { once: true });
  });
}

/** Inputs for keyboard/tap and the AI. */
function localWiring(options: Record<Side, Option[]>, mode: Mode, ui: UI, readSeconds: number): PickWiring {
  return (choose) => {
    const answersAt = clock.now() + readSeconds * 1000;
    const cleanups = [listenForInput(mode, ui, (side, index) => clock.now() >= answersAt && choose(side, index))];
    for (const side of SIDES) {
      if (isHuman(mode, side)) continue;
      cleanups.push(clock.after((readSeconds + aiDelay()) * 1000, () => choose(side, options[side].indexOf(aiPick(options[side])))));
    }
    return cleanups;
  };
}

/** Shared per-round bookkeeping once both picks are known. */
export function applyResult(world: Savanna, ui: UI, round: Round, picks: Picks, totals: Totals, played: Played[]): RoundResult {
  const result = resolveRound(picks.ranger, picks.predator);
  totals.ranger += result.rangerPoints;
  totals.predator += result.predatorPoints;
  played.push({ round, result });
  world.react(result);
  world.setScore(totals.predator - totals.ranger);
  ui.reveal(round, result, totals);
  return result;
}

/** Deals a fresh hand of questions. */
export function dealScenario(): { scenario: Scenario } {
  return { scenario: buildScenario(dealQuestions())! };
}

/** Plays the intro tour; resolves when the first question should start. */
export function startGame(scenario: Scenario, world: Savanna, ui: UI, signal?: AbortSignal): Promise<void> {
  world.newGame(scenario.predator.animal);
  world.setAttract(false);
  return introTour(world, ui, signal);
}

/** The camera visits the waterhole, the Rangers and the Attackers, one caption each. Space or Enter skips it. */
async function introTour(world: Savanna, ui: UI, signal?: AbortSignal): Promise<void> {
  const tour = [
    ['waterhole', 'This is the <b>Westpac</b> watering hole', 2.8],
    ['ranger', '<b>Rangers</b>, defend it', 3.8],
    ['predator', '<b>Attackers</b>, raid it', 3.8],
  ] as const;
  const skip = new AbortController();
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || (e.code !== 'Space' && e.key !== 'Enter')) return;
    e.preventDefault();
    skip.abort();
  };
  window.addEventListener('keydown', onKey);
  const stop = signal ? AbortSignal.any([signal, skip.signal]) : skip.signal;
  try {
    for (const [subject, text, seconds] of tour) {
      world.spotlight(subject);
      await ui.caption(text, seconds, stop);
    }
  } catch (e) {
    if (signal?.aborted || !skip.signal.aborted) throw e;
  } finally {
    window.removeEventListener('keydown', onKey);
    world.spotlight(null);
  }
}

/** Rejects with the abort reason if `signal` aborts before `promise` settles. */
function unlessAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    promise.then(resolve, reject);
  });
}

/** Runs a full game on this device. Esc pauses it, with the choice to resume or quit to the main menu. */
export async function playSession(mode: Mode, world: Savanna, ui: UI): Promise<void> {
  const quit = new AbortController();
  const signal = quit.signal;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.repeat || clock.isPaused()) return;
    e.preventDefault();
    clock.pause();
    world.setPaused(true);
    void ui.pauseMenu().then((choice) => {
      clock.resume();
      world.setPaused(false);
      if (choice === 'menu') quit.abort();
    });
  };
  window.addEventListener('keydown', onKey);
  try {
    const { scenario } = dealScenario();
    await startGame(scenario, world, ui, signal);

    const totals: Totals = { ranger: 0, predator: 0 };
    const played: Played[] = [];
    for (const [index, round] of scenario.rounds.entries()) {
      const order = { ranger: shuffle([...round.ranger.options.keys()]), predator: shuffle([...round.predator.options.keys()]) };
      const options = { ranger: order.ranger.map((i) => round.ranger.options[i]), predator: order.predator.map((i) => round.predator.options[i]) };
      ui.round(scenario, round, index, options, mode, totals);
      const readSeconds = readingSeconds(round);
      const picks = await collectPicks(options, readSeconds, ui, localWiring(options, mode, ui, readSeconds), undefined, signal);
      applyResult(world, ui, round, picks, totals, played);
      await unlessAborted(ui.continueAfterReveal(signal), signal);
    }

    world.setAttract(true);
    await unlessAborted(ui.debrief(scenario, mode, totals, played, signal), signal);
  } catch (err) {
    if (!signal.aborted) throw err;
  } finally {
    window.removeEventListener('keydown', onKey);
    world.setAttract(true);
  }
}
