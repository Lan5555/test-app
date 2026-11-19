const STANDARD_FIGHTERS = [
  "knight",
  "maiden",
  "warden",
  "duelist",
  "monk",
  "arcanist",
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
  return `/sprite/combat/${id}${preview ? "-preview" : ""}.webp`;
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
