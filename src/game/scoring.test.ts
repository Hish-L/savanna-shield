import { describe, expect, it } from 'vitest';
import { BLOCK_BONUS } from '../config';
import { resolveRound } from './scoring';

const phish = { text: 'Phish', score: 9, tag: 'phishing' };
const mfa = { text: 'MFA', score: 8, mitigates: ['phishing'] };
const slideshow = { text: 'Slides', score: 4 };

describe('resolveRound', () => {
  it('halves (rounding down) a blocked attack and gives the Ranger a bonus', () => {
    const r = resolveRound(mfa, phish);
    expect(r).toMatchObject({ blocked: true, breached: false, predatorPoints: 4, rangerPoints: 8 + BLOCK_BONUS });
  });

  it('scores an unmitigated attack in full as a breach', () => {
    const r = resolveRound(slideshow, phish);
    expect(r).toMatchObject({ blocked: false, breached: true, predatorPoints: 9, rangerPoints: 4 });
  });

  it('gives nothing to a side that timed out, and the attack still lands', () => {
    const r = resolveRound(null, phish);
    expect(r).toMatchObject({ blocked: false, breached: true, predatorPoints: 9, rangerPoints: 0 });
    expect(resolveRound(mfa, null)).toMatchObject({ blocked: false, breached: false, predatorPoints: 0, rangerPoints: 8 });
  });
});
