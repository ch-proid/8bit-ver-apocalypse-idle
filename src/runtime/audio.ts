import type { SimulationState } from "../core/types";

export type AudioCue =
  | "button"
  | "hit"
  | "kill"
  | "drop"
  | "summon"
  | "levelUp"
  | "upgradeSuccess"
  | "upgradeFail";

const AUDIO_MUTED_KEY = "apocalypse-audio-muted";
const BGM_STEP_SECONDS = 0.24;
const BGM_SCALE = [0, 3, 5, 7, 10];
const BGM_PATTERN = [0, 2, 1, 3, 4, 3, 1, 0, 2, 4, 3, 1, 0, 1, 3, 2];
const CHAPTER_ROOTS = [110, 123.47, 130.81, 146.83, 164.81, 185.0];

type AudioContextCtor = typeof AudioContext;
type MutedListener = (muted: boolean) => void;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextCtor;
  }
}

class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private muted = readMutedSetting();
  private unlocked = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private chapter = 1;
  private readonly listeners = new Set<MutedListener>();
  private readonly throttle = new Map<AudioCue, number>();

  installUnlockListeners(): () => void {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const unlock = () => {
      void this.unlock();
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }

  subscribe(listener: MutedListener): () => void {
    this.listeners.add(listener);
    listener(this.muted);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMutedSetting(muted);
    this.applyMuteState();
    for (const listener of this.listeners) {
      listener(muted);
    }
  }

  toggleMuted(): void {
    this.setMuted(!this.muted);
  }

  setChapter(chapter: number): void {
    this.chapter = Math.max(1, Math.min(CHAPTER_ROOTS.length, Math.floor(chapter)));
  }

  play(cue: AudioCue): void {
    if (this.muted || !this.canPlay(cue)) {
      return;
    }

    const context = this.ensureContext();
    if (!context || context.state !== "running" || !this.master) {
      return;
    }

    const t = context.currentTime;
    switch (cue) {
      case "button":
        this.blip(660, 0.035, 0.035, "square");
        break;
      case "hit":
        this.pitchDrop(190, 75, 0.07, 0.08);
        break;
      case "kill":
        this.note(156, t, 0.055, 0.09, "square");
        this.note(98, t + 0.055, 0.08, 0.08, "square");
        break;
      case "drop":
        this.note(523.25, t, 0.045, 0.06, "square");
        this.note(784.0, t + 0.045, 0.07, 0.055, "square");
        break;
      case "summon":
        this.pitchDrop(82, 55, 0.28, 0.12);
        this.note(164.81, t + 0.06, 0.19, 0.04, "sawtooth");
        break;
      case "levelUp":
        this.note(392, t, 0.07, 0.07, "square");
        this.note(523.25, t + 0.075, 0.07, 0.07, "square");
        this.note(783.99, t + 0.15, 0.12, 0.07, "square");
        break;
      case "upgradeSuccess":
        this.note(659.25, t, 0.075, 0.08, "square");
        this.note(987.77, t + 0.08, 0.12, 0.08, "square");
        break;
      case "upgradeFail":
        this.pitchDrop(220, 92, 0.16, 0.08);
        break;
    }
  }

  private async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      await context.resume();
    }
    this.unlocked = true;
    this.startBgm();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    if (this.context) {
      return this.context;
    }

    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }

    const context = new Ctor();
    const master = context.createGain();
    const bgmGain = context.createGain();
    master.gain.value = this.muted ? 0 : 0.18;
    bgmGain.gain.value = 0.18;
    bgmGain.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.bgmGain = bgmGain;
    return context;
  }

  private applyMuteState(): void {
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.18, this.master.context.currentTime, 0.015);
    }
    if (this.muted) {
      this.stopBgm();
    } else if (this.unlocked) {
      this.startBgm();
    }
  }

  private canPlay(cue: AudioCue): boolean {
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    const minGap = cue === "hit" ? 45 : cue === "drop" ? 90 : cue === "kill" ? 90 : 25;
    const last = this.throttle.get(cue) ?? -Infinity;
    if (now - last < minGap) {
      return false;
    }
    this.throttle.set(cue, now);
    return true;
  }

  private blip(frequency: number, duration: number, gain: number, type: OscillatorType): void {
    const context = this.context;
    if (!context) {
      return;
    }
    this.note(frequency, context.currentTime, duration, gain, type);
  }

  private pitchDrop(startFrequency: number, endFrequency: number, duration: number, gain: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(startFrequency, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), context.currentTime + duration);
    amp.gain.setValueAtTime(0.0001, context.currentTime);
    amp.gain.linearRampToValueAtTime(gain, context.currentTime + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + duration + 0.02);
  }

  private note(frequency: number, start: number, duration: number, gain: number, type: OscillatorType): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private startBgm(): void {
    if (this.muted || this.bgmTimer !== null || !this.context || !this.bgmGain) {
      return;
    }
    this.bgmTimer = window.setInterval(() => this.scheduleBgmStep(), BGM_STEP_SECONDS * 1000);
  }

  private stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private scheduleBgmStep(): void {
    const context = this.context;
    const bgmGain = this.bgmGain;
    if (!context || !bgmGain || this.muted || context.state !== "running") {
      return;
    }

    const root = CHAPTER_ROOTS[this.chapter - 1] ?? CHAPTER_ROOTS[0];
    const patternIndex = this.bgmStep % BGM_PATTERN.length;
    const scaleDegree = BGM_PATTERN[patternIndex] ?? 0;
    const octave = scaleDegree < 0 ? -1 : patternIndex % 8 >= 4 ? 1 : 0;
    const interval = BGM_SCALE[((scaleDegree % BGM_SCALE.length) + BGM_SCALE.length) % BGM_SCALE.length] ?? 0;
    const frequency = root * Math.pow(2, (interval + octave * 12) / 12);
    const t = context.currentTime + 0.012;
    this.bgmNote(frequency, t, patternIndex % 4 === 0 ? 0.16 : 0.11);
    if (patternIndex % 8 === 0) {
      this.bgmNote(root / 2, t, 0.19, 0.025);
    }
    this.bgmStep += 1;
  }

  private bgmNote(frequency: number, start: number, duration: number, gain = 0.032): void {
    const context = this.context;
    const bgmGain = this.bgmGain;
    if (!context || !bgmGain) {
      return;
    }

    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(bgmGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const gameAudio = new GameAudio();

interface AudioCueSnapshot {
  stageId: number;
  level: number;
  eliteActive: boolean;
  floatingIds: Set<string>;
  dropIconIds: Set<string>;
  aliveMonsterIds: Set<string>;
}

export function createSimulationAudioObserver(): (simulation: SimulationState) => void {
  let previous: AudioCueSnapshot | null = null;

  return (simulation) => {
    const next = captureAudioSnapshot(simulation);
    const chapter = Math.max(1, Math.ceil(simulation.progress.currentStage / 10));
    gameAudio.setChapter(chapter);

    if (!previous) {
      previous = next;
      return;
    }

    if (next.stageId !== previous.stageId) {
      previous = next;
      return;
    }

    if (next.level > previous.level) {
      gameAudio.play("levelUp");
    }

    if (!previous.eliteActive && next.eliteActive) {
      gameAudio.play("summon");
    }

    if (hasNewFloatingDamage(simulation, previous.floatingIds)) {
      gameAudio.play("hit");
    }

    if (hasNewDropIcon(simulation, previous.dropIconIds)) {
      gameAudio.play("drop");
    }

    if (hasKilledMonster(previous.aliveMonsterIds, next.aliveMonsterIds)) {
      gameAudio.play("kill");
    }

    previous = next;
  };
}

function captureAudioSnapshot(simulation: SimulationState): AudioCueSnapshot {
  return {
    stageId: simulation.progress.currentStage,
    level: simulation.progress.level,
    eliteActive: Boolean(simulation.world.altarElite),
    floatingIds: new Set(simulation.world.floatingTexts.map((text) => text.id)),
    dropIconIds: new Set(simulation.world.dropIcons.map((icon) => icon.id)),
    aliveMonsterIds: new Set(simulation.world.monsters.filter((monster) => monster.alive).map((monster) => monster.instanceId)),
  };
}

function hasNewFloatingDamage(simulation: SimulationState, previousIds: Set<string>): boolean {
  return simulation.world.floatingTexts.some((text) => !previousIds.has(text.id) && /^\d+$/.test(text.value));
}

function hasNewDropIcon(simulation: SimulationState, previousIds: Set<string>): boolean {
  return simulation.world.dropIcons.some((icon) => !previousIds.has(icon.id));
}

function hasKilledMonster(previousIds: Set<string>, nextIds: Set<string>): boolean {
  for (const id of previousIds) {
    if (!nextIds.has(id)) {
      return true;
    }
  }
  return false;
}

function readMutedSetting(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(AUDIO_MUTED_KEY) === "1";
}

function writeMutedSetting(muted: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUDIO_MUTED_KEY, muted ? "1" : "0");
}
