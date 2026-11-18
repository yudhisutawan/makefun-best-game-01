// VOIDLIGHT renderer: all art is procedural canvas drawing — neon glow,
// a parallax starfield, nebula gradients, distinct enemy silhouettes.
import { FIELD, ENEMIES, TOTAL_WAVES } from './config.js';
import { makeRng, range } from './random.js';
import { PHASE_UPGRADE, PHASE_OVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const STARS = (() => {
  const rng = makeRng(99);
  const stars = [];
  for (let i = 0; i < 170; i += 1) {
    stars.push({
      x: rng() * FIELD.width, y: rng() * FIELD.height,
      r: range(rng, 0.5, 2.1), depth: range(rng, 0.15, 0.6),
      tw: range(rng, 0, Math.PI * 2),
    });
  }
  return stars;
})();

let bgCanvas = null;
function background() {
  if (bgCanvas) return bgCanvas;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = FIELD.width;
  bgCanvas.height = FIELD.height;
  const c = bgCanvas.getContext('2d');
  const g = c.createRadialGradient(640, 360, 60, 640, 360, 820);
  g.addColorStop(0, '#0d1233');
  g.addColorStop(0.55, '#070a1c');
  g.addColorStop(1, '#03040a');
  c.fillStyle = g;
  c.fillRect(0, 0, FIELD.width, FIELD.height);
  const rng = makeRng(7);
  const blobs = [
    [300, 180, 260, 'rgba(45,226,230,0.10)'],
    [1000, 520, 300, 'rgba(255,77,141,0.09)'],
    [1050, 140, 220, 'rgba(179,136,255,0.10)'],
    [220, 560, 200, 'rgba(255,159,28,0.06)'],
  ];
  for (const [x, y, r, color] of blobs) {
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  void rng;
  return bgCanvas;
}

export function upgradeCardRects() {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 700, font = 'system-ui, sans-serif') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function glowText(ctx, str, x, y, size, color, align = 'center', weight = 800) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  text(ctx, str, x, y, size, color, align, weight);
  ctx.restore();
}

function drawShip(ctx, x, y, angle, radius, color, invuln, dashing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (invuln > 0 && Math.floor(invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius + 6, 0);
  ctx.lineTo(-radius * 0.8, radius * 0.75);
  ctx.lineTo(-radius * 0.35, 0);
  ctx.lineTo(-radius * 0.8, -radius * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#04121a';
  ctx.beginPath();
  ctx.arc(2, 0, radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void dashing;
}

function drawEnemy(ctx, e, time) {
  const def = ENEMIES[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = e.flash > 0 ? 26 : 12;
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  const r = e.radius;
  if (e.kind === 'drifter') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.8); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.8);
    ctx.closePath(); ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.rotate(time * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0d00';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, 3, 0, Math.PI * 2); ctx.arc(r * 0.32, r * 0.18, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'mini') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, r * 0.7); ctx.lineTo(-r * 0.7, -r * 0.7);
    ctx.closePath(); ctx.fill();
  } else { // orbiter
    ctx.rotate(e.angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, r * 0.7); ctx.lineTo(-r * 0.85, r * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#04222a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // HP bar for tougher enemies.
  if (e.maxHp > 45 && e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
    ctx.fillStyle = def.color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 4);
  }
}

function drawHud(ctx, world, ui) {
  const p = world.player;
  // Top-left: hull bar + dash.
  ctx.save();
  ctx.textAlign = 'left';
  text(ctx, 'HULL', 28, 30, 13, '#8fa8c8', 'left', 800);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, 28, 42, 240, 16, 8); ctx.fill();
  const hpFrac = Math.max(0, p.hp / p.maxHp);
  const hpColor = hpFrac > 0.5 ? '#2de2e6' : hpFrac > 0.25 ? '#ff9f1c' : '#ff4d6d';
  ctx.fillStyle = hpColor;
  ctx.shadowColor = hpColor; ctx.shadowBlur = 10;
  if (hpFrac > 0) { rr(ctx, 28, 42, 240 * hpFrac, 16, 8); ctx.fill(); }
  ctx.shadowBlur = 0;
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 278, 50, 13, '#e8f4ff', 'left', 700);
  text(ctx, 'DASH', 28, 76, 13, '#8fa8c8', 'left', 800);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, 28, 86, 120, 8, 4); ctx.fill();
  const dashFrac = p.dashCd <= 0 ? 1 : 1 - p.dashCd / (2.4 * p.dashCdMult);
  ctx.fillStyle = p.dashCd <= 0 ? '#b388ff' : '#7a6bb0';
  if (dashFrac > 0) { rr(ctx, 28, 86, 120 * dashFrac, 8, 4); ctx.fill(); }
  text(ctx, p.dashCd <= 0 ? 'READY  [SHIFT]' : 'charging…', 156, 90, 12, '#b9c8e0', 'left', 600);
  // Top-center: wave + score.
  text(ctx, `WAVE ${Math.min(world.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`, FIELD.width / 2, 30, 15, '#8fa8c8', 'center', 800);
  glowText(ctx, String(world.score).padStart(6, '0'), FIELD.width / 2, 58, 30, '#ffffff');
  if (world.combo >= 2) {
    glowText(ctx, `COMBO x${world.comboMult().toFixed(1)}  (${world.combo} kills)`, FIELD.width / 2, 88, 15, '#ffe14d');
  }
  // Top-right: best + mute hint.
  text(ctx, `BEST ${ui.best}`, FIELD.width - 28, 30, 14, '#8fa8c8', 'right', 700);
  text(ctx, ui.muted ? 'MUTED  [M]' : 'SOUND ON  [M]', FIELD.width - 28, 52, 12, '#8fa8c8', 'right', 600);
  text(ctx, 'PAUSE  [P]', FIELD.width - 28, 72, 12, '#8fa8c8', 'right', 600);
  ctx.restore();
}

function drawWorld(ctx, world) {
  const p = world.player;
  ctx.save();
  if (world.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  // Arena frame.
  ctx.strokeStyle = 'rgba(45,226,230,0.35)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#2de2e6';
  ctx.shadowBlur = 14;
  rr(ctx, 10, 10, FIELD.width - 20, FIELD.height - 20, 18);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Pickups.
  for (const pk of world.pickups) {
    const blink = pk.life < 2 && Math.floor(pk.life * 6) % 2 === 0;
    if (blink) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.shadowBlur = 12;
    if (pk.kind === 'heart') {
      ctx.shadowColor = '#9dff57';
      ctx.fillStyle = '#9dff57';
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-11, -3, -7, -11, 0, -5);
      ctx.bezierCurveTo(7, -11, 11, -3, 0, 7);
      ctx.fill();
    } else {
      ctx.shadowColor = '#ffe14d';
      ctx.fillStyle = '#ffe14d';
      ctx.rotate(world.time * 2);
      ctx.fillRect(-4, -4, 8, 8);
    }
    ctx.restore();
  }

  // Player trail.
  for (const t of p.trail) {
    if (t.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, t.life) * 1.2;
    ctx.fillStyle = '#2de2e6';
    ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player.
  if (world.phase !== PHASE_OVER) drawShip(ctx, p.x, p.y, p.angle, p.radius, '#2de2e6', p.invuln, p.dashTimer > 0);

  // Enemies.
  for (const e of world.enemies) drawEnemy(ctx, e, world.time);

  // Bullets.
  ctx.save();
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    ctx.strokeStyle = '#9be8ff';
    ctx.shadowColor = '#2de2e6';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const b of world.ebullets) {
    ctx.fillStyle = '#ff5c5c';
    ctx.shadowColor = '#ff2d55';
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd2d2';
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating score text.
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 0.4);
    text(ctx, f.text, f.x, f.y, 15, f.color, 'center', 800);
  }
  ctx.globalAlpha = 1;

  // Wave banner.
  if (world.waveBanner > 0) {
    ctx.globalAlpha = Math.min(1, world.waveBanner);
    glowText(ctx, world.waveBannerText, FIELD.width / 2, FIELD.height / 2 - 120, 44, '#ffffff');
    if (world.wave === TOTAL_WAVES) {
      text(ctx, 'Survive it all to win', FIELD.width / 2, FIELD.height / 2 - 78, 17, '#ffb3c8', 'center', 600);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,8,20,0.82)';
  ctx.strokeStyle = 'rgba(45,226,230,0.4)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(45,226,230,0.35)';
  ctx.shadowBlur = 24;
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx, ui) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  glowText(ctx, 'VOIDLIGHT', FIELD.width / 2, 168, 84, '#2de2e6');
  text(ctx, 'N E O N   A R E N A   S U R V I V A L', FIELD.width / 2, 226, 19, '#ff9f1c', 'center', 700);
  text(ctx, 'The last Warden ship holds the Void against ten waves.', FIELD.width / 2, 272, 18, '#c9d8ef', 'center', 500);
  text(ctx, 'Dash through the swarm. Chain kills into combos. Choose your upgrades.', FIELD.width / 2, 300, 18, '#c9d8ef', 'center', 500);
  text(ctx, 'Survive all 10 waves to win.', FIELD.width / 2, 328, 18, '#c9d8ef', 'center', 600);
  panel(ctx, FIELD.width / 2 - 330, 372, 660, 148);
  text(ctx, 'MOVE  —  WASD / Arrow keys', FIELD.width / 2, 402, 17, '#e8f4ff', 'center', 600);
  text(ctx, 'AIM  —  Mouse      FIRE  —  Hold left click / Space', FIELD.width / 2, 434, 17, '#e8f4ff', 'center', 600);
  text(ctx, 'DASH  —  Shift / Right click      PAUSE  —  P      MUTE  —  M', FIELD.width / 2, 466, 17, '#e8f4ff', 'center', 600);
  text(ctx, 'Between waves, pick 1 of 3 upgrades — click a card or press 1 / 2 / 3.', FIELD.width / 2, 496, 15, '#8fa8c8', 'center', 500);
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  ctx.globalAlpha = pulse;
  glowText(ctx, 'CLICK OR PRESS ENTER TO START', FIELD.width / 2, 586, 24, '#ffffff');
  ctx.globalAlpha = 1;
  if (ui.best > 0) text(ctx, `BEST SCORE  ${ui.best}`, FIELD.width / 2, 628, 16, '#ffe14d', 'center', 700);
  ctx.restore();
}

