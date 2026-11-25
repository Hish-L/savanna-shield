import type { Option, Question } from './types';

export interface RoundResult {
  ranger: Option | null;
  predator: Option | null;
  /** The defence was at least as strong as the attack (or the attackers never moved). */
  blocked: boolean;
  /** The attack landed: always the opposite of `blocked`. Drives the breach visuals. */
  breached: boolean;
  rangerPoints: number;
  predatorPoints: number;
}

/**
 * Every round is either defended or raided. A defence blocks an attack when its score is at least
 * as high as the attack's, and a blocked attack scores nothing. A missing pick means that side ran
 * out of time and scores nothing: Rangers who pick beat attackers who froze, but if the Rangers
 * don't act the watering hole is raided, even when the attackers froze too.
 */
export function resolveRound(ranger: Option | null, predator: Option | null): RoundResult {
  const blocked = !!ranger && (!predator || ranger.score >= predator.score);
  const breached = !blocked;
  return { ranger, predator, blocked, breached, rangerPoints: ranger?.score ?? 0, predatorPoints: breached ? (predator?.score ?? 0) : 0 };
}

export function bestOption(question: Question): Option {
  return question.options.reduce((a, b) => (b.score > a.score ? b : a));
}
