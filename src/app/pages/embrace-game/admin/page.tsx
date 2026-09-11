"use client";

import { useEffect, useMemo, useState } from "react";
import { socket } from "../lib/websocket";

type Role = "scouter" | "executioner";

type TeamId = "ravens" | "wolves" | "dragons" | "serpents";

type TeamCounts = Record<TeamId, number>;

type RosterPlayer = {
  id: string;
  name: string;
  status?: "alive" | "eliminated";
};

type Room = {
  roomCode: string;
  phase: "waiting" | "story" | "battle" | "finished";
  playerCount: number;
  teams: TeamCounts;
  teamCaps?: Partial<TeamCounts>;
  // Optional — populate this on ROOM_LIST_UPDATE to show real rosters below.
  players?: Partial<Record<TeamId, RosterPlayer[]>>;
};

const TEAM_IDS: TeamId[] = ["ravens", "wolves", "dragons", "serpents"];

const TEAM_LABELS: Record<TeamId, string> = {
  ravens: "Ravens",
  wolves: "Wolves",
  dragons: "Dragons",
  serpents: "Serpents",
};

const TEAM_ACCENT: Record<TeamId, string> = {
  ravens: "#67e8f9",
  wolves: "#a5b4fc",
  dragons: "#fca5a5",
  serpents: "#86efac",
};

const DEFAULT_CAP = 3;
const MIN_POPULATED_TEAMS = 2;

// Clipped-corner glass silhouette shared across panels.
const clip = (px = 20) => ({
  clipPath: `polygon(0 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% 100%, ${px}px 100%, 0 calc(100% - ${px}px))`,
});

function CornerTicks({ accent = "rgba(255,255,255,.25)" }: { accent?: string }) {
  return (
    <>
      <span
        className="pointer-events-none absolute left-3 top-3 size-3 border-l border-t"
        style={{ borderColor: accent }}
      />
      <span
        className="pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r"
        style={{ borderColor: accent }}
      />
    </>
  );
}

