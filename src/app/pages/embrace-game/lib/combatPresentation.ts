import type { Battle, Player, StatusEffect, StatusId } from "../types/game";
import { type CinematicMove, skillCinematic } from "./combatCinematics";
import type { Warrior } from "./warriorSelection";

export const CPU_COMBATANT_ID = "cpu";
export const companionActorId = (ownerId: string, skillId: string) =>
  `companion:${ownerId}:${skillId}`;

export type CombatImpactKind =
  | "hit"
  | "heavy"
  | "heal"
  | "break"
  | "guard"
  | "evade";
export type CombatSide = "left" | "right" | "center";
type CombatFlair = "crit" | "boss" | "limit" | "arcane" | "flame";
export type LightningKind =
  | "heavy"
  | "crit"
  | "boss"
  | "break"
  | "limit"
  | "arcane";

export interface CombatImpact {
  side: CombatSide;
  kind: CombatImpactKind;
  actorId?: string;
  actor?: string;
  value?: number;
  flair?: CombatFlair;
  knockback?: boolean;
  defeated?: boolean;
}

export interface CombatCue {
  flair?: CombatFlair;
  targetId?: string;
  knockback?: boolean;
}

export type AttackAnimation = "attack1" | "attack2" | "attack3" | "jump";
export type CombatAnimation = AttackAnimation | "cast" | "heal";

export interface CombatAttack {
  actorId: string;
  animation: CombatAnimation;
  cinematic?: CinematicMove;
  companionStrike?: number;
  enemySummon?: boolean;
  voiceCue?: string;
  silentVoice?: boolean;
}

export interface CombatVoice {
  actorId: string;
  fighter: Warrior;
  cue: string;
}

const BUFF_VOICE_CUES: Partial<Record<StatusId, string>> = {
  evading: "buff-evading",
  enraged: "buff-enraged",
  blessed: "buff-blessed",
};

function moveVoiceCue(move: string) {
  return move.replaceAll(" ", "-");
}

const FLAIR_PRIORITY = {
  flame: 5,
  arcane: 6,
  crit: 7,
  boss: 9,
  limit: 10,
} as const;
const IMPACT_PRIORITY = {
  evade: 1,
  guard: 4,
  heal: 2,
  hit: 3,
  heavy: 5,
  break: 8,
} as const;

export function strongestImpact<T extends CombatImpact>(impacts: readonly T[]) {
  let strongest: T | undefined;
  let priority = 0;
  for (const impact of impacts) {
    const score = impact.flair
      ? FLAIR_PRIORITY[impact.flair]
      : IMPACT_PRIORITY[impact.kind];
    if (score >= priority) {
      strongest = impact;
      priority = score;
    }
  }
  return strongest;
}

export function getImpactLightning({
  kind,
  flair,
}: CombatImpact): LightningKind | undefined {
  if (flair && flair !== "flame") return flair;
  if (kind === "break" || kind === "heavy") return kind;
}

interface Combatant {
  name: string;
  hp: number;
  broken: boolean;
  side: Exclude<CombatSide, "center">;
  fighterId?: Warrior;
  voiceFighterId?: Warrior;
  encounterId?: string;
  companions?: NonNullable<Player["companion"]>[];
  buffs?: readonly StatusEffect[];
}

export interface CombatFrame {
  battleId: string;
  log: readonly string[];
  combatants: Map<string, Combatant>;
}

export function captureCombatFrame(
  battle: Battle,
  allies: readonly Player[],
  opponents: readonly Player[],
): CombatFrame {
  const combatants = new Map<string, Combatant>();

  function add(players: readonly Player[], side: Combatant["side"]) {
    for (const player of players) {
      combatants.set(player.id, {
        name: player.name,
        hp: player.hp,
        fighterId: player.fighterId,
        voiceFighterId: player.fighterId ?? "knight",
        companions:
          player.status === "alive"
            ? [player.companion, player.secondaryCompanion].filter(
                (companion) => companion !== undefined,
              )
            : undefined,
        buffs:
          player.status === "alive"
            ? player.statusEffects?.filter(({ id }) =>
                Object.hasOwn(BUFF_VOICE_CUES, id),
              )
            : undefined,
        broken:
          player.statusEffects?.some((status) => status.id === "immobilized") ??
          false,
        side,
      });
    }
  }

  add(allies, "left");
  add(opponents, "right");

  if (battle.mode === "cpu") {
    for (const enemy of battle.enemyUnits ?? [battle]) {
      combatants.set(battle.enemyUnits ? enemy.id : CPU_COMBATANT_ID, {
        name: enemy.enemyName,
        hp: enemy.enemyHp,
        encounterId: enemy.encounterId,
        broken:
          enemy.enemyStatusEffects?.some(({ id }) => id === "immobilized") ??
          false,
        side: "right",
      });
    }
  }

  return { battleId: battle.id, log: battle.log, combatants };
}

