"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import manifest from "../data/combat-sprites.json";
import type { StageAttack, StageImpact } from "../hooks/useCombatPresentation";
import { ATTACK_TIMING } from "../lib/attackTiming";
import { type EnemySprite, enemyAtlasUrl } from "../lib/enemySprites";
import {
  baseFighter,
  fighterAtlasUrl,
  veteranAtlas,
  type Warrior,
} from "../lib/warriorSelection";
import styles from "./combat-stage.module.css";

type Animation = keyof (typeof manifest.frames)["knight"];
const signatureRows: Record<string, Animation> = {
  "astral-severance": "attack2",
  "crimson-waltz": "attack3",
  "moonveil-reflection": "cast",
  "the-unwritten-end": "attack2",
  "chronos-elegy": "attack3",
  "funeral-of-stars": "cast",
};

const actionTiming: Partial<Record<Animation, { run: number; total: number }>> =
  ATTACK_TIMING;
const REACTION_FRAME_MS = {
  run: 52,
  hurt: 76,
  death: 84,
};
const SHORT_REACTION_FRAMES = 6;
const ORIGINAL_REACTION_FRAMES = 4;

export function reactionAnimation(impact: StageImpact | undefined) {
  if (!impact || impact.kind === "heal") return;
  return impact.kind === "evade" ? "run" : "hurt";
}

export default function CombatSprite({
  warrior,
  preview = false,
  enemy,
  artwork,
  attack,
  impact,
  down,
}: {
  warrior: Warrior;
  preview?: boolean;
  enemy?: EnemySprite;
  artwork?: string;
  attack?: StageAttack;
  impact?: StageImpact;
  down: boolean;
}) {
  const [finished, setFinished] = useState(0);
  const [swinging, setSwinging] = useState(0);
  const [fallen, setFallen] = useState(down);
  const lastImpact = useRef(impact?.id);
  const reaction = reactionAnimation(impact);
  const reactionId = reaction ? (impact?.id ?? 0) : 0;
  const attackId = attack?.id ?? 0;
  const cueId = Math.max(attackId, reactionId);
  const advancing =
    !down &&
    attack &&
    ATTACK_TIMING[attack.animation].run > 0 &&
    attackId > reactionId &&
    cueId > finished;
  const runningIn = Boolean(advancing && swinging !== attackId);

  useEffect(() => {
    if (!advancing || !attack) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => setSwinging(attack.id),
      reduced ? 0 : ATTACK_TIMING[attack.animation].run,
    );
    return () => window.clearTimeout(timer);
  }, [advancing, attack]);

  useEffect(() => {
    const previousImpact = lastImpact.current;
    lastImpact.current = impact?.id;
    if (!down) {
      setFallen(false);
      return;
    }
    if (fallen) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || (impact && impact.id !== previousImpact)) {
      setFallen(true);
      return;
    }
    const timer = window.setTimeout(() => setFallen(true), 460);
    return () => window.clearTimeout(timer);
  }, [down, fallen, impact]);

  const base = baseFighter(warrior);
  const veteran = !enemy && veteranAtlas(warrior);
  const limitFlipPending =
    veteran &&
    attackId > finished &&
    attack?.animation === "jump" &&
    (attack.cinematic === "limit" || attack.voiceCue === "limit");
  // Keep the Limit attack in control through its last flip frame. An impact is
  // published at contact with a newer ID, but must not replace the flip early.
  const cue = limitFlipPending
    ? attack?.animation
    : reactionId > attackId
      ? reaction
      : attack?.animation;
  const animation =
    fallen && down
      ? "death"
      : runningIn
        ? "run"
        : !down && cue && cueId > finished
          ? cue
          : "idle";
  const ownAtlas = warrior === "lady-ley" || warrior === "grave-chorister";
  const signatureRow =
    attack?.voiceCue && Object.hasOwn(signatureRows, attack.voiceCue)
      ? signatureRows[attack.voiceCue]
      : undefined;
  const row =
    !enemy && ownAtlas && attack && animation === attack.animation
      ? (signatureRow ?? (animation === "cast" ? "heal" : animation))
      : animation;
  // Limit Breaks and successful dodges use the dedicated full flip row.
  const isLimitBreak = limitFlipPending && animation === "jump";
  const isDodgeFlip =
    veteran &&
    animation === "run" &&
    impact?.kind === "evade" &&
    reactionId === cueId;
  const pose = isLimitBreak || isDodgeFlip ? "flip" : row;
  const count = veteran
    ? veteran.frames[pose]
    : enemy
      ? manifest.enemyColumns
      : manifest.frames[base][row];
  const timing = actionTiming[animation];
  const reactionPace =
    animation === "run" || animation === "hurt" || animation === "death"
      ? REACTION_FRAME_MS[animation]
      : 84;
  const reactionDuration =
    (count === SHORT_REACTION_FRAMES ? ORIGINAL_REACTION_FRAMES : count) *
    reactionPace;
  const playback =
    pose === "flip"
      ? count * 78
      : runningIn && attack && count === SHORT_REACTION_FRAMES
        ? ATTACK_TIMING[attack.animation].run
        : timing
          ? timing.total - timing.run
          : animation === "idle"
            ? 2000
            : reactionDuration;
  const { cell, rows } = veteran || manifest;
  const columns = veteran
    ? veteran.columns
    : enemy
      ? manifest.enemyColumns
      : manifest.fighterColumns[base];
  const hold = animation === "death" && !impact;
  const stillPreview = preview && !enemy;

  const style = {
    backgroundImage: `url(${artwork ?? (enemy ? enemyAtlasUrl(enemy) : fighterAtlasUrl(warrior, stillPreview))})`,
    backgroundSize: artwork
      ? "contain"
      : stillPreview
        ? "100% 100%"
        : `${columns * 100}% ${rows.length * 100}%`,
    "--sprite-row": `${(rows.indexOf(pose) / (rows.length - 1)) * 100}%`,
    aspectRatio: `${cell.width} / ${cell.height}`,
    "--sprite-pivot": `${(cell.pivotX / cell.width) * 100}%`,
    "--sprite-height": "122%",
    "--sprite-bottom": `${((cell.pivotY - cell.height) / cell.height) * 122}%`,
    "--sprite-frames": count,
    "--sprite-last": `${((count - 1) / (columns - 1)) * 100}%`,
    "--sprite-time": `${playback}ms`,
  } as CSSProperties;

  return (
    <div
      key={
        animation === "death" || animation === "idle"
          ? animation
          : `${animation}-${cueId}`
      }
      className={styles.sprite}
      data-preview={stillPreview || undefined}
      data-warrior={warrior}
      data-enemy={enemy}
      data-artwork={Boolean(artwork) || undefined}
      data-animation={animation}
      data-veteran={Boolean(veteran) || undefined}
      data-limit-break={isLimitBreak || undefined}
      data-dodge-flip={isDodgeFlip || undefined}
      data-hold={hold || undefined}
      style={style}
      onAnimationEnd={() => {
        if (!runningIn && animation !== "death" && animation !== "idle") {
          setFinished((previous) => Math.max(previous, cueId));
        }
      }}
    />
  );
}
