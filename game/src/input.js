// Keyboard + mouse input, translated into field coordinates (the game runs
// in a fixed 1280x720 logical field scaled to fit the window).
import { FIELD } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = FIELD.width / 2;
    this.mouseY = FIELD.height / 2 - 120;
    this.mouseDown = false;
    this.rightDown = false;
    this.dashQueued = false;
    this.pressed = new Set(); // keys pressed since last consume (edge-triggered)
    this.clicked = false; // mouse click since last consume
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Shift') this.dashQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
      if (e.button === 2) { this.rightDown = true; this.dashQueued = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - rect.left - this.offsetX) / this.scale;
    this.mouseY = (e.clientY - rect.top - this.offsetY) / this.scale;
  }

  // Fit the 1280x720 field into the window; call on resize.
  fit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.scale = Math.min(w / FIELD.width, h / FIELD.height);
    this.offsetX = (w - FIELD.width * this.scale) / 2;
    this.offsetY = (h - FIELD.height * this.scale) / 2;
    this.canvas.style.width = `${FIELD.width * this.scale}px`;
    this.canvas.style.height = `${FIELD.height * this.scale}px`;
    this.canvas.style.left = `${this.offsetX}px`;
    this.canvas.style.top = `${this.offsetY}px`;
  }

  moveVector() {
    let mx = 0;
    let my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    return { mx, my };
  }

  firing() {
    return this.mouseDown || this.keys.has(' ');
  }

  consumeDash() {
    const d = this.dashQueued;
    this.dashQueued = false;
    return d;
  }

  consumePressed(key) {
    const k = key.toLowerCase();
    if (this.pressed.has(k)) {
      this.pressed.delete(k);
      return true;
    }
    return false;
  }

  consumeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
