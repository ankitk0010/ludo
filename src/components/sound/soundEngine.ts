let sfxOverrideCache: Map<string, string> | null = null;

/** (Re)load the admin-managed SFX audio overrides. */
export async function refreshSfxOverrides(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/sfx', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const map = new Map<string, string>();
    (data.sfx || []).forEach((s: { key?: string; audioUrl?: string | null }) => {
      if (s.key && s.audioUrl) map.set(s.key, s.audioUrl);
    });
    sfxOverrideCache = map;
  } catch {
    /* keep previous cache */
  }
}

function sfxUrl(key: string): string | null {
  return (sfxOverrideCache && sfxOverrideCache.get(key)) || null;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean = false;
  private sfxVolume: number = 1;
  private musicVolume: number = 1;
  private audioCache = new Map<string, HTMLAudioElement>();

  /** Play an admin-uploaded audio override for an sfx key when one exists. */
  private playCustom(key: string): boolean {
    if (this.muted) return false;
    const url = sfxUrl(key);
    if (!url) return false;
    try {
      let audio = this.audioCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this.audioCache.set(url, audio);
      }
      if (audio) {
        audio.currentTime = 0;
        audio.volume = this.sfxVolume;
        void audio.play().catch(() => {});
      }
    } catch {
      return false;
    }
    return true;
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.sfxVolume;
        this.master.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : this.sfxVolume;
    }
  }

  /** Apply global SFX volume (0..1). */
  public setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    this._applyVolume();
  }

  /** Apply global music volume (0..1). */
  public setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
  }

  public getMusicVolume() {
    return this.musicVolume;
  }

  private get sfx() {
    return this.sfxVolume;
  }

  private _applyVolume() {
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : this.sfxVolume;
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this._applyVolume();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.master!);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playDiceRoll() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Dice rattle: a quick, decaying train of clicks + a soft settling thud,
    // like a couple of dice shaking inside a cup and landing.
    const start = this.ctx.currentTime;
    const clickCount = 12;

    for (let i = 0; i < clickCount; i++) {
      const time = start + i * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Alternate wooden-tick vs bright-tick for texture
      osc.type = i % 2 === 0 ? 'triangle' : 'square';
      const pitch = 1800 - i * 90 + Math.random() * 160;
      osc.frequency.setValueAtTime(pitch, time);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.03);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(time);
      osc.stop(time + 0.04);
    }

    // Final "settle" — a low knock as the dice land
    const settleTime = start + clickCount * 0.045 + 0.02;
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(220, settleTime);
    thud.frequency.exponentialRampToValueAtTime(90, settleTime + 0.12);
    thudGain.gain.setValueAtTime(0.22, settleTime);
    thudGain.gain.linearRampToValueAtTime(0.002, settleTime + 0.14);
    thud.connect(thudGain);
    thudGain.connect(this.master!);
    thud.start(settleTime);
    thud.stop(settleTime + 0.15);
  }

  /**
     * Soft "thump" when the dice lands after a roll.
     */
  public playDiceLand() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(300, start);
    thud.frequency.exponentialRampToValueAtTime(110, start + 0.12);
    thudGain.gain.setValueAtTime(0.25, start);
    thudGain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
    thud.connect(thudGain);
    thudGain.connect(this.master!);
    thud.start(start);
    thud.stop(start + 0.15);

    // bright little click right after
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1200, start + 0.03);
    click.frequency.exponentialRampToValueAtTime(500, start + 0.08);
    clickGain.gain.setValueAtTime(0.1, start + 0.03);
    clickGain.gain.linearRampToValueAtTime(0.001, start + 0.09);
    click.connect(clickGain);
    clickGain.connect(this.master!);
    click.start(start + 0.03);
    click.stop(start + 0.09);
  }

  /**
   * Sparkly golden shimmer when a 6 is rolled.
   */
  public playSpecialSix() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const notes = [1046.5, 1318.5, 1568, 2093]; // C6 E6 G6 C7
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = start + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.14, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(time);
      osc.stop(time + 0.2);

      // sparkle overtone
      const spark = this.ctx.createOscillator();
      const sparkGain = this.ctx.createGain();
      spark.type = 'sine';
      spark.frequency.setValueAtTime(freq * 2, time + 0.02);
      sparkGain.gain.setValueAtTime(0.05, time + 0.02);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
      spark.connect(sparkGain);
      sparkGain.connect(this.master!);
      spark.start(time + 0.02);
      spark.stop(time + 0.18);
    });
  }

  /**
   * Short low "buzz" for an invalid roll / no legal moves.
   */
  public playInvalid() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, start);
    osc.frequency.linearRampToValueAtTime(120, start + 0.18);
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.linearRampToValueAtTime(0.001, start + 0.2);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.2);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(400, start + 0.05);
    osc2.frequency.linearRampToValueAtTime(260, start + 0.16);
    gain2.gain.setValueAtTime(0.05, start + 0.05);
    gain2.gain.linearRampToValueAtTime(0.001, start + 0.18);
    osc2.connect(gain2);
    gain2.connect(this.master!);
    osc2.start(start + 0.05);
    osc2.stop(start + 0.18);
  }

  /**
   * Cheerful "yeeh" launch sound when a goti steps out of its home base.
   */
  public playLaunch() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = start + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, time + 0.12);
      gain.gain.setValueAtTime(0.22, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.16);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(time);
      osc.stop(time + 0.16);
    });

    // Sparkle tail
    const sparkleOsc = this.ctx.createOscillator();
    const sparkleGain = this.ctx.createGain();
    sparkleOsc.type = 'sine';
    sparkleOsc.frequency.setValueAtTime(1568, start + notes.length * 0.07);
    sparkleGain.gain.setValueAtTime(0.08, start + notes.length * 0.07);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, start + notes.length * 0.07 + 0.25);
    sparkleOsc.connect(sparkleGain);
    sparkleGain.connect(this.master!);
    sparkleOsc.start(start + notes.length * 0.07);
    sparkleOsc.stop(start + notes.length * 0.07 + 0.26);
  }

  public playTokenMove() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.master!);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playCapture() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;

    // Sub "boom" — the weight of the capture
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(92, start);
    boom.frequency.exponentialRampToValueAtTime(44, start + 0.32);
    boomGain.gain.setValueAtTime(0.42, start);
    boomGain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
    boom.connect(boomGain);
    boomGain.connect(this.master!);
    boom.start(start);
    boom.stop(start + 0.34);

    // Grating saw sweep — the "cut"
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, start);
    osc.frequency.exponentialRampToValueAtTime(70, start + 0.24);
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.27);

    // Sharp "crack"
    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(2100, start);
    crack.frequency.exponentialRampToValueAtTime(300, start + 0.09);
    crackGain.gain.setValueAtTime(0.22, start);
    crackGain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
    crack.connect(crackGain);
    crackGain.connect(this.master!);
    crack.start(start);
    crack.stop(start + 0.11);

    // High ping "clang"
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1500, start + 0.04);
    ping.frequency.exponentialRampToValueAtTime(500, start + 0.11);
    pingGain.gain.setValueAtTime(0.2, start + 0.04);
    pingGain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
    ping.connect(pingGain);
    pingGain.connect(this.master!);
    ping.start(start + 0.04);
    ping.stop(start + 0.14);
  }

  /**
   * Light "whoosh" blip played at each hop on the return path.
   */
  public playHopBack() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.07);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.master!);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.07);
  }

  /**
   * Explosive landing "pop" when the returning token finally reaches its base.
   */
  public playCaptureReturn() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);

    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180, this.ctx.currentTime + 0.02);
    thud.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.15);
    thudGain.gain.setValueAtTime(0.25, this.ctx.currentTime + 0.02);
    thudGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.17);
    thud.connect(thudGain);
    thudGain.connect(this.master!);
    thud.start(this.ctx.currentTime + 0.02);
    thud.stop(this.ctx.currentTime + 0.17);
  }

  /**
   * Happy "reached home center" jingle played when a goti finishes.
   */
  public playReachHome() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0]; // C5 E5 G5 C6 E6 G6 C7
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, time + 0.12);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(time);
      osc.stop(time + 0.18);
    });

    // Shimmer + rising sparkle right after the melody
    const shimmer = this.ctx.createOscillator();
    const shimmerGain = this.ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2093, this.ctx.currentTime + 0.64);
    shimmerGain.gain.setValueAtTime(0.07, this.ctx.currentTime + 0.64);
    shimmerGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.1);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.master!);
    shimmer.start(this.ctx.currentTime + 0.64);
    shimmer.stop(this.ctx.currentTime + 1.1);

    const sparkle = this.ctx.createOscillator();
    const sparkleGain = this.ctx.createGain();
    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(2610, this.ctx.currentTime + 0.72);
    sparkleGain.gain.setValueAtTime(0.05, this.ctx.currentTime + 0.72);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(this.master!);
    sparkle.start(this.ctx.currentTime + 0.72);
    sparkle.stop(this.ctx.currentTime + 0.9);
  }

  public playPowerCard() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(time);
      osc.stop(time + 0.1);
    });
  }

  public playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // Victory chord sweep
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.linearRampToValueAtTime(0.01, time + 0.3);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  }

  /** Short bright "ding" when a turn starts. */
  public playTurnStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, start);
    osc.frequency.exponentialRampToValueAtTime(660, start + 0.1);
    gain.gain.setValueAtTime(0.14, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.12);
  }

  /** Gentle two-note "pop" for a voice reaction. */
  public playReaction() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [659.25, 987.77];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const time = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(time);
      osc.stop(time + 0.13);
    });
  }

  /** Downward "hmm" for a defeat / lost game. */
  public playDefeat() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, start);
    osc.frequency.exponentialRampToValueAtTime(196, start + 0.6);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.linearRampToValueAtTime(0.01, start + 0.7);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.72);
  }
}

export const soundEngine = new SoundEngine();
