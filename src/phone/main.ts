import { ROUND_SECONDS } from '../config';
import type { Side } from '../game/types';
import type { PhoneMsg, PhoneView } from '../net/teams-protocol';
import './phone.css';

// Team Battle controller. The big screen sends a full PhoneView whenever anything changes; this page
// just draws the latest one and sends taps back. Kept free of three.js so it loads fast on phones.

const app = document.getElementById('app')!;
const NAMES: Record<Side, string> = { ranger: 'Ranger', predator: 'Predator' };
const LETTERS = ['A', 'B', 'C'];
const ROUND_MS = ROUND_SECONDS * 1000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

// Per tab, so a refresh reclaims the seat but two tabs on one laptop can test both sides.
// (crypto.randomUUID needs HTTPS; the booth serves plain HTTP on the local network.)
const TOKEN_KEY = 'savannah-shield-team-token';
const token =
  sessionStorage.getItem(TOKEN_KEY) ??
  (() => {
    const t = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(TOKEN_KEY, t);
    return t;
  })();

let ws: WebSocket | null = null;
let view: PhoneView | null = null;
let attempts = 0;
let frame = 0;

function send(msg: PhoneMsg): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect(): void {
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = socket;
  socket.onopen = () => {
    attempts = 0;
    socket.send(JSON.stringify({ role: 'phone' }));
    setOffline(false);
    if (!view) status('Looking for the big screen…');
  };
  socket.onmessage = (e) => {
    let next: PhoneView;
    try {
      next = JSON.parse(e.data);
    } catch {
      return;
    }
    if (next.v === 'who') send({ t: 'hello', token });
    else {
      view = next;
      render();
    }
  };
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    setOffline(true);
    setTimeout(connect, Math.min(4000, 400 * 2 ** attempts++));
  };
}

// A phone coming back from a locked screen often has a dead socket; reconnect straight away,
// or ask for a fresh view so the timer is right.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (ws?.readyState === WebSocket.OPEN) send({ t: 'hello', token });
  else if (ws) ws.close();
  requestWakeLock();
});

/** Keeps the screen on during a game where supported (needs HTTPS on most browsers, so best effort). */
function requestWakeLock(): void {
  (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {});
}

function setOffline(offline: boolean): void {
  document.body.classList.toggle('offline', offline);
}

function status(message: string, side?: Side): void {
  draw(side, `<p class="message">${esc(message)}</p>`);
}

function draw(side: Side | undefined, body: string): void {
  cancelAnimationFrame(frame);
  document.body.dataset.side = side ?? '';
  app.innerHTML = `
    <header>
      <span class="title">Savannah <b>Shield</b></span>
      ${side ? `<span class="team">${NAMES[side]} team</span>` : ''}
    </header>
    <section class="body">${body}</section>
    <div class="reconnecting">Reconnecting…</div>`;
}

function render(): void {
  if (!view) return;
  switch (view.v) {
    case 'pick-side':
      return pickSide(view.taken);
    case 'waiting':
      return status(view.message, view.side);
    case 'question':
      return question(view);
    case 'result':
      return result(view);
    case 'final':
      return final(view);
  }
}

function pickSide(taken: Side[]): void {
  const button = (side: Side, sub: string) =>
    `<button class="side ${side}" data-side="${side}" ${taken.includes(side) ? 'disabled' : ''}><b>${NAMES[side]}</b><small>${taken.includes(side) ? 'Taken' : sub}</small></button>`;
  draw(
    undefined,
    `<h1>Team Battle</h1>
     <p class="message">Pick your team. One phone per team.</p>
     ${button('ranger', 'Defend the watering hole')}
     ${button('predator', 'Raid it')}`,
  );
  app.querySelectorAll<HTMLButtonElement>('button.side').forEach(
    (b) =>
      (b.onclick = () => {
        requestWakeLock();
        app.querySelectorAll<HTMLButtonElement>('button.side').forEach((x) => (x.disabled = true));
        send({ t: 'claim', side: b.dataset.side as Side });
      }),
  );
}

