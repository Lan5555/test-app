import { shouldPreloadOptionalMedia } from "./arenaAssets";
import type { Warrior } from "./warriorSelection";

export const CINEMATICS = {
  limit: { name: "Limit Break", duration: 1900 },
  "blood-rage": { name: "Blood Rage", duration: 800, contact: 510, src: "/gif/blood-rage.gif" },
  "void-blast": { name: "Void Blast", duration: 800, contact: 510, src: "/gif/void-blast.gif" },
} as const;

export type CinematicMove = keyof typeof CINEMATICS;
type CinematicSkill = Exclude<CinematicMove, "limit">;

const fighterClips: Partial<Record<Warrior, CinematicSkill>> = {
  knight: "blood-rage",
  arcanist: "void-blast",
};

export function skillCinematic(skillName: string | undefined, fighter?: Warrior) {
  const clip = fighter && fighterClips[fighter];
  if (clip && skillName === CINEMATICS[clip].name.toLowerCase()) return clip;
}

export function cinematicClip(move: CinematicMove, fighter?: Warrior, format: "webp" | "gif" = "webp") {
  return move === "limit"
    ? fighter && `/gif/limit-break/${fighter}.${format}?duration=${CINEMATICS.limit.duration}`
    : CINEMATICS[move].src;
}

const clips = new Map<string, Promise<Blob | undefined>>();

export function loadCinematicClip(src: string) {
  const cached = clips.get(src);
  if (cached) return cached;
  const request = fetch(src).then((response) => {
    if (!response.ok) throw new Error("Could not load combat animation");
    return response.blob();
  }).catch(() => {
    clips.delete(src);
    return undefined;
  });
  clips.set(src, request);
  return request;
}

export function preloadFighterCinematics(fighter: Warrior) {
  if (!shouldPreloadOptionalMedia() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const limit = cinematicClip("limit", fighter);
  if (limit) void loadCinematicClip(limit);
  const skill = fighterClips[fighter];
  if (skill) void loadCinematicClip(CINEMATICS[skill].src);
}
