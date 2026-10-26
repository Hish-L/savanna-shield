import type { Side } from './types';

// Team Battle seating, kept free of sockets and DOM so it can be unit tested.
// A phone identifies itself with a token it keeps in localStorage, so after a refresh or a
// dropped connection it comes back on a new connection id and reclaims the same seat.

export interface Seat {
  token: string;
  /** Hub connection id, or null while the phone is away. */
  conn: number | null;
}

export class Seats {
  private seats: Partial<Record<Side, Seat>> = {};
  private tokens = new Map<number, string>();

  /** Records who a connection is. Returns the side it was re-seated on, if any. */
  hello(conn: number, token: string): Side | null {
    this.tokens.set(conn, token);
    for (const side of ['ranger', 'predator'] as const) {
      const seat = this.seats[side];
      if (seat?.token === token) {
        seat.conn = conn;
        return side;
      }
    }
    return null;
  }

  /** Seats a connection on a free side. A phone can only hold one seat. */
  claim(conn: number, side: Side): boolean {
    const token = this.tokens.get(conn);
    if (!token || this.seats[side] || this.sideOf(conn)) return false;
    this.seats[side] = { token, conn };
    return true;
  }

  /** A connection dropped. Its seat stays held until `free` or `clear`. */
  left(conn: number): Side | null {
    this.tokens.delete(conn);
    const side = this.sideOf(conn);
    if (side) this.seats[side]!.conn = null;
    return side;
  }

  /** The relay restarted: everyone is away until they say hello again. */
  disconnectAll(): void {
    this.tokens.clear();
    for (const seat of Object.values(this.seats)) seat.conn = null;
  }

  sideOf(conn: number): Side | null {
    if (this.seats.ranger?.conn === conn) return 'ranger';
    if (this.seats.predator?.conn === conn) return 'predator';
    return null;
  }

  connOf(side: Side): number | null {
    return this.seats[side]?.conn ?? null;
  }

  isTaken(side: Side): boolean {
    return !!this.seats[side];
  }

  isAway(side: Side): boolean {
    return !!this.seats[side] && this.seats[side].conn === null;
  }

  taken(): Side[] {
    return (['ranger', 'predator'] as const).filter((s) => this.seats[s]);
  }

  full(): boolean {
    return !!this.seats.ranger && !!this.seats.predator;
  }

  free(side: Side): void {
    delete this.seats[side];
  }

  clear(): void {
    this.seats = {};
  }

  /** Every connection that has said hello, seated or not. */
  connections(): number[] {
    return [...this.tokens.keys()];
  }
}

/** A both-teams-agree vote (Next, Rematch). */
export class Vote {
  private sides = new Set<Side>();
  add(side: Side): boolean {
    this.sides.add(side);
    return this.done();
  }
  has(side: Side): boolean {
    return this.sides.has(side);
  }
  done(): boolean {
    return this.sides.size === 2;
  }
}
