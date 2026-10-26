import type { Side } from '../game/types';

// Team Battle messages between the big screen and the phones (relayed by server/hub.ts).
// The screen pushes a full PhoneView whenever anything changes, so a phone that reconnects
// only needs the latest one to catch up.

/** Phone → screen. `token` is a random id the phone keeps so it can reclaim its seat. */
export type PhoneMsg =
  | { t: 'hello'; token: string }
  | { t: 'claim'; side: Side }
  | { t: 'pick'; round: number; index: number }
  | { t: 'next'; round: number }
  | { t: 'rematch' };

export type Outcome = 'blocked' | 'breach' | 'fizzle';

/** Screen → phone: everything the phone shows. */
export type PhoneView =
  /** Asks the phone to send `hello` (sent when the screen first sees a connection). */
  | { v: 'who' }
  | { v: 'pick-side'; taken: Side[] }
  | { v: 'waiting'; side?: Side; message: string }
  | {
      v: 'question';
      side: Side;
      round: number;
      total: number;
      stage: string;
      prompt: string;
      options: string[];
      /** Remaining time rather than a timestamp, so phone clocks don't matter. */
      endsInMs: number;
      locked: number | null;
    }
  | {
      v: 'result';
      side: Side;
      round: number;
      yourPick: string | null;
      best: string;
      points: number;
      totals: Record<Side, number>;
      outcome: Outcome;
      youTappedNext: boolean;
      otherTappedNext: boolean;
    }
  | { v: 'final'; side: Side; totals: Record<Side, number>; winner: Side | 'draw'; youTappedRematch: boolean; otherTappedRematch: boolean };

/** Hub → screen envelope. */
export type HubEvent = { joined: number } | { left: number } | { from: number; msg: unknown };

const SIDES: readonly string[] = ['ranger', 'predator'];

/** Validates an untrusted phone message. */
export function parsePhoneMsg(raw: unknown): PhoneMsg | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const int = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0;
  switch (m.t) {
    case 'hello':
      return typeof m.token === 'string' && m.token.length > 0 && m.token.length <= 64 ? { t: 'hello', token: m.token } : null;
    case 'claim':
      return SIDES.includes(m.side as string) ? { t: 'claim', side: m.side as Side } : null;
    case 'pick':
      return int(m.round) && int(m.index) ? { t: 'pick', round: m.round as number, index: m.index as number } : null;
    case 'next':
      return int(m.round) ? { t: 'next', round: m.round as number } : null;
    case 'rematch':
      return { t: 'rematch' };
    default:
      return null;
  }
}
