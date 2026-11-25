import { bestOption, type RoundResult } from './scoring';
import type { Round } from './types';

/** A line of the lesson: a lead-in, plus the option text it refers to (shown emphasised). */
export interface LessonLine {
  lead: string;
  action?: string;
}

/**
 * The reveal's teaching moment, kept short enough to read at a glance: why the attack was blocked
 * or got through, then the best course of action if the defenders missed it. The picks themselves
 * are already on the cards, so they aren't repeated here.
 */
export function lessonFor(round: Round, r: RoundResult): { why: LessonLine; tip: LessonLine } {
  const best = bestOption(round.ranger);
  const why: LessonLine = !r.ranger
    ? { lead: 'Defenders were too slow.' }
    : !r.predator
      ? { lead: 'The attacker froze.' }
      : r.blocked
        ? { lead: 'Strong enough to stop the attack.' }
        : { lead: 'Not strong enough to stop the attack.' };
  const tip = r.ranger === best ? { lead: '★ Best defence!' } : { lead: '★ Best defence', action: best.text };
  return { why, tip };
}
