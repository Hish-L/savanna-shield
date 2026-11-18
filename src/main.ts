import { playSession } from './game/session';
import { playTeams } from './game/teams';
import { renderPortraits } from './scene/portraits';
import { Savanna } from './scene/world';
import { UI } from './ui/ui';

// Old Play Online invite links (?join=CODE) now go to the phone page for that room.
const invite = new URLSearchParams(location.search).get('join');
if (invite) location.replace(`${import.meta.env.BASE_URL}play.html?room=${encodeURIComponent(invite)}`);

const world = new Savanna(document.getElementById('world')!);
const ui = new UI(document.getElementById('ui')!, renderPortraits());

// Booth loop: title → game → debrief → title, forever.
for (;;) {
  const mode = await ui.title();
  if (mode === 'settings') await ui.settings();
  else if (mode === 'teams') await playTeams(world, ui);
  else await playSession(mode, world, ui);
}
