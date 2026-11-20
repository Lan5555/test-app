"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StageAttack, StageImpact } from "../hooks/useCombatPresentation";
import { type ArenaId, arenaImage } from "../lib/arenaAssets";
import { ATTACK_TIMING, LIMIT_RECOIL_DURATION } from "../lib/attackTiming";
import { preloadFighterCinematics } from "../lib/combatCinematics";
import {
  CPU_COMBATANT_ID,
  companionActorId,
  type CombatImpact,
  getImpactLightning,
  strongestImpact,
} from "../lib/combatPresentation";
import { type EnemySprite, enemySpriteFor } from "../lib/enemySprites";
import { encounterArtwork, encounterSprite } from "../lib/encounterAssets";
import {
  readWarriorSelection,
  WARRIORS,
  type Warrior,
} from "../lib/warriorSelection";
import type { CpuBattle, Player } from "../types/game";
import CombatCinematic from "./CombatCinematic";
import CombatSprite, { reactionAnimation } from "./CombatSprite";
import styles from "./combat-stage.module.css";
import Lightning from "./lightning";

const ARENA_PARTICLES = Array.from(
  { length: 14 },
  (_, index) =>
    ({
      "--particle-x": `${(index * 37) % 96}%`,
      "--particle-y": `${(index * 29) % 76}%`,
      "--particle-size": `${3 + (index % 5)}px`,
      "--particle-delay": `-${index * 1.73}s`,
      "--particle-duration": `${8 + (index % 7)}s`,
    }) as CSSProperties,
);

const IMPACT_LABELS = {
  hit: "Hit",
  heavy: "Heavy hit",
  heal: "Healing",
  break: "Break",
  guard: "Block",
  evade: "Dodge",
};

const FLAIR_LABELS = {
  crit: "Critical",
  boss: "Boss strike",
  limit: "Limit Break",
  arcane: "Arcane strike",
  flame: "Flame strike",
};

const CAMERA_MOVES = {
  hit: { zoom: 1.045, pan: 13, lift: 0, roll: 0.45, duration: 330 },
  guard: { zoom: 1.025, pan: 15, lift: 1, roll: -0.9, duration: 300 },
  evade: { zoom: 1.055, pan: 27, lift: 1, roll: -0.8, duration: 400 },
  heal: { zoom: 1.035, pan: 8, lift: 9, roll: 0, duration: 620 },
  heavy: { zoom: 1.092, pan: 24, lift: 5, roll: 1.0, duration: 540 },
  break: { zoom: 1.085, pan: 18, lift: -7, roll: 1.35, duration: 610 },
  crit: { zoom: 1.11, pan: 29, lift: 4, roll: 0.9, duration: 590 },
  boss: { zoom: 1.12, pan: 26, lift: -9, roll: 1.65, duration: 780 },
  limit: { zoom: 1.2, pan: 42, lift: 12, roll: 2.1, duration: 850 },
  arcane: { zoom: 1.08, pan: 19, lift: 7, roll: 0.7, duration: 635 },
  flame: { zoom: 1.075, pan: 20, lift: -3, roll: 0.78, duration: 480 },
};

const SPARK_ANGLES = [
  -172, -145, -124, -103, -81, -62, -36, -15, 12, 38, 61, 86, 119, 150,
];

const FORMATION_SLOTS = [
  { x: 36, depth: 0 },
  { x: 29, depth: 1 },
  { x: 40, depth: 2 },
  { x: 32, depth: 3 },
  { x: 25, depth: 2 },
  { x: 36, depth: 4 },
  { x: 29, depth: 5 },
  { x: 40, depth: 6 },
  { x: 33, depth: 7 },
  { x: 37, depth: 8 },
];

function formation(members: readonly Player[], localId?: string) {
  const visible = members.slice(0, FORMATION_SLOTS.length);
  const local = members.find(({ id }) => id === localId);
  if (local && !visible.includes(local)) visible[visible.length - 1] = local;
  return visible;
}