export function getBuffVoices(current: CombatFrame, previous?: CombatFrame) {
  const voices: CombatVoice[] = [];
  for (const [id, { voiceFighterId, buffs }] of current.combatants) {
    if (!voiceFighterId || !buffs?.length) continue;
    const before = previous?.combatants.get(id)?.buffs;
    for (const { id: status, turns } of buffs) {
      const cue = BUFF_VOICE_CUES[status];
      // A countdown or another render keeps the same buff. A refresh can extend it.
      if (
        cue &&
        turns > (before?.find(({ id }) => id === status)?.turns ?? 0)
      ) {
        voices.push({ actorId: id, fighter: voiceFighterId, cue });
      }
    }
  }
  return voices;
}

function addedLogLines(
  previous: readonly string[],
  current: readonly string[],
) {
  if (previous === current) return [];

  // The server may replace the array during a sync or retain only recent lines.
  for (let size = Math.min(previous.length, current.length); size > 0; size--) {
    if (
      current
        .slice(0, size)
        .every(
          (line, index) => line === previous[previous.length - size + index],
        )
    ) {
      return current.slice(size);
    }
  }

  return previous.length ? [] : current;
}

const BASIC_HIT = /^(?:attacked|struck|hits) (.+?) for \d+ damage\b/;
const NAMED_HEAL =
  /^used (.+?)(?: on .+?)? and (?:recovered|restored) \d+ hp\b/;
const NAMED_SKILL =
  /^used (.+?) on .+?(?: for \d+ damage\b|, but their guard\b)/;
const SUMMON = /^summoned (.+?)\./;

function rollsKnockback(battleId: string, logIndex: number, target: string) {
  let hash = logIndex;
  for (const char of battleId + target) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % 4 === 0;
}

