"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioController } from "../hooks/audioHandler";

interface Props {
  /** How the player died. */
  cause?: "battle" | "elimination" | "abandon";
  /** Enemy or team that killed them. */
  killerName?: string;
  /** Story node the death happened on. */
  nodeTitle?: string;
  /** Optional line shown under the cause. */
  epitaph?: string;
  /** Player's final stats. */
  stats?: {
    turnsSurvived?: number;
    battlesWon?: number;
    kills?: number;
    teamsLeft?: number;
  };
  /** Called when the player chooses to leave entirely. */
  onLeave?: () => void;
}

export default function GameOverScreen({
  cause = "battle",
  killerName,
  nodeTitle,
  epitaph,
  stats,
  onLeave,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"in" | "settled">("in");

  useEffect(() => {
    // Optional: hook this up if you have a game-over sting.
    try {
      (AudioController as unknown as { playGameOver?: () => void }).playGameOver?.();
    } catch {
      // no-op
    }

    const t = window.setTimeout(() => setPhase("settled"), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const causeLine =
    cause === "elimination"
      ? "The choice was yours."
      : cause === "abandon"
        ? "You walked away."
        : killerName
          ? `${killerName} ended you.`
          : "Something ended you.";

  const handleWatch = () => {
    router.push("/pages/embrace-game/watch");
  };

  const handleLeave = () => {
    if (onLeave) return onLeave();
    if (typeof window !== "undefined") {
      localStorage.removeItem("embrace-game-player");
      window.location.href = "/";
    }
  };

  return (
    <div className="gameover-root fixed inset-0 z-[500] flex items-center justify-center overflow-hidden bg-black">
      {/* Vignette */}
      <div className="gameover-vignette absolute inset-0" />

      {/* Slow red pulse */}
      <div className="gameover-pulse absolute inset-0" />

      {/* Grain */}
      <div className="gameover-grain absolute inset-0 opacity-[0.07]" />

      {/* Content */}
      <div
        className={`relative z-10 mx-auto max-w-2xl px-8 text-center transition-all duration-1000 ${
          phase === "in"
            ? "translate-y-3 opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        {/* Small label */}
        <p className="text-[10px] font-black uppercase tracking-[0.7em] text-red-400/80">
          The Chronicle Closes
        </p>

        {/* Big title */}
        <h1
          className="mt-6 text-6xl font-black uppercase leading-none tracking-tight text-white sm:text-8xl"
          style={{
            textShadow:
              "0 0 60px rgba(248,113,113,0.5), 6px 6px 0 rgba(0,0,0,0.9)",
          }}
        >
          You Died
        </h1>

        {/* Cause */}
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.35em] text-red-200/70">
          {causeLine}
        </p>

        {/* Epitaph */}
        {epitaph ? (
          <p className="mx-auto mt-8 max-w-lg text-lg italic leading-relaxed text-white/70">
            &ldquo;{epitaph}&rdquo;
          </p>
        ) : null}

        {/* Stats */}
        {stats ? (
          <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-3 text-left sm:grid-cols-4">
            <Stat label="Turns" value={stats.turnsSurvived} />
            <Stat label="Battles" value={stats.battlesWon} />
            <Stat label="Kills" value={stats.kills} />
            <Stat label="Houses Left" value={stats.teamsLeft} />
          </div>
        ) : null}

        {/* Divider */}
        <div className="mx-auto mt-10 h-px w-24 bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />

        {/* Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleWatch}
            className="rounded-none border border-red-300/30 bg-red-500/10 px-6 py-3 text-xs font-black uppercase tracking-[0.25em] text-red-100 transition hover:bg-red-500/20"
          >
            Watch the rest
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="rounded-none border border-white/15 bg-white/5 px-6 py-3 text-xs font-black uppercase tracking-[0.25em] text-white/60 transition hover:bg-white/10"
          >
            Leave
          </button>
        </div>

        {/* Footer node title */}
        {nodeTitle ? (
          <p className="mt-10 text-[10px] uppercase tracking-[0.5em] text-white/25">
            Fell at &middot; {nodeTitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small stat tile                                                    */
/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">
        {value ?? "\u2014"}
      </p>
    </div>
  );
}