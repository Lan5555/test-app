import type { CombatAnimation } from "./combatPresentation";

export const LIMIT_RECOIL_DURATION = 620;

export const ATTACK_TIMING: Record<
  CombatAnimation,
  { run: number; contact: number; total: number }
> = {
  attack1: { run: 120, contact: 300, total: 480 },
  attack2: { run: 145, contact: 369, total: 593 },
  attack3: { run: 155, contact: 410, total: 870 },
  jump: { run: 115, contact: 423, total: 731 },
  cast: { run: 0, contact: 240, total: 480 },
  heal: { run: 0, contact: 290, total: 580 },
};
