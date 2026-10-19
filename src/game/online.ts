import { hostRoom, isAbort, joinRoom, type Link } from '../net/link';
import type { Savanna } from '../scene/world';
import type { Choice, UI } from '../ui/ui';
import { playGuest, playSession } from './session';
import type { Side } from './types';

const other = (side: Side): Side => (side === 'ranger' ? 'predator' : 'ranger');

/**
 * Connects two devices and plays games back to back until someone leaves.
 * The host runs the game logic; the guest only sends its own picks.
 */
export async function playOnline(choice: Choice, world: Savanna, ui: UI): Promise<void> {
  const cancel = new AbortController();
  const leave = () => {
    cancel.abort();
    link?.close();
  };
  let link: Link | undefined;
  try {
    if (choice.kind === 'host') {
      ui.status('Creating game…', leave);
      link = await hostRoom((code) => ui.lobby(code, choice.side, leave), cancel.signal);
      link.send({ t: 'hello', side: other(choice.side) });
      const mode = `online-${choice.side}` as const;
      for (;;) {
        await playSession(mode, world, ui, link);
        ui.status('Waiting for your opponent…', leave);
        await link.next('ready');
      }
    } else {
      ui.status(`Joining game ${choice.code}…`, leave);
      link = await joinRoom(choice.code, cancel.signal);
      const { side } = await link.next('hello');
      const mode = `online-${side}` as const;
      for (;;) {
        ui.status('Get ready! Waiting for the host…', leave);
        await playGuest(mode, world, ui, link);
        link.send({ t: 'ready' });
      }
    }
  } catch (err) {
    if (!isAbort(err) && !cancel.signal.aborted) await ui.notice(err instanceof Error ? err.message : 'Connection lost.');
  } finally {
    link?.close();
    world.setAttract(true);
  }
}
