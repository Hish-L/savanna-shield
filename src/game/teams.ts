import QRCode from 'qrcode';
import { BRIEFING_SECONDS, ROUND_SECONDS } from '../config';
import { HubClient, NO_HUB } from '../net/hub';
import { isAbort } from '../net/link';
import { parsePhoneMsg, type HubEvent, type Outcome, type PhoneMsg, type PhoneView } from '../net/teams-protocol';
import type { Savanna } from '../scene/world';
import type { Played, Totals, UI } from '../ui/ui';
import { bestOption, type RoundResult } from './scoring';
import { Seats, Vote } from './seats';
import { applyResult, collectPicks, randomScenario, shuffle, startGame } from './session';
import type { Option, Round, Scenario, Side } from './types';

// Team Battle: this screen runs the game and shows the savanna; each team plays on one phone
// (src/phone/) connected through the booth relay (server/hub.ts).

const SIDES: Side[] = ['ranger', 'predator'];
const NAMES: Record<Side, string> = { ranger: 'Ranger', predator: 'Predator' };
/** In the lobby, a seat whose phone drops is given back after this long. In a game it's held until Esc. */
const LOBBY_GRACE_MS = 15_000;

const other = (side: Side): Side => (side === 'ranger' ? 'predator' : 'ranger');
const outcome = (r: RoundResult): Outcome => (r.blocked ? 'blocked' : r.breached ? 'breach' : 'fizzle');

function sleep(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, seconds * 1000);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** What the phones should be showing right now. */
type Phase =
  | { kind: 'lobby' }
  | { kind: 'briefing' }
  | { kind: 'question'; scenario: Scenario; round: Round; index: number; options: Record<Side, Option[]>; deadline: number; locked: Partial<Record<Side, number>> }
  | { kind: 'result'; round: Round; index: number; result: RoundResult; totals: Totals; vote: Vote }
  | { kind: 'final'; totals: Totals; vote: Vote };

/** Runs Team Battle until the operator presses Esc on the lobby. */
export async function playTeams(world: Savanna, ui: UI): Promise<void> {
  let hub: HubClient;
  let playUrl: string;
  try {
    hub = await HubClient.connect();
    playUrl = (await (await fetch('/api/info')).json()).playUrl;
  } catch {
    await ui.notice(NO_HUB);
    return;
  }
  const qr = await QRCode.toString(playUrl, { type: 'svg', margin: 1, color: { dark: '#1f1c4f', light: '#ffffff' } });
  const battle = new TeamBattle(hub, world, ui, playUrl, qr);
  try {
    await battle.run();
  } finally {
    battle.dispose();
    world.setAttract(true);
  }
}

class TeamBattle {
  private seats = new Seats();
  private phase: Phase = { kind: 'lobby' };
  /** Set while the lobby waits; resolves true to start, false to leave Team Battle. */
  private lobbyDone?: (start: boolean) => void;
  /** Aborted by Esc during a game. */
  private game?: AbortController;
  /** In-game handler for picks and votes from seated phones. */
  private onTeam?: (side: Side, msg: PhoneMsg) => void;
  private grace = new Map<Side, number>();

  constructor(
    private readonly hub: HubClient,
    private readonly world: Savanna,
    private readonly ui: UI,
    private readonly playUrl: string,
    private readonly qr: string,
  ) {
    hub.onEvent = (e) => this.onHub(e);
    hub.onReconnect = () => {
      this.seats.disconnectAll();
      this.showSeats();
    };
    window.addEventListener('keydown', this.onKey);
  }

