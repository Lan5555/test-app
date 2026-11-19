"use client";

import type { Player, Team } from "../types/game";
import CombatStatuses from "./CombatStatuses";

interface Props {
  team: Team;
  active?: boolean;
}

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
      data-active={active || undefined}
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

          const statuses = player.statusEffects ?? [];
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

              {!down && <CombatStatuses effects={statuses} />}
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
