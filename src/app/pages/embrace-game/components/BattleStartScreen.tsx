"use client";

import { useEffect, useState } from "react";
import FloatingParticles from "../components/FloatingParticles";
import BattleIntro from "./BattleIntro";
import { AudioController } from "../hooks/audioHandler";

export default function BattleStartScreen({
  enemyName,
  mode,
  attackerTeamId,
  defenderTeamId,
  onStart,
}: {
  enemyName: string;
  mode: "team" | "cpu";
  attackerTeamId?: string;
  defenderTeamId?: string;
  onStart: () => void;
}) {
  const [introPlaying, setIntroPlaying] = useState(false);
  const [shake, setShake] = useState(false);
  const [ready, setReady] = useState(false);

  // Entrance
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  // Pre-battle ambient shake
  useEffect(() => {
    const id = window.setInterval(() => {
      setShake(true);
      window.setTimeout(() => setShake(false), 600);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  function handleStart() {
    if(enemyName === 'NICHOLAS JOHNSON'){
        AudioController.playBossSSong();
        setIntroPlaying(true);
        return;
    }
    AudioController.playBattleSong();
    setIntroPlaying(true);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050507] text-white">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[url('/dark-forest-2.jpeg')] bg-cover bg-center opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.75),rgba(0,0,0,.95))]" />
      <FloatingParticles />

      {/* Red vignette pulse */}
      <div className="battle-prep-vignette pointer-events-none absolute inset-0" />

      <div
        className={`relative z-10 flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center ${
          shake ? "battle-intro-shake" : ""
        } ${ready ? "opacity-100" : "opacity-0"} transition-opacity duration-700`}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-red-300/80">
            {mode === "cpu" ? "An enemy appears" : "A clash is coming"}
          </p>
          <div className="h-px w-40 bg-gradient-to-r from-transparent via-red-300/60 to-transparent" />
        </div>

        {/* Enemy / matchup */}
        <div className="flex flex-col items-center">
          <h1
            className="max-w-[90vw] text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-7xl"
            style={{
              textShadow:
                "0 0 40px rgba(248,113,113,.45), 6px 6px 0 rgba(0,0,0,.85)",
            }}
          >
            {enemyName}
          </h1>

          {mode === "team" && attackerTeamId && defenderTeamId ? (
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.4em] text-white/50">
              {attackerTeamId} · vs · {defenderTeamId}
            </p>
          ) : null}
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <InfoChip label="Mode" value={mode === "cpu" ? "Enemy AI" : "PvP"} />
          <InfoChip label="Stakes" value="Turn order" />
          <InfoChip label="Music" value="Battle theme" />
        </div>

        {/* Start button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={introPlaying}
          className="group relative mt-4 overflow-hidden rounded-xl border border-red-300/40 bg-red-500/10 px-10 py-4 text-sm font-black uppercase tracking-[0.35em] text-red-50 transition hover:border-red-200/70 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="battle-prep-button-pulse absolute inset-0 -z-10 rounded-xl bg-red-400/10" />
          {introPlaying ? "Begin" : "Start battle"}
        </button>

        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">
          Press to enter the encounter
        </p>
      </div>

      {introPlaying ? (
        <BattleIntro
          enemyName={enemyName}
          mode={mode}
          attackerTeamId={attackerTeamId}
          defenderTeamId={defenderTeamId}
          onDone={onStart}
        />
      ) : null}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">
        {label}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/75">
        {value}
      </span>
    </div>
  );
}