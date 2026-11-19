import type { CSSProperties } from "react";
import atlas from "../data/combat-sprites.json";
import { baseFighter, fighterAtlasUrl, type Warrior } from "./warriorSelection";

export function adventureIdleStyle(fighter: Warrior): CSSProperties {
  const frames = atlas.frames[baseFighter(fighter)].idle;
  return {
    backgroundImage: `url("/sprite/combat/${fighter}-idle.webp")`,
    backgroundSize: `${frames * 100}% 100%`,
    "--row": "0%",
    "--last": "100%",
    "--frames": frames,
  } as CSSProperties;
}

export function adventureSpriteStyle(fighter: Warrior, motion: "run" | "idle"): CSSProperties {
  const base = baseFighter(fighter);
  const frames = atlas.frames[base][motion];
  const columns = atlas.fighterColumns[base];
  return {
    backgroundImage: `url("${fighterAtlasUrl(fighter)}")`,
    backgroundSize: `${columns * 100}% ${atlas.rows.length * 100}%`,
    "--row": `${atlas.rows.indexOf(motion) / (atlas.rows.length - 1) * 100}%`,
    "--last": `${(frames - 1) / (columns - 1) * 100}%`,
    "--frames": frames,
  } as CSSProperties;
}
