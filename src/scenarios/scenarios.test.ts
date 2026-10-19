import { describe, expect, it } from 'vitest';
import { scenarios } from './index';

// Booth rules: players get a few seconds per round, so text must stay short and every
// question needs one clear best answer to teach.
const MAX_PROMPT = 36;
const MAX_OPTION = 34;

describe.each(scenarios.map((s) => [s.id, s] as const))('scenario %s', (_id, scenario) => {
  it('has 10 rounds', () => {
    expect(scenario.rounds).toHaveLength(10);
  });

  it.each(scenario.rounds.map((r, i) => [i + 1, r] as const))('round %i is well-formed', (_n, round) => {
    const predatorTags = round.predator.options.map((o) => o.tag);
    for (const question of [round.ranger, round.predator]) {
      expect(question.options).toHaveLength(3);
      expect(question.prompt.length).toBeLessThanOrEqual(MAX_PROMPT);
      const scores = question.options.map((o) => o.score);
      expect(scores.filter((s) => s === Math.max(...scores))).toHaveLength(1);
      for (const option of question.options) {
        expect(option.text.length, option.text).toBeLessThanOrEqual(MAX_OPTION);
      }
    }
    for (const option of round.predator.options) {
      expect(option.tag, option.text).toBeTruthy();
    }
    // A typo in a mitigates list would silently make a defence useless.
    for (const option of round.ranger.options) {
      for (const tag of option.mitigates ?? []) expect(predatorTags, option.text).toContain(tag);
    }
  });
});
