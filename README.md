# Savanna Shield

A one-minute cyber security booth game. The Chief Ranger (Westpac Cyber Defender) defends the watering hole (customer data) while a predator (attacker) tries to raid it. Both answer at the same time across 10 rapid rounds that follow an attack from recon to recovery. Every round reveals the best defence and a one-line field note.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # scoring + scenario content checks
npm run build    # static site in dist/ (works offline on the booth machine)
```

Controls: Ranger `A S D`, Predator `J K L`, or click/tap the answers. On the title screen press `1` (2 players), `2` (solo Ranger), `3` (solo Predator), or `4` (online).

## Online play

Two people on their own phones or laptops. The host picks a side and gets a 4-letter code (plus a `?join=CODE` invite link); the other player enters it. Each device only shows its own question; the opponent's answer is hidden until the reveal.

There is no game server. Browsers connect directly over WebRTC using [PeerJS](https://peerjs.com); its free public broker (`0.peerjs.com`) only introduces the two players, and Google's public STUN servers let each browser find its public address. This works on phones (mobile data, home Wi-Fi) but not behind networks that rewrite ports per destination, such as Zscaler on work laptops: even two tabs on one such laptop can't connect. To support those, add a TURN relay at build time with `VITE_TURN_URLS` (comma-separated), `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL`. The host's browser runs the game and the guest's only sends its picks (`src/net/link.ts`, `src/game/online.ts`).

Deploy to Vercel (or any static host) as-is: framework preset Vite, build `npm run build`, output `dist`. Online play needs internet; the booth modes still work offline. To use a self-hosted PeerJS server instead, set `VITE_PEER_HOST` (and optionally `VITE_PEER_PORT`, `VITE_PEER_PATH`) at build time.

## How scoring works

- Each answer is worth 0–10 points; the highest-scoring option is the "best" answer.
- Predator options have a technique `tag`. Ranger options list the tags they `mitigate`.
- If the Ranger's defence mitigates the Predator's technique, the attack is **blocked**: the Predator gets half points and the Ranger gets a bonus (`BLOCK_BONUS` in `src/config.ts`).
- Running out of time scores 0.

## Adding a scenario

Copy one of the files in `src/scenarios/`, change the content, and add it to `src/scenarios/index.ts`. `npm test` checks that every scenario has 10 rounds, 3 options per side, one clear best answer, text short enough to read at a glance, and that every `mitigates` tag exists in that round.

Option `effect: 'steal'` muddies the watering hole; `effect: 'burn'` sets the ranger station on fire.

## Where things live

- `src/game/`: rules (scoring, AI opponent, game flow)
- `src/scenarios/`: question content
- `src/scene/`: Three.js savanna, animals, and effects
- `src/ui/`: HTML overlay (cards, timer, debrief)
- `src/config.ts`: timings and tuning
