"use client";

import { type CSSProperties, useMemo } from "react";
import type { LightningKind } from "../lib/combatPresentation";
import styles from "./lightning.module.css";

export type { LightningKind } from "../lib/combatPresentation";

const PRESETS = {
  heavy: { color: "#93c5fd", core: "#dbeafe", count: 3 },
  crit: { color: "#f9d77b", core: "#fff4ca", count: 4 },
  boss: { color: "#fb7185", core: "#ffe4e6", count: 5 },
  break: { color: "#f0a0dc", core: "#fce7f3", count: 3 },
  limit: { color: "#879dff", core: "#f5f6ff", count: 5 },
  arcane: { color: "#a3a2ff", core: "#e1e6ff", count: 2 },
} satisfies Record<
  LightningKind,
  { color: string; core: string; count: number }
>;

type Point = { x: number; y: number };

function makeBolts(seed: number, x: number, y: number, count: number, isLimit: boolean) {
  // Keep the pattern stable through unrelated HUD updates.
  let state = seed;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  }

  function trace(start: Point, end: Point, steps: number, jitter: number) {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const wobble =
        index === 0 || index === steps ? 0 : (random() - 0.5) * jitter;
      return {
        x: start.x + (end.x - start.x) * t + wobble,
        y: start.y + (end.y - start.y) * t,
      };
    });
  }

  const impact = { x, y };
  const trunk = trace(
    { x: x + (random() - 0.5) * 23, y: 0 },
    impact,
    isLimit ? 16 : 13,
    isLimit ? 12 : 9,
  );
  const branches = Array.from({ length: count - 1 }, (_, index) => {
    const origin = trunk[3 + index * 2];
    const direction = index % 2 === 0 ? -1 : 1;
    return trace(
      origin,
      {
        x: origin.x + direction * (10 + random() * 13),
        y: origin.y + 9 + random() * 13,
      },
      6,
      6,
    );
  });
  const converging = isLimit
    ? [-1, 1].map((direction) =>
        trace({ x: x + direction * (23 + random() * 8), y: 0 }, impact, 12, 10),
      )
    : [];
  return { trunk, converging, branches };
}

export default function Lightning({
  trigger,
  kind,
  x,
  y,
}: {
  trigger: number;
  kind: LightningKind;
  x: number;
  y: number;
}) {
  const preset = PRESETS[kind];
  const { trunk, converging, branches } = useMemo(
    () => makeBolts(trigger, x, y, preset.count, kind === "limit"),
    [trigger, x, y, preset.count, kind],
  );
  const bolts = [trunk, ...converging, ...branches];

  return (
    <div
      key={trigger}
      className={styles.lightning}
      data-lightning={kind}
      style={
        {
          "--bolt": preset.color,
          "--core": preset.core,
          "--x": `${x}%`,
          "--y": `${y}%`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className={styles.lightningGlow} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {bolts.map((points, index) => {
          const d = points
            .map(
              ({ x: px, y: py }, i) =>
                `${(i === 0 ? "M " : "L ") + px.toFixed(2)} ${py.toFixed(2)}`,
            )
            .join(" ");
          return (
            <g
              key={d}
              className={styles.arc}
              data-main={index === 0 || undefined}
              data-converging={(index > 0 && index <= converging.length) || undefined}
              style={{ animationDelay: `${index * (kind === "limit" ? 9 : 16)}ms` }}
            >
              <path d={d} className={styles.arcGlow} />
              <path d={d} className={styles.arcCore} />
            </g>
          );
        })}
      </svg>
      <div className={styles.lightningRing} />
    </div>
  );
}
