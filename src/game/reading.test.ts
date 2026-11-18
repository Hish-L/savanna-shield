import { describe, expect, it } from 'vitest';
import { settings } from '../config';
import { questionPool } from '../scenarios';
import { readingSeconds } from './reading';

describe('readingSeconds', () => {
  it('scales with the words in the question, plus the buffer', () => {
    const round = { ...questionPool[0], situation: 'One two three', detail: 'four five six' };
    expect(readingSeconds(round)).toBe(2 + settings.readingBufferSeconds);
  });

  it('gives every question in the pool a sensible reading time', () => {
    for (const round of questionPool) expect(readingSeconds(round)).toBeGreaterThan(settings.readingBufferSeconds);
  });
});