export function getCombatImpacts(
  previous: CombatFrame,
  current: CombatFrame,
  pendingCue?: CombatCue,
) {
  const impacts: CombatImpact[] = [];
  const attacks: CombatAttack[] = [];
  const preparationVoices: CombatVoice[] = [];
  if (previous.battleId !== current.battleId) {
    return { attacks, impacts, preparationVoices, nextCue: undefined };
  }

  const newLines = addedLogLines(previous.log, current.log);
  const combatantsByName = [...current.combatants.entries()].sort(
    ([, a], [, b]) => b.name.length - a.name.length,
  );
  const messages = newLines.map((line, index) => {
    const lower = line.toLowerCase();
    const [actorId, combatant] =
      combatantsByName.find(([, { name }]) =>
        lower.startsWith(`${name.toLowerCase()} `),
      ) ?? [];
    return {
      lower,
      actorId,
      combatant,
      outcome: combatant ? lower.slice(combatant.name.length + 1) : lower,
      logIndex: current.log.length - newLines.length + index,
    };
  });
  const cueMessage = messages.findLast(
    ({ outcome }) =>
      getCombatFlair(outcome) ||
      BASIC_HIT.test(outcome) ||
      NAMED_SKILL.test(outcome) ||
      /^(?:uses rend|rends|drains|sweeps|brings down ruin)\b/.test(outcome),
  );
  const flair = cueMessage && getCombatFlair(cueMessage.outcome);
  const basicTarget = cueMessage?.outcome.match(BASIC_HIT)?.[1];
  const target =
    cueMessage &&
    combatantsByName.find(([, { name }]) => {
      const lowerName = name.toLowerCase();
      if (basicTarget) return basicTarget === lowerName;
      return ["on", "rends", "drains"].some((verb) =>
        [` ${lowerName} for `, ` ${lowerName},`, ` ${lowerName} —`].some(
          (tail) => ` ${cueMessage.outcome}`.includes(` ${verb}${tail}`),
        ),
      );
    });
  const cue = cueMessage
    ? {
        flair,
        targetId: target?.[0],
        knockback:
          basicTarget && target
            ? rollsKnockback(current.battleId, cueMessage.logIndex, target[0])
            : undefined,
      }
    : pendingCue;
  let cueApplied = false;

  for (const [id, combatant] of current.combatants) {
    const before = previous.combatants.get(id);
    if (!before) continue;

    const { side, name: actor } = combatant;
    const value = combatant.hp - before.hp;
    if (value < 0) {
      const matchingCue =
        cue && (!cue.targetId || cue.targetId === id) ? cue : undefined;
      const impactFlair = matchingCue?.flair;
      cueApplied ||= Boolean(matchingCue);
      impacts.push({
        side,
        actor,
        actorId: id,
        kind:
          (impactFlair && impactFlair !== "flame") || value <= -400
            ? "heavy"
            : "hit",
        flair: impactFlair,
        knockback: impactFlair === "limit" || matchingCue?.knockback,
        defeated: combatant.hp === 0,
        value,
      });
    } else if (value > 0) {
      impacts.push({ side, actor, actorId: id, kind: "heal", value });
    }

    if (combatant.broken && !before.broken) {
      impacts.push({ side, actor, actorId: id, kind: "break" });
    }
  }

  for (const { lower, actorId, combatant, outcome } of messages) {
    const side = combatant?.side ?? "center";
    const actor = combatant?.name;
    const animation = getAttackAnimation(outcome);
    const fighter = combatant?.voiceFighterId;
    if (
      actorId &&
      fighter &&
      /^(?:raised their guard|used .+ and raised their guard)\b/.test(outcome)
    ) {
      preparationVoices.push({ actorId, fighter, cue: "buff-guarded" });
    } else if (actorId && fighter && /^prepared to dodge\b/.test(outcome)) {
      preparationVoices.push({ actorId, fighter, cue: "buff-evading" });
    }
    if (actorId && animation) {
      const heal = outcome.match(NAMED_HEAL)?.[1];
      const skill = outcome.match(NAMED_SKILL)?.[1];
      const summon = outcome.match(SUMMON)?.[1];
      const cinematic =
        getCombatFlair(outcome) === "limit"
          ? "limit"
          : skillCinematic(skill, combatant?.fighterId);
      const voiceCue =
        cinematic === "limit"
          ? "limit"
          : heal
            ? moveVoiceCue(heal)
            : skill
              ? moveVoiceCue(skill)
              : summon
                ? moveVoiceCue(`call ${summon}`)
                : animation === "heal"
                  ? "heal"
                  : "attack";
      attacks.push({
        actorId,
        animation,
        cinematic,
        voiceCue,
        enemySummon: Boolean(summon && side === "right" && !fighter),
      });
    }

    if (/\bis broken!\s*$/.test(lower)) {
      if (
        !impacts.some(
          (impact) => impact.kind === "break" && impact.actorId === actorId,
        ) &&
        !combatant?.broken
      ) {
        impacts.push({ side, actor, actorId, kind: "break" });
      }
    } else if (/^(?:dodged|dodges|evaded|evades)\b/.test(outcome)) {
      impacts.push({ side, actor, actorId, kind: "evade" });
      const strike = outcome.slice(outcome.indexOf(" ") + 1);
      const attacker = combatantsByName.find(([, { name }]) =>
        strike.startsWith(`${name.toLowerCase()}'s `),
      );
      if (attacker) {
        const [id, source] = attacker;
        const move = strike.slice(source.name.length + 3).replace(/\.$/, "");
        const cinematic =
          move === "limit break"
            ? "limit"
            : skillCinematic(move, source.fighterId);
        const animation =
          cinematic === "limit"
            ? "jump"
            : cinematic
              ? (getAttackAnimation(`used ${move} on `) ?? "attack1")
              : "attack1";
        const voiceCue =
          cinematic === "limit"
            ? "limit"
            : ["attack", "strike"].includes(move)
              ? "attack"
              : moveVoiceCue(move);
        attacks.push({ actorId: id, animation, cinematic, voiceCue });
      }
    } else if (
      /\battack misses\b|\bstrikes are dodged\b|\bsome slip the blow\b/.test(
        lower,
      )
    ) {
      impacts.push({ side: "center", kind: "evade" });
    } else if (/^(?:blocks|guarded against)\b/.test(outcome)) {
      impacts.push({ side, actor, actorId, kind: "guard" });
      const attacker = combatantsByName.find(([, { name }]) =>
        outcome.startsWith(`guarded against ${name.toLowerCase()},`),
      );
      if (attacker)
        attacks.push({
          actorId: attacker[0],
          animation: "attack1",
          voiceCue: "attack",
        });
    } else if (
      /\bguard (?:held|holds|absorbed|absorbs)\b|\bguards absorb\b/.test(lower)
    ) {
      const target = combatantsByName.find(([, { name }]) =>
        lower.includes(` ${name.toLowerCase()}, but their guard`),
      );
      impacts.push({
        side: target?.[1].side ?? "center",
        actor: target?.[1].name,
        actorId: target?.[0],
        kind: "guard",
      });
    }
  }

  return {
    attacks,
    impacts,
    preparationVoices,
    nextCue: cueApplied ? undefined : cue,
  };
}

