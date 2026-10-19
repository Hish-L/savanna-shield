import type { Scenario } from '../game/types';

export const crocodileApt: Scenario = {
  id: 'crocodile-apt',
  title: 'Silent Ambush',
  briefing: 'A patient nation-state group wants hidden, long-term access to payment systems.',
  predator: { name: 'The Crocodile', role: 'Nation-state hackers', animal: 'crocodile' },
  rounds: [
    {
      stage: 'Recon',
      predator: {
        prompt: 'Find the softest way in.',
        options: [
          { text: "Map the bank's suppliers", score: 10, tag: 'supplier-recon' },
          { text: 'Call the help desk randomly', score: 4, tag: 'vishing' },
          { text: 'Attack the website head-on', score: 3, tag: 'web-attack' },
        ],
      },
      ranger: {
        prompt: 'Know your weak spots. Start where?',
        options: [
          { text: 'Risk-rate every supplier', score: 10, mitigates: ['supplier-recon'] },
          { text: 'Audit only the biggest vendor', score: 4 },
          { text: 'Assume vendors are secure', score: 0 },
        ],
      },
      note: "Nation-state groups often come through trusted suppliers (MITRE T1195). You can't defend what you haven't inventoried.",
    },
    {
      stage: 'Initial access',
      predator: {
        prompt: 'How do you slip in?',
        options: [
          { text: "Poison a vendor's update", score: 10, tag: 'supply-chain' },
          { text: "Phish the vendor's staff", score: 7, tag: 'vendor-phish' },
          { text: "Hack the bank's website", score: 3, tag: 'web-attack' },
        ],
      },
      ranger: {
        prompt: 'A vendor pushes a software update.',
        options: [
          { text: 'Stage it, limit vendor access', score: 10, mitigates: ['supply-chain', 'vendor-phish'] },
          { text: 'Ask the vendor if it is safe', score: 3 },
          { text: 'Auto-install instantly', score: 1 },
        ],
      },
      note: 'SolarWinds (2020) showed one poisoned update can reach thousands of organisations. Stage updates; give vendors least privilege.',
    },
    {
      stage: 'Stealth',
      predator: {
        prompt: 'Avoid being noticed. How?',
        options: [
          { text: 'Use built-in admin tools only', score: 10, tag: 'lotl' },
          { text: 'Drop custom malware', score: 4, tag: 'malware' },
          { text: 'Change the desktop wallpaper', score: 0, tag: 'prank' },
        ],
      },
      ranger: {
        prompt: 'Attackers using normal tools?',
        options: [
          { text: 'Baseline normal, hunt anomalies', score: 10, mitigates: ['lotl'] },
          { text: 'Rely on antivirus signatures', score: 3, mitigates: ['malware'] },
          { text: 'Ban all admin tools', score: 2 },
        ],
      },
      note: "'Living off the land' uses legitimate tools so nothing looks like malware. Threat hunting against a known baseline finds it.",
    },
    {
      stage: 'Persistence',
      predator: {
        prompt: 'Stay for years. Best hideout?',
        options: [
          { text: 'Forge identity tokens', score: 10, tag: 'token-forge' },
          { text: 'Hide a backdoor on a server', score: 7, tag: 'backdoor' },
          { text: "Leave a file named virus.exe", score: 0, tag: 'obvious' },
        ],
      },
      ranger: {
        prompt: 'Protect the identity systems.',
        options: [
          { text: 'Signing keys in HSMs, monitored', score: 10, mitigates: ['token-forge'] },
          { text: 'Scan servers for backdoors', score: 6, mitigates: ['backdoor'] },
          { text: 'Rotate passwords yearly', score: 2 },
        ],
      },
      note: 'Forged identity tokens (MITRE T1606) let attackers log in as anyone. Signing keys belong in hardware security modules.',
    },
    {
      stage: 'Privilege escalation',
      predator: {
        prompt: 'Reach the payment admins.',
        options: [
          { text: 'Compromise a payments admin', score: 10, tag: 'admin-target' },
          { text: 'Exploit an old server', score: 6, tag: 'exploit' },
          { text: 'Guess the server password', score: 2, tag: 'guess' },
        ],
      },
      ranger: {
        prompt: 'Guard the payment admins.',
        options: [
          { text: 'Just-in-time admin + MFA', score: 10, mitigates: ['admin-target', 'guess'] },
          { text: 'Patch the old servers', score: 6, mitigates: ['exploit'] },
          { text: 'One shared admin password', score: 0 },
        ],
      },
      note: 'Privileged access management makes admin rights temporary, recorded and MFA-protected, so a stolen login is not enough.',
    },
    {
      stage: 'Lateral movement',
      predator: {
        prompt: 'Move toward the payments system.',
        options: [
          { text: 'Pivot through a jump server', score: 10, tag: 'jump' },
          { text: 'Email malware to payments team', score: 4, tag: 'phishing' },
          { text: 'Scan the whole network', score: 3, tag: 'noisy-scan' },
        ],
      },
      ranger: {
        prompt: 'Protect the payments network.',
        options: [
          { text: 'Isolated zone, strict access', score: 10, mitigates: ['jump', 'noisy-scan'] },
          { text: 'Firewall at the edge only', score: 3 },
          { text: 'Share the email network', score: 0 },
        ],
      },
      note: "After the 2016 Bangladesh Bank heist, SWIFT's security programme required payment systems to be isolated from the general network.",
    },
    {
      stage: 'Collection',
      predator: {
        prompt: 'Gather intel quietly.',
        options: [
          { text: 'Copy tiny chunks, slowly', score: 10, tag: 'low-slow', effect: 'steal' },
          { text: 'Copy everything at once', score: 5, tag: 'bulk', effect: 'steal' },
          { text: 'Screenshot one email', score: 1, tag: 'screenshot' },
        ],
      },
      ranger: {
        prompt: 'Detect slow data theft.',
        options: [
          { text: 'Behaviour analytics on data', score: 10, mitigates: ['low-slow', 'bulk'] },
          { text: 'Alert on huge transfers only', score: 5, mitigates: ['bulk'] },
          { text: 'Check firewall logs yearly', score: 1 },
        ],
      },
      note: "'Low and slow' theft stays under volume alarms. Behaviour analytics (UEBA) spots the unusual pattern instead.",
    },
    {
      stage: 'Impact',
      predator: {
        prompt: 'The order comes in. Strike!',
        options: [
          { text: 'Send fake payment messages', score: 10, tag: 'fraud-payment', effect: 'burn' },
          { text: 'Knock the website offline', score: 5, tag: 'ddos', effect: 'burn' },
          { text: 'Delete one spreadsheet', score: 1, tag: 'petty' },
        ],
      },
      ranger: {
        prompt: 'Strange payments appear.',
        options: [
          { text: 'Reconcile payments in real time', score: 10, mitigates: ['fraud-payment'] },
          { text: 'DDoS protection', score: 5, mitigates: ['ddos'] },
          { text: 'Check at month end', score: 1 },
        ],
      },
      note: 'Reconciling payment messages against the core ledger in real time catches fraudulent transfers before money settles.',
    },
    {
      stage: 'Response',
      predator: {
        prompt: "You've been discovered.",
        options: [
          { text: 'Go dormant, wait it out', score: 10, tag: 'dormant' },
          { text: 'Wipe systems on the way out', score: 6, tag: 'wiper', effect: 'burn' },
          { text: 'Leave a taunting note', score: 1, tag: 'taunt' },
        ],
      },
      ranger: {
        prompt: 'Nation-state actor found. Now?',
        options: [
          { text: 'Scope fully, then call ASD', score: 10, mitigates: ['dormant', 'wiper'] },
          { text: 'Unplug the one server', score: 3 },
          { text: 'Announce it online now', score: 1 },
        ],
      },
      note: "Evicting too early tips off the attacker. Scope first, then evict everywhere at once, with help from ASD's ACSC.",
    },
    {
      stage: 'Recovery',
      predator: {
        prompt: 'Plan your return.',
        options: [
          { text: 'Keep a spare, unused backdoor', score: 10, tag: 'backdoor' },
          { text: 'Reuse the same entry point', score: 4, tag: 'supply-chain' },
          { text: 'Send a thank-you email', score: 0, tag: 'thanks' },
        ],
      },
      ranger: {
        prompt: "Make sure they're really gone.",
        options: [
          { text: 'Assume breach, keep hunting', score: 10, mitigates: ['backdoor', 'supply-chain'] },
          { text: "Reset the admin's password", score: 2 },
          { text: 'Declare victory after a week', score: 1 },
        ],
      },
      note: 'Nation-state actors usually plant spare access. Treat recovery as a campaign: keep hunting, rebuild identity, harden suppliers.',
    },
  ],
};
