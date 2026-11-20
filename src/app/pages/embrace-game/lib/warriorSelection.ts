import combatSprites from "../data/combat-sprites.json";
import veteranSprites from "../data/veteran-sprites.json";

const STANDARD_FIGHTERS = [
  "knight",
  "maiden",
  "warden",
  "duelist",
  "monk",
  "arcanist",
  "lady-ley",
  "grave-chorister",
] as const;
export const FEATURED_FIGHTERS = {
  "ember-duelist": { name: "Ember Duelist", base: "duelist" },
  "eclipse-arcanist": { name: "Eclipse Arcanist", base: "arcanist" },
} as const;
export type FeaturedFighter = keyof typeof FEATURED_FIGHTERS;
type StandardFighter = (typeof STANDARD_FIGHTERS)[number];
export const WARRIORS = [
  ...STANDARD_FIGHTERS,
  ...(Object.keys(FEATURED_FIGHTERS) as FeaturedFighter[]),
] as const;
export type Warrior = (typeof WARRIORS)[number];
type VeteranAnimation = "idle" | "run" | "attack1" | "attack2" | "attack3" | "hurt" | "death" | "cast" | "heal" | "jump" | "flip";
const veteranFrames = veteranSprites.frames as Partial<Record<Warrior, Record<VeteranAnimation, number>>>;

export function veteranAtlas(id: Warrior) {
  const frames = veteranFrames[id];
  if (frames) return { ...veteranSprites, frames };
}

export function isFeaturedFighter(id: string): id is FeaturedFighter {
  return Object.hasOwn(FEATURED_FIGHTERS, id);
}

export function baseFighter(id: Warrior): StandardFighter {
  return isFeaturedFighter(id) ? FEATURED_FIGHTERS[id].base : id;
}

export function fighterArtwork(id: FeaturedFighter) {
  return `/forge/${id}.webp`;
}

export function fighterAtlasUrl(id: Warrior, preview = false) {
  return `/sprite/combat/${fighterSpriteId(id)}${preview ? "-preview" : ""}.webp`;
}

export function fighterSpriteId(id: Warrior) {
  return veteranFrames[id] ? `${id}-hd` : id;
}

export function fighterIdleSprite(id: Warrior) {
  return {
    src: `/sprite/combat/${fighterSpriteId(id)}-idle.webp`,
    frames: veteranFrames[id]?.idle ?? combatSprites.frames[baseFighter(id)].idle,
  };
}

const STORAGE_KEY = "embrace-combat-warrior";

export function readWarriorSelection(): Warrior | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return STANDARD_FIGHTERS.find((warrior) => warrior === value);
  } catch {
    return undefined;
  }
}

export function saveWarriorSelection(warrior: Warrior) {
  try {
    window.localStorage.setItem(STORAGE_KEY, warrior);
    return true;
  } catch {
    return false;
  }
}
