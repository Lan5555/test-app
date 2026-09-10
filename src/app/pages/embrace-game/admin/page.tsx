"use client";

import { useEffect, useMemo, useState } from "react";
import { socket } from "../lib/websocket";

type Role = "executioner" | "chronicler" | "scouter";

type TeamId = "ravens" | "wolves" | "dragons" | "serpents";

type TeamCounts = Record<TeamId, number>;

type Room = {
  roomCode: string;
  phase: "waiting" | "story" | "battle" | "finished";
  playerCount: number;
  teams: TeamCounts;
  teamCaps?: Partial<TeamCounts>;
};

const TEAM_IDS: TeamId[] = ["ravens", "wolves", "dragons", "serpents"];

const TEAM_LABELS: Record<TeamId, string> = {
  ravens: "Ravens",
  wolves: "Wolves",
  dragons: "Dragons",
  serpents: "Serpents",
};

const DEFAULT_CAP = 3;
const MIN_POPULATED_TEAMS = 2;

export default function AdminPage() {
  const [role, setRole] = useState<Role>("chronicler");
  const [json, setJson] = useState("");
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
    const teamCaps = capsFor(room.roomCode);
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

    socket.send({
      type: "ADMIN_APPROVE_ROOM",
      roomId: room.roomCode,
      teamCaps,
    });

    setMessage(
      `${room.roomCode} activated with caps ${TEAM_IDS.map(
        (id) => `${TEAM_LABELS[id]}=${teamCaps[id]}`,
      ).join(", ")}.`,
    );
  }

  async function importStory() {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const res = await fetch("/game/api/story/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: parsed }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      setMessage("Story imported successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Invalid story: ${error.message}`
          : "Invalid JSON story.",
      );
    }
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
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.4em] text-white/30">
            Game Administration
          </p>
          <h1 className="mt-2 text-5xl font-black">THE CONTROL ROOM</h1>
        </header>

        {/* ROOM MONITOR */}
        <section className="mb-10 rounded-3xl border border-white/10 bg-white/3 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/30">
                Live monitoring
              </p>
              <h2 className="mt-1 text-2xl font-bold">ROOM CONTROL</h2>
            </div>

            <div
              className={`flex items-center gap-2 text-xs ${
                isLive ? "text-green-400" : "text-white/40"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isLive ? "bg-green-400" : "bg-white/30"
                }`}
              />
              {isLive ? "LIVE" : status.toUpperCase()}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {rooms.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/40">
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
                  className="rounded-2xl border border-white/10 bg-black/40 p-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/30">
                        Room
                      </p>
                      <h3 className="text-3xl font-black">
                        {room.roomCode === "global"
                          ? "Global Chronicle"
                          : room.roomCode}
                      </h3>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-xs uppercase text-white/30">
                        Players
                      </p>
                      <p className="text-3xl font-black">{room.playerCount}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {TEAM_IDS.map((id) => {
                      const current = room.teams[id] ?? 0;
                      const cap = roomCaps[id];
                      const atCap = current >= cap;

                      return (
                        <div
                          key={id}
                          className={`rounded-xl border p-4 ${
                            atCap
                              ? "border-amber-400/40 bg-amber-400/10"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <p className="text-xs text-white/30">
                            {TEAM_LABELS[id]}
                          </p>

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
                                className="w-16 rounded-md border border-white/10 bg-black px-2 py-1 text-center text-xl font-bold outline-none"
                              />
                              <span className="text-xs uppercase text-white/40">
                                cap
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-2xl font-bold">
                              {current}
                              {cap ? ` / ${cap}` : ""}
                            </p>
                          )}

                          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
                            {current} joined
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/50">
                      {room.phase}
                    </span>

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
                        className={`rounded-xl px-6 py-3 font-bold transition ${
                          canActivate
                            ? "bg-white text-black hover:bg-white/80"
                            : "cursor-not-allowed bg-white/20 text-white/40"
                        }`}
                      >
                        ACTIVATE ROOM
                      </button>
                    )}
                  </div>

                  {room.phase === "waiting" && !canActivate ? (
                    <p className="mt-3 text-xs uppercase tracking-widest text-amber-300/70">
                      Waiting on at least {MIN_POPULATED_TEAMS} populated teams
                      ({populated.length} so far)
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles */}
        <div className="mb-8 flex flex-wrap gap-3">
          {(
            [
              ["chronicler", "📜 Chronicler"],
              ["scouter", "🦅 Scouter"],
              ["executioner", "☠ Executioner"],
            ] as [Role, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`rounded-xl border px-5 py-3 ${
                role === value
                  ? "border-white bg-white text-black"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* CHRONICLER */}
        {role === "chronicler" && (
          <section className="rounded-3xl border border-white/10 bg-white/3 p-6">
            <h2 className="text-2xl font-bold">Create Story</h2>
            <p className="mt-2 text-white/40">
              Upload or paste your story JSON.
            </p>

            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={`{
  "start": {
    "id": "start",
    "title": "The Beginning",
    "text": "...",
    "choices": []
  }
}`}
              className="mt-6 min-h-100 w-full rounded-xl border border-white/10 bg-black p-5 font-mono text-sm outline-none"
            />

            <button
              type="button"
              onClick={importStory}
              className="mt-4 rounded-xl bg-white px-6 py-3 font-bold text-black"
            >
              Import Story
            </button>
          </section>
        )}

        {/* SCOUTER */}
        {role === "scouter" && (
          <section className="rounded-3xl border border-white/10 bg-white/3 p-8">
            <h2 className="text-2xl font-bold">Scouter</h2>
            <p className="mt-2 text-white/40">Decide which team acts next.</p>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {TEAM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => assignTeam(id)}
                  className={`rounded-xl border p-6 font-bold transition ${
                    selectedTeam === id
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {TEAM_LABELS[id]}
                </button>
              ))}
            </div>

            {primaryRoom ? (
              <p className="mt-4 text-xs uppercase tracking-widest text-white/40">
                Current turn is set on the server; picking a team broadcasts
                TEAM_TURN to every client.
              </p>
            ) : null}
          </section>
        )}

        {/* EXECUTIONER */}
        {role === "executioner" && (
          <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8">
            <h2 className="text-2xl font-bold">Executioner</h2>
            <p className="mt-2 text-white/40">
              Eliminate players who have fallen in battle.
            </p>

            <input
              type="text"
              value={targetPlayerId}
              onChange={(e) => setTargetPlayerId(e.target.value)}
              placeholder="Player id"
              className="mt-6 w-full rounded-xl border border-white/10 bg-black p-4 font-mono text-sm outline-none"
            />

            <button
              type="button"
              onClick={eliminatePlayer}
              className="mt-4 rounded-xl bg-red-600 px-6 py-3 font-bold"
            >
              Execute Player
            </button>
          </section>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}