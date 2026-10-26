export type Side = 'ranger' | 'predator';
export type Animal = 'hyena' | 'crocodile' | 'poacher';
/** `online-<side>`: this device plays <side> against a remote player. `teams`: both sides play on phones (Team Battle). */
export type Mode = 'duel' | 'solo-ranger' | 'solo-predator' | 'online-ranger' | 'online-predator' | 'teams';

/** Visual consequence of a Predator option that lands. */
export type Effect = 'steal' | 'burn';

export interface Option {
  text: string;
  /** 0–10. The highest-scoring option is the "best" answer shown in the field note. */
  score: number;
  /** Predator options: the attacker technique this option uses. */
  tag?: string;
  /** Ranger options: Predator tags this defence blocks. */
  mitigates?: string[];
  effect?: Effect;
}

export interface Question {
  prompt: string;
  options: Option[];
}

export interface Round {
  stage: string;
  ranger: Question;
  predator: Question;
  /** One-line lesson shown on reveal and in the debrief. */
  note: string;
}

export interface Scenario {
  id: string;
  title: string;
  briefing: string;
  predator: { name: string; role: string; animal: Animal };
  rounds: Round[];
}
