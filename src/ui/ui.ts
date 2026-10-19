import { LOGO_SVG } from '../brand';
import { DEFENDER_TITLE, DEBRIEF_SECONDS, ROUND_SECONDS } from '../config';
import { bestOption, type RoundResult } from '../game/scoring';
import type { Mode, Option, Round, Scenario, Side } from '../game/types';
import { CODE_LENGTH, normalizeCode } from '../net/link';
import type { Portrait } from '../scene/portraits';
import './styles.css';

export const KEYS: Record<Side, string[]> = { ranger: ['A', 'S', 'D'], predator: ['J', 'K', 'L'] };

const BRAND = `<span class="brand"><i>${LOGO_SVG}</i><b>ISG | Security Controls Assessment</b></span>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

export interface Totals {
  ranger: number;
  predator: number;
}

export interface Played {
  round: Round;
  result: RoundResult;
}

export const isHuman = (mode: Mode, side: Side) => mode === 'duel' || mode === `solo-${side}` || mode === `online-${side}`;
export const isOnline = (mode: Mode) => mode.startsWith('online-');
/** The one side this device plays, or null when both players share the screen. */
export const localSide = (mode: Mode): Side | null => (mode === 'duel' ? null : isHuman(mode, 'ranger') ? 'ranger' : 'predator');

/** What the player picked on the online menu. */
export type Choice = { kind: 'host'; side: Side } | { kind: 'join'; code: string };

/** All DOM rendering. The game flow calls these; clicks on answer buttons go to onPick. */
export class UI {
  onPick: (side: Side, index: number) => void = () => {};
  private shown: Record<Side, Option[]> = { ranger: [], predator: [] };

  /** `portraits` holds a rendered headshot image URL for each character. */
  constructor(
    private readonly root: HTMLElement,
    private readonly portraits: Record<Portrait, string>,
  ) {
    root.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button.opt');
      if (button) this.onPick(button.dataset.side as Side, Number(button.dataset.i));
    });
  }

  private avatar(who: Portrait, variant = ''): string {
    return `<img class="avatar ${variant}" src="${this.portraits[who]}" alt="">`;
  }

  title(): Promise<Mode | 'online'> {
    const modes: { mode: Mode | 'online'; key: string; label: string; sub: string }[] = [
      { mode: 'duel', key: '1', label: 'Ranger vs Predator', sub: '2 players, head to head' },
      { mode: 'solo-ranger', key: '2', label: 'Play the Ranger', sub: 'Defend against the computer' },
      { mode: 'solo-predator', key: '3', label: 'Play the Predator', sub: 'Think like an attacker' },
      { mode: 'online', key: '4', label: 'Play Online', sub: '2 players, 2 devices' },
    ];
    this.root.innerHTML = `
      <div class="screen title">
        ${BRAND}
        <h1>Savanna <span>Shield</span></h1>
        <p class="tagline">Defend the watering hole, or raid it. 10 rounds, ${ROUND_SECONDS} seconds each.</p>
        <div class="modes">
          ${modes.map((m) => `<button class="mode" data-mode="${m.mode}"><kbd>${m.key}</kbd><b>${m.label}</b><small>${m.sub}</small></button>`).join('')}
        </div>
      </div>`;
    return new Promise((resolve) => {
      const done = (mode: Mode | 'online') => {
        window.removeEventListener('keydown', onKey);
        resolve(mode);
      };
      const onKey = (e: KeyboardEvent) => {
        const m = modes.find((x) => x.key === e.key);
        if (m) done(m.mode);
      };
      window.addEventListener('keydown', onKey);
      this.root.querySelectorAll<HTMLButtonElement>('button.mode').forEach((b) => (b.onclick = () => done(b.dataset.mode as Mode | 'online')));
    });
  }

  briefing(scenario: Scenario, mode: Mode, seconds: number): void {
    const p = scenario.predator;
    const controls = (side: Side) =>
      isOnline(mode) ? (isHuman(mode, side) ? 'You' : 'Opponent') : isHuman(mode, side) ? KEYS[side].join(' ') : 'Computer';
    this.root.innerHTML = `
      <div class="screen briefing">
        ${BRAND}
        ${this.avatar(p.animal, 'hero')}
        <small class="eyebrow">Incoming threat</small>
        <h2>${esc(p.name)}</h2>
        <p class="role">${esc(p.role)} · ${esc(scenario.title)}</p>
        <p class="brief">${esc(scenario.briefing)}</p>
        <div class="controls">
          <span class="ranger">${this.avatar('ranger')} Ranger: <kbd>${controls('ranger')}</kbd></span>
          <span class="predator">${this.avatar(p.animal)} Predator: <kbd>${controls('predator')}</kbd></span>
        </div>
        <div class="countdown" style="animation-duration:${seconds}s"></div>
      </div>`;
  }

  round(scenario: Scenario, round: Round, index: number, options: Record<Side, Option[]>, mode: Mode, totals: Totals): void {
    this.shown = options;
    const p = scenario.predator;
    const card = (side: Side, who: Portrait, name: string, sub: string) => `
      <section class="card ${side} ${isHuman(mode, side) ? '' : 'ai'}">
        <div class="who">${this.avatar(who)}<div><b>${esc(name)}</b><small>${esc(sub)}</small></div><div class="pts">${totals[side]}</div></div>
        <div class="timer"><div class="fill"></div></div>
        <p class="prompt">${esc(round[side].prompt)}</p>
        ${options[side]
          .map((o, i) => `<button class="opt" data-side="${side}" data-i="${i}"><kbd>${isHuman(mode, side) ? KEYS[side][i] : '?'}</kbd><span>${esc(o.text)}</span><em></em></button>`)
          .join('')}
        <div class="lock">${isHuman(mode, side) ? 'Locked in' : isOnline(mode) ? 'Opponent is choosing…' : 'Computer is thinking…'}</div>
      </section>`;
    this.root.innerHTML = `
      <div class="hud ${isOnline(mode) ? 'online' : ''}">
        ${BRAND}
        <header class="topbar">
          <div class="stage"><small>Round ${index + 1} / ${scenario.rounds.length}</small><b>${esc(round.stage)}</b></div>
        </header>
        ${card('ranger', 'ranger', 'Chief Ranger', DEFENDER_TITLE)}
        ${card('predator', p.animal, p.name, p.role)}
        <div class="banner"></div>
      </div>`;
    // The AI card starts "thinking" until it locks in.
    this.root.querySelectorAll('.card.ai').forEach((c) => c.classList.add('waiting'));
  }

  timer(fraction: number): void {
    this.root.querySelectorAll<HTMLElement>('.card .timer .fill').forEach((fill) => {
      fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
      fill.classList.toggle('urgent', fraction < 0.35);
    });
  }

  lock(side: Side): void {
    const card = this.root.querySelector(`.card.${side}`);
    card?.classList.remove('waiting');
    card?.classList.add('locked');
    const lock = card?.querySelector('.lock');
    if (lock) lock.textContent = 'Locked in';
  }

  reveal(round: Round, result: RoundResult, totals: Totals): void {
    // Cards tuck up to the top so the map reveal is unobstructed.
    this.root.querySelector('.hud')?.classList.add('revealing');
    for (const side of ['ranger', 'predator'] as const) {
      const card = this.root.querySelector(`.card.${side}`)!;
      card.classList.remove('locked', 'waiting');
      card.classList.add('revealed');
      const best = bestOption(round[side]);
      const chosen = result[side];
      card.querySelectorAll<HTMLButtonElement>('button.opt').forEach((b, i) => {
        const option = this.shown[side][i];
        b.classList.toggle('best', option === best);
        b.classList.toggle('chosen', option === chosen);
        if (option === chosen) b.querySelector('em')!.textContent = `+${side === 'ranger' ? result.rangerPoints : result.predatorPoints}`;
      });
      card.querySelector('.pts')!.textContent = String(totals[side]);
      if (!chosen) card.querySelector('.prompt')!.insertAdjacentHTML('afterend', `<div class="timeout">⏱ Too slow, 0 points</div>`);
    }
    const [kind, label] = result.blocked
      ? ['blocked', '🛡️ Blocked!']
      : result.breached
        ? ['breach', '⚠️ Breach!']
        : ['fizzle', result.predator ? 'Attack fizzled' : 'Predator froze'];
    const banner = this.root.querySelector('.banner')!;
    banner.className = `banner show ${kind}`;
    banner.innerHTML = `<b>${label}</b><p>${esc(round.note)}</p>`;
  }

  /** Host or join an online game. Resolves null on Back. */
  onlineMenu(prefillCode = ''): Promise<Choice | null> {
    this.root.innerHTML = `
      <div class="screen online-menu">
        ${BRAND}
        <h2>Play Online</h2>
        <p class="role">Each player uses their own phone or laptop. Answers stay hidden until the reveal.</p>
        <div class="panels">
          <section class="panel">
            <h3>Host a game</h3>
            <p>Pick your side, then share the code.</p>
            <button class="mode side ranger" data-side="ranger">${this.avatar('ranger')}<b>Ranger</b><small>Defend</small></button>
            <button class="mode side predator" data-side="predator">${this.avatar('hyena')}<b>Predator</b><small>Attack</small></button>
          </section>
          <section class="panel">
            <h3>Join a game</h3>
            <p>Enter the code from the host.</p>
            <form class="join">
              <input class="code-input" name="code" value="${esc(prefillCode)}" maxlength="${CODE_LENGTH}" placeholder="CODE"
                autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Game code">
              <button class="mode" type="submit"><b>Join</b></button>
            </form>
          </section>
        </div>
        <button class="link-button back">Back</button>
      </div>`;
    return new Promise((resolve) => {
      const input = this.root.querySelector<HTMLInputElement>('.code-input')!;
      input.oninput = () => (input.value = normalizeCode(input.value));
      this.root.querySelectorAll<HTMLButtonElement>('button.side').forEach((b) => (b.onclick = () => resolve({ kind: 'host', side: b.dataset.side as Side })));
      this.root.querySelector<HTMLFormElement>('form.join')!.onsubmit = (e) => {
        e.preventDefault();
        const code = normalizeCode(input.value);
        if (code.length === CODE_LENGTH) resolve({ kind: 'join', code });
        else input.classList.add('invalid'), input.focus();
      };
      this.root.querySelector<HTMLButtonElement>('.back')!.onclick = () => resolve(null);
    });
  }

  /** Host waiting room: shows the code and a share link. */
  lobby(code: string, side: Side, onCancel: () => void): void {
    const url = `${location.origin}${location.pathname}?join=${code}`;
    const canShare = typeof navigator.share === 'function';
    this.root.innerHTML = `
      <div class="screen lobby">
        ${BRAND}
        <small class="eyebrow">You're the ${side === 'ranger' ? 'Ranger' : 'Predator'}</small>
        <p class="role">Tell your opponent to open this site and enter</p>
        <div class="room-code">${code}</div>
        <button class="mode share"><b>${canShare ? 'Share invite link' : 'Copy invite link'}</b><small>${esc(url.replace(/^https?:\/\//, ''))}</small></button>
        <p class="waiting">Waiting for opponent to join…</p>
        <button class="link-button cancel">Cancel</button>
      </div>`;
    const share = this.root.querySelector<HTMLButtonElement>('.share')!;
    share.onclick = async () => {
      try {
        if (canShare) await navigator.share({ title: 'Savanna Shield', text: `Join my Savanna Shield game: ${code}`, url });
        else {
          await navigator.clipboard.writeText(url);
          share.querySelector('b')!.textContent = 'Link copied!';
        }
      } catch {
        // Share sheet dismissed.
      }
    };
    this.root.querySelector<HTMLButtonElement>('.cancel')!.onclick = onCancel;
  }

  /** A simple "please wait" screen with an optional cancel button. */
  status(message: string, onCancel?: () => void): void {
    this.root.innerHTML = `
      <div class="screen status">
        ${BRAND}
        <p class="waiting">${esc(message)}</p>
        ${onCancel ? '<button class="link-button cancel">Leave</button>' : ''}
      </div>`;
    if (onCancel) this.root.querySelector<HTMLButtonElement>('.cancel')!.onclick = onCancel;
  }

  /** Shows a message until the player taps OK. */
  notice(message: string): Promise<void> {
    this.root.innerHTML = `
      <div class="screen status">
        ${BRAND}
        <p class="role">${esc(message)}</p>
        <button class="mode ok"><b>OK</b></button>
      </div>`;
    return new Promise((resolve) => (this.root.querySelector<HTMLButtonElement>('.ok')!.onclick = () => resolve()));
  }

  debrief(scenario: Scenario, mode: Mode, totals: Totals, played: Played[]): Promise<void> {
    const winner: Side | 'draw' = totals.ranger > totals.predator ? 'ranger' : totals.predator > totals.ranger ? 'predator' : 'draw';
    const headline = {
      ranger: ['Ranger wins!', 'The watering hole is safe and the herd grazes on.'],
      predator: [`${scenario.predator.name} wins!`, 'The herd scattered and the water ran dark.'],
      draw: ['Stalemate', 'Nobody owns the savanna tonight.'],
    }[winner];
    const missed = played.filter((p) => p.result.ranger !== bestOption(p.round.ranger));
    const lessons = (missed.length ? missed : played).slice(0, 3);
    const youWon = mode === 'duel' || winner === 'draw' ? '' : isHuman(mode, winner) ? 'You won! ' : isOnline(mode) ? 'Your opponent won. ' : 'The computer won. ';
    this.root.innerHTML = `
      <div class="screen debrief ${winner}">
        ${BRAND}
        <h2>${esc(headline[0])}</h2>
        <p class="role">${youWon}${esc(headline[1])}</p>
        <div class="finals">
          <div class="ranger"><small>${this.avatar('ranger')} Ranger</small><b>${totals.ranger}</b></div>
          <div class="predator"><small>${this.avatar(scenario.predator.animal)} ${esc(scenario.predator.name)}</small><b>${totals.predator}</b></div>
        </div>
        <h3>${missed.length ? 'Field notes: defences to remember' : 'Flawless defence! Field notes'}</h3>
        <ol class="lessons">
          ${lessons.map((p) => `<li><b>${esc(p.round.stage)}: ${esc(bestOption(p.round.ranger).text)}</b><span>${esc(p.round.note)}</span></li>`).join('')}
        </ol>
        <p class="again">${isOnline(mode) ? 'Tap for a rematch' : 'Press any key or tap to play again'}</p>
      </div>`;
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', finish);
        this.root.removeEventListener('pointerdown', finish);
        clearTimeout(timeout);
        resolve();
      };
      // A short grace period so a late answer key-press doesn't skip the debrief.
      setTimeout(() => {
        window.addEventListener('keydown', finish);
        this.root.addEventListener('pointerdown', finish);
      }, 2500);
      const timeout = setTimeout(finish, DEBRIEF_SECONDS * 1000);
    });
  }
}
