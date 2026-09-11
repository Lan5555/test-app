"use client";

import { useEffect, useState } from "react";

interface Props {
  playerName: string;
  friendly: boolean;
  trigger: number;
  onDone?: () => void;
}

// Spider-crack partition of the text's bounding box (in %), radiating
// from an off-center impact point — this is both the clip-path for
// each glass shard and the path data for the crack lines.
const IMPACT = { x: 48, y: 52 };
const SHARD_POINTS = [
  [0, 0],
  [35, 0],
  [100, 0],
  [100, 45],
  [100, 100],
  [60, 100],
  [0, 100],
  [0, 55],
];

const SHARDS = SHARD_POINTS.map((p, i) => {
  const next = SHARD_POINTS[(i + 1) % SHARD_POINTS.length];
  const angle = Math.atan2(p[1] - IMPACT.y, p[0] - IMPACT.x);
  const throwDist = 46 + (i % 3) * 10;
  return {
    clip: `polygon(${IMPACT.x}% ${IMPACT.y}%, ${p[0]}% ${p[1]}%, ${next[0]}% ${next[1]}%)`,
    dx: Math.cos(angle) * throwDist,
    dy: Math.sin(angle) * throwDist,
    rot: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 3),
    delay: (i * 37) % 90,
  };
});

const CRACK_LINES = SHARD_POINTS.map(
  (p) => `M${IMPACT.x},${IMPACT.y} L${p[0]},${p[1]}`
);

export default function BreakFlash({
  playerName,
  friendly,
  trigger,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [trigger, onDone]);

  if (!visible) return null;

  const accent = friendly ? "text-cyan-100" : "text-amber-100";
  const ring = friendly
    ? "drop-shadow-[0_0_50px_rgba(34,211,238,.55)]"
    : "drop-shadow-[0_0_50px_rgba(251,191,36,.55)]";
  const crackColor = friendly
    ? "rgba(165,243,252,.6)"
    : "rgba(253,230,138,.6)";
  const glintColor = friendly
    ? "rgba(165,243,252,.9)"
    : "rgba(253,230,138,.9)";

  const textShadow =
    "0 0 40px rgba(255,255,255,.35), 8px 8px 0 rgba(0,0,0,.55), -1px -1px 0 rgba(255,255,255,.25)";

  return (
    <div
      key={trigger}
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <div className="relative z-10 flex flex-col items-center break-flash-text">
        <p
          className={`text-[11px] font-black uppercase tracking-[0.55em] ${accent} opacity-80`}
        >
          {friendly ? "Ally broken" : "Enemy broken"}
        </p>

        {/* BREAK — shattered glass text */}
        <div className="relative mt-4">
          {/* impact glint burst, timed to the shards landing */}
          <span
            className="absolute left-1/2 top-1/2 aspect-square w-[130%] rounded-full break-impact-glint"
            style={{
              background: `radial-gradient(circle, ${glintColor} 0%, transparent 70%)`,
            }}
          />

          {/* solid base so no gaps show while shards are still mid-flight */}
          <h1
            aria-hidden="true"
            className="select-none text-[22vw] leading-[0.85] font-black uppercase tracking-tight text-white/80 sm:text-[16vw]"
            style={{ textShadow }}
          >
            BREAK
          </h1>

          {/* shattered shards, each a clipped copy flying into place */}
          <h1
            className={`absolute inset-0 text-[22vw] leading-[0.85] font-black uppercase tracking-tight text-white sm:text-[16vw] ${ring}`}
            style={{ textShadow }}
          >
            {SHARDS.map((s, i) => (
              <span
                key={i}
                className="absolute inset-0 break-shard"
                style={
                  {
                    clipPath: s.clip,
                    "--sx": `${s.dx}%`,
                    "--sy": `${s.dy}%`,
                    "--srot": `${s.rot}deg`,
                    animationDelay: `${s.delay}ms`,
                  } as React.CSSProperties
                }
              >
                BREAK
              </span>
            ))}
          </h1>

          {/* fracture lines etched across the settled glass */}
          <svg
            className="absolute inset-0 h-full w-full break-cracks"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {CRACK_LINES.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={crackColor}
                strokeWidth="0.35"
                strokeLinecap="round"
                style={{ animationDelay: `${60 + i * 25}ms` }}
              />
            ))}
          </svg>
        </div>

        <div className="mt-2 h-[1px] w-40 bg-white/40" />

        <p className={`mt-4 text-xl font-black uppercase tracking-[0.4em] ${accent}`}>
          {playerName}
        </p>

        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.35em] text-white/50">
          Turn lost · immobilized
        </p>
      </div>

      <style jsx>{`
        .break-shard {
          animation: break-shard-in 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity, filter;
        }
        .break-cracks path {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          pathLength: 100;
          animation: break-crack-draw 480ms ease-out both;
        }
        .break-impact-glint {
          transform: translate(-50%, -50%) scale(0.2);
          animation: break-impact-glint 650ms ease-out both;
        }
        @keyframes break-shard-in {
          0% {
            transform: translate3d(var(--sx), var(--sy), 0) rotate(var(--srot)) scale(1.08);
            opacity: 0;
            filter: blur(3px) brightness(1.6);
          }
          55% {
            opacity: 1;
            filter: blur(0.5px) brightness(1.15);
          }
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
            opacity: 1;
            filter: blur(0) brightness(1);
          }
        }
        @keyframes break-crack-draw {
          0% {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          60% {
            stroke-dashoffset: 0;
            opacity: 0.9;
          }
          100% {
            opacity: 0.6;
          }
        }
        @keyframes break-impact-glint {
          0% {
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 0;
          }
          35% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.9;
          }
          65%, 100% {
            transform: translate(-50%, -50%) scale(1.15);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}