function Companion({
  companion,
  side,
  warrior,
  attack,
  x,
  depth,
  scale,
}: {
  companion: NonNullable<Player["companion"]>;
  side: "left" | "right";
  warrior: Warrior;
  attack?: StageAttack;
  x: number;
  depth: number;
  scale: number;
}) {
  const wasPresent = useRef(companion.remaining > 0 || Boolean(attack));
  const [departing, setDeparting] = useState(false);
  useEffect(() => {
    if (
      companion.remaining === 0 &&
      attack?.companionStrike === companion.strikes
    ) {
      setDeparting(true);
    }
  }, [attack, companion.remaining, companion.strikes]);

  if (!wasPresent.current && !attack) return null;

  return (
    <div
      className={styles.companion}
      data-departing={departing || undefined}
      data-attacking={Boolean(attack) || undefined}
    >
      <Fighter
        side={side}
        warrior={warrior}
        enemy={companion.sprite}
        attack={attack}
        position={
          {
            "--x": `${x + (side === "left" ? -9 : 9)}%`,
            "--depth": depth,
            "--scale": scale * 0.62,
            zIndex: 9 - depth,
          } as CSSProperties
        }
        down={false}
        selected={false}
        acting={false}
        label={companion.name}
        summoned
      />
    </div>
  );
}

