import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settings } from '../config';
import type { HubClient } from '../net/hub';
import type { HubEvent, PhoneCount, PhoneView } from '../net/teams-protocol';
import type { Savanna } from '../scene/world';
import type { UI } from '../ui/ui';
import { playTeams } from './teams';

const relay = vi.hoisted(() => ({ url: undefined as string | undefined, connect: vi.fn() }));
vi.mock('../net/hub', () => ({
  get RELAY() { return relay.url; },
  newCode: () => 'TEST', NO_HUB: 'No relay',
  HubClient: { connect: relay.connect },
}));
vi.mock('./session', async (original) => ({
  ...await original<typeof import('./session')>(),
  startGame: vi.fn().mockResolvedValue(undefined),
}));

const originalSettings = { ...settings };

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout }));
  vi.stubGlobal('location', { origin: 'https://game.example' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ playUrl: 'http://192.168.1.2:8080/play' }) }));
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Object.assign(settings, { questionsPerGame: 1, autoContinueSeconds: 0 });
});

afterEach(() => {
  Object.assign(settings, originalSettings);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function game(phones: PhoneCount) {
  const hub = { send: vi.fn<(conn: number, view: PhoneView) => void>(), close: vi.fn(), onEvent: (_e: HubEvent) => {}, onReconnect: () => {} };
  relay.connect.mockResolvedValue(hub as unknown as HubClient);
  const ui = {
    teamSetup: vi.fn().mockResolvedValueOnce(phones).mockResolvedValue(null),
    teamLobby: vi.fn(), seatStatus: vi.fn(), round: vi.fn(), lock: vi.fn(),
    timer: vi.fn(), showAnswers: vi.fn(), reveal: vi.fn(), teamContinue: vi.fn(),
    continueAfterReveal: () => new Promise<void>(() => {}), debrief: () => new Promise<void>(() => {}),
  };
  const world = { setAttract: vi.fn(), react: vi.fn(), setScore: vi.fn() };
  const done = playTeams(world as unknown as Savanna, ui as unknown as UI);
  await vi.waitFor(() => expect(ui.teamLobby).toHaveBeenCalled());
  const send = (conn: number, msg: unknown) => hub.onEvent({ from: conn, msg });
  const latest = (conn: number): PhoneView => hub.send.mock.calls.filter(([id]) => id === conn).at(-1)![1];
  const escape = () => window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
  const stop = async () => {
    escape();
    await vi.waitFor(() => expect(latest(1).v).toBe('pick-side'));
    escape();
    await done;
  };
  return { hub, ui, done, send, latest, stop };
}

describe.each(['booth', 'online'])('Play Together over the %s relay', (transport) => {
  beforeEach(() => { relay.url = transport === 'online' ? 'wss://relay.example' : undefined; });

  it('runs a shared-phone game with independent picks, votes, refresh and rematch', async () => {
    const g = await game(1);
    expect(g.ui.teamLobby.mock.calls[0][0]).toContain(transport === 'online' ? 'https://game.example/' : 'http://192.168.1.2:8080/play');
    expect(g.ui.teamLobby.mock.calls[0][2]).toBe(transport === 'online' ? 'TEST' : null);
    g.send(1, { t: 'hello', token: 'shared' });
    expect(g.latest(1)).toMatchObject({ v: 'pick-side', phones: 1 });
    g.send(1, { t: 'claim', side: 'ranger' });
    expect(g.latest(1).v).toBe('pick-side'); // One-phone setup only accepts an atomic shared claim.
    g.send(1, { t: 'claim', side: 'both' });
    await vi.waitFor(() => expect(g.latest(1)).toMatchObject({ v: 'shared', ranger: { v: 'question' }, predator: { v: 'question' } }));
    g.send(1, { t: 'pick', round: 0, index: 0 });
    expect(g.ui.lock).not.toHaveBeenCalled(); // Shared messages must say which team tapped.
    g.send(1, { t: 'pick', side: 'ranger', round: 0, index: 1 });
    expect(g.latest(1)).toMatchObject({ ranger: { locked: 1 }, predator: { locked: null } });
    g.send(1, { t: 'pick', side: 'ranger', round: 0, index: 2 });
    expect(g.ui.lock).toHaveBeenCalledTimes(1);
    g.hub.onEvent({ left: 1 });
    expect(g.ui.seatStatus).toHaveBeenCalledWith('ranger', true);
    expect(g.ui.seatStatus).toHaveBeenCalledWith('predator', true);
    g.send(1, { t: 'hello', token: 'shared' });
    expect(g.latest(1)).toMatchObject({ ranger: { locked: 1 }, predator: { locked: null } });
    g.send(1, { t: 'pick', side: 'predator', round: 0, index: 2 });
    await vi.waitFor(() => expect(g.latest(1)).toMatchObject({ ranger: { v: 'result' }, predator: { v: 'result' } }));
    // A shared view also stays within both relays' 4096-byte payload limit.
    expect(new TextEncoder().encode(JSON.stringify({ to: 1, msg: g.latest(1) })).length).toBeLessThan(4096);
    g.send(1, { t: 'next', side: 'ranger', round: 0 });
    expect(g.latest(1)).toMatchObject({ ranger: { youTappedNext: true }, predator: { youTappedNext: false } });
    g.send(1, { t: 'next', side: 'predator', round: 0 });
    await vi.waitFor(() => expect(g.latest(1)).toMatchObject({ ranger: { v: 'final' }, predator: { v: 'final' } }));
    g.send(1, { t: 'rematch', side: 'ranger' });
    expect(g.latest(1)).toMatchObject({ ranger: { youTappedRematch: true }, predator: { youTappedRematch: false } });
    g.send(1, { t: 'rematch', side: 'predator' });
    await vi.waitFor(() => expect(g.latest(1)).toMatchObject({ ranger: { v: 'question', locked: null }, predator: { v: 'question', locked: null } }));
    await g.stop();
    expect(g.hub.close).toHaveBeenCalled();
  });

  it('preserves the two-phone flow and prevents a phone answering for its opponent', async () => {
    const g = await game(2);
    g.send(1, { t: 'hello', token: 'ranger' });
    g.send(2, { t: 'hello', token: 'predator' });
    expect(g.latest(1)).toMatchObject({ v: 'pick-side', phones: 2 });
    g.send(1, { t: 'claim', side: 'both' });
    expect(g.latest(1).v).toBe('pick-side');
    g.send(1, { t: 'claim', side: 'ranger' });
    expect(g.ui.round).not.toHaveBeenCalled();
    g.send(2, { t: 'claim', side: 'predator' });
    await vi.waitFor(() => expect(g.latest(1)).toMatchObject({ v: 'question', side: 'ranger' }));
    g.send(1, { t: 'pick', side: 'predator', round: 0, index: 0 });
    expect(g.ui.lock).not.toHaveBeenCalled();
    g.send(1, { t: 'pick', round: 0, index: 0 });
    expect(g.latest(1)).toMatchObject({ locked: 0 });
    expect(g.latest(2)).toMatchObject({ side: 'predator', locked: null });
    g.send(2, { t: 'pick', round: 0, index: 2 });
    await vi.waitFor(() => expect(g.latest(1).v).toBe('result'));
    g.send(1, { t: 'next', round: 0 });
    expect(g.latest(2)).toMatchObject({ youTappedNext: false, otherTappedNext: true });
    g.send(2, { t: 'next', round: 0 });
    await vi.waitFor(() => expect(g.latest(1).v).toBe('final'));
    await g.stop();
  });
});
