import { READING_BUFFER_SECONDS, READING_WORDS_PER_SECOND } from '../config';
import type { Round } from './types';

/** Seconds to read a question (title and description) before the answer timer starts counting down. */
export function readingSeconds(round: Round): number {
  const words = `${round.situation} ${round.detail}`.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / READING_WORDS_PER_SECOND + READING_BUFFER_SECONDS);
}
