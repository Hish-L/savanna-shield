import { describe, expect, it } from 'vitest';
import { resolveRound } from './scoring';

const ransomware = { text: 'Ransomware', score: 4 };
const probe = { text: 'Probe', score: 1 };
const escalate = { text: 'Escalate', score: 4 };
const track = { text: 'Track', score: 1 };

describe('resolveRound', () => {
  it('blocks an attack the defence matches or beats, and the attack scores nothing', () => {
    expect(resolveRound(escalate, ransomware)).toMatchObject({ blocked: true, breached: false, predatorPoints: 0, rangerPoints: 4 });
    expect(resolveRound(track, probe)).toMatchObject({ blocked: true, predatorPoints: 0, rangerPoints: 1 });
  });

  it('scores a stronger attack in full as a breach', () => {
    expect(resolveRound(track, ransomware)).toMatchObject({ blocked: false, breached: true, predatorPoints: 4, rangerPoints: 1 });
  });

  it('gives nothing to a side that timed out, and the attack still lands', () => {
    expect(resolveRound(null, probe)).toMatchObject({ blocked: false, breached: true, predatorPoints: 1, rangerPoints: 0 });
    expect(resolveRound(escalate, null)).toMatchObject({ blocked: false, breached: false, predatorPoints: 0, rangerPoints: 4 });
  });
});
