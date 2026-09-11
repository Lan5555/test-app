export class AudioController {
  private static currentSong: HTMLAudioElement | null = null;
  private static currentSrc: string | null = null;

  private static MENU_SRC = "/assets/music/main.mp3";
  private static FOREST_SRC = "/assets/music/forest.mp3";
  private static FOREST_SRC_2 = "/assets/music/main2.mp3";
  private static CLICK_SRC = "/assets/music/click.mp3";
  private static BATTLE_SONG = "/assets/music/hell.mp3";
  private static BOSS_SONG = "/assets/music/bestower.mp3";
  private static SLASH_SOUND = "/assets/music/slash.mp3";
  private static SHATTER_SOUND = "/assets/music/shatter.mp3";
  private static IMPACT_SOUND = "/assets/music/impact.mp3";
  private static HEAL_SOUND = "/assets/music/heal.mp3";
  private static GAMEOVER_SOUND = "/assets/music/gameOver.mp3";
  private static FIRE_SOUND = "/assets/music/fire.mp3";

  private static callCount = 0;

  // Cache to store converted Blob URLs so IDM cannot intercept them
  private static blobCache: Map<string, string> = new Map();

  private static masterVolume = 0.8; 
  private static musicVolume = 0.65;
  private static sfxVolume = 0.75;
  private static muted = false;

  /** Resolves a standard path into a safe Blob URL to bypass IDM */
  private static async getSafeSrc(src: string): Promise<string> {
    if (this.blobCache.has(src)) {
      return this.blobCache.get(src)!;
    }
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Failed to fetch audio: ${src}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.blobCache.set(src, blobUrl);
      return blobUrl;
    } catch (err) {
      console.error("[audio-safe] Error converting audio to blob, falling back to original path:", err);
      return src; // Fallback to direct path if fetch fails
    }
  }

  static playMenuSong() {
    
    if(this.callCount === 0){
    this.playTrack(this.MENU_SRC);
    }else{
      this.playTrack(this.FOREST_SRC_2);
    }
    this.callCount++;
  }

  static playGameSong() {
    this.playTrack(this.FOREST_SRC);
  }

  static playBattleSong() {
    this.playTrack(this.BATTLE_SONG);
  }
  static playBossSSong() {
    this.playTrack(this.BOSS_SONG);
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

  private static async playTrack(src: string) {
    if (this.currentSrc === src && this.currentSong && !this.currentSong.paused) {
      return;
    }

    if (this.currentSong) {
      this.currentSong.pause();
      this.currentSong.currentTime = 0;
    }

    // Convert to direct browser-memory pointer before creating Audio node
    const safeSrc = await this.getSafeSrc(src);
    const audio = new Audio(safeSrc);
    audio.loop = true;
    audio.volume = this.musicVolume * this.masterVolume * (this.muted ? 0 : 1);

    this.currentSong = audio;
    this.currentSrc = src;

    audio.play().catch((err) => {
      console.log("[audio] playback blocked until user interaction:", err);
    });
  }

  static async playerHoverAndClickSound() {
    const safeSrc = await this.getSafeSrc(this.CLICK_SRC);
    const sfx = new Audio(safeSrc);
    sfx.volume = this.sfxVolume * this.masterVolume * (this.muted ? 0 : 1);
    sfx.play().catch(() => {});
  }

  static async playOneShot(src: string) {
    const safeSrc = await this.getSafeSrc(src);
    const sfx = new Audio(safeSrc);
    sfx.volume = this.sfxVolume * this.masterVolume * (this.muted ? 0 : 1);
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
      this.musicVolume * this.masterVolume * (this.muted ? 0 : 1);
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
