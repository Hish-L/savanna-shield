import type { Scenario } from '../game/types';
import { settings } from '../config';
import { questionPool } from './pool';

export { questionPool };

// One scenario frame; each game deals a random hand of questions from the pool into it.
const releaseWeek: Omit<Scenario, 'rounds'> = {
  id: 'release-week',
  title: 'Release Week',
  briefing: 'Your squad ships a new Westpac Live feature on Friday. The backlog is full and the deadline is real. Security is job zero.',
  predator: { name: 'Hyena Pack', role: 'Opportunistic attackers', animal: 'hyena' },
};

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
export function buildScenario(questions: number[]): Scenario | null {
  const rounds = questions.map((i) => questionPool[i]);
  if (!rounds.length || rounds.some((r) => !r)) return null;
  return { ...releaseWeek, rounds };
}
