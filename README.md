# makefun-best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/yudhisutawan/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/yudhisutawan/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

VOIDLIGHT — a neon arena survival shooter. Pilot the last Warden ship against ten escalating waves of void creatures: chasing drifters, ranged spitters, splitters that break apart, and circling orbiters. Chain kills into score combos, dash through the swarm with i-frames, grab shards and hull repairs, and pick one of three upgrades between waves (fire rate, multishot, piercing rounds, nova dash, and more). Survive all ten waves to win; lose your hull and the signal is lost.

No libraries, no network, no assets: the art is drawn on canvas and the sound is synthesised with WebAudio. Keyboard + mouse, desktop browser.

## Controls

- Move — WASD / arrow keys
- Aim — mouse, Fire — hold left click or Space
- Dash — Shift or right click (brief invulnerability, recharges)
- Pause — P, Mute — M, Restart — R (on the end screens)
- Between waves: pick an upgrade card — click it or press 1 / 2 / 3

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Or open `game/index.html` directly — the game is static files only. `node main.ts` copies `game/` and `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` for the make.fun judge.

---

<sub>Entered on [make.fun](https://make.fun/?ref=g12ffam3&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
