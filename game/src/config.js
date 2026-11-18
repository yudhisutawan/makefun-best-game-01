// VOIDLIGHT — a neon arena survival shooter. Original game, written for
// make.fun best-game-01. No libraries, no network, no assets: all art is
// drawn on canvas and all sound is synthesised with WebAudio.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// Player tuning.
export const PLAYER = {
  radius: 16,
  speed: 300,
  maxHp: 100,
  fireInterval: 0.16, // seconds between shots at base fire rate
  bulletSpeed: 640,
  bulletDamage: 34,
  dashSpeed: 900,
  dashTime: 0.18,
  dashCooldown: 2.4,
  invulnTime: 0.6, // brief mercy invulnerability after taking a hit
};

// Enemy catalogue. hp is in damage points; score is base points per kill.
export const ENEMIES = {
  drifter:  { radius: 17, speed: 95,  hp: 30,  damage: 12, score: 100, color: '#ff4d8d' },
  spitter:  { radius: 18, speed: 70,  hp: 45,  damage: 10, score: 150, color: '#ff9f1c' },
  splitter: { radius: 30, speed: 55,  hp: 90,  damage: 16, score: 200, color: '#b388ff' },
  mini:     { radius: 11, speed: 165, hp: 15,  damage: 8,  score: 50,  color: '#ff6fb5' },
  orbiter:  { radius: 16, speed: 130, hp: 60,  damage: 14, score: 250, color: '#2de2e6' },
};

// Wave composition: how many of each type spawn in each of the 10 waves.
// Wave 10 is the final stand; clearing it wins the game.
export const WAVES = [
  { drifter: 6 },
  { drifter: 9, spitter: 2 },
  { drifter: 10, spitter: 4, splitter: 1 },
  { drifter: 12, spitter: 4, splitter: 2, orbiter: 2 },
  { drifter: 12, spitter: 6, splitter: 2, orbiter: 3 },
  { drifter: 14, spitter: 6, splitter: 3, orbiter: 4 },
  { drifter: 16, spitter: 8, splitter: 4, orbiter: 4 },
  { drifter: 18, spitter: 8, splitter: 4, orbiter: 6 },
  { drifter: 20, spitter: 10, splitter: 5, orbiter: 6 },
  { drifter: 22, spitter: 12, splitter: 6, orbiter: 8 },
];
export const TOTAL_WAVES = WAVES.length;

export const COMBO_WINDOW = 3; // seconds to keep the kill combo alive
export const COMBO_MAX = 5;    // x5 is the highest multiplier
