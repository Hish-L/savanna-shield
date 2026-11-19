export type Side = 'ranger' | 'predator';
export type Animal = 'hyena' | 'crocodile' | 'poacher';
/** `teams`: both sides play on phones (Play Together). */
export type Mode = 'duel' | 'solo-ranger' | 'solo-predator' | 'teams';

/** Visual consequence of a Predator option that lands. */
export type Effect = 'steal' | 'burn';

export interface Option {
  text: string;
  /** 1–4, from the answer key. The highest-scoring option is the "best" answer. */
  score: number;
  effect?: Effect;
}

export interface Question {
  prompt: string;
  options: Option[];
}

export interface Round {
  /** Topic tag shown above the situation, e.g. "Secure by Design". */
  stage: string;
  /** Headline of the situation both sides face this round. */
  situation: string;
  /** One or two sentences of context under the headline. */
  detail: string;
  ranger: Question;
  predator: Question;
  /** Optional lesson shown on reveal and in the debrief. */
  note?: string;
}

export interface Scenario {
  id: string;
  title: string;
  predator: { name: string; role: string; animal: Animal };
  rounds: Round[];
}