export default function AdminPage() {
  const [role, setRole] = useState<Role>("scouter");
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("disconnected");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamId>("ravens");

  // Draft caps per room while the admin configures approval.
  const [caps, setCaps] = useState<Record<string, TeamCounts>>({});

  useEffect(() => {
    socket.connect();

    const stopStatus = socket.onStatus(setStatus);
    const stopMessages = socket.onMessage((event) => {
      if (event.type === "ROOM_LIST_UPDATE") {
        setRooms((event.rooms ?? []) as unknown as Room[]);
      }

      if (event.type === "STATE_SYNC") {
        const payload = event.payload as { error?: string };
        if (payload?.error) setMessage(payload.error);
      }
    });

    socket.send({ type: "ADMIN_GET_ROOMS" });

    return () => {
      stopStatus();
      stopMessages();
      socket.disconnect();
    };
  }, []);

  const isLive = status === "connected";

  const primaryRoom = useMemo<Room | undefined>(() => rooms[0], [rooms]);

  function capsFor(roomCode: string): TeamCounts {
    return (
      caps[roomCode] ?? {
        ravens: DEFAULT_CAP,
        wolves: DEFAULT_CAP,
        dragons: DEFAULT_CAP,
        serpents: DEFAULT_CAP,
      }
    );
  }

  function setCap(roomCode: string, team: TeamId, value: number) {
    const next = { ...capsFor(roomCode), [team]: Math.max(1, value) };
    setCaps((prev) => ({ ...prev, [roomCode]: next }));
  }

  function populatedTeams(room: Room): TeamId[] {
    return TEAM_IDS.filter((id) => (room.teams[id] ?? 0) > 0);
  }

 function approveRoom(room: Room) {
  const populated = populatedTeams(room);

  if (populated.length < MIN_POPULATED_TEAMS) {
    setMessage(
      `Cannot activate: at least ${MIN_POPULATED_TEAMS} teams must have players. Currently populated: ${
        populated.length === 0
          ? "none"
          : populated.map((id) => TEAM_LABELS[id]).join(", ")
      }.`,
    );
    return;
  }

  const draftCaps = capsFor(room.roomCode);
  const teamCaps = Object.fromEntries(
    populated.map((id) => [id, draftCaps[id]]),
  ) as Partial<TeamCounts>;

  socket.send({
    type: "ADMIN_APPROVE_ROOM",
    roomId: room.roomCode,
    teamCaps,
  });

  setMessage(
    `${room.roomCode} activated. Teams in rotation: ${populated
      .map((id) => `${TEAM_LABELS[id]}=${teamCaps[id]}`)
      .join(", ")}.`,
  );
}

  function eliminatePlayer() {
    const playerId = targetPlayerId.trim();
    if (!playerId) {
      setMessage("Enter a player id to eliminate.");
      return;
    }

    socket.send({ type: "ELIMINATE", playerId });
    setMessage(`Elimination command issued for ${playerId}.`);
    setTargetPlayerId("");
  }

  function assignTeam(teamId: TeamId) {
    socket.send({ type: "TEAM_TURN", teamId });
    setSelectedTeam(teamId);
    setMessage(`Turn assigned to ${TEAM_LABELS[teamId]}.`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050709] p-6 text-white sm:p-8">
      {/* faint scan texture behind everything */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:100%_3px]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-200/50">
              Game administration
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              THE CONTROL ROOM
            </h1>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-widest ${
              isLive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            <span className="relative flex size-2">
              {isLive ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              ) : null}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  isLive ? "bg-emerald-400" : "bg-white/30"
                }`}
              />
            </span>
            {isLive ? "Live" : status}
          </div>
        </header>

        {/* ROOM MONITOR */}
        <section
          style={clip(28)}
          className="relative mb-8 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-7"
        >
          <CornerTicks accent="rgba(103,232,249,.3)" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">
                Live monitoring
              </p>
              <h2 className="mt-1 text-2xl font-bold">Room control</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {rooms.length === 0 && (
              <div
                style={clip(16)}
                className="border border-white/10 bg-black/30 p-6 text-white/40"
              >
                No active game. A room appears once the first player joins.
              </div>
            )}

            {rooms.map((room) => {
              const roomCaps = capsFor(room.roomCode);
              const isConfigurable = room.phase === "waiting";
              const populated = populatedTeams(room);
              const canActivate = populated.length >= MIN_POPULATED_TEAMS;

              return (
                <div
                  key={room.roomCode}
                  style={clip(20)}
                  className="relative border border-white/10 bg-black/40 p-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">
                        Room
                      </p>
                      <h3 className="text-3xl font-black">
                        {room.roomCode === "global"
                          ? "Global Chronicle"
                          : room.roomCode}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/50">
                        {room.phase}
                      </span>
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                          Players
                        </p>
                        <p className="text-3xl font-black tabular-nums">
                          {room.playerCount}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {TEAM_IDS.map((id) => {
                      const current = room.teams[id] ?? 0;
                      const cap = roomCaps[id];
                      const atCap = current >= cap;
                      const accent = TEAM_ACCENT[id];
                      const roster = room.players?.[id];

                      return (
                        <div
                          key={id}
                          className={`rounded-xl border p-4 ${
                            atCap
                              ? "border-amber-400/40 bg-amber-400/10"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p
                              className="text-xs font-bold uppercase tracking-widest"
                              style={{ color: accent }}
                            >
                              {TEAM_LABELS[id]}
                            </p>
                            {selectedTeam === id ? (
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: accent }}
                              />
                            ) : null}
                          </div>

                          {isConfigurable ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={cap}
                                onChange={(e) =>
                                  setCap(
                                    room.roomCode,
                                    id,
                                    Number(e.target.value),
                                  )
                                }
                                className="w-16 rounded-md border border-white/10 bg-black px-2 py-1 text-center text-xl font-bold outline-none focus:border-cyan-200/50"
                              />
                              <span className="text-xs uppercase text-white/40">
                                cap
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-2xl font-bold tabular-nums">
                              {current}
                              {cap ? ` / ${cap}` : ""}
                            </p>
                          )}

                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
                            {current} joined
                          </p>

                          {/* Roster */}
                          <ul className="mt-3 space-y-1 border-t border-white/10 pt-2">
                            {roster && roster.length > 0 ? (
                              roster.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span
                                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                                      p.status === "eliminated"
                                        ? "bg-white/10 text-white/30 line-through"
                                        : "text-black"
                                    }`}
                                    style={
                                      p.status === "eliminated"
                                        ? undefined
                                        : { background: accent }
                                    }
                                  >
                                    {p.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span
                                    className={`truncate ${
                                      p.status === "eliminated"
                                        ? "text-white/30 line-through"
                                        : "text-white/70"
                                    }`}
                                  >
                                    {p.name}
                                  </span>
                                </li>
                              ))
                            ) : (
                              <li className="text-[11px] text-white/25">
                                {current > 0
                                  ? "Roster data not available."
                                  : "No players yet."}
                              </li>
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {room.phase === "waiting" && !canActivate ? (
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-300/70">
                        Waiting on at least {MIN_POPULATED_TEAMS} populated
                        teams ({populated.length} so far)
                      </p>
                    ) : (
                      <span />
                    )}

                    {room.phase === "waiting" && (
                      <button
                        type="button"
                        disabled={!canActivate}
                        onClick={() => approveRoom(room)}
                        title={
                          canActivate
                            ? "Activate the room"
                            : `At least ${MIN_POPULATED_TEAMS} teams must have players`
                        }
                        className={`rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest transition ${
                          canActivate
                            ? "bg-cyan-200 text-slate-950 hover:bg-cyan-100"
                            : "cursor-not-allowed bg-white/10 text-white/30"
                        }`}
                      >
                        Activate room
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles */}
        <div className="mb-6 flex flex-wrap gap-3">
          {(
            [
              ["scouter", "Scouter"],
              ["executioner", "Executioner"],
            ] as [Role, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`rounded-xl border px-5 py-3 text-sm font-bold uppercase tracking-widest transition ${
                role === value
                  ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SCOUTER */}
        {role === "scouter" && (
          <section
            style={clip(24)}
            className="relative border border-white/10 bg-white/[0.03] p-8"
          >
            <CornerTicks accent="rgba(103,232,249,.3)" />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/50">
              Turn control
            </p>
            <h2 className="mt-1 text-2xl font-bold">Scouter</h2>
            <p className="mt-2 text-white/40">Decide which team acts next.</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEAM_IDS.map((id) => {
                const accent = TEAM_ACCENT[id];
                const active = selectedTeam === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => assignTeam(id)}
                    style={
                      active
                        ? {
                            borderColor: accent,
                            boxShadow: `0 0 0 1px ${accent}, 0 0 20px -4px ${accent}`,
                          }
                        : undefined
                    }
                    className={`rounded-xl border p-6 text-left font-bold transition ${
                      active
                        ? "bg-white/5"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className="mb-1 block h-1 w-8 rounded-full"
                      style={{ background: accent }}
                    />
                    {TEAM_LABELS[id]}
                  </button>
                );
              })}
            </div>

            {primaryRoom ? (
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/30">
                Current turn is set on the server; picking a team broadcasts
                TEAM_TURN to every client.
              </p>
            ) : null}
          </section>
        )}

        {/* EXECUTIONER */}
        {role === "executioner" && (
          <section
            style={clip(24)}
            className="relative border border-red-500/25 bg-red-500/5 p-8"
          >
            <CornerTicks accent="rgba(248,113,113,.35)" />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-300/60">
              Combat override
            </p>
            <h2 className="mt-1 text-2xl font-bold">Executioner</h2>
            <p className="mt-2 text-white/40">
              Eliminate players who have fallen in battle.
            </p>

            <input
              type="text"
              value={targetPlayerId}
              onChange={(e) => setTargetPlayerId(e.target.value)}
              placeholder="Player id"
              className="mt-6 w-full rounded-xl border border-white/10 bg-black p-4 font-mono text-sm outline-none focus:border-red-300/50"
            />

            <button
              type="button"
              onClick={eliminatePlayer}
              className="mt-4 rounded-xl bg-red-600 px-6 py-3 text-sm font-black uppercase tracking-widest transition hover:bg-red-500"
            >
              Execute player
            </button>
          </section>
        )}

        {message && (
          <div
            style={clip(16)}
            className="mt-6 border border-white/10 bg-white/5 p-4 text-sm text-white/70"
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}