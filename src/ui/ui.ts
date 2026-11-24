import { LOGO_SVG } from '../brand';
import { DEFAULTS, DEFENDER_TITLE, resetSettings, saveSettings, settings, type Settings } from '../config';
import { questionPool } from '../scenarios';
import { lessonFor, type LessonLine } from '../game/lesson';
import { bestOption, type RoundResult } from '../game/scoring';
import type { Mode, Option, Round, Scenario, Side } from '../game/types';
import type { Portrait } from '../scene/portraits';
import './styles.css';

export const KEYS: Record<Side, string[]> = { ranger: ['A', 'S', 'D'], predator: ['J', 'K', 'L'] };

const BRAND = `<span class="brand"><i>${LOGO_SVG}</i><b>ISG | Security Controls Assessment</b></span>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

/** One lesson line: the lead-in, then the action it names in emphasis. */
const lessonHtml = (line: LessonLine, cls: string) =>
  `<p class="${cls}">${esc(line.lead)}${line.action ? ` <strong>${esc(line.action)}</strong>` : ''}</p>`;

export interface Totals {
  ranger: number;
  predator: number;
}

export interface Played {
  round: Round;
  result: RoundResult;
}

export const isHuman = (mode: Mode, side: Side) => mode === 'duel' || mode === `solo-${side}`;
/** The one side this device plays, or null when both sides show on this screen. */
export const localSide = (mode: Mode): Side | null => (mode === 'duel' || mode === 'teams' ? null : isHuman(mode, 'ranger') ? 'ranger' : 'predator');

/** Settings screen fields, in display order. Native min/max/step do the validation. */
const SETTING_FIELDS: { key: keyof Settings; label: string; min: number; max: number; step?: number }[] = [
  { key: 'questionsPerGame', label: 'Questions per game', min: 1, max: questionPool.length },
  { key: 'roundSeconds', label: 'Answer time (seconds)', min: 5, max: 120 },
  { key: 'readingWordsPerSecond', label: 'Reading pace (words per second)', min: 0.5, max: 10, step: 0.5 },
  { key: 'readingBufferSeconds', label: 'Extra reading time (seconds)', min: 0, max: 30 },
  { key: 'autoContinueSeconds', label: 'Auto-continue after reveal (seconds, 0 = wait for Space)', min: 0, max: 120 },
];

/** Team Battle lobby slot state. */
export type SlotState = 'open' | 'joined' | 'away';

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

  title(): Promise<Mode | 'settings'> {
    const modes: { mode: Mode; key: string; label: string; sub: string }[] = [
      { mode: 'duel', key: '1', label: 'Ranger vs Predator', sub: '2 players, head to head' },
      { mode: 'solo-ranger', key: '2', label: 'Play the Ranger', sub: 'Defend against the computer' },
      { mode: 'solo-predator', key: '3', label: 'Play the Predator', sub: 'Think like an attacker' },
      { mode: 'teams', key: '4', label: 'Play Together', sub: 'Teams or friends, on phones' },
    ];
    this.root.innerHTML = `
      <div class="screen title">
        ${BRAND}
        <h1>Savannah <span>Shield</span></h1>
        <p class="tagline">Defend the Westpac watering hole, or raid it. ${settings.questionsPerGame} security calls, ${settings.roundSeconds} seconds to answer each.</p>
        <div class="modes">
          ${modes.map((m) => `<button class="mode" data-mode="${m.mode}"><kbd>${m.key}</kbd><b>${m.label}</b><small>${m.sub}</small></button>`).join('')}
        </div>
        <button class="link-button open-settings"><kbd>5</kbd> ⚙ Settings</button>
      </div>`;
    return new Promise((resolve) => {
      const done = (mode: Mode | 'settings') => {
        window.removeEventListener('keydown', onKey);
        resolve(mode);
      };
      const onKey = (e: KeyboardEvent) => {
        const m = modes.find((x) => x.key === e.key);
        if (m) done(m.mode);
        else if (e.key === '5') done('settings');
      };
      window.addEventListener('keydown', onKey);
      this.root.querySelectorAll<HTMLButtonElement>('button.mode').forEach((b) => (b.onclick = () => done(b.dataset.mode as Mode)));
      this.root.querySelector<HTMLButtonElement>('.open-settings')!.onclick = () => done('settings');
    });
  }

  /** The game settings form. Resolves when the operator saves or goes back. */
  settings(): Promise<void> {
    const field = (f: (typeof SETTING_FIELDS)[number]) =>
      `<label><span>${f.label}</span><small>Default ${DEFAULTS[f.key]}</small>
        <input type="number" name="${f.key}" value="${settings[f.key]}" min="${f.min}" max="${f.max}" step="${f.step ?? 1}" required></label>`;
    this.root.innerHTML = `
      <div class="screen settings">
        ${BRAND}
        <h2>Settings</h2>
        <form class="settings-form">
          ${SETTING_FIELDS.map(field).join('')}
          <div class="settings-actions">
            <button type="submit" class="mode"><b>Save</b></button>
            <button type="button" class="link-button reset">Reset to defaults</button>
            <button type="button" class="link-button back"><kbd>Esc</kbd> Back</button>
          </div>
          <p class="saved" hidden></p>
        </form>
      </div>`;
    const form = this.root.querySelector<HTMLFormElement>('form')!;
    const input = (key: keyof Settings) => form.elements.namedItem(key) as HTMLInputElement;
    const flash = (text: string) => {
      const saved = form.querySelector<HTMLElement>('.saved')!;
      saved.textContent = text;
      saved.hidden = false;
    };
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('keydown', onKey);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') done();
      };
      window.addEventListener('keydown', onKey);
      form.onsubmit = (e) => {
        e.preventDefault();
        saveSettings(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, input(f.key).valueAsNumber])) as Settings);
        done();
      };
      form.querySelector<HTMLButtonElement>('.reset')!.onclick = () => {
        resetSettings();
        for (const f of SETTING_FIELDS) input(f.key).value = String(DEFAULTS[f.key]);
        flash('Defaults restored.');
      };
      form.querySelector<HTMLButtonElement>('.back')!.onclick = done;
    });
  }

  /** Intro tour: one caption over the live scene for `seconds`. `html` is trusted markup. */
  caption(html: string, seconds: number, signal?: AbortSignal): Promise<void> {
    this.root.innerHTML = `<div class="tour">${BRAND}<p class="caption">${html}</p></div>`;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, seconds * 1000);
      signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true });
    });
  }

  round(scenario: Scenario, round: Round, index: number, options: Record<Side, Option[]>, mode: Mode, totals: Totals): void {
    this.shown = options;
    const p = scenario.predator;
    const card = (side: Side, who: Portrait, name: string, sub: string) => `
      <section class="card ${side} ${isHuman(mode, side) ? '' : 'ai'}">
        <div class="status-chip">${side === 'ranger' ? 'Defending' : 'Attacking'}\u2026</div>
        <div class="who">${this.avatar(who)}<div><b>${esc(name)}</b><small>${esc(sub)}</small></div><div class="pts">${totals[side]}</div></div>
        <div class="timer"><div class="fill"></div></div>
        <p class="prompt">${esc(round[side].prompt)}</p>
        ${options[side]
          .map((o, i) => `<button class="opt" data-side="${side}" data-i="${i}"><kbd>${isHuman(mode, side) ? KEYS[side][i] : mode === 'teams' ? 'ABC'[i] : '?'}</kbd><span>${esc(o.text)}</span><em></em></button>`)
          .join('')}
        <div class="lock">${isHuman(mode, side) ? 'Locked in' : mode === 'teams' ? 'Team is choosing…' : 'Computer is thinking…'}</div>
      </section>`;
    this.root.innerHTML = `
      <div class="hud reading ${mode === 'teams' ? 'teams' : ''} ${localSide(mode) ? 'one-player' : 'shared'}">
        ${BRAND}
        <header class="topbar">
          <div class="stage"><small>Question ${index + 1} / ${scenario.rounds.length} · ${esc(round.stage)}</small><b>${esc(round.situation)}</b><p class="detail">${esc(round.detail)}</p></div>
          <p class="read-hint" hidden></p>
        </header>
        ${card('ranger', 'ranger', 'Chief Ranger', DEFENDER_TITLE)}
        ${card('predator', p.animal, p.name, p.role)}
        <div class="banner"></div>
      </div>`;
    // The AI card starts "thinking" until it locks in.
    this.root.querySelectorAll('.card.ai').forEach((c) => c.classList.add('waiting'));
  }

  /** `readingLeft` > 0 means the answer timer hasn't started yet: the bar stays full and shows a countdown. */
  timer(fraction: number, readingLeft = 0): void {
    this.root.querySelectorAll<HTMLElement>('.card .timer .fill').forEach((fill) => {
      fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
      fill.classList.toggle('urgent', fraction < 0.35);
    });
    this.root.querySelector('.hud')?.classList.toggle('reading', readingLeft > 0);
    const text = readingLeft > 0 ? `Timer starts in ${Math.ceil(readingLeft)}s` : '';
    this.root.querySelectorAll<HTMLElement>('.topbar .read-hint').forEach((hint) => {
      if (hint.textContent !== text) hint.textContent = text;
      hint.hidden = !text;
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
    const hud = this.root.querySelector('.hud');
    hud?.classList.add('revealing');
    // Either side missed the best answer, so its card shows a second line (narrow screens need the room).
    hud?.classList.toggle('show-best', (['ranger', 'predator'] as const).some((s) => result[s] !== bestOption(round[s])));
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
    const { why, tip } = lessonFor(round, result);
    banner.innerHTML = `<b>${label}</b>${lessonHtml(why, 'why')}${tip ? lessonHtml(tip, 'tip') : ''}${round.note ? `<p class="why">${esc(round.note)}</p>` : ''}`;
  }

  /**
   * Ends the reveal with a Continue prompt and resolves when Space is pressed or it's tapped.
   * Aborting `signal` stops listening (the promise then never resolves).
   */
  continueAfterReveal(signal?: AbortSignal): Promise<void> {
    const banner = this.root.querySelector('.banner')!;
    const auto = settings.autoContinueSeconds;
    banner.insertAdjacentHTML('beforeend', `<button class="link-button next"><kbd>Space</kbd> Continue${auto ? ` · auto in ${auto}s` : ''}</button>`);
    const next = banner.querySelector('.next')!;
    if (auto) {
      // Acts like a tap on Continue; harmless if Space or a tap got there first.
      const timer = setTimeout(() => next.dispatchEvent(new Event('pointerdown')), auto * 1000);
      signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
    }
    return this.onSpace(next, signal);
  }

  /** Team Battle: shows which teams have tapped Next on their phones. */
  teamContinue(ready: Record<Side, boolean>): void {
    const banner = this.root.querySelector('.banner');
    if (!banner) return;
    let votes = banner.querySelector('.votes');
    if (!votes) {
      banner.querySelector('.next')?.insertAdjacentHTML('beforebegin', '<p class="votes"></p>');
      votes = banner.querySelector('.votes')!;
    }
    const tag = (side: Side, name: string) => `<span class="${side} ${ready[side] ? 'ready' : ''}">${name} ${ready[side] ? '✓ ready' : '· tap Next'}</span>`;
    votes.innerHTML = `${tag('ranger', 'Ranger')}${tag('predator', 'Predator')}`;
  }

  /** Team Battle: flags a team whose phone has dropped. */
  seatStatus(side: Side, away: boolean): void {
    const card = this.root.querySelector(`.card.${side}`);
    if (!card) return;
    card.classList.toggle('away', away);
    card.querySelector('.away-badge')?.remove();
    if (away) card.querySelector('.who')?.insertAdjacentHTML('afterend', '<div class="away-badge">📵 Phone reconnecting…</div>');
  }

  /** Team Battle waiting room: QR code for the phones, the room code (cloud relay only) and the two team slots. */
  teamLobby(playUrl: string, qrSvg: string, code: string | null, slots: Record<Side, SlotState>, onBack: () => void): void {
    const label: Record<SlotState, string> = { open: 'Scan to join', joined: 'Ready', away: 'Reconnecting…' };
    const slot = (side: Side, name: string, who: Portrait) =>
      `<div class="slot ${side} ${slots[side]}">${this.avatar(who)}<b>${name}</b><small>${label[slots[side]]}</small></div>`;
    const waitingFor = (['ranger', 'predator'] as const).filter((s) => slots[s] === 'open');
    this.root.innerHTML = `
      <div class="screen team-lobby">
        ${BRAND}
        <h2>Play Together</h2>
        <p class="role">One phone per team, or one each for 2 players anywhere. Answers stay hidden until the reveal.</p>
        <div class="join-row">
          <div class="qr">${qrSvg}</div>
          <div class="join-info">
            <div class="slots">
              ${slot('ranger', 'Ranger team', 'ranger')}
              ${slot('predator', 'Predator team', 'hyena')}
            </div>
            ${
              code
                ? `<p class="url">Scan, or open ${esc(playUrl.replace(/^https?:\/\//, '').replace(/\?.*/, ''))} and enter</p><div class="room-code">${code}</div>`
                : `<p class="url">${esc(playUrl.replace(/^https?:\/\//, ''))}</p>`
            }
          </div>
        </div>
        <p class="waiting">${waitingFor.length ? `Waiting for the ${waitingFor.map((s) => (s === 'ranger' ? 'Ranger' : 'Predator')).join(' and ')} team…` : 'Starting…'}</p>
        <button class="link-button back"><kbd>Esc</kbd> Back</button>
      </div>`;
    this.root.querySelector<HTMLButtonElement>('.back')!.onclick = onBack;
  }

  /** Resolves on a Space key press or a tap on `target`. Aborting `signal` removes the listeners. */
  private onSpace(target: Element, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('keydown', onKey);
        target.removeEventListener('pointerdown', done);
        signal?.removeEventListener('abort', stop);
        resolve();
      };
      const stop = () => {
        window.removeEventListener('keydown', onKey);
        target.removeEventListener('pointerdown', done);
      };
      signal?.addEventListener('abort', stop, { once: true });
      const onKey = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || e.repeat) return;
        e.preventDefault();
        done();
      };
      window.addEventListener('keydown', onKey);
      target.addEventListener('pointerdown', done);
    });
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

  debrief(scenario: Scenario, mode: Mode, totals: Totals, played: Played[], signal?: AbortSignal): Promise<void> {
    const winner: Side | 'draw' = totals.ranger > totals.predator ? 'ranger' : totals.predator > totals.ranger ? 'predator' : 'draw';
    const headline = {
      ranger: ['Ranger wins!', 'The watering hole is safe and the herd grazes on.'],
      predator: [`${scenario.predator.name} wins!`, 'The herd scattered and the water ran dark.'],
      draw: ['Stalemate', 'Nobody owns the savanna tonight.'],
    }[winner];
    const missed = played.filter((p) => p.result.ranger !== bestOption(p.round.ranger));
    const lessons = (missed.length ? missed : played).slice(0, 3);
    const youWon = !localSide(mode) || winner === 'draw' ? '' : isHuman(mode, winner) ? 'You won! ' : 'The computer won. ';
    this.root.innerHTML = `
      <div class="screen debrief ${winner}">
        ${BRAND}
        <h2>${esc(headline[0])}</h2>
        <p class="role">${youWon}${esc(headline[1])}</p>
        <div class="finals">
          <div class="ranger"><small>${this.avatar('ranger')} Ranger</small><b>${totals.ranger}</b></div>
          <div class="predator"><small>${this.avatar(scenario.predator.animal)} ${esc(scenario.predator.name)}</small><b>${totals.predator}</b></div>
        </div>
        <h3>${missed.length ? 'Best defences to remember' : 'Flawless defence! Best defences'}</h3>
        <ol class="lessons">
          ${lessons.map((p) => `<li><small>${esc(p.round.stage)} · ${esc(p.round.situation)}</small><b>${esc(bestOption(p.round.ranger).text)}</b>${p.round.note ? `<span>${esc(p.round.note)}</span>` : ''}</li>`).join('')}
        </ol>
        <p class="again">${
          mode === 'teams'
            ? 'Tap <b>Rematch</b> on both phones to play again · <kbd>Esc</kbd> next teams'
            : `${matchMedia('(hover: none)').matches ? 'Tap' : 'Press <kbd>Space</kbd> or tap'} to play again`
        }</p>
      </div>`;
    // A short grace period so a double press of Space on the last reveal doesn't skip the debrief.
    return new Promise((resolve) =>
      setTimeout(() => {
        if (!signal?.aborted) resolve(this.onSpace(this.root, signal));
      }, 2500),
    );
  }
}
