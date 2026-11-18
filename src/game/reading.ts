import { settings } from '../config';
import type { Round } from './types';

/** Seconds to read a question (title and description) before the answer timer starts counting down. */
export function readingSeconds(round: Round): number {
  const words = `${round.situation} ${round.detail}`.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / settings.readingWordsPerSecond + settings.readingBufferSeconds);
}
