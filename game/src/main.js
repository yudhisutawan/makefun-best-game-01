// VOIDLIGHT bootstrap: game loop, screen state machine, pause/mute/restart,
// best-score persistence, and the ?shot= staging hook used for screenshots.
import { FIELD, STEP } from './config.js';
import { World, PHASE_PLAYING, PHASE_UPGRADE, PHASE_OVER, PHASE_VICTORY } from './world.js';
import { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_PAUSED, SCREEN_OVER, SCREEN_VICTORY, upgradeCardRects } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'voidlight.best';
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');

const world = new World(seed);
const input = new Input(canvas);
const audio = new AudioEngine();

let screen = SCREEN_TITLE;
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY) || '0') || 0; } catch { best = 0; }
let uiTime = 0;
let lastStatus = '';

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ }
  }
}

function setStatus(text) {
  if (text !== lastStatus) {
    lastStatus = text;
    statusEl.textContent = text;
  }
}

function startGame() {
  audio.ensure();
  world.reset(seed);
  screen = SCREEN_PLAY;
  if (audio.ctx) audio.waveStart();
}

function restart() {
  startGame();
}

// Screenshot staging: ?shot=start|play|upgrade|end|victory renders a fixed,
// deterministic scene from the real simulation, then freezes the frame.
let staged = false;
if (shot) {
  const stagedScreen = stageShot(shot, world);
  screen = stagedScreen.screen;
  best = Math.max(best, stagedScreen.best);
  staged = true;
  setStatus(`VOIDLIGHT screenshot scene: ${shot}.`);
}

function cardAt(x, y) {
  const rects = upgradeCardRects();
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

input.fit();
window.addEventListener('resize', () => input.fit());

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  uiTime += dt;

  if (!staged) {
    // Global keys.
    if (input.consumePressed('m')) {
      audio.ensure();
      audio.setMuted(!audio.muted);
    }
    if (input.consumePressed('enter') && screen === SCREEN_TITLE) startGame();
    if (input.consumePressed('r') && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) restart();
    if (input.consumePressed('p') && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
    }

    if (screen === SCREEN_TITLE) {
      // Idle drift behind the title: the world simmers with no enemies.
      world.updateParticles(dt);
      if (input.consumeClick()) startGame();
    } else if (screen === SCREEN_PLAY) {
      const { mx, my } = input.moveVector();
      const simInput = {
        mx, my,
        aimX: input.mouseX, aimY: input.mouseY,
        firing: input.firing(),
        dashPressed: input.consumeDash(),
      };
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 8) {
        world.step(STEP, simInput, audio);
        acc -= STEP;
        guard += 1;
        if (world.phase !== PHASE_PLAYING) break;
      }
      if (world.phase === PHASE_UPGRADE) {
        screen = SCREEN_UPGRADE;
      } else if (world.phase === PHASE_OVER) {
        saveBest();
        screen = SCREEN_OVER;
        audio.gameOver();
      } else if (world.phase === PHASE_VICTORY) {
        saveBest();
        screen = SCREEN_VICTORY;
        audio.victory();
      }
      setStatus(`Wave ${world.wave} of 10. Score ${world.score}. Hull ${Math.ceil(world.player.hp)} of ${world.player.maxHp}.`);
    } else if (screen === SCREEN_UPGRADE) {
      let picked = -1;
      if (input.consumePressed('1')) picked = 0;
      if (input.consumePressed('2')) picked = 1;
      if (input.consumePressed('3')) picked = 2;
      if (input.consumeClick()) picked = cardAt(input.mouseX, input.mouseY);
      if (picked >= 0 && world.chooseUpgrade(picked)) {
        audio.ensure();
        if (world.phase === PHASE_VICTORY) {
          saveBest();
          screen = SCREEN_VICTORY;
        } else {
          screen = SCREEN_PLAY;
          audio.waveStart();
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.consumeClick()) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (input.consumeClick()) restart();
    }
  }

  draw(ctx, world, screen, { best, muted: audio.muted, time: uiTime, mouseX: input.mouseX, mouseY: input.mouseY });
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
