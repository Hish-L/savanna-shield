import { describe, expect, it } from 'vitest';
import { settings } from '../config';
import { attackers, buildScenario, dealQuestions, questionPool } from './index';

// Booth rules: players get a few seconds per question, so text must stay readable at a glance
// and every question needs one clear best answer per side.
const MAX_SITUATION = 50;
const MAX_DETAIL = 150;
const MAX_OPTION = 90;

describe('question pool', () => {
  it('has 18 questions with unique situations', () => {
    expect(questionPool).toHaveLength(18);
    expect(new Set(questionPool.map((r) => r.situation)).size).toBe(questionPool.length);
  });

  it.each(questionPool.map((r, i) => [i + 1, r] as const))('question %i is well-formed', (_n, round) => {
    expect(round.situation.length, round.situation).toBeLessThanOrEqual(MAX_SITUATION);
    expect(round.detail.length, round.detail).toBeLessThanOrEqual(MAX_DETAIL);
    for (const question of [round.ranger, round.predator]) {
      // Answer key scoring: one option each at 4, 3 and 2 (the ±1 options are left out).
      expect(question.options.map((o) => o.score).sort()).toEqual([2, 3, 4]);
      for (const option of question.options) {
        expect(option.text.length, option.text).toBeLessThanOrEqual(MAX_OPTION);
      }
    }
  });
});

describe('dealing', () => {
  it(`deals ${settings.questionsPerGame} distinct questions`, () => {
    for (let i = 0; i < 50; i++) {
      const hand = dealQuestions();
      expect(hand).toHaveLength(settings.questionsPerGame);
      expect(new Set(hand).size).toBe(settings.questionsPerGame);
      expect(buildScenario(hand)?.rounds).toHaveLength(settings.questionsPerGame);
    }
  });

  it('picks every attacker', () => {
    const seen = new Set(Array.from({ length: 200 }, () => buildScenario([0])!.predator.animal));
    expect(seen.size).toBe(attackers.length);
  });

  it('rejects indices outside the pool', () => {
    expect(buildScenario([0, 999])).toBeNull();
    expect(buildScenario([])).toBeNull();
  });
});
