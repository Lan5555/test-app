import { ARENA_SOUNDS, FINAL_BOSS_MUSIC, SUMMON_SOUNDS, arenaMusic, battleBackdrop, isNicholasBattle, isNicholasFinalForm, preloadArenaAudio, type ArenaId } from "../lib/arenaAssets";
import type { CombatImpact } from "../lib/combatPresentation";
import type { Battle } from "../types/game";
import type { Warrior } from "../lib/warriorSelection";
import { encounterSound } from "../lib/encounterAssets";
import fighterVoiceAssets from "../data/fighter-voice-assets.json";
import { AdventureSoundscape } from "../lib/adventureSoundscape";

export type FighterVoice = "attack" | "hit" | "defeat" | "taunt";
export const DEFAULT_GAME_VOLUME = { master: 80, music: 65, effects: 75 } as const;
const VOICE_BOOST = 1.65;
const VOICE_QUEUE_LIMIT = 3;
const VOICE_MAX_QUEUE_AGE_MS = 1400;
const AUDIO_START_TIMEOUT_MS = 2500;
const ACTIVE_EFFECT_LIMIT = 8;
const COMBAT_EFFECTS = {
  break: "/arenas/audio/combat-break.mp3",
  guard: "/arenas/audio/combat-guard.mp3",
  evade: "/arenas/audio/combat-evade.mp3",
  summon: "/arenas/audio/combat-summon.mp3",
} as const;
const installedCombatVoices = new Set<string>(fighterVoiceAssets);

export class AudioController {
  private static currentSong: HTMLAudioElement | null = null;
  private static currentSrc: string | null = null;

  private static MENU_SRC = "/assets/music/main.mp3";
  private static FOREST_SRC = "/assets/music/forest.mp3";
  private static FOREST_SRC_2 = "/assets/music/main2.mp3";
  private static DISTURBANCE = "/assets/music/disturbance.mp3";
  private static HOPE = "/assets/music/hope.mp3";
  private static SHADOWLORD = "/assets/music/shadow-lord.mp3";
  private static FOREST_SRC_3 = "/assets/music/forest3.mp3";

  private static CLICK_SRC = "/assets/music/click.mp3";
  private static BATTLE_SONGS = [
    arenaMusic("ember-citadel"),
    arenaMusic("ashen-cathedral"),
    arenaMusic("eclipse-throne"),
  ];
  private static SLASH_SOUND = "/assets/music/slash.mp3";
  private static SHATTER_SOUND = "/assets/music/shatter.mp3";
  private static IMPACT_SOUND = "/assets/music/impact.mp3";
  private static HEAL_SOUND = "/assets/music/heal.mp3";
  private static GAMEOVER_SOUND = "/assets/music/gameOver.mp3";
  private static FIRE_SOUND = "/assets/music/fire.mp3";
  private static LIGHTENING_SOUND = "/audio/over/lightning.mp3";

  private static callCount = 0;
  private static playRequestId = 0;
  private static pendingSrc: string | null = null;
  private static lastSfxTime: Map<string, number> = new Map();
  private static activeSfx = new Map<string, () => void>();
  private static adventureSoundscape = new AdventureSoundscape((channel) =>
    channel === "music" ? AudioController.musicGain() : AudioController.effectGain(1));
  private static combatVoice: HTMLAudioElement | null = null;
  private static stopVoice: (() => void) | null = null;
  private static combatVoiceQueue: { clip: string; action: boolean; queuedAt: number }[] = [];

  private static masterVolume = DEFAULT_GAME_VOLUME.master / 100;
  public static cutSceneVolume = 0.65;
  private static musicVolume = DEFAULT_GAME_VOLUME.music / 100;
  private static sfxVolume = DEFAULT_GAME_VOLUME.effects / 100;
  private static muted = false;

  static playMenuSong() {
    if (
      this.currentSrc === this.MENU_SRC &&
      this.currentSong &&
      !this.currentSong.paused
    ) {
      return;
    }

    this.playTrack(this.MENU_SRC);
  }

  static playInitialMusicOnLoad() {
    if (!this.currentSong?.paused) {
      this.currentSong?.pause();
    }

    this.playTrack(this.FOREST_SRC);
  }

