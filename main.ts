// VOIDLIGHT — a best-game-01 entry (Node 22, standard library only). The game
// is this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network
// request). The program hands it in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// VOIDLIGHT is a neon arena survival shooter: pilot the last Warden ship
// against ten escalating waves of void creatures (chasers, ranged spitters,
// splitters that break apart, circling orbiters), chain kills into score
// combos, dash through danger with i-frames, and pick one of three upgrades
// between waves. Survive all ten waves to win; lose your hull and the signal
// is lost. Title screen, pause, game over and victory screens, restart,
// synthesised WebAudio sound, and a persistent best score.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