function drawUpgrade(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  glowText(ctx, `WAVE ${world.wave} CLEARED`, FIELD.width / 2, 130, 40, '#9dff57');
  text(ctx, 'Choose one upgrade — the swarm regroups after you pick.', FIELD.width / 2, 178, 18, '#c9d8ef', 'center', 500);
  const rects = upgradeCardRects();
  world.upgradeChoices.forEach((u, i) => {
    const r = rects[i];
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,32,0.92)';
    ctx.strokeStyle = u.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = u.color;
    ctx.shadowBlur = 12;
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    text(ctx, `[ ${i + 1} ]`, r.x + r.w / 2, r.y + 30, 13, '#8fa8c8', 'center', 700);
    text(ctx, u.icon, r.x + r.w / 2, r.y + 76, 40, u.color, 'center', 700);
    text(ctx, u.name, r.x + r.w / 2, r.y + 128, 20, '#ffffff', 'center', 800);
    text(ctx, u.desc, r.x + r.w / 2, r.y + 162, 15, '#c9d8ef', 'center', 500);
    ctx.restore();
  });
  text(ctx, `SCORE ${world.score}   ·   HULL ${Math.ceil(world.player.hp)}/${world.player.maxHp}`, FIELD.width / 2, 520, 16, '#e8f4ff', 'center', 600);
  ctx.restore();
}

