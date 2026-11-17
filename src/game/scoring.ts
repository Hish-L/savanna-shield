import type { Option, Question } from './types';

export interface RoundResult {
  ranger: Option | null;
  predator: Option | null;
  /** The defence was at least as strong as the attack. */
  blocked: boolean;
  /** The attack landed. Drives the breach visuals. */
  breached: boolean;
  rangerPoints: number;
  predatorPoints: number;
}

/**
 * A defence blocks an attack when its score is at least as high as the attack's, and a blocked
 * attack scores nothing. A missing pick means that side ran out of time and scores nothing.
 */
export function resolveRound(ranger: Option | null, predator: Option | null): RoundResult {
  const blocked = !!ranger && !!predator && ranger.score >= predator.score;
  const breached = !!predator && !blocked;
  return { ranger, predator, blocked, breached, rangerPoints: ranger?.score ?? 0, predatorPoints: breached ? predator.score : 0 };
}

export function bestOption(question: Question): Option {
  return question.options.reduce((a, b) => (b.score > a.score ? b : a));
}
