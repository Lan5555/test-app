"use client";

import type { Player, Team } from "../types/game";

interface Props {
  team: Team;
  active?: boolean;
}

export default function TeamPanel({ team, active }: Props) {
  const alive = team.players.filter(
    (player: Player) => player.status === "alive",
  );

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
      <div
        className="
        flex
        items-center
        justify-between
      "
      >
        <div>
          <div
            className="
            text-xs
            uppercase
            tracking-widest
            text-white/40
          "
          >
            Team
          </div>

          <h2 className="text-xl font-bold">{team.name}</h2>
        </div>

        {active && (
          <div
            className="
            rounded-full
            bg-white
            px-3
            py-1
            text-xs
            font-bold
            text-black
          "
          >
            ACTIVE
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {team.players.map((player: Player) => (
          <div key={player.id}>
            <div
              className="
              mb-1
              flex
              justify-between
              text-xs
            "
            >
              <span>{player.name}</span>

              <span className="text-white/40">
                {player.hp}/{player.maxHp}
              </span>
            </div>

            <div
              className="
              h-1.5
              overflow-hidden
              rounded-full
              bg-white/10
            "
            >
              <div
                className="h-full bg-white transition-all duration-700"
                style={{
                  width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}

        <p
          className="
          pt-2
          text-xs
          text-white/40
        "
        >
          {team.players.length}{" "}
          {team.players.length === 1 ? "player" : "players"}
          {" · "}
          {alive.length} survivors
        </p>
      </div>
    </div>
  );
}
