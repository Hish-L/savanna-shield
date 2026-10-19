import type { Scenario } from '../game/types';

export const poacherScam: Scenario = {
  id: 'poacher-scam',
  title: 'Payment Scam',
  briefing: 'A scam syndicate wants to trick staff and customers into paying them.',
  predator: { name: 'Poacher Gang', role: 'Scam syndicate', animal: 'poacher' },
  rounds: [
    {
      stage: 'Target',
      predator: {
        prompt: 'Pick your target.',
        options: [
          { text: 'The accounts payable team', score: 10, tag: 'target-finance' },
          { text: 'Random customers from a leak', score: 6, tag: 'target-customers' },
          { text: 'The cleaning contractor', score: 1, tag: 'target-random' },
        ],
      },
      ranger: {
        prompt: 'Who gets scam training first?',
        options: [
          { text: 'Targeted drills, high-risk roles', score: 10, mitigates: ['target-finance'] },
          { text: 'Same yearly module for all', score: 5 },
          { text: 'Only the IT team', score: 1 },
        ],
      },
      note: 'Business Email Compromise targets whoever can move money. High-risk roles need extra, realistic training.',
    },
    {
      stage: 'Approach',
      predator: {
        prompt: 'Send emails from where?',
        options: [
          { text: 'A lookalike domain', score: 10, tag: 'lookalike' },
          { text: "Spoof the bank's real domain", score: 5, tag: 'spoof' },
          { text: 'A free webmail account', score: 2, tag: 'freemail' },
        ],
      },
      ranger: {
        prompt: 'Secure the inbox.',
        options: [
          { text: 'DMARC + lookalike monitoring', score: 10, mitigates: ['lookalike', 'spoof'] },
          { text: 'Banner on external emails', score: 6, mitigates: ['freemail'] },
          { text: 'Bigger mailbox quotas', score: 0 },
        ],
      },
      note: 'DMARC stops attackers spoofing your exact domain. Monitoring new lookalike domains catches tricks like "rn" for "m".',
    },
    {
      stage: 'The lure',
      predator: {
        prompt: 'Write the email.',
        options: [
          { text: 'Supplier bank details changed', score: 10, tag: 'bank-change' },
          { text: 'Please pay attached invoice', score: 6, tag: 'invoice' },
          { text: "You've won a prize!", score: 2, tag: 'prize' },
        ],
      },
      ranger: {
        prompt: 'A supplier changes bank details.',
        options: [
          { text: 'Call back on a known number', score: 10, mitigates: ['bank-change', 'invoice'] },
          { text: 'Reply to the email to confirm', score: 1 },
          { text: 'Approve if the logo looks right', score: 0 },
        ],
      },
      note: 'Never verify through the channel the request came from. Calling back on a number you already have beats payment redirection.',
    },
    {
      stage: 'Pressure',
      predator: {
        prompt: 'Turn up the pressure.',
        options: [
          { text: "Fake CEO: 'Pay now, secret'", score: 10, tag: 'authority' },
          { text: 'ALL CAPS ANGRY EMAIL', score: 3, tag: 'anger' },
          { text: 'Polite reminder in 2 weeks', score: 1, tag: 'patience' },
        ],
      },
      ranger: {
        prompt: "The 'CEO' wants a secret payment.",
        options: [
          { text: 'Dual approval, no exceptions', score: 10, mitigates: ['authority', 'anger'] },
          { text: "Ask the CEO's email to confirm", score: 2 },
          { text: "Pay it, it's the CEO", score: 0 },
        ],
      },
      note: 'Urgency + authority + secrecy is the classic scam recipe. Dual approval means nobody decides under pressure alone.',
    },
    {
      stage: 'Deepfake',
      predator: {
        prompt: 'They want proof. Escalate how?',
        options: [
          { text: "Deepfake the CEO's voice", score: 10, tag: 'deepfake' },
          { text: 'Send a photo of the CEO', score: 2, tag: 'photo' },
          { text: 'Give up on this one', score: 0, tag: 'quit' },
        ],
      },
      ranger: {
        prompt: "The 'CEO' calls to confirm.",
        options: [
          { text: 'Hang up, call the known number', score: 10, mitigates: ['deepfake'] },
          { text: 'Ask a personal question', score: 4 },
          { text: 'Voice sounds right, proceed', score: 0 },
        ],
      },
      note: 'Voices and faces can be cloned from seconds of public audio. Process (call-backs, code words) beats recognition.',
    },
    {
      stage: 'Customers',
      predator: {
        prompt: 'Now go after customers.',
        options: [
          { text: 'Texts pretending to be the bank', score: 10, tag: 'smishing' },
          { text: 'Pop-up ads on game sites', score: 3, tag: 'adware' },
          { text: 'Letters in the post', score: 2, tag: 'mail' },
        ],
      },
      ranger: {
        prompt: 'Fake bank texts are spreading.',
        options: [
          { text: 'Block spoofed senders, warn users', score: 10, mitigates: ['smishing'] },
          { text: "Tell customers 'be careful'", score: 4 },
          { text: "Ignore it, not our texts", score: 0 },
        ],
      },
      note: 'Scam texts can land in the same thread as real bank messages. Banks never send links asking you to log in or move money.',
    },
    {
      stage: 'Cash out',
      predator: {
        prompt: 'Where does the money go?',
        options: [
          { text: 'A network of mule accounts', score: 10, tag: 'mules', effect: 'steal' },
          { text: 'Gift cards', score: 5, tag: 'giftcards', effect: 'steal' },
          { text: 'Your own bank account', score: 0, tag: 'own-account' },
        ],
      },
      ranger: {
        prompt: 'Stop money reaching criminals.',
        options: [
          { text: 'Payee name check + mule hunting', score: 10, mitigates: ['mules'] },
          { text: 'Warn on gift card payments', score: 4, mitigates: ['giftcards'] },
          { text: 'Trust whatever BSB is entered', score: 0 },
        ],
      },
      note: 'Money mules launder stolen funds. Payee name checks (Confirmation of Payee) and mule detection stop the cash leaving.',
    },
    {
      stage: 'Getaway',
      predator: {
        prompt: 'Money landed. Now?',
        options: [
          { text: 'Split and move it in minutes', score: 10, tag: 'fast-move', effect: 'steal' },
          { text: 'Withdraw it all at one ATM', score: 3, tag: 'atm' },
          { text: 'Leave it there for a week', score: 1, tag: 'wait' },
        ],
      },
      ranger: {
        prompt: 'A suspicious payment just left.',
        options: [
          { text: 'Real-time monitoring and hold', score: 10, mitigates: ['fast-move', 'atm'] },
          { text: 'Email the customer', score: 3 },
          { text: 'Review it next month', score: 0 },
        ],
      },
      note: 'Scammers move money within minutes. Real-time behavioural monitoring and payment holds give banks a chance to recover funds.',
    },
    {
      stage: 'Response',
      predator: {
        prompt: 'A victim reports you.',
        options: [
          { text: 'Switch domains and mules', score: 10, tag: 'pivot' },
          { text: 'Keep using the same mules', score: 2, tag: 'same-mules' },
          { text: 'Send an apology', score: 0, tag: 'apology' },
        ],
      },
      ranger: {
        prompt: 'A customer reports a scam.',
        options: [
          { text: 'Recall funds, share intel fast', score: 10, mitigates: ['pivot', 'same-mules'] },
          { text: 'Log a ticket for later', score: 2 },
          { text: 'Blame the customer', score: 0 },
        ],
      },
      note: 'Speed matters. Recalling funds and sharing scam indicators with other banks (e.g. via the AFCX) protects the next victim.',
    },
    {
      stage: 'Round two',
      predator: {
        prompt: 'Squeeze the victims again.',
        options: [
          { text: "Pose as 'fund recovery' service", score: 10, tag: 'recovery-scam' },
          { text: 'Sell the victim list', score: 7, tag: 'victim-resale' },
          { text: 'Retire on the loot', score: 0, tag: 'retire' },
        ],
      },
      ranger: {
        prompt: 'Aftercare for scam victims.',
        options: [
          { text: 'Warn about recovery scams', score: 10, mitigates: ['recovery-scam', 'victim-resale'] },
          { text: 'Post a generic social update', score: 3 },
          { text: 'Close the case', score: 1 },
        ],
      },
      note: "Victims are often re-targeted by 'recovery' scammers promising to get money back. Proactive warnings stop round two.",
    },
  ],
};
