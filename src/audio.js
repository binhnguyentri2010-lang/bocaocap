/**
 * Procedural ambience with the Web Audio API: rain, the hum of the city and its
 * motorbikes, the odd horn, and thunder. No audio files needed. Must be started from a user
 * gesture (iOS requirement).
 */
export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.rain = 0;
  }

  _noiseBuffer(seconds, brown = false) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else d[i] = w;
      }
    }
    return buf;
  }

  _loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const white = this._noiseBuffer(3);
    const brown = this._noiseBuffer(4, true);

    // rain: hiss + patter
    const hiss = this._loop(white);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    hiss.connect(hp).connect(lp).connect(this.rainGain).connect(this.master);

    const body = this._loop(brown);
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 500;
    this.rainBody = ctx.createGain(); this.rainBody.gain.value = 0;
    body.connect(bp).connect(this.rainBody).connect(this.master);

    // distant city hum
    const hum = this._loop(brown);
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 260;
    const humGain = ctx.createGain(); humGain.gain.value = 0.22;
    hum.connect(hlp).connect(humGain).connect(this.master);

    // swarm of motorbikes: band-passed rumble that swells and fades
    const motor = this._loop(brown);
    const mbp = ctx.createBiquadFilter(); mbp.type = 'bandpass'; mbp.frequency.value = 150; mbp.Q.value = 0.9;
    const motorGain = ctx.createGain(); motorGain.gain.value = 0.35;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.18;
    lfo.connect(lfoAmt).connect(motorGain.gain);
    lfo.start();
    motor.connect(mbp).connect(motorGain).connect(this.master);

    this.brown = brown;
    this._scheduleHonk();
    return true;
  }

  /** Occasional distant "bíp bíp" of a scooter horn. */
  _scheduleHonk() {
    setTimeout(() => {
      if (this.enabled && this.ctx && document.visibilityState === 'visible') this.honk();
      this._scheduleHonk();
    }, 2500 + Math.random() * 7000);
  }

  honk() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const f = 380 + Math.random() * 180;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.value = 0;
    const vol = 0.02 + Math.random() * 0.04;
    const beeps = Math.random() < 0.6 ? 2 : 1;
    for (let k = 0; k < beeps; k++) {
      const t = t0 + k * 0.2;
      for (const mul of [1, 1.26]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f * mul;
        o.connect(lp);
        o.start(t);
        o.stop(t + 0.14);
      }
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.setValueAtTime(vol, t + 0.12);
      g.gain.linearRampToValueAtTime(0, t + 0.14);
    }
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; lp.connect(g).connect(pan).connect(this.master); }
    else lp.connect(g).connect(this.master);
  }

  async setEnabled(on) {
    if (on && !this.ctx && !this._init()) return false;
    this.enabled = on;
    if (!this.ctx) return false;
    if (on && this.ctx.state !== 'running') await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.4);
    this.setRain(this.rain);
    return true;
  }

  setRain(k) {
    this.rain = k;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(0.32 * k, t, 0.6);
    this.rainBody.gain.setTargetAtTime(0.5 * k, t, 0.6);
  }

  thunder(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + Math.random() * 120;
    const g = ctx.createGain();
    const t = ctx.currentTime + 0.4 + Math.random() * 1.2; // sound arrives after the flash
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.4 * strength, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.4 * strength, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + 5);
  }
}
