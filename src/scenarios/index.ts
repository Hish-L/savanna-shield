import type { Scenario } from '../game/types';
import { settings } from '../config';
import { questionPool } from './pool';

export { questionPool };

// Each game deals a random hand of questions and a random attacker.
export const attackers: Scenario['predator'][] = [
  { name: 'Hyena Pack', role: 'Opportunistic attackers', animal: 'hyena' },
  { name: 'Crocodile Crew', role: 'Patient ambushers', animal: 'crocodile' },
  { name: 'Poacher Gang', role: 'Organised criminals', animal: 'poacher' },
];

/** Random, distinct pool indices for one game. */
export function dealQuestions(random = Math.random): number[] {
  const indices = [...questionPool.keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, settings.questionsPerGame);
}

/** The scenario for a dealt hand, or null if an index isn't in this build's pool (version mismatch online). */
export function buildScenario(questions: number[], random = Math.random): Scenario | null {
  const rounds = questions.map((i) => questionPool[i]);
  if (!rounds.length || rounds.some((r) => !r)) return null;
  const predator = attackers[Math.floor(random() * attackers.length)];
  return { id: 'release-week', title: 'Release Week', predator, rounds };
}
