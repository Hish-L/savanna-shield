import type { LessonLine } from '../game/lesson';
import type { Side } from '../game/types';
import { CODE_LENGTH, normalizeCode, RELAY, relayUrl } from '../net/hub';
import type { PhoneMsg, PhoneView } from '../net/teams-protocol';
import './phone.css';

// Team Battle controller. The big screen sends a full PhoneView whenever anything changes; this page
// just draws the latest one and sends taps back. Kept free of three.js so it loads fast on phones.

const app = document.getElementById('app')!;
const NAMES: Record<Side, string> = { ranger: 'Ranger', predator: 'Predator' };
const LETTERS = ['A', 'B', 'C'];
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

// The cloud relay needs the room code from the QR link (?room=) or typed in. The booth server is a single room.
let room = normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
let ws: WebSocket | null = null;
let view: PhoneView | null = null;
let attempts = 0;
let frame = 0;

function send(msg: PhoneMsg): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect(): void {
  const socket = new WebSocket(relayUrl(room));
  ws = socket;
  socket.onopen = () => {
    attempts = 0;
    socket.send(JSON.stringify({ role: 'phone' }));
    setOffline(false);
    if (!view) status(RELAY ? `Looking for game ${room}… If nothing happens, check the code on the big screen.` : 'Looking for the big screen…');
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
    `<div class="col"><h1>Pick your side</h1>
     <p class="message">One phone per team or player.</p></div>
     <div class="col">${button('ranger', 'Defend the watering hole')}
     ${button('predator', 'Raid it')}</div>`,
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
    `<div class="col"><p class="stage">Scenario ${q.round + 1} / ${q.total} · ${esc(q.stage)}</p>
     <p class="situation"><b>${esc(q.situation)}</b> ${esc(q.detail)}</p>
     <div class="timer"><div class="fill"></div></div>
     <p class="read-hint" hidden></p></div>
     <div class="col"><h2 class="prompt">${esc(q.prompt)}</h2>
     <div class="options ${locked ? 'locked' : ''}">
       ${q.options
         .map((text, i) => `<button class="opt ${q.locked === i ? 'chosen' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}><kbd>${LETTERS[i]}</kbd><span>${esc(text)}</span></button>`)
         .join('')}
     </div>
     <p class="note">${locked ? 'Locked in. Waiting for the other team…' : 'Talk it over, then tap your answer.'}</p></div>`,
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
  const hint = app.querySelector<HTMLElement>('.read-hint')!;
  const end = performance.now() + q.endsInMs;
  const answerMs = q.answerMs;
  const tick = () => {
    const left = Math.max(0, end - performance.now());
    // Time beyond the answer window is reading time: the bar stays full with a countdown to the start.
    const fraction = Math.min(1, left / answerMs);
    fill.style.transform = `scaleX(${fraction})`;
    fill.classList.toggle('urgent', fraction < 0.35);
    const reading = left > answerMs;
    hint.hidden = !reading;
    if (reading) hint.textContent = `Answer in ${Math.ceil((left - answerMs) / 1000)}…`;
    if (left > 0) frame = requestAnimationFrame(tick);
    else if (!app.querySelector('.options.locked')) {
      buttons.forEach((x) => (x.disabled = true));
      app.querySelector('.note')!.textContent = "Time's up!";
    }
  };
  tick();
}

const line = (l: LessonLine | null) => (l ? `<p>${esc(l.lead)}${l.action ? ` <strong>${esc(l.action)}</strong>` : ''}</p>` : '');

function result(r: Extract<PhoneView, { v: 'result' }>): void {
  const headline = { blocked: '🛡️ Watering hole defended!', breach: '⚠️ Watering hole raided!' }[r.outcome];
  const wasBest = r.yourPick === r.best;
  draw(
    r.side,
    `<div class="col"><h2 class="outcome ${r.outcome}">${headline}</h2>
     <div class="pick ${r.yourPick ? '' : 'missed'}">
       <small>Your answer</small>
       <b>${r.yourPick ? esc(r.yourPick) : '⏱ Too slow'}</b>
       <em>+${r.points}</em>
     </div>
     ${wasBest ? '<p class="best-tag">★ Best answer!</p>' : r.side === 'ranger' ? '' : `<div class="pick best"><small>Best answer</small><b>${esc(r.best)}</b></div>`}
     </div>
     <div class="col"><div class="lesson">${line(r.lesson.why)}${line(r.lesson.tip)}</div>
     ${scoreline(r.totals)}
     ${voteButton(r.youTappedNext, r.otherTappedNext, 'Next round')}</div>`,
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

/** Asks for the code shown on the big screen, then connects. */
function enterCode(): void {
  draw(
    undefined,
    `<h1>Join a game</h1>
     <p class="message">Enter the code on the big screen.</p>
     <form class="join">
       <input class="code-input" maxlength="${CODE_LENGTH}" placeholder="CODE" autocomplete="off" autocapitalize="characters"
         spellcheck="false" enterkeyhint="go" aria-label="Game code">
       <button class="side ranger" type="submit"><b>Join</b></button>
     </form>`,
  );
  const input = app.querySelector<HTMLInputElement>('.code-input')!;
  input.oninput = () => (input.value = normalizeCode(input.value));
  input.focus();
  app.querySelector<HTMLFormElement>('form.join')!.onsubmit = (e) => {
    e.preventDefault();
    if (input.value.length !== CODE_LENGTH) return input.focus();
    room = input.value;
    history.replaceState(null, '', `?room=${room}`);
    status('Connecting…');
    connect();
  };
}

if (RELAY && room.length !== CODE_LENGTH) enterCode();
else {
  status('Connecting…');
  connect();
}