function Fighter({
  side,
  warrior,
  enemy,
  impact,
  attack,
  position,
  down,
  selected,
  acting,
  label,
  summoned = false,
  encounterId,
}: {
  side: "left" | "right";
  warrior: Warrior;
  enemy?: EnemySprite;
  impact?: StageImpact;
  attack?: StageAttack;
  position: CSSProperties;
  down: boolean;
  selected: boolean;
  acting: boolean;
  label?: string;
  summoned?: boolean;
  encounterId?: string;
}) {
  const fighter = useRef<HTMLDivElement>(null);
  const lastCue = useRef(0);

  useEffect(() => {
    const element = fighter.current;
    const reaction = reactionAnimation(impact);
    const reactionId = reaction ? (impact?.id ?? 0) : 0;
    const attackId = attack?.id ?? 0;
    const cue = Math.max(attackId, reactionId);
    if (
      !element?.animate ||
      !cue ||
      cue <= lastCue.current ||
      (down && impact?.kind !== "break" && !impact?.knockback) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    lastCue.current = cue;
    const direction = side === "left" ? -1 : 1;
    const shattering = impact?.kind === "break" && reactionId === cue;
    if (shattering || (impact?.knockback && reactionId === cue)) {
      const limit = impact?.flair === "limit";
      const strong = shattering || limit;
      const shove =
        direction *
        Math.min(
          limit ? 82 : shattering ? 58 : 39,
          window.innerWidth * (strong ? 0.095 : 0.075),
        );
      const lift = strong ? 10 : 5;
      const tilt = direction * (strong ? 11 : 7);
      const recoil = element.animate(
        [
          { transform: "none" },
          {
            transform: `translate(${shove}px, ${-lift}px) rotate(${tilt}deg)`,
            offset: 0.23,
          },
          {
            transform: `translateX(${shove * 0.64}px) rotate(${tilt * 0.36}deg)`,
            offset: 0.56,
          },
          { transform: "none" },
        ],
        {
          duration: limit ? LIMIT_RECOIL_DURATION : shattering ? 620 : 470,
          easing: "cubic-bezier(0.16, 0.75, 0.3, 1)",
        },
      );
      return () => recoil.cancel();
    }
    const advancing = attackId > reactionId;
    const timing = advancing && attack ? ATTACK_TIMING[attack.animation] : null;
    if (timing?.run === 0) return;
    const jumping = advancing && attack?.animation === "jump";
    const distance = advancing
      ? (attack?.animation === "attack3" || jumping ? -34 : -19) * direction
      : (reaction === "run" ? 28 : 11) * direction;
    const keyframes =
      jumping && timing
        ? [
            { transform: "none" },
            {
              transform: `translateX(${distance * 0.52}px)`,
              offset: timing.run / timing.total,
            },
            {
              transform: `translate(${distance * 0.85}px, -34px) rotate(${direction * -9}deg)`,
              offset: 0.42,
            },
            {
              transform: `translate(${distance * 1.17}px, -22px) rotate(${direction * 8}deg)`,
              offset: timing.contact / timing.total,
            },
            { transform: `translateX(${distance}px)`, offset: 0.78 },
            { transform: "none" },
          ]
        : [
            { transform: "translateX(0)" },
            {
              transform: `translateX(${distance}px)`,
              offset: timing ? timing.run / timing.total : 0.22,
            },
            ...(timing
              ? [
                  {
                    transform: `translateX(${distance * 1.12}px)`,
                    offset: timing.contact / timing.total,
                  },
                ]
              : []),
            { transform: "translateX(0)" },
          ];
    const animation = element.animate(keyframes, {
      duration: timing?.total ?? 390,
      easing: "ease-out",
    });

    return () => animation.cancel();
  }, [attack, down, impact, side]);

  return (
    <div
      className={styles.unit}
      style={position}
      data-side={side}
      data-warrior={warrior}
      data-enemy={enemy}
      data-encounter={encounterId}
      data-down={down || undefined}
      data-selected={selected || undefined}
      data-acting={acting || undefined}
    >
      {enemy && (
        <div className={styles.plinth}>
          <span />
        </div>
      )}
      {summoned && <span className={styles.summonPortal} aria-hidden="true" />}
      {attack?.animation === "jump" && (
        <span
          key={`landing-${attack.id}`}
          className={styles.landingPulse}
          aria-hidden="true"
        />
      )}
      <div ref={fighter} className={styles.fighter}>
        {(encounterId === "glasswing-echo" ||
          encounterId === "ash-familiar") && (
          <span className={styles.enemySummonArrival} />
        )}
        {attack?.companionStrike !== undefined && (
          <span
            key={attack.id}
            className={styles.companionTrail}
            aria-hidden="true"
          />
        )}
        {attack?.animation === "jump" && (
          <span
            key={`trail-${attack.id}`}
            className={styles.aerialTrail}
            aria-hidden="true"
          />
        )}
        <CombatSprite
          warrior={warrior}
          enemy={enemy}
          artwork={encounterArtwork(encounterId)}
          impact={impact}
          attack={attack}
          down={down}
        />
      </div>
      {label && <span className={styles.unitName}>{label}</span>}
    </div>
  );
}

export default function CombatStage({
  limitCinematicLayer,
  backdrop,
  usePersonalWarrior,
  allies,
  opponents,
  defending,
  cpu,
  localId,
  activeId,
  alliedTargetId,
  enemyTargetId,
  impacts,
  attacks,
  pendingKnockbacks,
}: {
  limitCinematicLayer: HTMLDivElement | null;
  backdrop?: ArenaId;
  usePersonalWarrior: boolean;
  allies: readonly Player[];
  opponents: readonly Player[];
  defending: boolean;
  cpu?: CpuBattle;
  localId?: string;
  activeId?: string;
  alliedTargetId?: string;
  enemyTargetId?: string;
  impacts: readonly StageImpact[];
  attacks: readonly StageAttack[];
  pendingKnockbacks: readonly CombatImpact[];
}) {
  const scene = useRef<HTMLDivElement>(null);
  const [personalWarrior, setPersonalWarrior] = useState<Warrior>();
  useEffect(() => {
    if (localId) setPersonalWarrior(readWarriorSelection());
  }, [localId]);
  useEffect(() => {
    for (const { fighterId } of [...allies, ...opponents]) {
      if (fighterId) preloadFighterCinematics(fighterId);
    }
  }, [allies, opponents]);
  const cameraAnimation = useRef<Animation | null>(null);
  const lastCameraId = useRef(0);
  const left = formation(allies, localId);
  const enemyUnits = cpu
    ? (cpu.enemyUnits ?? [{ ...cpu, id: CPU_COMBATANT_ID }])
    : [];
  const right = cpu
    ? enemyUnits.map((enemy) => ({
        id: enemy.id,
        name: enemy.enemyName,
        status: enemy.enemyHp > 0 ? "alive" : "defeated",
      }))
    : formation(opponents);
  const attackingSide = defending ? "right" : "left";
  const units = [
    { side: "left" as const, members: left, selectedId: alliedTargetId },
    { side: "right" as const, members: right, selectedId: enemyTargetId },
  ].flatMap(({ side, members, selectedId }) => {
    const lineup: readonly Warrior[] =
      side === attackingSide
        ? ["knight", "maiden", "warden", "duelist", "monk", "arcanist"]
        : ["maiden", "knight", "duelist", "warden", "arcanist", "monk"];
    return members.map((member, index) => {
      const opponent = enemyUnits.find(({ id }) => id === member.id);
      const slot =
        members.length === 1 ? { x: 34, depth: 0 } : FORMATION_SLOTS[index];
      return {
        member,
        side,
        warrior:
          ("fighterId" in member &&
          member.fighterId &&
          WARRIORS.includes(member.fighterId)
            ? member.fighterId
            : undefined) ??
          (usePersonalWarrior && member.id === localId
            ? personalWarrior
            : undefined) ??
          lineup[index % lineup.length],
        x: side === "left" ? slot.x : 100 - slot.x,
        depth: slot.depth,
        selected: member.id === selectedId,
        enemy: opponent
          ? (encounterSprite(opponent.encounterId) ??
            enemySpriteFor(opponent.enemyName))
          : undefined,
        encounterId: opponent?.encounterId,
        scale: opponent
          ? enemyUnits.length > 1
            ? 0.77
            : opponent.encounterId === "crownless-king"
              ? 1.36
              : 1.2
          : members.length === 1
            ? 1
            : members.length <= 6
              ? 0.76
              : 0.62,
      };
    });
  });
  const latestBatch = impacts.at(-1)?.batch;
  const cameraImpact = strongestImpact(
    impacts.filter(({ batch }) => batch === latestBatch),
  );
  const cameraUnit = units.find(
    ({ member }) => member.id === cameraImpact?.actorId,
  );
  const cameraX =
    cameraUnit?.x ??
    (cameraImpact?.side === "left"
      ? 34
      : cameraImpact?.side === "right"
        ? 66
        : 50);
  const cameraMove = cameraImpact && (cameraImpact.flair ?? cameraImpact.kind);

  const lightningBatch = impacts.findLast(getImpactLightning)?.batch;
  const strike = strongestImpact(
    impacts.filter(
      (impact) => impact.batch === lightningBatch && getImpactLightning(impact),
    ),
  );
  const lightningKind = strike && getImpactLightning(strike);
  const strikeUnit = units.find(({ member }) => member.id === strike?.actorId);
  const cinematic = attacks.findLast(({ cinematic }) => cinematic);
  const cinematicUnit =
    cinematic && units.find(({ member }) => member.id === cinematic.actorId);
  const cinematicFighter =
    cinematic &&
    (cinematicUnit
      ? cinematicUnit.enemy
        ? undefined
        : cinematicUnit.warrior
      : [...allies, ...opponents].find(({ id }) => id === cinematic.actorId)
          ?.fighterId);
  const cutIn = cinematic?.cinematic && (
    <CombatCinematic
      key={cinematic.id}
      move={cinematic.cinematic}
      side={
        cinematicUnit?.side ??
        (allies.some(({ id }) => id === cinematic.actorId) ? "left" : "right")
      }
      fighter={cinematicFighter}
    />
  );

  useEffect(() => {
    const camera = scene.current;
    if (
      !camera?.animate ||
      !cameraImpact ||
      !cameraMove ||
      lastCameraId.current === cameraImpact.id ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    lastCameraId.current = cameraImpact.id;
    const initial = getComputedStyle(camera).transform;
    cameraAnimation.current?.cancel();

    const { zoom, pan, lift, roll, duration } = CAMERA_MOVES[cameraMove];
    const direction = cameraX <= 50 ? 1 : -1;
    const x = pan * direction * (cameraX === 50 ? 0.3 : 1);
    const angle = roll * direction;
    const settle = cameraMove === "heal" ? 0.56 : 0.19;
    cameraAnimation.current = camera.animate(
      [
        { transform: initial },
        {
          transform: `translate(${x}px,${lift}px) scale(${zoom}) rotate(${angle}deg)`,
          offset: settle,
          easing: "ease-out",
        },
        {
          transform: `translate(${-x * 0.19}px,${-lift * 0.2}px) scale(${1 + (zoom - 1) * 0.3}) rotate(${-angle * 0.24}deg)`,
          offset: 0.72,
        },
        { transform: "none" },
      ],
      { duration, easing: "ease-out" },
    );
  }, [cameraImpact, cameraMove, cameraX]);

  useEffect(() => () => cameraAnimation.current?.cancel(), []);

  return (
    <div className={styles.stage} data-battleground={backdrop}>
      <div
        ref={scene}
        className={styles.scene}
        data-camera={cameraMove}
        aria-hidden="true"
      >
        <div
          className={styles.landscape}
          style={
            backdrop
              ? {
                  backgroundImage: `linear-gradient(180deg, #080b1430, transparent 56%, #080b1450), url("${arenaImage(backdrop)}"), url("${arenaImage(backdrop, true)}")`,
                }
              : undefined
          }
        />
        <div className={styles.fog} />
        {backdrop && (
          <div className={styles.arenaDrift}>
            {ARENA_PARTICLES.map((style, index) => (
              <span key={index} style={style} />
            ))}
          </div>
        )}
        <div className={styles.world}>
          {!backdrop && <div className={styles.floor} />}
          {units.flatMap(({ member, side, warrior, x, depth, scale }) => {
            if (member.status !== "alive" || !("companion" in member))
              return [];
            return [member.companion, member.secondaryCompanion].flatMap(
              (companion, index) => {
                if (!companion) return [];
                const id = companionActorId(member.id, companion.skillId);
                return (
                  <Companion
                    key={id}
                    companion={companion}
                    side={side}
                    warrior={warrior}
                    x={x + (side === "left" ? -5 : 5) * index}
                    depth={depth + index}
                    scale={scale}
                    attack={attacks.findLast(({ actorId }) => actorId === id)}
                  />
                );
              },
            );
          })}
          {units.map(
            ({
              member,
              side,
              warrior,
              enemy,
              encounterId,
              x,
              depth,
              selected,
              scale,
            }) => {
              const memberImpacts = impacts.filter(
                ({ actorId, kind }) => actorId === member.id && kind !== "heal",
              );
              const latestImpact = memberImpacts.at(-1);
              const impact =
                memberImpacts.findLast(
                  ({ batch, flair }) =>
                    batch === latestImpact?.batch && flair === "limit",
                ) ?? latestImpact;
              const waitingForHit = pendingKnockbacks.some(
                ({ actorId }) => actorId === member.id,
              );
              return (
                <Fighter
                  key={member.id}
                  side={side}
                  warrior={warrior}
                  enemy={enemy}
                  encounterId={encounterId}
                  position={
                    {
                      "--x": `${x}%`,
                      "--depth": depth,
                      "--scale": scale,
                      zIndex: 10 - depth,
                    } as CSSProperties
                  }
                  down={
                    !waitingForHit &&
                    (member.status !== "alive" ||
                      ("hp" in member && member.hp <= 0))
                  }
                  acting={member.id === activeId}
                  selected={selected}
                  label={
                    selected || member.id === localId || member.id === activeId
                      ? member.name
                      : undefined
                  }
                  impact={impact}
                  attack={attacks.findLast(
                    ({ actorId, cinematic }) =>
                      actorId === member.id && cinematic !== "limit",
                  )}
                />
              );
            },
          )}
        </div>
        <div className={styles.embers} />
      </div>
      {strike && lightningKind && (
        <Lightning
          key={strike.id}
          trigger={strike.id}
          kind={lightningKind}
          x={
            strikeUnit?.x ??
            (strike.side === "left" ? 34 : strike.side === "right" ? 66 : 50)
          }
          y={48 - (strikeUnit?.depth ?? 0) * 2.5}
        />
      )}
      <div className={styles.effects} aria-hidden="true">
        {impacts.map((impact) => {
          const unit = units.find(({ member }) => member.id === impact.actorId);
          return (
            <div
              key={impact.id}
              className={styles.impact}
              data-kind={impact.kind}
              data-flair={impact.flair}
              data-side={impact.side}
              style={
                unit
                  ? ({
                      "--x": `${unit.x}%`,
                      "--depth": unit.depth,
                    } as CSSProperties)
                  : undefined
              }
            >
              <span className={styles.bloom} />
              <span className={styles.wave} />
              <span className={styles.slash} />
              <span className={styles.dust} />
              {impact.kind === "break" && <span className={styles.fracture} />}
              {impact.flair === "flame" && <span className={styles.flame} />}
              {SPARK_ANGLES.slice(
                0,
                impact.kind === "heavy" || impact.kind === "break" ? 14 : 8,
              ).map((angle, index) => (
                <i
                  key={angle}
                  className={styles.spark}
                  style={
                    {
                      "--angle": `${angle}deg`,
                      "--reach": `${36 + (index % 4) * 19}px`,
                      "--delay": `${(index % 3) * 18}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
      {cinematic?.cinematic === "limit" && limitCinematicLayer
        ? createPortal(cutIn, limitCinematicLayer)
        : cutIn}
      <div className={styles.readouts} aria-live="polite" aria-atomic="false">
        {(["left", "center", "right"] as const).map((side) => (
          <div key={side} className={styles.readoutStack} data-side={side}>
            {impacts
              .filter((impact) => impact.side === side)
              .slice(-3)
              .map(({ id, kind, actor, value, flair }) => (
                <div
                  key={id}
                  className={styles.readout}
                  data-kind={kind}
                  data-flair={flair}
                >
                  {actor && <span>{actor}</span>}
                  <strong>
                    {value === undefined
                      ? IMPACT_LABELS[kind]
                      : `${value > 0 ? "+" : "−"}${Math.abs(value)}`}
                  </strong>
                  {(flair || kind === "heavy") && value !== undefined && (
                    <small>
                      {flair ? FLAIR_LABELS[flair] : IMPACT_LABELS.heavy}
                    </small>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
