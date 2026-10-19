import type { Scenario } from '../game/types';

export const hyenaRansomware: Scenario = {
  id: 'hyena-ransomware',
  title: 'Ransomware Raid',
  briefing: 'A ransomware gang wants to lock up the reserve and demand a ransom.',
  predator: { name: 'Hyena Pack', role: 'Ransomware gang', animal: 'hyena' },
  rounds: [
    {
      stage: 'Recon',
      predator: {
        prompt: 'Scout the herd. Look where first?',
        options: [
          { text: 'Staff profiles on LinkedIn', score: 10, tag: 'social-recon' },
          { text: 'Scan every server, loudly', score: 4, tag: 'noisy-scan' },
          { text: "Guess the CEO's password", score: 1, tag: 'guess' },
        ],
      },
      ranger: {
        prompt: 'Strangers are watching the herd.',
        options: [
          { text: 'Coach staff on oversharing', score: 10, mitigates: ['social-recon'] },
          { text: 'Detect and block scanning', score: 6, mitigates: ['noisy-scan'] },
          { text: 'Ignore it, nothing happened', score: 0 },
        ],
      },
      note: 'Attacks start with open-source recon (MITRE T1593). What staff share publicly shapes the phishing they receive.',
    },
    {
      stage: 'Initial access',
      predator: {
        prompt: 'How do you get in?',
        options: [
          { text: 'Phish a staff member', score: 10, tag: 'phishing' },
          { text: 'Buy stolen VPN logins', score: 7, tag: 'valid-accounts' },
          { text: 'Walk into HQ in hi-vis', score: 2, tag: 'physical' },
        ],
      },
      ranger: {
        prompt: 'Protect the front gate. Priority?',
        options: [
          { text: 'Phishing-resistant MFA', score: 10, mitigates: ['phishing', 'valid-accounts'] },
          { text: 'Yearly awareness slideshow', score: 4 },
          { text: 'Longer password rules', score: 1 },
        ],
      },
      note: 'Phishing and stolen logins are the top ways in. Phishing-resistant MFA (passkeys, security keys) stops both. Essential Eight: MFA.',
    },
    {
      stage: 'Execution',
      predator: {
        prompt: "You're on a laptop. Next?",
        options: [
          { text: 'Run a PowerShell payload', score: 10, tag: 'scripting' },
          { text: 'Open a macro-laden doc', score: 6, tag: 'macro' },
          { text: 'Ask IT for admin rights', score: 1, tag: 'ask' },
        ],
      },
      ranger: {
        prompt: 'Stop unknown code from running.',
        options: [
          { text: 'Application allow-listing', score: 10, mitigates: ['scripting', 'macro'] },
          { text: 'Block internet macros', score: 6, mitigates: ['macro'] },
          { text: 'Trust antivirus alone', score: 2 },
        ],
      },
      note: 'Application control and macro restrictions are Essential Eight controls. They stop attacker code even after a successful phish (MITRE T1059).',
    },
    {
      stage: 'Persistence',
      predator: {
        prompt: 'Make sure you can come back.',
        options: [
          { text: 'Hidden scheduled task', score: 10, tag: 'scheduled-task' },
          { text: 'Create a new admin account', score: 6, tag: 'new-account' },
          { text: 'Password on a sticky note', score: 0, tag: 'sticky' },
        ],
      },
      ranger: {
        prompt: 'Spot attackers settling in.',
        options: [
          { text: 'EDR alerts on tasks & accounts', score: 10, mitigates: ['scheduled-task', 'new-account'] },
          { text: 'Monthly manual log review', score: 4, mitigates: ['new-account'] },
          { text: 'Rebuild PCs once a year', score: 1 },
        ],
      },
      note: 'Persistence (MITRE T1053) means a reboot will not evict the attacker. Endpoint detection (EDR) flags new tasks and accounts in minutes.',
    },
    {
      stage: 'Privilege escalation',
      predator: {
        prompt: 'You need admin. Best route?',
        options: [
          { text: 'Dump cached admin passwords', score: 10, tag: 'cred-dump' },
          { text: 'Exploit an unpatched driver', score: 7, tag: 'exploit' },
          { text: 'Brute-force domain admin', score: 2, tag: 'brute' },
        ],
      },
      ranger: {
        prompt: 'Guard the keys to the kingdom.',
        options: [
          { text: 'No admin rights on PCs', score: 10, mitigates: ['cred-dump'] },
          { text: 'Patch critical flaws in 48h', score: 7, mitigates: ['exploit'] },
          { text: '20-character admin passwords', score: 3, mitigates: ['brute'] },
        ],
      },
      note: 'Restricting admin privileges and patching fast are both Essential Eight controls. Credential dumping (MITRE T1003) is how most crews become admin.',
    },
    {
      stage: 'Lateral movement',
      predator: {
        prompt: 'Spread to the servers.',
        options: [
          { text: 'Stolen admin login over RDP', score: 10, tag: 'remote-services' },
          { text: 'Email malware to server team', score: 4, tag: 'phishing' },
          { text: 'Plug a USB into each server', score: 1, tag: 'physical' },
        ],
      },
      ranger: {
        prompt: 'Stop the pack moving between pens.',
        options: [
          { text: 'Segment the network', score: 10, mitigates: ['remote-services'] },
          { text: 'Alert on odd admin logins', score: 7, mitigates: ['remote-services'] },
          { text: 'Flat network, faster for staff', score: 0 },
        ],
      },
      note: 'Segmentation turns one infected laptop into one problem, not a bank-wide outage (MITRE T1021).',
    },
    {
      stage: 'Exfiltration',
      predator: {
        prompt: 'Grab data for double extortion.',
        options: [
          { text: 'Upload files to cloud storage', score: 10, tag: 'exfil-cloud', effect: 'steal' },
          { text: 'Email files to yourself', score: 5, tag: 'exfil-email', effect: 'steal' },
          { text: 'Print everything', score: 1, tag: 'physical' },
        ],
      },
      ranger: {
        prompt: 'Data is leaving. Your control?',
        options: [
          { text: 'Data loss prevention', score: 10, mitigates: ['exfil-cloud', 'exfil-email'] },
          { text: 'Encrypt laptop disks', score: 3 },
          { text: 'Hope the files are too big', score: 0 },
        ],
      },
      note: 'Modern ransomware steals data before encrypting, so it can threaten a leak too (MITRE T1567). Watch and limit what leaves.',
    },
    {
      stage: 'Impact',
      predator: {
        prompt: 'Time to strike.',
        options: [
          { text: 'Encrypt servers, delete backups', score: 10, tag: 'encrypt', effect: 'burn' },
          { text: 'Deface the intranet', score: 3, tag: 'deface' },
          { text: 'Send a scary email', score: 1, tag: 'bluff' },
        ],
      },
      ranger: {
        prompt: 'Ransomware detonates. Lifeline?',
        options: [
          { text: 'Offline, immutable backups', score: 10, mitigates: ['encrypt'] },
          { text: 'Backups on the same network', score: 3 },
          { text: 'Pay the ransom quickly', score: 0 },
        ],
      },
      note: 'Offline, immutable backups let a bank recover without paying. Paying funds crime and guarantees nothing. Essential Eight: regular backups.',
    },
    {
      stage: 'Response',
      predator: {
        prompt: "You've been spotted. Now?",
        options: [
          { text: 'Wipe logs to hide tracks', score: 10, tag: 'log-wipe' },
          { text: 'Threaten a customer data leak', score: 7, tag: 'extortion' },
          { text: 'Brag on social media', score: 1, tag: 'brag' },
        ],
      },
      ranger: {
        prompt: 'Incident declared. First move?',
        options: [
          { text: 'Isolate hosts, run the playbook', score: 10, mitigates: ['log-wipe'] },
          { text: 'Shut down the whole bank', score: 3 },
          { text: 'Stay quiet, investigate alone', score: 0 },
        ],
      },
      note: 'A rehearsed playbook and logs shipped off-host stop attackers erasing evidence (MITRE T1070). APRA CPS 234 requires notifying APRA of material incidents within 72 hours.',
    },
    {
      stage: 'Recovery',
      predator: {
        prompt: 'One last chance to profit.',
        options: [
          { text: 'Sell access to another gang', score: 10, tag: 'access-broker' },
          { text: 'Keep a backdoor for later', score: 9, tag: 'backdoor' },
          { text: 'Retire to the beach', score: 0, tag: 'retire' },
        ],
      },
      ranger: {
        prompt: 'Restoring the reserve. Priority?',
        options: [
          { text: 'Rebuild clean, reset all logins', score: 10, mitigates: ['access-broker', 'backdoor'] },
          { text: 'Restore and reopen ASAP', score: 3 },
          { text: "Change only the CEO's password", score: 1 },
        ],
      },
      note: 'Recovery is not done until systems are rebuilt from known-good images and every credential is reset, or the pack walks straight back in.',
    },
  ],
};
