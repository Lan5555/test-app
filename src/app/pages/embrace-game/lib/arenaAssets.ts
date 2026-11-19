import type { Battle } from "../types/game";
import { encounterArena } from "./encounterAssets";

export const ARENAS = [
  { id: "moonlit-observatory", name: "Moonlit Observatory" },
  { id: "ember-citadel", name: "Ember Citadel" },
  { id: "verdant-sanctum", name: "Verdant Sanctum" },
  { id: "ashen-cathedral", name: "Ashen Cathedral" },
  { id: "eclipse-throne", name: "Eclipse Throne" },
] as const;

export type ArenaId = (typeof ARENAS)[number]["id"];

export const FINAL_BOSS_MUSIC = "/assets/music/bestower.mp3";

export function findArena(id?: ArenaId) {
  return ARENAS.find((arena) => arena.id === id);
}

export function isNicholasBattle(battle: Battle | undefined) {
  return battle?.mode === "cpu" && Boolean(battle.enemyName?.toUpperCase().includes("NICHOLAS"));
}

export function isNicholasFinalForm(battle: Battle) {
  return (
    battle.mode === "cpu" &&
    /^NICHOLAS JOHNSON\s*[-\u2013\u2014]\s*FINAL FORM$/i.test(battle.enemyName?.trim() ?? "")
  );
}

export function battleBackdrop(battle: Battle, arenaId?: ArenaId): ArenaId | undefined {
  if (isNicholasFinalForm(battle)) return "eclipse-throne";
  if (battle.mode === "cpu" && battle.encounterId) {
    const stage = encounterArena(battle.encounterId);
    if (stage) return stage;
  }
  const arena = findArena(arenaId);
  if (arena) return arena.id;
  if (battle.mode === "cpu" && !isNicholasBattle(battle)) return "ashen-cathedral";
}

export function arenaImage(id: ArenaId, preview = false) {
  return `/arenas/${id}${preview ? "-preview" : ""}.webp`;
}

const ARENA_MUSIC: Record<ArenaId, string> = {
  "moonlit-observatory": "/arenas/audio/Alien.mp3",
  "ember-citadel": "/assets/music/hell.mp3",
  "verdant-sanctum": "/arenas/audio/shiku.mp3",
  "ashen-cathedral": "/assets/music/nier.mp3",
  "eclipse-throne": "/arenas/audio/Rings.mp3",
};

export function arenaMusic(id: ArenaId) {
  return ARENA_MUSIC[id];
}

export const ARENA_SOUNDS = {
  select: "/arenas/audio/fighter-select.wav",
  impact: "/arenas/audio/arena-impact.wav",
  break: "/arenas/audio/arena-break.wav",
};

export const SUMMON_SOUNDS = {
  portal: "/arenas/audio/summon-portal.wav",
  strike: "/arenas/audio/summon-strike.wav",
  charge: "/arenas/audio/summon-charge.wav",
  burst: "/arenas/audio/summon-burst.wav",
  reveal: "/arenas/audio/summon-reveal.wav",
  legendary: "/arenas/audio/summon-legendary.wav",
} as const;

export const SUMMON_REVEAL_DELAY = 280;

const images = new Map<string, Promise<void>>();
const audio = new Map<string, HTMLAudioElement>();

export function preloadArenaImage(src: string) {
  const existing = images.get(src);
  if (existing) return existing;
  const ready = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.decode().then(resolve, reject);
  }).catch(() => {
    images.delete(src);
  });
  images.set(src, ready);
  return ready;
}

export function preloadArenaAudio(src: string, preload: "auto" | "metadata" | "none" = "auto") {
  const existing = audio.get(src);
  if (existing) return existing;
  const track = new Audio();
  track.preload = preload;
  track.addEventListener("error", () => audio.delete(src), { once: true });
  audio.set(src, track);
  track.src = src;
  return track;
}

export function preloadArena(id: ArenaId, music = arenaMusic(id)) {
  if (shouldPreloadOptionalMedia()) preloadArenaAudio(music, "metadata");
  for (const sound of Object.values(ARENA_SOUNDS)) preloadArenaAudio(sound);
  preloadArenaAudio(SUMMON_SOUNDS.portal);
  preloadArenaAudio(SUMMON_SOUNDS.strike);
  return preloadArenaImage(arenaImage(id));
}

export function shouldPreloadOptionalMedia() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !connection?.saveData && connection?.effectiveType !== "2g" && connection?.effectiveType !== "slow-2g";
}
