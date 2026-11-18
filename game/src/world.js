// VOIDLIGHT world: the whole simulation. Pure logic over a seeded RNG — no
// DOM, no canvas — so the screenshot stager can run it headless and the game
// plays identically from the same seed.
import { FIELD, PLAYER, ENEMIES, WAVES, TOTAL_WAVES, COMBO_WINDOW, COMBO_MAX } from './config.js';
import { makeRng, pick, shuffle, range, clamp, dist2, angleTo } from './random.js';

export const PHASE_PLAYING = 'playing';
export const PHASE_UPGRADE = 'upgrade';
export const PHASE_OVER = 'over';
export const PHASE_VICTORY = 'victory';

// Upgrade cards offered between waves. Each may be taken repeatedly unless
// its `max` says otherwise.
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Coils', desc: '+25% fire rate', icon: '»', color: '#2de2e6',
    apply: (p) => { p.fireRateMult *= 1.25; } },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+30% bullet damage', icon: '◆', color: '#ff9f1c',
    apply: (p) => { p.damageMult *= 1.3; } },
  { id: 'twin', name: 'Split Barrel', desc: '+1 projectile per shot', icon: '✦', color: '#7CFC98', max: 3,
    apply: (p) => { p.projectiles += 1; } },
  { id: 'pierce', name: 'Lance Rounds', desc: 'Bullets pierce +1 enemy', icon: '→', color: '#e6e6ff', max: 3,
    apply: (p) => { p.pierce += 1; } },
  { id: 'swift', name: 'Ion Thrusters', desc: '+15% move speed', icon: '≫', color: '#4d7cff',
    apply: (p) => { p.speedMult *= 1.15; } },
  { id: 'plating', name: 'Ablative Plating', desc: '+25 max hull, repair 25', icon: '▣', color: '#9dff57',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'magnet', name: 'Tractor Web', desc: 'Pickups fly to you from 2x range', icon: '◎', color: '#ff6fb5', max: 2,
    apply: (p) => { p.magnetMult *= 2; } },
  { id: 'dashcd', name: 'Blink Capacitor', desc: 'Dash recharges 35% faster', icon: '⚡', color: '#ffe14d', max: 3,
    apply: (p) => { p.dashCdMult *= 0.65; } },
  { id: 'nova', name: 'Nova Dash', desc: 'Dashing blasts nearby enemies', icon: '✺', color: '#b388ff', max: 1,
    apply: (p) => { p.novaOnDash = true; } },
];

