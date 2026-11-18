// Screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. (Same pattern as the kit's
// starter: the scenes are the game playing itself, not mock-ups.)
import { FIELD, STEP } from './config.js';
import { PHASE_PLAYING, PHASE_UPGRADE, PHASE_OVER } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_OVER } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const LIMIT_SECONDS = 600;

/** Steer like a competent player: keep range, dodge what is close, shoot the nearest. */
function autopilot(world, skilled) {
  const p = world.player;
  let target = null;
  let targetD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < targetD) { targetD = d; target = e; }
  }
  let mx = 0;
  let my = 0;
  if (target) {
    const d = targetD || 1;
    const nx = (target.x - p.x) / d;
    const ny = (target.y - p.y) / d;
    if (d > 260) { mx = nx; my = ny; }
    else if (d < 150) { mx = -nx; my = -ny; }
    else { mx = -ny * 0.7; my = nx * 0.7; }
  }
  // Repulsion from anything very close, and stay off the walls.
  for (const e of world.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) { mx += (dx / d) * (1 - d / 110) * 2; my += (dy / d) * (1 - d / 110) * 2; }
  }
  if (p.x < 120) mx += 1;
  if (p.x > FIELD.width - 120) mx -= 1;
  if (p.y < 120) my += 1;
  if (p.y > FIELD.height - 120) my -= 1;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const dash = skilled && targetD < 80 && p.dashCd <= 0;
  return {
    mx, my,
    aimX: target ? target.x : p.x,
    aimY: target ? target.y : p.y - 100,
    firing: skilled,
    dashPressed: dash,
  };
}

/** A careless player: stands still, never shoots, never dashes. The swarm closes in. */
function badPilot(world, t) {
  return {
    mx: 0, my: 0,
    aimX: world.player.x, aimY: world.player.y - 100,
    firing: false, dashPressed: false,
  };
}

function simulate(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, pilot(world, i * STEP), null);
    if (world.phase !== PHASE_PLAYING) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Fight on through the upgrades and freeze mid-wave 3, once the banner
    // has faded and the arena is full of drifters, spitters and a splitter.
    for (let t = 0; t < 90; t += STEP) {
      if (world.phase === PHASE_UPGRADE) world.chooseUpgrade(0);
      if (world.phase !== PHASE_PLAYING) break;
      world.step(STEP, autopilot(world, true), null);
      if (world.wave >= 3 && world.enemies.length >= 3 && world.waveBanner <= 0) break;
    }
    return { screen: SCREEN_PLAY, best: world.score };
  }
  if (name === 'upgrade') {
    // Play wave 1 until it is cleared and the upgrade cards appear.
    for (let t = 0; t < 180; t += STEP) {
      world.step(STEP, autopilot(world, true), null);
      if (world.phase === PHASE_UPGRADE) break;
      if (world.phase !== PHASE_PLAYING) break;
    }
    if (world.phase === PHASE_UPGRADE) return { screen: SCREEN_UPGRADE, best: world.score };
    return { screen: SCREEN_PLAY, best: world.score };
  }
  if (name === 'end') {
    simulate(world, LIMIT_SECONDS, badPilot);
    return { screen: world.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  // start (default): a few seconds of live play behind the title screen.
  simulate(world, START_SECONDS, (w) => autopilot(w, true));
  return { screen: SCREEN_TITLE, best: 0 };
}
