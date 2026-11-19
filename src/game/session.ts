import { settings } from '../config';
import { buildScenario, dealQuestions } from '../scenarios';
import type { Savanna } from '../scene/world';
import { KEYS, isHuman, localSide, type Played, type Totals, type UI } from '../ui/ui';
import { aiDelay, aiPick } from './ai';
import { readingSeconds } from './reading';
import { resolveRound, type RoundResult } from './scoring';
import type { Mode, Option, Round, Scenario, Side } from './types';

const SIDES: Side[] = ['ranger', 'predator'];
const sleep = (seconds: number) => new Promise((r) => setTimeout(r, seconds * 1000));

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
  const start = performance.now();
  let frame = 0;
  const tick = () => {
    const elapsed = (performance.now() - start) / 1000;
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
): Promise<Picks> {
  return new Promise((resolve) => {
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
    const timer = window.setTimeout(finish, (readSeconds + settings.roundSeconds) * 1000);
    cleanups = [...wire(choose, finish), runTimer(ui, readSeconds), () => clearTimeout(timer)];
  });
}

/** Inputs for keyboard/tap and the AI. */
function localWiring(options: Record<Side, Option[]>, mode: Mode, ui: UI, readSeconds: number): PickWiring {
  return (choose) => {
    const answersAt = performance.now() + readSeconds * 1000;
    const cleanups = [listenForInput(mode, ui, (side, index) => performance.now() >= answersAt && choose(side, index))];
    for (const side of SIDES) {
      if (isHuman(mode, side)) continue;
      const timer = window.setTimeout(() => choose(side, options[side].indexOf(aiPick(options[side]))), (readSeconds + aiDelay()) * 1000);
      cleanups.push(() => clearTimeout(timer));
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

export function startGame(scenario: Scenario, mode: Mode, world: Savanna, ui: UI): void {
  world.newGame(scenario.predator.animal);
  world.setAttract(false);
  ui.briefing(scenario, mode, settings.briefingSeconds);
}

/** Runs a full game on this device. */
export async function playSession(mode: Mode, world: Savanna, ui: UI): Promise<void> {
  const { scenario } = dealScenario();
  startGame(scenario, mode, world, ui);
  await sleep(settings.briefingSeconds);

  const totals: Totals = { ranger: 0, predator: 0 };
  const played: Played[] = [];
  for (const [index, round] of scenario.rounds.entries()) {
    const order = { ranger: shuffle([...round.ranger.options.keys()]), predator: shuffle([...round.predator.options.keys()]) };
    const options = { ranger: order.ranger.map((i) => round.ranger.options[i]), predator: order.predator.map((i) => round.predator.options[i]) };
    ui.round(scenario, round, index, options, mode, totals);
    const readSeconds = readingSeconds(round);
    const picks = await collectPicks(options, readSeconds, ui, localWiring(options, mode, ui, readSeconds));
    applyResult(world, ui, round, picks, totals, played);
    await ui.continueAfterReveal();
  }

  world.setAttract(true);
  await ui.debrief(scenario, mode, totals, played);
}