function question(q: Extract<PhoneView, { v: 'question' }>): void {
  const locked = q.locked !== null;
  draw(
    q.side,
    `<p class="stage">Round ${q.round + 1} / ${q.total} · ${esc(q.stage)}</p>
     <div class="timer"><div class="fill"></div></div>
     <h2 class="prompt">${esc(q.prompt)}</h2>
     <div class="options ${locked ? 'locked' : ''}">
       ${q.options
         .map((text, i) => `<button class="opt ${q.locked === i ? 'chosen' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}><kbd>${LETTERS[i]}</kbd><span>${esc(text)}</span></button>`)
         .join('')}
     </div>
     <p class="note">${locked ? 'Locked in. Waiting for the other team…' : 'Talk it over, then tap your answer.'}</p>`,
  );
  const buttons = app.querySelectorAll<HTMLButtonElement>('button.opt');
  buttons.forEach(
    (b) =>
      (b.onclick = () => {
        // Show the choice straight away; the screen confirms with a locked view.
        buttons.forEach((x) => (x.disabled = true));
        b.classList.add('chosen');
        app.querySelector('.options')!.classList.add('locked');
        app.querySelector('.note')!.textContent = 'Locked in. Waiting for the other team…';
        send({ t: 'pick', round: q.round, index: Number(b.dataset.i) });
      }),
  );

  const fill = app.querySelector<HTMLElement>('.timer .fill')!;
  const end = performance.now() + q.endsInMs;
  const tick = () => {
    const left = Math.max(0, end - performance.now());
    const fraction = left / ROUND_MS;
    fill.style.transform = `scaleX(${fraction})`;
    fill.classList.toggle('urgent', fraction < 0.35);
    if (left > 0) frame = requestAnimationFrame(tick);
    else if (!app.querySelector('.options.locked')) {
      buttons.forEach((x) => (x.disabled = true));
      app.querySelector('.note')!.textContent = "Time's up!";
    }
  };
  tick();
}

function result(r: Extract<PhoneView, { v: 'result' }>): void {
  const headline = { blocked: '🛡️ Blocked!', breach: '⚠️ Breach!', fizzle: 'Attack fizzled' }[r.outcome];
  const wasBest = r.yourPick === r.best;
  draw(
    r.side,
    `<h2 class="outcome ${r.outcome}">${headline}</h2>
     <div class="pick ${r.yourPick ? '' : 'missed'}">
       <small>Your answer</small>
       <b>${r.yourPick ? esc(r.yourPick) : '⏱ Too slow'}</b>
       <em>+${r.points}</em>
     </div>
     ${wasBest ? '<p class="best-tag">★ Best answer!</p>' : `<div class="pick best"><small>Best answer</small><b>${esc(r.best)}</b></div>`}
     ${scoreline(r.totals)}
     <p class="message small">The field note is on the big screen.</p>
     ${voteButton(r.youTappedNext, r.otherTappedNext, 'Next round')}`,
  );
  app.querySelector<HTMLButtonElement>('button.vote')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    send({ t: 'next', round: r.round });
  });
}

function final(f: Extract<PhoneView, { v: 'final' }>): void {
  const headline = f.winner === 'draw' ? 'Stalemate!' : f.winner === f.side ? 'Your team wins! 🏆' : `${NAMES[f.winner]} team wins`;
  draw(
    f.side,
    `<h2 class="outcome ${f.winner === f.side ? 'win' : ''}">${headline}</h2>
     ${scoreline(f.totals)}
     ${voteButton(f.youTappedRematch, f.otherTappedRematch, 'Rematch')}`,
  );
  app.querySelector<HTMLButtonElement>('button.vote')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    send({ t: 'rematch' });
  });
}

function scoreline(totals: Record<Side, number>): string {
  return `<div class="scores"><span class="ranger">Ranger <b>${totals.ranger}</b></span><span class="predator">Predator <b>${totals.predator}</b></span></div>`;
}

function voteButton(mine: boolean, theirs: boolean, label: string): string {
  if (mine) return `<p class="waiting">Waiting for the other team…</p>`;
  return `<button class="vote">${label}</button>${theirs ? '<p class="message small">The other team is ready.</p>' : ''}`;
}

status('Connecting…');
connect();
