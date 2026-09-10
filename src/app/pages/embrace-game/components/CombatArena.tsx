"use client";

import { HeartPulse, Shield, Sparkles, Swords } from "lucide-react";
import { useState } from "react";
import type {
  Battle,
  CombatAction,
  CombatVariant,
  Player,
} from "../types/game";

interface Props {
  battle: Battle;
  player?: Player;
  onAction: (action: CombatAction, variant?: CombatVariant) => void;
}
const actions: {
  id: CombatAction;
  label: string;
  hint: string;
  icon: typeof Swords;
}[] = [
  { id: "attack", label: "Attack", hint: "Direct damage", icon: Swords },
  { id: "skill", label: "Skill", hint: "Choose a technique", icon: Sparkles },
  { id: "heal", label: "Heal", hint: "Restore vitality", icon: HeartPulse },
  { id: "block", label: "Block", hint: "Brace for impact", icon: Shield },
  { id: "dodge", label: "Dodge", hint: "Evade the strike", icon: Swords },
];

export default function CombatArena({ battle, player, onAction }: Props) {
  const [skill, setSkill] = useState<CombatVariant>("shadow_strike");
  const [heal, setHeal] = useState<CombatVariant>("minor_heal");
  const [impactPulse, setImpactPulse] = useState(false);
  const canAct = Boolean(
    player?.status === "alive" &&
      player.id === battle.activePlayerId &&
      battle.turnTeamId === player.teamId,
  );
  const lastLog = battle.log.at(-1)?.toLowerCase() ?? "";
  const breakPulse = lastLog.includes("break") || lastLog.includes("stagger");

  function act(action: CombatAction, variant?: CombatVariant) {
    setImpactPulse(true);
    window.setTimeout(() => setImpactPulse(false), 450);
    onAction(action, variant);
  }

  return (
    <section
      className={`relative min-h-[min(720px,calc(100vh-2rem))] overflow-hidden rounded-3xl border border-orange-200/20 bg-[#17120f] shadow-2xl ${impactPulse ? "combat-impact" : ""}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{ backgroundImage: "url('/dark-forest-2.jpeg')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,11,14,.25),rgba(9,11,14,.95)_78%)]" />
      {breakPulse && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-amber-300/10">
          <div className="animate-pulse text-center">
            <div className="text-6xl font-black uppercase tracking-[0.2em] text-amber-200 drop-shadow-[0_0_25px_rgba(253,230,138,.8)] sm:text-8xl">
              BREAK
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-white/80">
              Server reported a stagger
            </p>
          </div>
        </div>
      )}
      <div className="relative z-10 flex min-h-[min(720px,calc(100vh-2rem))] flex-col justify-between p-5 sm:p-8 lg:p-10">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-orange-200/75">
            <Swords className="size-4" /> Live encounter
          </span>
          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            {battle.status} · {battle.turnTeamId} turn
          </span>
        </div>
        <div className="ml-auto w-full max-w-md text-right">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-200/70">
            Abyssal foe
          </p>
          <h2 className="mt-2 text-4xl font-black tracking-tight text-white">
            {battle.enemyName}
          </h2>
          <div className="mt-4 flex justify-between text-xs font-bold text-white/50">
            <span>Vitality</span>
            <span>
              {battle.enemyHp} / {battle.enemyMaxHp}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, (battle.enemyHp / battle.enemyMaxHp) * 100))}%`,
              }}
            />
          </div>
        </div>
        <div className="w-full max-w-xl">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">
                Your combatant
              </p>
              <h2 className="mt-1 text-3xl font-black">
                {player?.name ?? "Waiting for your player"}
              </h2>
            </div>
            {player && (
              <div className="text-right text-xs text-white/55">
                <div>
                  {player.hp} / {player.maxHp} HP
                </div>
                <div className="mt-1 text-cyan-200/70">
                  {player.connected ? "Connected" : "Offline"} ·{" "}
                  {player.ready ? "Ready" : "Not ready"}
                </div>
              </div>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all duration-500"
              style={{
                width: `${player ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0}%`,
              }}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
            {actions.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={!canAct}
                onClick={() =>
                  act(
                    id,
                    id === "skill" ? skill : id === "heal" ? heal : undefined,
                  )
                }
                className="group rounded-2xl border border-white/15 bg-black/35 p-3 text-left transition hover:-translate-y-1 hover:border-cyan-200/60 hover:bg-cyan-100/10 disabled:cursor-not-allowed disabled:opacity-35 sm:p-4"
              >
                <Icon className="size-5 text-white/75 transition group-hover:text-cyan-200" />
                <span className="mt-3 block text-xs font-black uppercase tracking-wider">
                  {label}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-white/40">
                  {hint}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              aria-label="Skill"
              value={skill}
              disabled={!canAct}
              onChange={(event) =>
                setSkill(event.target.value as CombatVariant)
              }
              className="rounded-xl border border-violet-200/30 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value="shadow_strike">Shadow Strike</option>
              <option value="blood_rage">Blood Rage</option>
              <option value="fire_burst">Fire Burst</option>
              <option value="void_blast">Void Blast</option>
            </select>
            <select
              aria-label="Heal"
              value={heal}
              disabled={!canAct}
              onChange={(event) => setHeal(event.target.value as CombatVariant)}
              className="rounded-xl border border-emerald-200/30 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value="minor_heal">Minor Heal</option>
              <option value="major_heal">Major Heal</option>
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            Battle log
          </p>
          <div className="mt-2 space-y-1 text-sm text-white/65">
            {battle.log.slice(-5).map((entry, index, visibleLog) => (
              <p
                key={`${entry}-${visibleLog.slice(0, index).filter((item) => item === entry).length}`}
              >
                {entry}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
