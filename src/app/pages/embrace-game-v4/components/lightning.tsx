"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type LightningKind = "heavy" | "crit" | "boss" | "break";

interface Props {
  /** Increment to trigger a strike. Any change fires. */
  trigger: number;
  /** Which variant to play. Defaults to "heavy". */
  kind?: LightningKind;
  /** Duration in ms. Defaults to 800. */
  duration?: number;
  /** Called when the animation finishes. */
  onDone?: () => void;
}

/* ------------------------------------------------------------------ */
/* Presets                                                            */
/* ------------------------------------------------------------------ */

const PRESETS: Record<
  LightningKind,
  { color: string; core: string; boltCount: number; shake: string }
> = {
  heavy: {
    color: "#93c5fd",
    core: "#dbeafe",
    boltCount: 3,
    shake: "0 0 40px rgba(147, 197, 253, .7)",
  },
  crit: {
    color: "#fde68a",
    core: "#fef3c7",
    boltCount: 5,
    shake: "0 0 60px rgba(253, 230, 138, .85)",
  },
  boss: {
    color: "#fca5a5",
    core: "#fee2e2",
    boltCount: 6,
    shake: "0 0 80px rgba(252, 165, 165, .9)",
  },
  break: {
    color: "#f9a8d4",
    core: "#fce7f3",
    boltCount: 4,
    shake: "0 0 50px rgba(249, 168, 212, .8)",
  },
};

/* ------------------------------------------------------------------ */
/* Bolt geometry                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate a jagged SVG path from top of screen to a target point.
 * Adds horizontal jitter at each segment to make it feel chaotic.
 */
function buildBoltPath(
  fromX: number,
  toX: number,
  toY: number,
  segments: number,
  jitter: number,
): string {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Interpolate between start and end on the Y axis.
    const y = t * toY;
    // Interpolate X, then add jitter. Reduce jitter near the target.
    const baseX = fromX + (toX - fromX) * t;
    const wobble = (Math.random() - 0.5) * jitter * (1 - t * 0.6);
    points.push([baseX + wobble, y]);
  }

  return points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function Lightning({
  trigger,
  kind = "heavy",
  duration = 800,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [instance, setInstance] = useState(0);
  const doneRef = useRef(false);

  const preset = PRESETS[kind];

  // Generate the bolt paths once per trigger. The randomness is captured
  // in the memo, so re-renders don't cause the lightning to jitter.
  const bolts = useMemo(() => {
    void instance; // dependency: regenerate on each instance change
    const width = 100; // SVG viewBox is 0-100 horizontally
    return Array.from({ length: preset.boltCount }, (_, i) => {
      const startX = 15 + Math.random() * 70;
      const endX = 20 + Math.random() * 60;
      const endY = 55 + Math.random() * 45;
      const segments = 8 + Math.floor(Math.random() * 5);
      const jitter = 4 + Math.random() * 6;
      const delay = Math.random() * 0.25;
      const stroke = i === 0 ? 0.55 : 0.22 + Math.random() * 0.2;
      return {
        id: `bolt-${i}`,
        d: buildBoltPath(startX, endX, endY, segments, jitter),
        delay,
        stroke,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, kind]);

  useEffect(() => {
    if (!trigger) return;
    doneRef.current = false;
    setInstance((n) => n + 1);
    setVisible(true);

    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setVisible(false);
      onDone?.();
    }, duration);

    return () => window.clearTimeout(t);
  }, [trigger, duration, onDone]);

  if (!visible) return null;

  return (
    <div
      key={instance}
      className="pointer-events-none fixed inset-0 z-[400] overflow-hidden"
      aria-hidden="true"
    >
      {/* Flash backdrop — brief whiteout for the strike */}
      <div
        className="absolute inset-0 lightning-flash"
        style={{ background: preset.core }}
      />

      {/* Screen tint after the flash */}
      <div
        className="absolute inset-0 lightning-tint"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${preset.color}33 0%, transparent 65%)`,
        }}
      />

      {/* Bolts */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {bolts.map((b) => (
          <g key={b.id}>
            {/* Glow layer */}
            <path
              d={b.d}
              fill="none"
              stroke={preset.color}
              strokeWidth={b.stroke * 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
              className="lightning-bolt"
              style={{ animationDelay: `${b.delay}s` }}
            />
            {/* Core layer */}
            <path
              d={b.d}
              fill="none"
              stroke={preset.core}
              strokeWidth={b.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lightning-bolt"
              style={{ animationDelay: `${b.delay}s` }}
            />
          </g>
        ))}
      </svg>

      {/* Impact burst at the bottom of the strike */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lightning-burst"
        style={{
          width: "60vmin",
          height: "60vmin",
          background: `radial-gradient(circle, ${preset.core}88 0%, ${preset.color}44 30%, transparent 70%)`,
        }}
      />

      {/* Edge lightning — small arcs at the screen edges */}
      <div
        className="absolute inset-0 lightning-edges"
        style={{
          boxShadow: `inset 0 0 120px 20px ${preset.color}55`,
        }}
      />

      <style jsx>{`
        .lightning-flash {
          opacity: 0;
          animation: lightning-flash var(--lt-duration, 800ms) ease-out both;
          mix-blend-mode: screen;
        }
        @keyframes lightning-flash {
          0% {
            opacity: 0;
          }
          4% {
            opacity: 0.85;
          }
          8% {
            opacity: 0.15;
          }
          12% {
            opacity: 0.7;
          }
          20% {
            opacity: 0.1;
          }
          30% {
            opacity: 0.3;
          }
          100% {
            opacity: 0;
          }
        }

        .lightning-tint {
          opacity: 0;
          animation: lightning-tint var(--lt-duration, 800ms) ease-out both;
        }
        @keyframes lightning-tint {
          0% {
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        .lightning-bolt {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          opacity: 0;
          animation: lightning-bolt var(--lt-duration, 800ms)
            cubic-bezier(0.2, 0.9, 0.3, 1) both;
          filter: drop-shadow(0 0 6px currentColor);
        }
        @keyframes lightning-bolt {
          0% {
            stroke-dashoffset: 300;
            opacity: 0;
          }
          8% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          20% {
            opacity: 0.9;
          }
          55% {
            opacity: 0.35;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
        }

        .lightning-burst {
          opacity: 0;
          animation: lightning-burst var(--lt-duration, 800ms) ease-out both;
          mix-blend-mode: screen;
        }
        @keyframes lightning-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.4);
          }
          10% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1);
          }
          40% {
            opacity: 0.4;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
          }
        }

        .lightning-edges {
          opacity: 0;
          animation: lightning-edges var(--lt-duration, 800ms) ease-out both;
        }
        @keyframes lightning-edges {
          0% {
            opacity: 0;
          }
          6% {
            opacity: 1;
          }
          18% {
            opacity: 0.3;
          }
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lightning-flash,
          .lightning-tint,
          .lightning-bolt,
          .lightning-burst,
          .lightning-edges {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  );
}