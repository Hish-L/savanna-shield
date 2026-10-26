import { describe, expect, it } from 'vitest';
import { parsePhoneMsg } from '../net/teams-protocol';
import { Seats, Vote } from './seats';

describe('Team Battle seats', () => {
  it('seats one phone per side and reports taken sides', () => {
    const seats = new Seats();
    seats.hello(1, 'a');
    seats.hello(2, 'b');
    expect(seats.claim(1, 'ranger')).toBe(true);
    expect(seats.claim(2, 'ranger')).toBe(false);
    expect(seats.taken()).toEqual(['ranger']);
    expect(seats.claim(2, 'predator')).toBe(true);
    expect(seats.full()).toBe(true);
  });

  it("doesn't let one phone hold both seats or claim before saying hello", () => {
    const seats = new Seats();
    expect(seats.claim(1, 'ranger')).toBe(false);
    seats.hello(1, 'a');
    seats.claim(1, 'ranger');
    expect(seats.claim(1, 'predator')).toBe(false);
  });

  it('holds a dropped seat and gives it back to the same token on a new connection', () => {
    const seats = new Seats();
    seats.hello(1, 'a');
    seats.claim(1, 'ranger');
    expect(seats.left(1)).toBe('ranger');
    expect(seats.isAway('ranger')).toBe(true);
    expect(seats.isTaken('ranger')).toBe(true);
    expect(seats.hello(7, 'someone-else')).toBe(null);
    expect(seats.hello(9, 'a')).toBe('ranger');
    expect(seats.sideOf(9)).toBe('ranger');
    expect(seats.isAway('ranger')).toBe(false);
  });

  it('marks everyone away when the relay restarts', () => {
    const seats = new Seats();
    seats.hello(1, 'a');
    seats.claim(1, 'ranger');
    seats.disconnectAll();
    expect(seats.isAway('ranger')).toBe(true);
    expect(seats.sideOf(1)).toBe(null);
    expect(seats.connections()).toEqual([]);
  });

  it('frees and clears seats', () => {
    const seats = new Seats();
    seats.hello(1, 'a');
    seats.claim(1, 'predator');
    seats.free('predator');
    expect(seats.taken()).toEqual([]);
    seats.claim(1, 'ranger');
    seats.clear();
    expect(seats.full()).toBe(false);
    expect(seats.taken()).toEqual([]);
  });
});

describe('Team Battle votes', () => {
  it('needs both sides, and repeat taps from one side do not count twice', () => {
    const vote = new Vote();
    expect(vote.add('ranger')).toBe(false);
    expect(vote.add('ranger')).toBe(false);
    expect(vote.add('predator')).toBe(true);
  });
});

describe('phone message validation', () => {
  it('accepts well-formed messages', () => {
    expect(parsePhoneMsg({ t: 'hello', token: 'abc' })).toEqual({ t: 'hello', token: 'abc' });
    expect(parsePhoneMsg({ t: 'claim', side: 'predator' })).toEqual({ t: 'claim', side: 'predator' });
    expect(parsePhoneMsg({ t: 'pick', round: 3, index: 2, extra: 1 })).toEqual({ t: 'pick', round: 3, index: 2 });
    expect(parsePhoneMsg({ t: 'next', round: 0 })).toEqual({ t: 'next', round: 0 });
    expect(parsePhoneMsg({ t: 'rematch' })).toEqual({ t: 'rematch' });
  });

  it('rejects junk', () => {
    expect(parsePhoneMsg(null)).toBe(null);
    expect(parsePhoneMsg('pick')).toBe(null);
    expect(parsePhoneMsg({ t: 'claim', side: 'referee' })).toBe(null);
    expect(parsePhoneMsg({ t: 'pick', round: -1, index: 0 })).toBe(null);
    expect(parsePhoneMsg({ t: 'pick', round: 1, index: 1.5 })).toBe(null);
    expect(parsePhoneMsg({ t: 'hello', token: '' })).toBe(null);
    expect(parsePhoneMsg({ t: 'nope' })).toBe(null);
  });
});
