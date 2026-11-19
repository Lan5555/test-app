import type { EnemySprite } from "./enemySprites";
import type { ArenaId } from "./arenaAssets";

const sprites: Record<string, EnemySprite> = {
  "ironbound-sentry": "gate-warden",
  "mourning-wisp": "hollow-specter",
  "rimefang-stalker": "echo-beast",
  bellkeeper: "gate-warden",
  "ashen-matriarch": "hollow-specter",
  "crownless-king": "gate-warden",
  "thorn-revenant": "gate-warden",
  "saltglass-oracle": "hollow-specter",
  "graveshell-colossus": "gate-warden",
  "mothveil-duchess": "hollow-specter",
  "cinder-jackal": "echo-beast",
  "tidebound-executioner": "gate-warden",
};

const originalRoster = new Set([
  "ironbound-sentry", "mourning-wisp", "rimefang-stalker", "bellkeeper", "ashen-matriarch", "crownless-king",
]);

const arenas: Partial<Record<string, ArenaId>> = {
  "mourning-wisp": "moonlit-observatory",
  "rimefang-stalker": "verdant-sanctum",
  bellkeeper: "ashen-cathedral",
  "ashen-matriarch": "ember-citadel",
  "crownless-king": "eclipse-throne",
  "thorn-revenant": "verdant-sanctum",
  "saltglass-oracle": "moonlit-observatory",
  "graveshell-colossus": "ashen-cathedral",
  "mothveil-duchess": "moonlit-observatory",
  "cinder-jackal": "ember-citadel",
  "tidebound-executioner": "eclipse-throne",
};

export function encounterArena(id: string) {
  return Object.hasOwn(arenas, id) ? arenas[id] : undefined;
}

export function encounterSprite(id: string | undefined) {
  return id && Object.hasOwn(sprites, id) ? sprites[id] : undefined;
}

export function encounterPortrait(id: string) {
  return encounterSprite(id) ? `/encounters/${id}.webp` : undefined;
}

export function encounterArtwork(id?: string) {
  return id && !originalRoster.has(id) ? encounterPortrait(id) : undefined;
}

export function encounterSound(id: string, cue: "entrance" | "attack") {
  return encounterSprite(id) ? `/encounters/audio/${id}-${cue}.wav` : undefined;
}
