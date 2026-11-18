// Procedural sound: every effect is synthesised with WebAudio oscillators and
// filtered noise. No audio files, no network. The ambient drone starts on the
// first user gesture (browsers require it) and stays quiet under the action.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.drone = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startDrone();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  startDrone() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.master);
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = 55.7;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    oscA.start();
    oscB.start();
    lfo.start();
    this.drone = { gain, oscA, oscB, lfo };
  }

  // A short oscillator blip with pitch glide and an exponential decay.
  blip({ type = 'square', from = 440, to = 220, dur = 0.12, vol = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst (explosions, hits).
  noise({ dur = 0.25, vol = 0.3, freq = 1200, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.blip({ type: 'square', from: 880, to: 320, dur: 0.08, vol: 0.08 }); }
  hit() { this.blip({ type: 'triangle', from: 300, to: 140, dur: 0.06, vol: 0.12 }); }
  explode() {
    this.noise({ dur: 0.3, vol: 0.35, freq: 900 });
    this.blip({ type: 'sine', from: 160, to: 40, dur: 0.3, vol: 0.3 });
  }
  pickup() {
    this.blip({ type: 'sine', from: 660, to: 990, dur: 0.09, vol: 0.12 });
    this.blip({ type: 'sine', from: 990, to: 1320, dur: 0.1, vol: 0.1, delay: 0.07 });
  }
  hurt() {
    this.blip({ type: 'sawtooth', from: 220, to: 60, dur: 0.25, vol: 0.25 });
    this.noise({ dur: 0.15, vol: 0.2, freq: 500 });
  }
  dash() { this.noise({ dur: 0.18, vol: 0.18, freq: 2400 }); }
  waveStart() {
    this.blip({ type: 'sine', from: 392, to: 392, dur: 0.14, vol: 0.16 });
    this.blip({ type: 'sine', from: 523, to: 523, dur: 0.14, vol: 0.16, delay: 0.12 });
    this.blip({ type: 'sine', from: 659, to: 659, dur: 0.22, vol: 0.18, delay: 0.24 });
  }
  upgrade() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip({ type: 'sine', from: f, to: f, dur: 0.16, vol: 0.14, delay: i * 0.08 }));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.blip({ type: 'triangle', from: f, to: f * 0.94, dur: 0.3, vol: 0.18, delay: i * 0.18 }));
  }
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.blip({ type: 'sine', from: f, to: f, dur: 0.25, vol: 0.16, delay: i * 0.11 }));
  }
}