function newPlayer() {
  return {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    fireTimer: 0, dashTimer: 0, dashCd: 0, dashX: 0, dashY: 0,
    invuln: 0, fireRateMult: 1, damageMult: 1, projectiles: 1, pierce: 0,
    speedMult: 1, magnetMult: 1, dashCdMult: 1, novaOnDash: false,
    trail: [],
  };
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.time = 0;
    this.phase = PHASE_PLAYING;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.player = newPlayer();
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.particles = [];
    this.pickups = [];
    this.floaters = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.upgradeChoices = [];
    this.upgradeTaken = {};
    this.shake = 0;
    this.waveBanner = 0;
    this.waveBannerText = '';
    this.startWave(1);
  }

  comboMult() {
    return 1 + Math.min(this.combo, 20) * 0.2 > COMBO_MAX ? COMBO_MAX : 1 + Math.min(this.combo, 20) * 0.2;
  }

  startWave(n) {
    this.wave = n;
    const def = WAVES[n - 1];
    const queue = [];
    for (const [kind, count] of Object.entries(def)) {
      for (let i = 0; i < count; i += 1) queue.push(kind);
    }
    this.spawnQueue = shuffle(this.rng, queue);
    this.spawnTimer = 0.8;
    this.waveBanner = 2.2;
    this.waveBannerText = n === TOTAL_WAVES ? 'FINAL WAVE' : `WAVE ${n}`;
  }

  spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const p = this.player;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      const edge = Math.floor(this.rng() * 4);
      if (edge === 0) { x = range(this.rng, 40, FIELD.width - 40); y = 36; }
      else if (edge === 1) { x = range(this.rng, 40, FIELD.width - 40); y = FIELD.height - 36; }
      else if (edge === 2) { x = 36; y = range(this.rng, 40, FIELD.height - 40); }
      else { x = FIELD.width - 36; y = range(this.rng, 40, FIELD.height - 40); }
      if (dist2(x, y, p.x, p.y) > 320 * 320) break;
    }
    this.enemies.push({
      kind, x, y, vx: 0, vy: 0, hp: def.hp, maxHp: def.hp,
      radius: def.radius, angle: 0, shootTimer: range(this.rng, 1, 2.4),
      orbitAngle: this.rng() * Math.PI * 2, lungeTimer: range(this.rng, 1.5, 3),
      lungeTime: 0, wobble: this.rng() * Math.PI * 2, flash: 0,
    });
  }

  burst(x, y, color, count, speed = 220, life = 0.6, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = this.rng() * Math.PI * 2;
      const s = range(this.rng, speed * 0.3, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(this.rng, life * 0.5, life), maxLife: life,
        size: range(this.rng, size * 0.6, size * 1.4), color,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  floater(x, y, text, color) {
    if (this.floaters.length > 24) this.floaters.shift();
    this.floaters.push({ x, y, text, color, life: 0.9 });
  }

  addScore(base, x, y) {
    const mult = this.comboMult();
    const gained = Math.round(base * mult);
    this.score += gained;
    if (x !== undefined) this.floater(x, y, `+${gained}`, mult >= 2 ? '#ffe14d' : '#e8f4ff');
  }

  killEnemy(enemy, index) {
    const def = ENEMIES[enemy.kind];
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.addScore(def.score, enemy.x, enemy.y);
    this.burst(enemy.x, enemy.y, def.color, enemy.kind === 'splitter' ? 26 : 14, 260, 0.7, 3.5);
    this.burst(enemy.x, enemy.y, '#ffffff', 5, 160, 0.35, 2);
    this.shake = Math.min(10, this.shake + (enemy.kind === 'splitter' ? 6 : 3));
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        this.enemies.push({
          kind: 'mini', x: enemy.x + (i === 0 ? -18 : 18), y: enemy.y,
          vx: 0, vy: 0, hp: ENEMIES.mini.hp, maxHp: ENEMIES.mini.hp,
          radius: ENEMIES.mini.radius, angle: 0, shootTimer: 0,
          orbitAngle: 0, lungeTimer: 0, lungeTime: 0, wobble: this.rng() * Math.PI * 2, flash: 0,
        });
      }
    }
    const roll = this.rng();
    if (roll < 0.08 && this.player.hp < this.player.maxHp) {
      this.pickups.push({ kind: 'heart', x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 9 });
    } else if (roll < 0.72) {
      this.pickups.push({ kind: 'shard', x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 9 });
    }
  }

  damagePlayer(amount, sx, sy) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || this.phase !== PHASE_PLAYING) return;
    p.hp -= amount;
    p.invuln = PLAYER.invulnTime;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = Math.min(14, this.shake + 7);
    this.burst(p.x, p.y, '#ff4d6d', 18, 280, 0.6, 3.5);
    if (sx !== undefined) {
      const a = angleTo(sx, sy, p.x, p.y);
      p.vx += Math.cos(a) * 320;
      p.vy += Math.sin(a) * 320;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = PHASE_OVER;
      this.burst(p.x, p.y, '#2de2e6', 60, 420, 1.1, 4);
      this.burst(p.x, p.y, '#ffffff', 24, 300, 0.8, 3);
      this.shake = 16;
    }
  }

  fireBullet() {
    const p = this.player;
    const spread = 0.09;
    const n = p.projectiles;
    for (let i = 0; i < n; i += 1) {
      const off = (i - (n - 1) / 2) * spread;
      const a = p.angle + off;
      const px = p.x + Math.cos(a) * (p.radius + 8);
      const py = p.y + Math.sin(a) * (p.radius + 8);
      this.bullets.push({
        x: px, y: py,
        vx: Math.cos(a) * PLAYER.bulletSpeed + p.vx * 0.25,
        vy: Math.sin(a) * PLAYER.bulletSpeed + p.vy * 0.25,
        dmg: Math.round(PLAYER.bulletDamage * p.damageMult),
        pierce: p.pierce, life: 1.1, hitSet: new Set(),
      });
    }
  }

  doDash() {
    const p = this.player;
    p.dashTimer = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown * p.dashCdMult;
    p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.08);
    if (p.novaOnDash) {
      this.burst(p.x, p.y, '#b388ff', 30, 380, 0.7, 4);
      this.shake = Math.min(12, this.shake + 5);
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (dist2(e.x, e.y, p.x, p.y) < 150 * 150) {
          e.hp -= 60;
          e.flash = 0.12;
          if (e.hp <= 0) this.killEnemy(e, i);
        }
      }
    }
  }

  rollUpgrades() {
    const available = UPGRADES.filter((u) => {
      const taken = this.upgradeTaken[u.id] ?? 0;
      return !u.max || taken < u.max;
    });
    const pool = available.length >= 3 ? available : UPGRADES;
    this.upgradeChoices = shuffle(this.rng, pool).slice(0, 3);
  }

  chooseUpgrade(index) {
    if (this.phase !== PHASE_UPGRADE) return false;
    const choice = this.upgradeChoices[index];
    if (!choice) return false;
    choice.apply(this.player);
    this.upgradeTaken[choice.id] = (this.upgradeTaken[choice.id] ?? 0) + 1;
    this.upgradeChoices = [];
    if (this.wave >= TOTAL_WAVES) {
      this.phase = PHASE_VICTORY;
    } else {
      this.phase = PHASE_PLAYING;
      this.startWave(this.wave + 1);
    }
    return true;
  }

  step(dt, input, audio) {
    this.time += dt;
    if (this.waveBanner > 0) this.waveBanner -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.updateParticles(dt);
    this.updateFloaters(dt);
    if (this.phase !== PHASE_PLAYING) return;

    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;

    // --- movement & dash ---
    p.angle = angleTo(p.x, p.y, input.aimX, input.aimY);
    if (input.dashPressed && p.dashCd <= 0 && p.dashTimer <= 0) {
      const len = Math.hypot(input.mx, input.my);
      if (len > 0.1) { p.dashX = input.mx / len; p.dashY = input.my / len; }
      else { p.dashX = Math.cos(p.angle); p.dashY = Math.sin(p.angle); }
      this.doDash();
      if (audio) audio.dash();
    }
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
      this.burst(p.x, p.y, '#2de2e6', 2, 60, 0.3, 2.5);
    } else {
      const speed = PLAYER.speed * p.speedMult;
      const tx = input.mx * speed;
      const ty = input.my * speed;
      p.vx += (tx - p.vx) * Math.min(1, dt * 12);
      p.vy += (ty - p.vy) * Math.min(1, dt * 12);
    }
    p.x = clamp(p.x + p.vx * dt, p.radius + 6, FIELD.width - p.radius - 6);
    p.y = clamp(p.y + p.vy * dt, p.radius + 6, FIELD.height - p.radius - 6);
    p.trail.push({ x: p.x, y: p.y, life: 0.25 });
    if (p.trail.length > 14) p.trail.shift();
    for (const t of p.trail) t.life -= dt;

    // --- firing ---
    p.fireTimer -= dt;
    if (input.firing && p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireInterval / p.fireRateMult;
      this.fireBullet();
      if (audio) audio.shoot();
    }

    // --- spawning ---
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.35, 0.85 - this.wave * 0.04);
        const burstCount = this.wave >= 5 && this.rng() < 0.3 ? 2 : 1;
        for (let i = 0; i < burstCount && this.spawnQueue.length > 0; i += 1) {
          this.spawnEnemy(this.spawnQueue.pop());
        }
      }
    } else if (this.enemies.length === 0) {
      // Wave cleared.
      if (this.wave >= TOTAL_WAVES) {
        this.phase = PHASE_VICTORY;
        if (audio) audio.victory();
      } else {
        this.phase = PHASE_UPGRADE;
        this.rollUpgrades();
        if (audio) audio.upgrade();
      }
      return;
    }

    this.updateEnemies(dt, audio);
    this.updateBullets(dt, audio);
    this.updatePickups(dt, audio);
  }

  updateEnemies(dt, audio) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const def = ENEMIES[e.kind];
      if (e.flash > 0) e.flash -= dt;
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const nx = (p.x - e.x) / d;
      const ny = (p.y - e.y) / d;
      const speedScale = 1 + (this.wave - 1) * 0.03;

      if (e.kind === 'spitter') {
        e.shootTimer -= dt;
        let mx = 0;
        let my = 0;
        if (d > 300) { mx = nx; my = ny; }
        else if (d < 210) { mx = -nx; my = -ny; }
        else { mx = -ny * 0.6; my = nx * 0.6; }
        e.vx += (mx * def.speed * speedScale - e.vx) * Math.min(1, dt * 4);
        e.vy += (my * def.speed * speedScale - e.vy) * Math.min(1, dt * 4);
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = 2.3;
          const a = angleTo(e.x, e.y, p.x, p.y);
          this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: def.damage, life: 4 });
          this.burst(e.x, e.y, def.color, 4, 120, 0.3, 2);
        }
      } else if (e.kind === 'orbiter') {
        e.orbitAngle += dt * 1.4;
        e.lungeTimer -= dt;
        if (e.lungeTimer <= 0 && d < 320) {
          e.lungeTimer = range(this.rng, 2.2, 3.2);
          e.lungeTime = 0.45;
        }
        if (e.lungeTime > 0) {
          e.lungeTime -= dt;
          e.vx = nx * def.speed * 2.4;
          e.vy = ny * def.speed * 2.4;
        } else {
          const tx = p.x + Math.cos(e.orbitAngle) * 215;
          const ty = p.y + Math.sin(e.orbitAngle) * 215;
          const td = Math.hypot(tx - e.x, ty - e.y) || 1;
          e.vx += (((tx - e.x) / td) * def.speed * speedScale - e.vx) * Math.min(1, dt * 3);
          e.vy += (((ty - e.y) / td) * def.speed * speedScale - e.vy) * Math.min(1, dt * 3);
        }
      } else {
        // drifter / splitter / mini: chase with a wobble.
        e.wobble += dt * 3;
        const wob = Math.sin(e.wobble) * 0.35;
        const ax = nx + -ny * wob;
        const ay = ny + nx * wob;
        const al = Math.hypot(ax, ay) || 1;
        e.vx += ((ax / al) * def.speed * speedScale - e.vx) * Math.min(1, dt * 3.5);
        e.vy += ((ay / al) * def.speed * speedScale - e.vy) * Math.min(1, dt * 3.5);
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, e.radius, FIELD.width - e.radius);
      e.y = clamp(e.y, e.radius, FIELD.height - e.radius);
      e.angle = Math.atan2(e.vy, e.vx);

      // Touching the player hurts.
      const rr = e.radius + p.radius - 4;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        this.damagePlayer(def.damage, e.x, e.y);
        if (audio) audio.hurt();
        // The enemy bounces off so one touch is not a death spiral.
        e.vx = -nx * 220;
        e.vy = -ny * 220;
        if (this.phase !== PHASE_PLAYING) return;
      }
    }
  }

  updateBullets(dt, audio) {
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
          const e = this.enemies[j];
          if (b.hitSet.has(e)) continue;
          const rr = e.radius + 5;
          if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            e.hp -= b.dmg;
            e.flash = 0.1;
            e.vx += b.vx * 0.02;
            e.vy += b.vy * 0.02;
            this.burst(b.x, b.y, '#9be8ff', 4, 140, 0.25, 2);
            if (audio) audio.hit();
            b.hitSet.add(e);
            if (e.hp <= 0) this.killEnemy(e, j);
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
    for (let i = this.ebullets.length - 1; i >= 0; i -= 1) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const rr = p.radius + 6;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        this.damagePlayer(b.dmg, b.x - b.vx, b.y - b.vy);
        if (audio) audio.hurt();
        this.ebullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        this.ebullets.splice(i, 1);
      }
    }
  }

  updatePickups(dt, audio) {
    const p = this.player;
    const magnetR = 95 * p.magnetMult;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pk = this.pickups[i];
      pk.life -= dt;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
      if (d < magnetR) {
        const pull = 520 * (1 - d / magnetR) + 140;
        pk.vx += ((p.x - pk.x) / d) * pull * dt * 4;
        pk.vy += ((p.y - pk.y) / d) * pull * dt * 4;
      }
      pk.vx *= Math.max(0, 1 - dt * 3);
      pk.vy *= Math.max(0, 1 - dt * 3);
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (d < p.radius + 14) {
        if (pk.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 20);
          this.floater(p.x, p.y - 24, '+20 HULL', '#9dff57');
        } else {
          this.addScore(25);
          p.hp = Math.min(p.maxHp, p.hp + 1);
        }
        this.burst(pk.x, pk.y, pk.kind === 'heart' ? '#9dff57' : '#ffe14d', 6, 120, 0.35, 2.5);
        if (audio) audio.pickup();
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) this.pickups.splice(i, 1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - dt * 2.4);
      pt.vy *= Math.max(0, 1 - dt * 2.4);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }
}
