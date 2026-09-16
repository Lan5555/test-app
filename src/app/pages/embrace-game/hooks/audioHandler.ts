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
  private static BATTLE_SONG = "/assets/music/hell.mp3";
  private static BATTLE_SONG_2 = "/assets/music/nier.mp3";
  private static BOSS_SONG = "/assets/music/bestower.mp3";
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

  private static masterVolume = 0.8;
  public static cutSceneVolume = 0.4;
  private static musicVolume = 0.65;
  private static sfxVolume = 0.75;
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
  // Generates either 0 or 1
  const randomIndex = Math.floor(Math.random() * 2); 
  
  if (randomIndex === 0) {
    this.playTrack(this.BATTLE_SONG);
  } else {
    this.playTrack(this.BATTLE_SONG_2);
  }
}

  static playBossSSong() {
    this.playTrack(this.DISTURBANCE);
  }

  static playFinalBossSong() {
    this.playTrack(this.BATTLE_SONG);
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

  static playBossVoice() {
    const voices = this.createVoiceString(6);
    const index = Math.floor(Math.random() * voices.length);

    this.playOneShot(voices[index]);
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

  private static async playTrack(src: string) {
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

      const audio = new Audio(src);

      audio.loop = true;

      audio.volume =
        this.musicVolume *
        this.masterVolume *
        (this.muted ? 0 : 1);

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

  static async playLightningEffect(){
    this.playOneShot(this.LIGHTENING_SOUND);
  }

  static async playOneShot(src: string) {
    const now = Date.now();
    const last = this.lastSfxTime.get(src) ?? 0;

    if (now - last < 60) {
      return;
    }

    this.lastSfxTime.set(src, now);

    const sfx = new Audio(src);

    sfx.volume =
      this.sfxVolume *
      this.masterVolume *
      (this.muted ? 0 : 1);

    sfx.play().catch(() => {});
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
  }

  static setMuted(muted: boolean) {
    this.muted = muted;

    this.applyVolumes();
  }

  private static applyVolumes() {
    if (!this.currentSong) return;

    this.currentSong.volume =
      this.musicVolume *
      this.masterVolume *
      (this.muted ? 0 : 1);
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