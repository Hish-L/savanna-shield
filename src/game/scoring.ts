import { BLOCK_BONUS } from '../config';
import type { Option, Question } from './types';

export interface RoundResult {
  ranger: Option | null;
  predator: Option | null;
  blocked: boolean;
  /** The attack landed: not blocked and a decent technique. Drives the breach visuals. */
  breached: boolean;
  rangerPoints: number;
  predatorPoints: number;
}

/** A missing pick means that side ran out of time and scores nothing. */
export function resolveRound(ranger: Option | null, predator: Option | null): RoundResult {
  const blocked = !!predator?.tag && !!ranger?.mitigates?.includes(predator.tag);
  const predatorPoints = predator ? (blocked ? Math.floor(predator.score / 2) : predator.score) : 0;
  const rangerPoints = ranger ? ranger.score + (blocked ? BLOCK_BONUS : 0) : 0;
  const breached = !!predator && !blocked && predator.score >= 5;
  return { ranger, predator, blocked, breached, rangerPoints, predatorPoints };
}

export function bestOption(question: Question): Option {
  return question.options.reduce((a, b) => (b.score > a.score ? b : a));
}
