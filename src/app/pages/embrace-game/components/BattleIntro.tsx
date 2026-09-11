"use client";

import { useEffect, useState } from "react";

interface Props {
  enemyName: string;
  /** "team" for PvP, "cpu" for enemy AI. */
  mode: "team" | "cpu";
  /** Optional team names for PvP. */
  attackerTeamId?: string;
  defenderTeamId?: string;
  /** Called once the intro finishes so the parent can drop the overlay. */
  onDone: () => void;
  /** Duration in ms. Defaults to 1800. */
  duration?: number;
}

export default function BattleIntro({
  enemyName,
  mode,
  attackerTeamId,
  defenderTeamId,
  onDone,
  duration = 1800,
}: Props) {
  const [phase, setPhase] = useState<"impact" | "reveal" | "fadeout">(
    "impact",
  );

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("reveal"), 380);
    const t2 = window.setTimeout(() => setPhase("fadeout"), duration - 400);
    const t3 = window.setTimeout(() => onDone(), duration);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [duration, onDone]);

  const subtitle =
    mode === "cpu"
      ? "AN ENEMY APPEARS"
      : `${attackerTeamId ?? ""} vs ${defenderTeamId ?? ""}`.toUpperCase();

  return (
    <div
      className="battle-intro-root fixed inset-0 z-[260] flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {/* Fast blackout cut */}
      <div className="absolute inset-0 bg-black battle-intro-black" />

      {/* Radial impact burst */}
      <div className="absolute inset-0 battle-intro-burst" />

      {/* Horizontal slashes — two crossing bands */}
      <div className="absolute inset-0 battle-intro-bands">
        <div className="absolute left-0 top-[42%] h-[3px] w-full bg-red-400/70" />
        <div className="absolute left-0 top-[58%] h-[3px] w-full bg-red-400/70" />
      </div>

      {/* Shockwave rings */}
      <div className="absolute size-[70vmin] rounded-full border-2 border-red-300/50 battle-intro-ring" />
      <div className="absolute size-[70vmin] rounded-full border border-red-200/30 battle-intro-ring-delayed" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p
          className={`battle-intro-subtitle text-[11px] font-black uppercase tracking-[0.6em] text-red-200/80 ${
            phase === "impact" ? "opacity-0" : "opacity-100"
          } transition-opacity duration-300`}
        >
          {subtitle}
        </p>

        <h1
          className={`battle-intro-title mt-4 max-w-[90vw] text-6xl font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_0_30px_rgba(248,113,113,.6)] sm:text-8xl ${
            phase === "impact" ? "opacity-0" : "opacity-100"
          } transition-opacity duration-300`}
          style={{
            textShadow:
              "0 0 40px rgba(255,255,255,.35), 6px 6px 0 rgba(0,0,0,.85), -1px -1px 0 rgba(255,255,255,.15)",
          }}
        >
          {enemyName}
        </h1>

        <p
          className={`battle-intro-tagline mt-6 text-[11px] font-bold uppercase tracking-[0.4em] text-white/60 ${
            phase === "impact" ? "opacity-0" : "opacity-100"
          } transition-opacity duration-500`}
        >
          Prepare yourself
        </p>
      </div>
    </div>
  );
}