import type { Option, Round } from '../game/types';

// The question pool, from the facilitator answer key ("Cyber security game scenarios").
// Each game deals settings.questionsPerGame of these at random.
//
// Scores follow the answer key: Ranger options are +2..+4 (+4 is the strongest defender action).
// Predator options are stored as the size of the answer key's −2..−4 (4 is the highest-impact move),
// so for both sides the highest score is the best pick. scenarios.test.ts enforces the format.

const DEFEND = 'Choose the best response.';
const ATTACK = 'Choose the best attack.';

/** Options in answer-key order: strongest first, scored 4, 3, 2 (the key's ±1 options are left out). */
const ranked = (...options: (string | Omit<Option, 'score'>)[]): Option[] =>
  options.map((o, i) => ({ ...(typeof o === 'string' ? { text: o } : o), score: 4 - i }));

export const questionPool: Round[] = [
  {
    stage: 'Pen Test',
    situation: 'Customer information exposed in Westpac Live',
    detail: 'The Penetration Testing Team discovers a vulnerability that could let someone view any customer’s personally identifiable information (PII).',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Escalate immediately and help contain the exposure.',
        'Fix the access checks and retest with the penetration testers.',
        'Help the response team check logs for misuse.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Sell stolen customer information to fraudsters.', effect: 'steal' },
        { text: 'Steal personal information from thousands of accounts.', effect: 'steal' },
        { text: 'Copy a customer’s private details without permission.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Patching',
    situation: 'Critical Microsoft patch',
    detail: 'Microsoft releases a critical patch. The Distributed Controls Assessment Team decides that deploying it requires a CISO override.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Request the urgent override and prepare a safe rollout.',
        'Check affected systems and test the patch promptly.',
        'Apply approved temporary protections while awaiting approval.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Deploy ransomware across affected systems.', effect: 'burn' },
        'Install malware to maintain unauthorised access.',
        { text: 'Exploit the flaw to steal internal files.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'AppSec',
    situation: 'Plaintext password in source code',
    detail: "The Application Security Team identifies a plaintext password in an application's source code.",
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Revoke or rotate the password and report the exposure.',
        'Replace the hardcoded password with an approved secrets manager.',
        'Check for copies in code history, logs and build files.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Use the stolen password to sabotage critical services.', effect: 'burn' },
        { text: 'Steal sensitive data using the compromised account.', effect: 'steal' },
        'Use the password to access the application illegally.',
      ),
    },
  },
  {
    stage: 'Pen Test',
    situation: 'Compromised software package',
    detail: 'The Penetration Testing Team identifies that a popular software package has been compromised in a supply chain attack.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Alert the response team and block affected package versions.',
        'Find affected systems and move to a verified safe version.',
        'Help check affected environments for signs of compromise.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Push malicious changes into production applications.', effect: 'burn' },
        'Use stolen credentials to break into development systems.',
        { text: 'Distribute a package that secretly steals credentials.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Secure by Design',
    situation: 'Security requirements for a new feature',
    detail: 'An application team is building a new feature and needs guidance from Secure By Design (SBD).',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Engage SBD during design and agree on security requirements.',
        'Review threats with SBD before development starts.',
        'Share the design, data flows and planned integrations.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Take over customer accounts to commit fraud.', effect: 'steal' },
        'Alter customer records without authorisation.',
        { text: 'Access another user’s private information without permission.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Release',
    situation: 'Production release with a high vulnerability',
    detail: 'An application team wants to release an application with a high-rated vulnerability.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Hold the release, fix the vulnerability and retest.',
        'Seek a formal risk decision before releasing with the vulnerability.',
        'Assess exposure and propose temporary protections for review.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Exploit the vulnerability to shut down critical services.', effect: 'burn' },
        { text: 'Sell stolen application data to criminals.', effect: 'steal' },
        { text: 'Use the vulnerability to steal confidential files.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'AppSec',
    situation: 'Vulnerable dependency found by Snyk',
    detail: 'A Snyk scan finds a vulnerable dependency in your application.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Upgrade to a fixed version, test and rescan.',
        'Remove the dependency if the application does not need it.',
        'Assess the risk and apply approved protections while arranging a fix.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Destroy data across the compromised systems.', effect: 'burn' },
        'Use stolen secrets to break into connected systems.',
        { text: 'Abuse the dependency to steal application secrets.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Secure by Design',
    situation: 'SaaS onboarding without SBD',
    detail: 'A new catalyst delivery unit wants to start using a SaaS tool without engaging Secure By Design.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Engage SBD and complete required reviews before onboarding.',
        'Check whether an approved tool already meets the need.',
        'Gather the supplier’s security details for review.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Abuse the SaaS connection to steal internal company data.', effect: 'steal' },
        { text: 'Steal confidential files stored in the tool.', effect: 'steal' },
        'Use stolen credentials to access the team’s SaaS account.',
      ),
    },
  },
  {
    stage: 'AppSec',
    situation: 'Ten critical findings from Argus',
    detail: 'The Argus code scan harness identifies ten critical vulnerabilities in an application’s source code.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Escalate immediately and pause affected releases while findings are assessed.',
        'Prioritise confirmed vulnerabilities, fix them and rescan.',
        'Check production exposure and coordinate any urgent containment.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Use stolen administrator access to destroy production data.', effect: 'burn' },
        'Create a hidden administrator account for future attacks.',
        { text: 'Exploit a weakness to steal restricted information.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Pen Test',
    situation: 'Sensitive data in application logs',
    detail: 'The Penetration Testing Team discovers that a production application is writing customer information and access tokens into its logs.',
    ranger: {
      prompt: DEFEND,
      options: ranked(
        'Escalate, stop sensitive logging and revoke exposed tokens.',
        'Restrict log access and help assess the exposure.',
        'Remove sensitive fields from logs and test the fix.',
      ),
    },
    predator: {
      prompt: ATTACK,
      options: ranked(
        { text: 'Use stolen tokens to steal data across multiple accounts.', effect: 'steal' },
        'Use stolen access tokens to impersonate customers.',
        { text: 'Share customer information from logs with criminals.', effect: 'steal' },
      ),
    },
  },
];