function drawOver(ctx, world, ui, victory) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  if (victory) {
    glowText(ctx, 'THE VOID IS QUIET', FIELD.width / 2, 190, 52, '#9dff57');
    text(ctx, 'All ten waves broken. The Warden endures.', FIELD.width / 2, 244, 19, '#c9d8ef', 'center', 500);
  } else {
    glowText(ctx, 'SIGNAL LOST', FIELD.width / 2, 190, 52, '#ff4d6d');
    text(ctx, `The swarm overran the Warden on wave ${world.wave}.`, FIELD.width / 2, 244, 19, '#c9d8ef', 'center', 500);
  }
  panel(ctx, FIELD.width / 2 - 260, 288, 520, 168);
  text(ctx, 'FINAL SCORE', FIELD.width / 2, 320, 14, '#8fa8c8', 'center', 800);
  glowText(ctx, String(world.score), FIELD.width / 2, 358, 40, '#ffffff');
  text(ctx, `WAVE ${world.wave}  ·  ${world.kills} KILLS  ·  BEST COMBO x${(1 + Math.min(world.bestCombo, 20) * 0.2).toFixed(1)}`, FIELD.width / 2, 402, 16, '#e8f4ff', 'center', 600);
  if (world.score >= ui.best && world.score > 0) {
    text(ctx, '★ NEW BEST SCORE ★', FIELD.width / 2, 434, 16, '#ffe14d', 'center', 800);
  } else {
    text(ctx, `BEST  ${ui.best}`, FIELD.width / 2, 434, 16, '#8fa8c8', 'center', 700);
  }
  const pulse = 0.65 + 0.35 * Math.sin(ui.time * 3.2);
  ctx.globalAlpha = pulse;
  glowText(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 530, 22, '#ffffff');
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  glowText(ctx, 'PAUSED', FIELD.width / 2, FIELD.height / 2 - 20, 48, '#ffffff');
  text(ctx, 'Press P or click to resume', FIELD.width / 2, FIELD.height / 2 + 34, 18, '#c9d8ef', 'center', 500);
  ctx.restore();
}

// Main entry: draws the current screen. `screen` is one of the SCREEN_*
// constants; `ui` carries {best, muted, time, mouseX, mouseY} in field coords.
export function draw(ctx, world, screen, ui) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  ctx.drawImage(background(), 0, 0);
  // Parallax starfield, drifting with the player.
  const px = world.player ? (world.player.x - FIELD.width / 2) * 0.02 : 0;
  const py = world.player ? (world.player.y - FIELD.height / 2) * 0.02 : 0;
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(ui.time * 1.5 + s.tw);
    ctx.globalAlpha = tw * 0.9;
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath();
    ctx.arc(s.x - px * s.depth, s.y - py * s.depth, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (screen === SCREEN_TITLE) {
    drawWorld(ctx, world);
    drawTitle(ctx, ui);
    return;
  }
  drawWorld(ctx, world);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
    drawHud(ctx, world, ui);
    if (screen === SCREEN_PAUSED) drawPaused(ctx);
    return;
  }
  if (screen === SCREEN_UPGRADE) {
    drawHud(ctx, world, ui);
    drawUpgrade(ctx, world);
    return;
  }
  if (screen === SCREEN_OVER) drawOver(ctx, world, ui, false);
  if (screen === SCREEN_VICTORY) drawOver(ctx, world, ui, true);
}
