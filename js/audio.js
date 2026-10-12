// audio.js - Sintetizador Web Audio API autónomo (seguro fuera del navegador)
const hasStorage = () => typeof localStorage !== 'undefined';

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 1;
    try {
      if (hasStorage()) {
        const saved = localStorage.getItem('blackademy_sound_enabled');
        if (saved !== null) this.enabled = saved === '1';
      }
    } catch { /* almacenamiento no disponible */ }
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    try { if (hasStorage()) localStorage.setItem('blackademy_sound_enabled', this.enabled ? '1' : '0'); } catch { /* noop */ }
    return this.enabled;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
  }

  init() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _ready() {
    if (!this.enabled) return false;
    this.init();
    return Boolean(this.ctx);
  }

  _tone({ type, f0, f1 = null, start = 0, dur, gain, ramp = 'linear', filter = null }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== null) {
      if (ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    const peak = gain * this.volume;
    g.gain.setValueAtTime(peak, t);
    if (ramp === 'exp') g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    else g.gain.linearRampToValueAtTime(0.01, t + dur);

    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(filter, t);
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playCard()   { if (this._ready()) this._tone({ type: 'triangle', f0: 450, f1: 120, dur: 0.08, gain: 0.3, ramp: 'exp', filter: 1200 }); }
  playChip()   { if (this._ready()) this._tone({ type: 'sine', f0: 1200, f1: 800, dur: 0.06, gain: 0.2, ramp: 'exp' }); }
  playLoss()   { if (this._ready()) this._tone({ type: 'sawtooth', f0: 180, f1: 90, dur: 0.35, gain: 0.25 }); }
  playBuzzer() { if (this._ready()) this._tone({ type: 'square', f0: 150, dur: 0.18, gain: 0.2 }); }
  playWin() {
    if (!this._ready()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, start: i * 0.08, dur: 0.2, gain: 0.15 }));
  }
}

export const sounds = new SoundFX();
