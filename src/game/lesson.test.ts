import { describe, expect, it } from 'vitest';
import { questionPool } from '../scenarios';
import { lessonFor } from './lesson';
import { bestOption, resolveRound } from './scoring';

const round = questionPool[0];
const byScore = (side: 'ranger' | 'predator', score: number) => round[side].options.find((o) => o.score === score)!;
const best = bestOption(round.ranger).text;

describe('lessonFor', () => {
  it('praises the best defence without repeating it', () => {
    expect(lessonFor(round, resolveRound(byScore('ranger', 4), byScore('predator', 4)))).toEqual({
      why: { lead: 'Strong enough to stop the attack.' },
      tip: { lead: '★ Best defence!' },
    });
  });

  it('names the best defence after a breach', () => {
    expect(lessonFor(round, resolveRound(byScore('ranger', 2), byScore('predator', 3)))).toEqual({
      why: { lead: 'Not strong enough to stop the attack.' },
      tip: { lead: '★ Best defence', action: best },
    });
  });

  it('covers timeouts', () => {
    expect(lessonFor(round, resolveRound(null, byScore('predator', 2))).why.lead).toBe('Defenders were too slow.');
    expect(lessonFor(round, resolveRound(byScore('ranger', 4), null)).why.lead).toBe('The attacker froze.');
    expect(lessonFor(round, resolveRound(null, null)).why.lead).toBe('Defenders were too slow.');
  });
});
