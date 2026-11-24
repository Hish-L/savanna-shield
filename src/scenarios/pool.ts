import type { Option, Round } from '../game/types';

// The question pool, from the facilitator spreadsheet ("cyber_security_game_updated_scenarios WF2").
// Each game deals settings.questionsPerGame of these at random.
//
// Scores follow the spreadsheet: Ranger options are +2..+4 (+4 is the strongest defender action).
// Predator options are stored as the size of the spreadsheet's −2..−4 (4 is the highest-impact move),
// so for both sides the highest score is the best pick. scenarios.test.ts enforces the format.

/** Options in answer-key order: strongest first, scored 4, 3, 2. */
const ranked = (...options: (string | Omit<Option, 'score'>)[]): Option[] =>
  options.map((o, i) => ({ ...(typeof o === 'string' ? { text: o } : o), score: 4 - i }));

export const questionPool: Round[] = [
  {
    stage: 'Pen Test',
    situation: 'Customer information exposed in Westpac Live',
    detail: 'Penetration Testing Team [PTT] discovers a vulnerability that could let someone view any customer’s personally identifiable information (PII) Data.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Fix the access checks and retest with the penetration testers.',
        'Escalate immediately and get help to contain the exposure.',
        'Help the Security Response team check logs for misuse.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        { text: 'Sell stolen customer information to fraudsters.', effect: 'steal' },
        { text: 'Steal personal information from thousands of accounts.', effect: 'steal' },
        { text: 'Copy a customer’s private details without permission.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Patching',
    situation: 'Critical Software patch',
    detail: 'Software Vendor releases a critical patch. The Distributed Controls Assessment Team decides that deploying it requires a CISO override.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Action the urgent override and prepare a safe rollout.',
        'Check affected systems and test the patch promptly.',
        'Apply approved temporary protections while awaiting approval.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        { text: 'Exploit the flaw to steal internal files.', effect: 'steal' },
        'Exploit & Install malware to maintain unauthorised access.',
        { text: 'Deploy ransomware across affected systems.', effect: 'burn' },
      ),
    },
  },
  {
    stage: 'AppSec',
    situation: 'Plaintext password in Source Code',
    detail: 'Application Security Team (AppSec) identifies a plaintext password in an application\'s source code.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Revoke or rotate the passwords regularly & amend the source code.',
        'Replace the hardcoded password with an approved secrets manager.',
        'Check for copies in code history, logs and build files.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
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
    detail: 'Penetration Testing Team [PTT] identifies that a popular software package has been compromised in a supply chain attack.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Alert the response team and block affected package versions.',
        'Find affected systems and move to a verified safe version.',
        'Help check affected environments for signs of compromise.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
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
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Engage SBD during design and Adhere to security requirements.',
        'Review threats with SBD before development starts.',
        'Share the design, data flows and planned integrations.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'App is Insecure, Take over customer accounts to commit fraud.',
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
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Hold the release, fix the vulnerability and retest with [PTT].',
        'Advise Devs to Fix before releasing with the vulnerability.',
        'Assess exposure and propose temporary protections for review.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
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
    detail: 'AppSec\'s Snyk scan finds a vulnerable dependency in your application.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Upgrade to a fixed version, test and rescan.',
        'Remove the dependency if the application does not need it.',
        'Assess the risk and apply approved protections while arranging a fix.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
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
    detail: 'A new catalyst delivery unit (DU) wants to start using a SaaS tool without engaging Secure By Design (SBD).',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Engage SBD and complete required reviews before onboarding.',
        'Check whether an approved tool already meets the need.',
        'Gather the supplier’s security details for review.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        { text: 'Abuse the SaaS connection to steal internal company data.', effect: 'steal' },
        { text: 'Steal confidential files stored in the tool.', effect: 'steal' },
        'Use stolen credentials to access the team’s SaaS account.',
      ),
    },
  },
  {
    stage: 'AppSec',
    situation: 'Critical findings from Argus',
    detail: 'Westpac\'s AI Code scan harness (called ARGUS) identifies Critical and High vulnerabilities in an application’s source code.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Escalate immediately and pause affected releases while findings are assessed.',
        'Prioritise confirmed vulnerabilities, fix them and request rescan.',
        'Check production exposure and coordinate any urgent containment.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
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
    detail: 'Penetration Testing Team [PTT] discovers that a Prod application is writing customer information and access tokens into its logs.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Escalate, stop sensitive logging and revoke exposed tokens.',
        'Restrict log access and help assess the exposure.',
        'Remove sensitive fields from logs and test the fix.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        { text: 'Use stolen tokens to steal data across multiple accounts.', effect: 'steal' },
        'Use stolen access tokens to impersonate customers.',
        { text: 'Share customer information from logs with criminals.', effect: 'steal' },
      ),
    },
  },
  {
    stage: 'Phishing',
    situation: 'Suspicious email link',
    detail: 'You receive an unexpected email containing a link.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Verify the sender through another channel before even thinking about opening the link.',
        'Looks suspicious, mark as phishing.',
        'Delete the email immediately without taking any further action.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Make the request urgent so the recipient acts without checking first.',
        'Make the message appear routine so the recipient trusts the request.',
        'Send repeated messages until the recipient eventually opens the link.',
      ),
    },
  },
  {
    stage: 'Passwords',
    situation: 'Password practices',
    detail: 'What approach would you take when dealing with passwords?',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Create unique passwords and store them using approved security tools.',
        'Change passwords regularly avoiding the same basic password pattern.',
        'Create complex passwords and reuse them across several important accounts.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for accounts where users may have weak password practices.',
        'Target random accounts without considering their existing security controls.',
        'Focus on accounts that appear to have strong authentication controls.',
      ),
    },
  },
  {
    stage: 'MFA',
    situation: 'Unexpected MFA notification',
    detail: 'You receive an unexpected MFA notification on your mobile.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Reject the request and report the unexpected authentication activity immediately.',
        'Ignore the request because it will eventually disappear by itself.',
        'Approve the request once to check what application triggered it.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for users who may approve unexpected requests without checking them.',
        'Avoid accounts protected by additional authentication controls whenever possible.',
        'Focus on users who consistently verify every authentication request carefully.',
      ),
    },
  },
  {
    stage: 'Updates',
    situation: 'Important security update',
    detail: 'Your device has an important security update available.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Install the approved update according to the required security process.',
        'Delay the update until the existing software begins experiencing problems.',
        'Ignore the update because existing security software should provide protection.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for outdated systems that may be missing important security protections.',
        'Focus on devices that consistently receive their security updates promptly.',
        'Target systems only after confirming every available update has been installed.',
      ),
    },
  },
  {
    stage: 'Social Engineering',
    situation: 'Request for sensitive information',
    detail: 'Someone requests sensitive information from you.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Verify the person\'s identity independently before sharing the requested information.',
        'Ask the Requester why they need this information.',
        'Do not provide the information.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Make the request appear familiar and relevant to the person\'s normal work.',
        'Make the request unusual so the recipient immediately questions its legitimacy.',
        'Include obvious inconsistencies that encourage the recipient to verify the request.',
      ),
    },
  },
  {
    stage: 'Software',
    situation: 'Installing new software',
    detail: 'You need software that isn\'t installed on your work device.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Request the application through the organisation\'s approved technology process.',
        'Download the application directly from an approved website.',
        'Copy the application from a colleague who already has it installed.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for users who regularly install software outside approved technology processes.',
        'Focus exclusively on computers where application installation is strictly controlled.',
        'Avoid environments where users are allowed to install their own applications.',
      ),
    },
  },
  {
    stage: 'Vulnerabilities',
    situation: 'Discovering a vulnerability',
    detail: 'You discover a potential security vulnerability.',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Document the vulnerability and report it through the approved security process.',
        'Discuss the vulnerability broadly so other employees know about the problem.',
        'Research the vulnerability and determine if it is dangerous.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for weaknesses that remain unidentified, unpatched or incorrectly configured.',
        'Avoid systems with known vulnerabilities because administrators may monitor them closely.',
        'Focus on vulnerabilities that have already been fixed across every affected system.',
      ),
    },
  },
  {
    stage: 'Security Culture',
    situation: 'General approach to cybersecurity',
    detail: 'What is your general approach to cybersecurity?',
    ranger: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Cyber Security Is Everyone\'s Job, Every Day.',
        'Follow security controls and report suspicious behaviour whenever it is identified.',
        'Rely on cybersecurity teams to identify and resolve every potential security issue.',
      ),
    },
    predator: {
      prompt: 'What do YOU do Next?',
      options: ranked(
        'Look for situations where people bypass security controls for convenience.',
        'Target processes that have strong controls and little opportunity for mistakes.',
        'Focus on employees who consistently follow every required security control.',
      ),
    },
  },
];
