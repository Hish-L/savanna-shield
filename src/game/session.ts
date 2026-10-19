import { BRIEFING_SECONDS, REVEAL_SECONDS, ROUND_SECONDS } from '../config';
import { Disconnected, type Link, type Msg } from '../net/link';
import { scenarios } from '../scenarios';
import type { Savanna } from '../scene/world';
import { KEYS, isHuman, localSide, type Played, type Totals, type UI } from '../ui/ui';
import { aiDelay, aiPick } from './ai';
import { resolveRound } from './scoring';
import type { Mode, Option, Round, Scenario, Side } from './types';

const SIDES: Side[] = ['ranger', 'predator'];
const sleep = (seconds: number) => new Promise((r) => setTimeout(r, seconds * 1000));
const other = (side: Side): Side => (side === 'ranger' ? 'predator' : 'ranger');

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Picks = Record<Side, Option | null>;

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
    // Single players can also use 1/2/3.
    const n = ['1', '2', '3'].indexOf(key);
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

/** Animates the round timer bar until the returned function is called. */
function runTimer(ui: UI): () => void {
  const start = performance.now();
  let frame = 0;
  const tick = () => {
    ui.timer(1 - (performance.now() - start) / (ROUND_SECONDS * 1000));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(frame);
}

/**
 * Resolves when both sides have locked in or the round timer runs out (missing picks are null).
 * With a `link`, the remote side's pick arrives over the network; it is never shown before the reveal.
 */
function collectPicks(options: Record<Side, Option[]>, mode: Mode, ui: UI, round: number, link?: Link): Promise<Picks> {
  return new Promise((resolve) => {
    const picks: Partial<Picks> = {};
    const timers: number[] = [];
    const cleanups: (() => void)[] = [];
    const finish = () => {
      cleanups.forEach((f) => f());
      timers.forEach(clearTimeout);
      resolve({ ranger: picks.ranger ?? null, predator: picks.predator ?? null });
    };
    const choose = (side: Side, option: Option | undefined) => {
      if (!option || picks[side]) return;
      picks[side] = option;
      ui.lock(side);
      if (link && isHuman(mode, side)) link.send({ t: 'lock' });
      if (picks.ranger && picks.predator) finish();
    };
    cleanups.push(listenForInput(mode, ui, (side, index) => choose(side, options[side][index])));

    for (const side of SIDES) {
      if (isHuman(mode, side)) continue;
      if (link) {
        cleanups.push(
          link.listen((m) => {
            if (m.t === 'pick' && m.round === round) choose(side, options[side][m.index]);
            if (m.t === 'bye') finish();
          }),
        );
      } else {
        timers.push(window.setTimeout(() => choose(side, aiPick(options[side])), aiDelay() * 1000));
      }
    }
    timers.push(window.setTimeout(finish, ROUND_SECONDS * 1000));
    cleanups.push(runTimer(ui));
  });
}

/** Shared per-round bookkeeping once both picks are known. */
function applyResult(world: Savanna, ui: UI, round: Round, picks: Picks, totals: Totals, played: Played[]): void {
  const result = resolveRound(picks.ranger, picks.predator);
  totals.ranger += result.rangerPoints;
  totals.predator += result.predatorPoints;
  played.push({ round, result });
  world.react(result);
  world.setScore(totals.predator - totals.ranger);
  ui.reveal(round, result, totals);
}

function startGame(scenario: Scenario, mode: Mode, world: Savanna, ui: UI): void {
  world.newGame(scenario.predator.animal);
  world.setAttract(false);
  ui.briefing(scenario, mode, BRIEFING_SECONDS);
}

/** Runs a full game on this device. Online, this device is the host and drives the guest via `link`. */
export async function playSession(mode: Mode, world: Savanna, ui: UI, link?: Link): Promise<void> {
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  link?.send({ t: 'start', scenario: scenario.id });
  startGame(scenario, mode, world, ui);
  await sleep(BRIEFING_SECONDS);

  const totals: Totals = { ranger: 0, predator: 0 };
  const played: Played[] = [];
  for (const [index, round] of scenario.rounds.entries()) {
    const order = { ranger: shuffle([...round.ranger.options.keys()]), predator: shuffle([...round.predator.options.keys()]) };
    const options = { ranger: order.ranger.map((i) => round.ranger.options[i]), predator: order.predator.map((i) => round.predator.options[i]) };
    link?.send({ t: 'round', index, order });
    ui.round(scenario, round, index, options, mode, totals);
    const picks = await collectPicks(options, mode, ui, index, link);
    if (link) {
      // A mid-round disconnect ends the game rather than scoring a forfeit.
      if (link.closed) throw new Disconnected();
      const pickIndex = (side: Side) => (picks[side] ? options[side].indexOf(picks[side]) : null);
      link.send({ t: 'reveal', picks: { ranger: pickIndex('ranger'), predator: pickIndex('predator') } });
    }
    applyResult(world, ui, round, picks, totals, played);
    await sleep(REVEAL_SECONDS);
  }

  link?.send({ t: 'end' });
  world.setAttract(true);
  await ui.debrief(scenario, mode, totals, played);
}

/** Online guest: mirrors the host's game, sending only this device's picks. */
export async function playGuest(mode: Mode, world: Savanna, ui: UI, link: Link): Promise<void> {
  const start = await link.next('start');
  const scenario = scenarios.find((s) => s.id === start.scenario);
  if (!scenario) throw new Error('Your opponent is running a different version of the game. Both refresh and try again.');
  startGame(scenario, mode, world, ui);

  const mine = localSide(mode)!;
  const totals: Totals = { ranger: 0, predator: 0 };
  const played: Played[] = [];
  for (;;) {
    const m = await link.next('round', 'end');
    if (m.t === 'end') break;
    const round = scenario.rounds[m.index];
    const options = { ranger: m.order.ranger.map((i) => round.ranger.options[i]), predator: m.order.predator.map((i) => round.predator.options[i]) };
    ui.round(scenario, round, m.index, options, mode, totals);

    let picked = false;
    const stopInput = listenForInput(mode, ui, (side, index) => {
      if (picked || !options[side][index]) return;
      picked = true;
      ui.lock(side);
      link.send({ t: 'pick', round: m.index, index });
    });
    const stopTimer = runTimer(ui);
    // The host's clock is authoritative; its reveal ends the round.
    const reveal = await new Promise<Extract<Msg, { t: 'reveal' }>>((resolve, reject) => {
      const stopListening = link.listen((msg) => {
        if (msg.t === 'lock') ui.lock(other(mine));
        if (msg.t !== 'reveal' && msg.t !== 'bye') return;
        stopListening();
        stopInput();
        stopTimer();
        if (msg.t === 'reveal') resolve(msg);
        else reject(new Disconnected());
      });
    });
    const pick = (side: Side) => (reveal.picks[side] === null ? null : options[side][reveal.picks[side]]);
    applyResult(world, ui, round, { ranger: pick('ranger'), predator: pick('predator') }, totals, played);
  }

  world.setAttract(true);
  await ui.debrief(scenario, mode, totals, played);
}
