import type { Scenario } from '../game/types';
import { crocodileApt } from './crocodile-apt';
import { hyenaRansomware } from './hyena-ransomware';
import { poacherScam } from './poacher-scam';

// Add new scenarios here. scenarios.test.ts checks every entry for booth-readability rules.
export const scenarios: Scenario[] = [hyenaRansomware, poacherScam, crocodileApt];
