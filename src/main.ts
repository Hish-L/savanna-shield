import { playOnline } from './game/online';
import { playSession } from './game/session';
import { normalizeCode } from './net/link';
import { renderPortraits } from './scene/portraits';
import { Savanna } from './scene/world';
import { UI } from './ui/ui';

const world = new Savanna(document.getElementById('world')!);
const ui = new UI(document.getElementById('ui')!, renderPortraits());

// An invite link (?join=CODE) goes straight to the join screen with the code filled in.
let invite = normalizeCode(new URLSearchParams(location.search).get('join') ?? '');
if (invite) history.replaceState(null, '', location.pathname);

// Booth loop: title → game → debrief → title, forever.
for (;;) {
  const mode = invite ? 'online' : await ui.title();
  if (mode !== 'online') {
    await playSession(mode, world, ui);
    continue;
  }
  const choice = await ui.onlineMenu(invite);
  invite = '';
  if (choice) await playOnline(choice, world, ui);
}