  async run(): Promise<void> {
    for (;;) {
      this.seats.clear();
      this.grace.forEach(clearTimeout);
      this.grace.clear();
      this.phase = { kind: 'lobby' };
      this.showSeats();
      this.refreshAll();
      const start = await new Promise<boolean>((resolve) => {
        this.lobbyDone = resolve;
      });
      this.lobbyDone = undefined;
      if (!start) return;

      const game = (this.game = new AbortController());
      try {
        // Rematches keep the same seats; Esc aborts back to the lobby.
        for (;;) await this.playGame(game.signal);
      } catch (err) {
        if (!isAbort(err)) throw err;
      } finally {
        this.game = undefined;
        this.onTeam = undefined;
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.grace.forEach(clearTimeout);
    for (const conn of this.seats.connections()) this.hub.send(conn, { v: 'waiting', message: 'Team Battle has finished. Thanks for playing!' });
    this.hub.close();
  }

  private async playGame(signal: AbortSignal): Promise<void> {
    const scenario = randomScenario();
    this.phase = { kind: 'briefing' };
    this.refreshAll();
    startGame(scenario, 'teams', this.world, this.ui);
    await sleep(BRIEFING_SECONDS, signal);

    const totals: Totals = { ranger: 0, predator: 0 };
    const played: Played[] = [];
    for (const [index, round] of scenario.rounds.entries()) {
      const order = { ranger: shuffle([...round.ranger.options.keys()]), predator: shuffle([...round.predator.options.keys()]) };
      const options = { ranger: order.ranger.map((i) => round.ranger.options[i]), predator: order.predator.map((i) => round.predator.options[i]) };
      this.ui.round(scenario, round, index, options, 'teams', totals);
      const question = { kind: 'question' as const, scenario, round, index, options, deadline: performance.now() + ROUND_SECONDS * 1000, locked: {} as Partial<Record<Side, number>> };
      this.phase = question;
      this.showSeats();
      this.refreshAll();

      const picks = await collectPicks(
        options,
        this.ui,
        (choose, end) => {
          this.onTeam = (side, msg) => {
            if (msg.t === 'pick' && msg.round === index) choose(side, msg.index);
          };
          signal.addEventListener('abort', end);
          return [
            () => {
              this.onTeam = undefined;
              signal.removeEventListener('abort', end);
            },
          ];
        },
        (side, i) => {
          question.locked[side] = i;
          this.refreshSide(side);
        },
      );
      signal.throwIfAborted();

      const result = applyResult(this.world, this.ui, round, picks, totals, played);
      const vote = new Vote();
      this.phase = { kind: 'result', round, index, result, totals, vote };
      this.refreshAll();
      // Both phones tap Next, or the operator presses Space.
      await this.waitForVote(
        vote,
        signal,
        (s) => this.ui.continueAfterReveal(false, s),
        (msg) => msg.t === 'next' && msg.round === index,
        () => this.ui.teamContinue({ ranger: vote.has('ranger'), predator: vote.has('predator') }),
      );
    }

    const vote = new Vote();
    this.phase = { kind: 'final', totals, vote };
    this.refreshAll();
    this.world.setAttract(true);
    // Both phones tap Rematch (Space also works); Esc frees the seats for the next teams.
    await this.waitForVote(vote, signal, (s) => this.ui.debrief(scenario, 'teams', totals, played, s), (msg) => msg.t === 'rematch');
  }

  /** Resolves when both teams vote, or `override` (the operator) resolves first. Rejects on Esc. */
  private waitForVote(
    vote: Vote,
    signal: AbortSignal,
    override: (signal: AbortSignal) => Promise<void>,
    matches: (msg: PhoneMsg) => boolean,
    render?: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const local = new AbortController();
      let done = false;
      const finish = (err?: unknown) => {
        if (done) return;
        done = true;
        local.abort();
        this.onTeam = undefined;
        signal.removeEventListener('abort', onAbort);
        if (err) reject(err);
        else resolve();
      };
      const onAbort = () => finish(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      override(local.signal).then(() => finish());
      render?.();
      this.onTeam = (side, msg) => {
        if (!matches(msg) || vote.has(side)) return;
        vote.add(side);
        render?.();
        this.refreshAll();
        if (vote.done()) finish();
      };
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this.lobbyDone) this.lobbyDone(false);
    else this.game?.abort();
  };

  private onHub(e: HubEvent): void {
    if ('joined' in e) {
      this.hub.send(e.joined, { v: 'who' });
    } else if ('left' in e) {
      const side = this.seats.left(e.left);
      if (!side) return;
      if (this.phase.kind === 'lobby') {
        this.grace.set(
          side,
          window.setTimeout(() => {
            this.grace.delete(side);
            if (this.phase.kind !== 'lobby' || !this.seats.isAway(side)) return;
            this.seats.free(side);
            this.showSeats();
            this.refreshAll();
          }, LOBBY_GRACE_MS),
        );
      }
      this.showSeats();
    } else {
      const msg = parsePhoneMsg(e.msg);
      if (msg) this.onPhone(e.from, msg);
    }
  }

  private onPhone(conn: number, msg: PhoneMsg): void {
    if (msg.t === 'hello') {
      const side = this.seats.hello(conn, msg.token);
      if (side) {
        clearTimeout(this.grace.get(side));
        this.grace.delete(side);
        this.showSeats();
      }
      this.send(conn);
    } else if (msg.t === 'claim') {
      if (this.phase.kind === 'lobby' && this.seats.claim(conn, msg.side)) {
        this.showSeats();
        this.refreshAll();
        if (this.seats.full()) this.lobbyDone?.(true);
      } else this.send(conn);
    } else {
      const side = this.seats.sideOf(conn);
      if (side) this.onTeam?.(side, msg);
    }
  }

  /** Updates the big screen's view of who is connected. */
  private showSeats(): void {
    if (this.phase.kind === 'lobby') {
      const slot = (side: Side) => (!this.seats.isTaken(side) ? 'open' : this.seats.isAway(side) ? 'away' : 'joined');
      this.ui.teamLobby(this.playUrl, this.qr, { ranger: slot('ranger'), predator: slot('predator') }, () => this.lobbyDone?.(false));
    } else {
      for (const side of SIDES) this.ui.seatStatus(side, this.seats.isAway(side));
    }
  }

  private viewFor(conn: number): PhoneView {
    const side = this.seats.sideOf(conn);
    const p = this.phase;
    if (!side) {
      return p.kind === 'lobby'
        ? { v: 'pick-side', taken: this.seats.taken() }
        : { v: 'waiting', message: 'A game is in progress. Hang tight, you can join the next one!' };
    }
    switch (p.kind) {
      case 'lobby':
        return { v: 'waiting', side, message: this.seats.full() ? 'Starting…' : `Waiting for the ${NAMES[other(side)]} team to join…` };
      case 'briefing':
        return { v: 'waiting', side, message: 'Get ready! Look at the big screen.' };
      case 'question':
        return {
          v: 'question',
          side,
          round: p.index,
          total: p.scenario.rounds.length,
          stage: p.round.stage,
          prompt: p.round[side].prompt,
          options: p.options[side].map((o) => o.text),
          endsInMs: Math.max(0, p.deadline - performance.now()),
          locked: p.locked[side] ?? null,
        };
      case 'result':
        return {
          v: 'result',
          side,
          round: p.index,
          yourPick: p.result[side]?.text ?? null,
          best: bestOption(p.round[side]).text,
          points: side === 'ranger' ? p.result.rangerPoints : p.result.predatorPoints,
          totals: { ...p.totals },
          outcome: outcome(p.result),
          youTappedNext: p.vote.has(side),
          otherTappedNext: p.vote.has(other(side)),
        };
      case 'final': {
        const { ranger, predator } = p.totals;
        return {
          v: 'final',
          side,
          totals: { ...p.totals },
          winner: ranger > predator ? 'ranger' : predator > ranger ? 'predator' : 'draw',
          youTappedRematch: p.vote.has(side),
          otherTappedRematch: p.vote.has(other(side)),
        };
      }
    }
  }

  private send(conn: number): void {
    this.hub.send(conn, this.viewFor(conn));
  }

  private refreshSide(side: Side): void {
    const conn = this.seats.connOf(side);
    if (conn !== null) this.send(conn);
  }

  private refreshAll(): void {
    for (const conn of this.seats.connections()) this.send(conn);
  }
}
