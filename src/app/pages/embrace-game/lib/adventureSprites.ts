import type { CSSProperties } from "react";
import atlas from "../data/combat-sprites.json";
import { baseFighter, fighterAtlasUrl, fighterIdleSprite, veteranAtlas, type Warrior } from "./warriorSelection";

export function adventureIdleStyle(fighter: Warrior): CSSProperties {
  const { src, frames } = fighterIdleSprite(fighter);
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: `${frames * 100}% 100%`,
    "--row": "0%",
    "--last": "100%",
    "--frames": frames,
  } as CSSProperties;
}

export function adventureSpriteStyle(fighter: Warrior, motion: "run" | "idle"): CSSProperties {
  const base = baseFighter(fighter);
  const veteran = veteranAtlas(fighter);
  const frames = veteran?.frames[motion] ?? atlas.frames[base][motion];
  const columns = veteran?.columns ?? atlas.fighterColumns[base];
  const rows = veteran?.rows ?? atlas.rows;
  return {
    backgroundImage: `url("${fighterAtlasUrl(fighter)}")`,
    backgroundSize: `${columns * 100}% ${rows.length * 100}%`,
    "--row": `${rows.indexOf(motion) / (rows.length - 1) * 100}%`,
    "--last": `${(frames - 1) / (columns - 1) * 100}%`,
    "--frames": frames,
  } as CSSProperties;
}
