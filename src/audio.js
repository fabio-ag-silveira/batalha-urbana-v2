const STORAGE_KEY = "batalha_urbana_sound";

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePreference(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // preferencia so vale para a sessao
  }
}

// Efeitos sonoros sintetizados com WebAudio: nenhum arquivo de audio e necessario.
export class SoundBoard {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.chargeVoice = null;
    this.enabled = readPreference();
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.45 : 0;
      this.master.connect(this.context.destination);

      const length = this.context.sampleRate;
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
    }
    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    writePreference(this.enabled);
    if (this.master) {
      this.master.gain.value = this.enabled ? 0.45 : 0;
    }
    if (!this.enabled) {
      this.setCharge(null);
    }
    return this.enabled;
  }

  get ready() {
    return Boolean(this.context && this.enabled && this.context.state === "running");
  }

  tone({ type = "sine", from, to = from, duration, volume = 0.3, delay = 0 }) {
    if (!this.ready) {
      return;
    }
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration, volume = 0.4, filter = "lowpass", from = 2000, to = from }) {
    if (!this.ready) {
      return;
    }
    const start = this.context.currentTime;
    const source = this.context.createBufferSource();
    const biquad = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    biquad.type = filter;
    biquad.frequency.setValueAtTime(from, start);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(biquad).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  shot(power = 0.5) {
    this.noise({ duration: 0.18, volume: 0.35, filter: "highpass", from: 900, to: 300 });
    this.tone({ type: "square", from: 180 + power * 120, to: 50, duration: 0.2, volume: 0.18 });
  }

  explosion(scale = 1) {
    this.noise({ duration: 0.5 + 0.4 * scale, volume: Math.min(1, 0.5 + 0.3 * scale), filter: "lowpass", from: 1000 + 400 * scale, to: 120 });
    this.tone({ type: "sine", from: 130 - 20 * scale, to: 30, duration: 0.3 + 0.3 * scale, volume: Math.min(0.7, 0.5 * scale) });
  }

  pickup() {
    [784, 988, 1318].forEach((frequency, index) => {
      this.tone({ type: "triangle", from: frequency, duration: 0.12, volume: 0.16, delay: index * 0.06 });
    });
  }

  bounce() {
    this.tone({ type: "sine", from: 300, to: 520, duration: 0.12, volume: 0.18 });
  }

  split() {
    this.noise({ duration: 0.15, volume: 0.3, filter: "bandpass", from: 1800, to: 900 });
  }

  select() {
    this.tone({ type: "square", from: 660, to: 990, duration: 0.07, volume: 0.07 });
  }

  hit() {
    this.tone({ type: "triangle", from: 620, to: 240, duration: 0.18, volume: 0.25 });
  }

  land() {
    this.noise({ duration: 0.2, volume: 0.35, filter: "lowpass", from: 500, to: 120 });
  }

  miss() {
    this.tone({ type: "sine", from: 500, to: 260, duration: 0.25, volume: 0.12 });
  }

  tick(urgent) {
    this.tone({ type: "square", from: urgent ? 1046 : 880, duration: 0.05, volume: 0.08 });
  }

  turn() {
    this.tone({ type: "sine", from: 440, to: 660, duration: 0.14, volume: 0.12 });
  }

  timeout() {
    this.tone({ type: "sawtooth", from: 300, to: 140, duration: 0.35, volume: 0.15 });
  }

  win() {
    [523, 659, 784].forEach((frequency, index) => {
      this.tone({ type: "triangle", from: frequency, duration: 0.22, volume: 0.2, delay: index * 0.12 });
    });
  }

  fanfare() {
    [523, 659, 784, 1046, 784, 1046].forEach((frequency, index) => {
      this.tone({ type: "triangle", from: frequency, duration: 0.28, volume: 0.22, delay: index * 0.13 });
    });
  }

  // Tom continuo enquanto a barra de forca carrega; null desliga.
  setCharge(power) {
    if (power === null || !this.ready) {
      if (this.chargeVoice) {
        const { oscillator, gain } = this.chargeVoice;
        gain.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
        oscillator.stop(this.context.currentTime + 0.1);
        this.chargeVoice = null;
      }
      return;
    }

    if (!this.chargeVoice) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      gain.gain.value = 0.06;
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      this.chargeVoice = { oscillator, gain };
    }
    this.chargeVoice.oscillator.frequency.setTargetAtTime(220 + power * 660, this.context.currentTime, 0.02);
  }
}