function getAttackAnimation(outcome: string): CombatAnimation | undefined {
  const flair = getCombatFlair(outcome);
  if (
    /^(?:used .*? and (?:recovered|restored) \d+ hp\b|tried to heal\b|was already at full health\b|mends its wounds\b|regenerates \d+ hp\b)/.test(
      outcome,
    )
  )
    return "heal";
  if (flair === "limit") return "jump";
  if (flair === "boss") return "attack3";
  if (
    /^used (?:oathbreaker aegis|gravebell collapse|thunder meridian|phantom thread|pyre afterimage) on\b/.test(
      outcome,
    )
  )
    return "attack3";
  if (/^used crimson waltz on\b/.test(outcome)) return "attack3";
  if (/^used astral severance on\b/.test(outcome)) return "attack2";
  if (/^used thunder kata on\b/.test(outcome)) return "jump";
  if (
    /^used (?:shadow strike|blood rage|iron cleave|dawnstrike|spirit palm|blacksteel rebuke|bellstroke|riposte|cinderstep) on\b/.test(
      outcome,
    )
  )
    return "attack2";
  if (flair === "arcane" || flair === "flame") return "cast";
  if (/^(?:summoned|cast|howls|lets out a howl)\b/.test(outcome)) return "cast";
  if (NAMED_SKILL.test(outcome)) return "attack2";
  if (flair || /^(?:rends|drains|sweeps|uses rend|crushes)\b/.test(outcome))
    return "attack2";
  if (/^(?:attacked|struck|hits)\b/.test(outcome)) return "attack1";
}

function getCombatFlair(outcome: string): CombatFlair | undefined {
  if (/^unleashed a limit break\b/.test(outcome)) return "limit";
  if (
    /^(?:unleashes a devastating signature move|brings down ruin)\b/.test(
      outcome,
    )
  )
    return "boss";
  if (/\bcritical (?:for \d+ damage|cut lands)\b/.test(outcome)) return "crit";
  if (
    /^used (?:void blast|shadow strike|astral bind|hex lance|eclipse sigil) on\b/.test(
      outcome,
    )
  )
    return "arcane";
  if (
    /^used (?:astral severance|moonveil reflection|chronos elegy|the unwritten end) on\b/.test(
      outcome,
    )
  )
    return "arcane";
  if (/^used funeral of stars on\b/.test(outcome)) return "flame";
  if (
    /^used (?:dawnglass verdict|astral convergence|black sun cascade) on\b/.test(
      outcome,
    )
  )
    return "arcane";
  if (/^used pyre afterimage on\b/.test(outcome)) return "flame";
  if (/^used (?:fire burst|blood rage|sunbrand) on\b/.test(outcome))
    return "flame";
}
