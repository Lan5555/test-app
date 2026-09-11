"use client";

import { Lock, Shield, Sparkles, Wind, Zap } from "lucide-react";
import type { Player, StatusEffect, Team } from "../types/game";

interface Props {
  team: Team;
  active?: boolean;
}

type StatusId =
  | "immobilized"
  | "guarded"
  | "evading"
  | "enraged"
  | "blessed";

const STATUS_META: Record<
  StatusId,
  { label: string; icon: typeof Lock; tone: string; description: string }
> = {
  immobilized: {
    label: "Immobilized",
    icon: Lock,
    tone: "text-amber-200 border-amber-300/40 bg-amber-400/10",
    description: "Cannot act until the effect wears off.",
  },
  guarded: {
    label: "Guarded",
    icon: Shield,
    tone: "text-cyan-200 border-cyan-300/40 bg-cyan-400/10",
    description: "Incoming damage reduced.",
  },
  evading: {
    label: "Evading",
    icon: Wind,
    tone: "text-emerald-200 border-emerald-300/40 bg-emerald-400/10",
    description: "Chance to dodge the next strike.",
  },
  enraged: {
    label: "Enraged",
    icon: Zap,
    tone: "text-red-200 border-red-300/40 bg-red-400/10",
    description: "Deals increased damage.",
  },
  blessed: {
    label: "Blessed",
    icon: Sparkles,
    tone: "text-violet-200 border-violet-300/40 bg-violet-400/10",
    description: "Heals a small amount each round.",
  },
};

function statusLabel(player: Player): {
  text: string;
  tone: string;
} {
  switch (player.status) {
    case "defeated":
      return { text: "DEFEATED", tone: "text-red-300" };
    case "eliminated":
      return { text: "ELIMINATED", tone: "text-red-300/80" };
    case "spectator":
      return { text: "SPECTATOR", tone: "text-white/30" };
    default:
      return { text: "", tone: "" };
  }
}

export default function TeamPanel({ team, active }: Props) {
  const alive = team.players.filter((p) => p.status === "alive");
  const defeated = team.players.filter((p) => p.status === "defeated");
  const eliminated = team.players.filter((p) => p.status === "eliminated");

  return (
    <div
      className={`
        rounded-2xl
        border
        p-5
        transition
        duration-500

        ${
          active
            ? "border-white/30 bg-white/10 shadow-2xl"
            : "border-white/10 bg-white/3"
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">
            Team
          </div>
          <h2 className="text-xl font-bold">{team.name}</h2>
        </div>

        {active && (
          <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
            ACTIVE
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {team.players.map((player) => {
          const pct = Math.max(
            0,
            Math.min(100, (player.hp / player.maxHp) * 100),
          );

          const statuses = (player.statusEffects ?? []) as StatusEffect[];
          const broken = statuses.some((s) => s.id === "immobilized");
          const down = player.status !== "alive";
          const isDefeated = player.status === "defeated";
          const isEliminated = player.status === "eliminated";
          const label = statusLabel(player);

          return (
            <div
              key={player.id}
              className={`rounded-lg border px-3 py-2 transition ${
                broken
                  ? "border-amber-300/50 bg-amber-400/10"
                  : isDefeated
                    ? "border-red-400/40 bg-red-500/10"
                    : isEliminated
                      ? "border-red-300/20 bg-red-500/5"
                      : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`truncate text-xs font-bold uppercase tracking-wider ${
                      down ? "text-white/40 line-through" : "text-white/80"
                    }`}
                  >
                    {player.name}
                  </span>

                  {broken && !down ? (
                    <span className="rounded-sm bg-amber-400 px-1 text-[8px] font-black uppercase text-black">
                      BRK
                    </span>
                  ) : null}

                  {label.text ? (
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${label.tone}`}
                    >
                      {label.text}
                    </span>
                  ) : null}
                </div>

                <span className="shrink-0 text-xs tabular-nums text-white/40">
                  {down ? "0" : player.hp}/{player.maxHp}
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isDefeated
                      ? "bg-red-400/60"
                      : isEliminated
                        ? "bg-red-300/40"
                        : "bg-gradient-to-r from-cyan-500 to-cyan-300"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {statuses.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {statuses.map((s) => {
                    const meta = STATUS_META[s.id];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={s.id}
                        title={`${meta.label} · ${s.turns} turn${
                          s.turns > 1 ? "s" : ""
                        }`}
                        className={`flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.tone}`}
                      >
                        <Icon className="size-2.5" />
                        {meta.label}
                        <span className="text-white/50">· {s.turns}</span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        <p className="pt-2 text-xs text-white/40">
          {team.players.length}{" "}
          {team.players.length === 1 ? "player" : "players"}
          {" · "}
          {alive.length} alive
          {defeated.length > 0 ? ` · ${defeated.length} defeated` : ""}
          {eliminated.length > 0 ? ` · ${eliminated.length} eliminated` : ""}
        </p>
      </div>
    </div>
  );
}