  static currentIndex: number = 0;

  static playGameSong() {
    const songs = [
      this.HOPE,
      this.FOREST_SRC_3,
      this.FOREST_SRC_2,
      this.SHADOWLORD,
    ].filter(Boolean);

    if (songs.length === 0) {
      this.playTrack(this.FOREST_SRC);
      return;
    }

    if (this.currentIndex >= songs.length) {
      this.currentIndex = 0;
    }

    this.playTrack(songs[this.currentIndex]);
    this.currentIndex++;
  }

  static playBattleSong() {
    const index = Math.floor(Math.random() * this.BATTLE_SONGS.length);
    void this.playTrack(this.BATTLE_SONGS[index]);
  }

  static playEncounterSong(battle: Battle, arenaId?: ArenaId) {
    const source = this.encounterMusic(battle, arenaId);
    const preloaded = source === FINAL_BOSS_MUSIC ||
      (source !== this.DISTURBANCE && Boolean(battleBackdrop(battle, arenaId)));
    void this.playTrack(source, preloaded);
  }

  static encounterMusic(battle: Battle, arenaId?: ArenaId) {
    if (isNicholasFinalForm(battle) || (battle.mode === "cpu" && battle.encounterId === "crownless-king")) return FINAL_BOSS_MUSIC;
    if (isNicholasBattle(battle)) return this.DISTURBANCE;
    const backdrop = battleBackdrop(battle, arenaId);
    if (backdrop) return arenaMusic(backdrop);
    const index = Array.from(battle.id).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) % this.BATTLE_SONGS.length,
      0,
    );
    return this.BATTLE_SONGS[index];
  }

  static playFighterSelect() {
    return this.playOneShot(ARENA_SOUNDS.select, 0.52);
  }

  static playSummonEffect(cue: keyof typeof SUMMON_SOUNDS) {
    return this.playOneShot(cue === "portal" ? COMBAT_EFFECTS.summon : SUMMON_SOUNDS[cue], 0.75);
  }

  static playEncounterEnemy(id: string, cue: "entrance" | "attack") {
    const src = encounterSound(id, cue);
    if (src) return this.playOneShot(src, cue === "entrance" ? 0.85 : 0.6);
  }

  static playFighterVoice(fighter: Warrior, cue: FighterVoice) {
    if ((fighter === "lady-ley" || fighter === "grave-chorister") && !installedCombatVoices.has(`${fighter}/${cue}`)) return;
    const gain = cue === "attack" ? 0.5 : 0.85;
    return this.playOneShot(`/audio/fighters/${fighter}/${cue}.wav`, gain * VOICE_BOOST);
  }

  static playCombatVoice(fighter: Warrior, cue: string, fallback?: FighterVoice | "heal") {
    if (this.muted || this.masterVolume === 0 || this.sfxVolume === 0) return;
    const clip = `${fighter}/${cue}`;
    if ((fighter === "lady-ley" || fighter === "grave-chorister") && !installedCombatVoices.has(clip)) return;
    if (installedCombatVoices.has(clip)) {
      const action = fallback === "attack" || fallback === "heal";
      if (this.combatVoiceQueue.some((entry) => entry.clip === clip)) return;
      const entry = { clip, action, queuedAt: performance.now() };
      const firstReaction = action ? this.combatVoiceQueue.findIndex((entry) => !entry.action) : -1;
      if (firstReaction < 0) this.combatVoiceQueue.push(entry);
      else this.combatVoiceQueue.splice(firstReaction, 0, entry);
      if (this.combatVoiceQueue.length > VOICE_QUEUE_LIMIT) this.combatVoiceQueue.pop();
      this.playNextCombatVoice();
    } else if (fallback === "heal") {
      if (cue !== "heal") this.playCombatVoice(fighter, "heal", "heal");
    } else if (fallback) {
      void this.playFighterVoice(fighter, fallback);
    }
  }

  private static playNextCombatVoice() {
    if (this.combatVoice) return;
    const now = performance.now();
    this.combatVoiceQueue = this.combatVoiceQueue.filter(
      ({ queuedAt }) => now - queuedAt <= VOICE_MAX_QUEUE_AGE_MS,
    );
    const entry = this.combatVoiceQueue.shift();
    if (!entry) return;
    const { clip } = entry;
    const audio = new Audio(`/audio/fighters/${clip}.wav`);
    audio.volume = this.effectGain(VOICE_BOOST);
    this.combatVoice = audio;
    const finish = () => {
      clearTimeout(startTimeout);
      if (this.combatVoice !== audio) return;
      this.combatVoice = null;
      this.stopVoice = null;
      audio.pause();
      this.playNextCombatVoice();
    };
    const startTimeout = setTimeout(finish, AUDIO_START_TIMEOUT_MS);
    this.stopVoice = finish;
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.addEventListener("stalled", finish, { once: true });
    void audio.play().then(() => clearTimeout(startTimeout), finish);
  }

  static stopCombatVoices() {
    this.combatVoiceQueue.length = 0;
    this.stopVoice?.();
  }

  static playArenaImpact(kind: CombatImpact["kind"]) {
    if (kind === "break") return this.playOneShot(ARENA_SOUNDS.break, 0.38);
    if (kind === "hit" || kind === "heavy") return this.playOneShot(ARENA_SOUNDS.impact, kind === "heavy" ? 0.45 : 0.22);
  }

  static playBossSSong() {
    this.playTrack(this.DISTURBANCE);
  }

  static playFinalBossSong() {
    void this.playTrack(FINAL_BOSS_MUSIC, true);
  }

  static playWatchThemeSong(){
    this.playTrack(this.FOREST_SRC_3);
  }


  static playSlashSong() {
    this.playOneShot(this.SLASH_SOUND);
  }

  static playShatterSound() {
    this.playOneShot(this.SHATTER_SOUND);
  }

  static playImpactSound() {
    this.playOneShot(this.IMPACT_SOUND);
  }

  static playHealSound() {
    this.playOneShot(this.HEAL_SOUND);
  }

  static playGameOverSound() {
    this.playOneShot(this.GAMEOVER_SOUND);
  }

  static playFireSound() {
    this.playOneShot(this.FIRE_SOUND);
  }

  static playCombatImpact(kind: CombatImpact["kind"]) {
    switch (kind) {
      case "hit":
      case "heavy":
        return this.playOneShot(this.SLASH_SOUND, kind === "heavy" ? 0.75 : 0.66, 1, true);
      case "break":
        return this.playOneShot(COMBAT_EFFECTS.break, 0.72);
      case "heal":
        return this.playOneShot(this.HEAL_SOUND, 0.62);
      case "guard":
        return this.playOneShot(COMBAT_EFFECTS.guard, 0.62);
      case "evade":
        return this.playOneShot(COMBAT_EFFECTS.evade, 0.49);
    }
  }

  static playBossVoice() {
    const voices = this.createVoiceString(6);
    const index = Math.floor(Math.random() * voices.length);

    this.playOneShot(voices[index], VOICE_BOOST);
  }

  static createVoiceString(LENGTH: number): string[] {
    const stringVal = "voice";
    const audioFiles: string[] = [];

    for (let index = 0; index < LENGTH; index++) {
      const generated = `/audio/over/${stringVal} (${index}).mp3`;
      audioFiles.push(generated);
    }

    return audioFiles;
  }

  private static async playTrack(src: string, preloaded = false) {
    if (
      this.currentSrc === src &&
      this.currentSong &&
      !this.currentSong.paused
    ) {
      return;
    }

    if (this.pendingSrc === src) {
      return;
    }

    const requestId = ++this.playRequestId;
    this.pendingSrc = src;

    if (this.currentSong) {
      this.currentSong.pause();
      this.currentSong.currentTime = 0;
      this.currentSong = null;
    }

    try {
      if (requestId !== this.playRequestId) {
        return;
      }

      const audio = preloaded ? preloadArenaAudio(src, "none") : new Audio(src);

      audio.loop = true;

      audio.volume = this.musicGain();

      this.currentSong = audio;
      this.currentSrc = src;
      this.pendingSrc = null;

      audio.play().catch((err) => {
        console.log(
          "[audio] Playback blocked until user interaction:",
          err
        );
      });
    } catch (err) {
      if (requestId === this.playRequestId) {
        this.pendingSrc = null;
      }

      console.error("[audio] Error playing track:", err);
    }
  }

  static async playerHoverAndClickSound() {
    this.playOneShot(this.CLICK_SRC);
  }

  static playLightningEffect(gain = 1) {
    return this.playOneShot(this.LIGHTENING_SOUND, gain);
  }

  static playAdventureSoundscape(music: string, ambience: string, indoors: boolean) {
    this.pause();
    this.adventureSoundscape.play(music, ambience, indoors);
  }

  static stopAdventureSoundscape() {
    this.adventureSoundscape.stop();
  }

  static playAdventureEffect(cue: "door" | "chest") {
    return this.playOneShot(`/adventure/audio/${cue}.wav`, 0.8);
  }

  static async playOneShot(src: string, gain = 1, playbackRate = 1, restart = false) {
    const active = this.activeSfx.get(src);
    if (!this.effectGain(gain) || (active && !restart) || (!active && this.activeSfx.size >= ACTIVE_EFFECT_LIMIT)) return;
    const now = Date.now();
    const last = this.lastSfxTime.get(src) ?? 0;

    if (now - last < 60) {
      return;
    }

    active?.();
    this.lastSfxTime.set(src, now);

    const sfx = src.startsWith("/arenas/audio/")
      ? preloadArenaAudio(src).cloneNode() as HTMLAudioElement
      : new Audio(src);
    sfx.playbackRate = playbackRate;

    sfx.volume = this.effectGain(gain);

    const release = () => {
      clearTimeout(startTimeout);
      if (this.activeSfx.get(src) !== stop) return;
      this.activeSfx.delete(src);
      sfx.removeEventListener("ended", release);
      sfx.removeEventListener("error", release);
      sfx.removeEventListener("pause", release);
      sfx.removeEventListener("stalled", stop);
    };
    const stop = () => {
      release();
      sfx.pause();
    };
    const startTimeout = setTimeout(stop, AUDIO_START_TIMEOUT_MS);
    this.activeSfx.set(src, stop);
    sfx.addEventListener("ended", release);
    sfx.addEventListener("error", release);
    sfx.addEventListener("pause", release);
    sfx.addEventListener("stalled", stop, { once: true });
    void sfx.play().then(() => clearTimeout(startTimeout), release);
  }

  static stopSoundEffects() {
    this.stopCombatVoices();
    this.activeSfx.forEach((stop) => stop());
  }

  static setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v / 100));

    this.applyVolumes();
  }

  static setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v / 100));

    this.applyVolumes();
  }

  static setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v / 100));
    this.applyVolumes();
  }

  static setMuted(muted: boolean) {
    this.muted = muted;

    this.applyVolumes();
  }

  private static applyVolumes() {
    if (this.currentSong) this.currentSong.volume = this.musicGain();
    this.adventureSoundscape.updateVolumes();
    if (this.muted || this.masterVolume === 0 || this.sfxVolume === 0) {
      this.stopCombatVoices();
    } else if (this.combatVoice) {
      this.combatVoice.volume = this.effectGain(VOICE_BOOST);
    }
  }

  static musicGain() {
    return this.muted ? 0 : this.musicVolume * this.masterVolume;
  }

  private static effectGain(gain: number) {
    return this.muted ? 0 : Math.min(1, this.masterVolume * this.sfxVolume * gain);
  }

  static cutsceneGain() {
    return this.muted ? 0 : this.cutSceneVolume * this.masterVolume;
  }

  static initAutoMute() {
    document.addEventListener("visibilitychange", () => {
      if (!this.currentSong) return;

      if (document.hidden) {
        this.currentSong.volume = 0;
      } else {
        this.applyVolumes();
      }
    });
  }

  static makeFullScreen() {
    const element = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => {});
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen().catch(() => {});
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen().catch(() => {});
    }
  }

  static initOnFirstClick() {
    const startApp = () => {
      this.makeFullScreen();
      this.playMenuSong();
      this.initAutoMute();

      window.removeEventListener("click", startApp);
    };

    window.addEventListener("click", startApp);
  }

  static pause() {
    this.currentSong?.pause();
  }

  static resume() {
    this.currentSong?.play().catch(() => {});
  }
}
