# Savannah Shield

A one-minute cyber security booth game. The Chief Ranger (Westpac Cyber Defender) defends the watering hole (customer data) while a predator (attacker) tries to raid it. It's release week: each game deals 5 random scenarios from a pool of 10 (Pen Test, AppSec, Secure by Design, patching and release calls, from the facilitator answer key). The Ranger picks how to respond while the Predator picks how to exploit it, both at the same time. Every question reveals the best defence.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run booth    # build, then serve on http://localhost:8080 with an offline Play Together relay (see below)
npm run relay    # deploy the Cloudflare relay for Play Together online
npm test         # scoring + scenario content checks
npm run build    # static site in dist/ (works offline on the booth machine)
```

Controls: Ranger `A S D`, Predator `J K L`, or click/tap the answers. On the title screen press `1` (2 players), `2` (solo Ranger), `3` (solo Predator), or `4` (Play Together). Press `Space` (or tap Continue) to move on after each round's reveal and to leave the end-of-game screen.

Each question starts with reading time: the words in its title and description at 3 words a second, plus 3 seconds (about 8–11s). The timer bar stays full and shows a countdown, and then players have 15 seconds to answer. Players can lock in during reading time too. The pace, buffer and answer time are in `src/config.ts`.

## Play Together

One screen runs the game and shows the savanna. Each side plays on a phone: one phone per team at the booth, or one each for two players anywhere. The phones show their own question, the 3 answers and the timer, then their result after each reveal. The answers only appear on the big screen at the reveal.

1. Open the game on the big screen (or the host's laptop) and press `4`. It shows a QR code and a 4-letter room code.
2. Each team scans the QR code, or opens `…/play.html` and types the code, then picks Ranger or Predator. The game starts once both sides are taken.
3. After each reveal, both phones tap **Next** to continue. At the end, both tap **Rematch** to play again with the same teams.

Operator keys: `Space` moves on without waiting for the phones, and `Esc` ends the game and frees both seats for the next teams (`Esc` again leaves to the title screen). If a phone locks or drops, it rejoins its seat automatically when it comes back, and a refreshed big screen keeps its room code. Any round a phone misses scores 0, like a timeout.

The big-screen browser runs the game (`src/game/teams.ts`). The phones (`play.html`, `src/phone/`) only draw what the screen sends them. Messages pass through a small relay, and nothing else runs on a server:

- **Online (GitHub Pages):** a Cloudflare Worker (`relay/worker.ts`) with one Durable Object per room. It uses `wss://` on port 443, so it works on mobile data, home Wi-Fi, VPNs and Zscaler. The Workers Free plan allows 100k requests a day (resets 00:00 UTC). A game uses about 10, so that's roughly 10,000 games a day. Never send per-second updates through the relay: the phones run their own timers.
- **Offline booth:** `npm run booth` serves the game and runs the same relay locally (`server/hub.ts`). Phones and laptop must be on a network that lets devices talk to each other. Guest and corporate Wi-Fi often isolate clients, so bring a travel router or use the laptop's hotspot. Set `PORT` to change the port.

### The Cloudflare relay

It's deployed at `wss://savanna-relay.hishamlegha.workers.dev`, set in `src/net/hub.ts` (`CLOUD_RELAY`). The site uses it when it's served from `*.github.io`; the booth and dev servers use their own local relay. The address stays the same across deploys and only changes if the Worker or the account's `workers.dev` subdomain is renamed.

To change the relay code, run `npx wrangler login` once, then `npm run relay` to redeploy.

The relay only accepts games from the origins in `relay/wrangler.toml` (`ALLOWED_ORIGINS`) and localhost. If a corporate filter blocks `*.workers.dev`, add a custom domain to the Worker in the Cloudflare dashboard and point `RELAY_URL` at it.

To try the real Cloudflare relay before pushing: `VITE_RELAY_URL=wss://savanna-relay.hishamlegha.workers.dev npm run dev`, then use browser tabs on `localhost` (the relay only accepts the Pages site and localhost). To try relay code changes without deploying: `npm run relay:dev`, then `VITE_RELAY_URL=ws://localhost:8787 npm run dev`. Plain `npm run dev` uses the local relay.

## How scoring works

- Scores come from the answer key. Defender actions are worth +2 to +4 points. Attacker moves are worth 2 to 4 points (the key's −2 to −4; the key's ±1 options aren't used). The highest-scoring option is the "best" answer.
- If the Ranger's defence scores at least as much as the Predator's attack, the attack is **blocked** and the Predator scores 0. Otherwise it's a breach and both sides score their points.
- Running out of time scores 0.

## Adding questions

Questions live in `src/scenarios/pool.ts`. Each has a topic `stage`, a `situation` headline with a line of `detail`, and 3 options per side listed strongest first (scored 4, 3, 2). An optional `note` replaces the "Best defence" line on the reveal. `QUESTIONS_PER_GAME` and the scenario frame (briefing, predator) are in `src/scenarios/index.ts`. `npm test` checks every question has one option at each score per side and text short enough to read at a glance. Update the pool size in `scenarios.test.ts` if you add or remove questions.

Option `effect: 'steal'` muddies the watering hole; `effect: 'burn'` sets the ranger station on fire.

## Where things live

- `src/game/`: rules (scoring, AI opponent, game flow, Play Together)
- `src/phone/`, `play.html`: Play Together phone controller
- `server/`: offline booth server and local relay
- `relay/`: Cloudflare relay for online play
- `src/scenarios/`: question pool and dealing
- `src/scene/`: Three.js savanna, animals, and effects
- `src/ui/`: HTML overlay (cards, timer, debrief)
- `src/config.ts`: timings and tuning
