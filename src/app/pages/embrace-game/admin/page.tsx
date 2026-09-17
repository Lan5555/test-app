"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, LogOut, ShieldCheck, X } from "lucide-react";
import { socket } from "../lib/websocket";
import type { AdminPlayerSummary, TeamId } from "../types/game";

type Role = "scouter" | "executioner";

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

const TEAM_ACCENT: Record<TeamId, string> = {
  ravens: "#67e8f9",
  wolves: "#a5b4fc",
  dragons: "#fca5a5",
  serpents: "#86efac",
};

const DEFAULT_CAP = 3;
const MIN_POPULATED_TEAMS = 2;
const ADMIN_SESSION_KEY = "embrace-admin-session";

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
        className="pointer-events-none absolute bottom-3 right-3 size-b-3 border-b border-r"
        style={{ borderColor: accent }}
      />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Login modal                                                      */
/* ---------------------------------------------------------------- */

function AdminLoginModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (password: string) => void;
  onClose?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit() {
    if (busy) return;
    const value = password.trim();
    if (value.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }
    setBusy(true);
    setError("");
    // Hand off to the parent; parent decides whether to accept.
    onSubmit(value);
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        style={clip(28)}
        className="relative w-full max-w-md border border-cyan-200/20 bg-[#0a0f13] p-8 shadow-2xl"
      >
        <CornerTicks accent="rgba(103,232,249,.35)" />

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-200/10">
            <ShieldCheck className="size-6 text-cyan-200" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200/60">
              Restricted area
            </p>
            <h1 className="mt-1 text-xl font-black uppercase tracking-wider">
              Admin Access
            </h1>
          </div>
        </div>

        <p className="mt-6 text-sm text-white/50">
          Enter the admin password to unlock the control room.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="••••••••"
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-black py-3 pl-11 pr-11 font-mono text-sm text-white outline-none transition focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-rose-300/80">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-cyan-200 py-3 text-sm font-black uppercase tracking-widest text-slate-950 transition hover:bg-cyan-100 disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Enter control room"}
        </button>

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">
          Unauthorized access is logged
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */

export default function AdminPage() {
  /* ---- Auth ---- */
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  /* ---- Live state ---- */
  const [role, setRole] = useState<Role>("scouter");
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [players, setPlayers] = useState<AdminPlayerSummary[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("disconnected");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamId>("ravens");

  /* ---- Caps draft ---- */
  const [caps, setCaps] = useState<Record<string, TeamCounts>>({});

  /* ---- Kick confirm ---- */
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Restore session                                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (stored) {
      setIsAuthed(true);
    }
    setHydrated(true);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Socket (only when authed)                                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isAuthed) return;

    socket.connect();

    const stopStatus = socket.onStatus(setStatus);
    const stopMessages = socket.onMessage((event) => {
      if (event.type === "ROOM_LIST_UPDATE") {
        setRooms((event.rooms ?? []) as unknown as Room[]);
      }

      if (event.type === "PLAYER_LIST_UPDATE") {
        setPlayers(event.players ?? []);
      }

      if (event.type === "STATE_SYNC") {
        const payload = event.payload as { error?: string };
        if (payload?.error) setMessage(payload.error);
      }
    });

    // Ask for the current roster right away.
    socket.send({ type: "ADMIN_GET_ROOMS" });

    return () => {
      stopStatus();
      stopMessages();
      socket.disconnect();
    };
  }, [isAuthed]);

  const isLive = status === "connected";

  const primaryRoom = useMemo<Room | undefined>(() => rooms[0], [rooms]);

  /* ------------------------------------------------------------------ */
  /* Auth                                                              */
  /* ------------------------------------------------------------------ */
  function handleLogin(password: string) {
    // Local client-side check. Replace with a server-side verification
    // if you want real security.
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "highlands";
    if (password !== expected) {
      setLoginError("Incorrect password.");
      return;
    }

    sessionStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({ authedAt: Date.now() }),
    );
    setIsAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthed(false);
    setPlayers([]);
    setRooms([]);
  }

  /* ------------------------------------------------------------------ */
  /* Room helpers                                                       */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* Player / turn actions                                              */
  /* ------------------------------------------------------------------ */
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

  function kickPlayer(playerId: string) {
    socket.send({ type: "ADMIN_KICK_PLAYER", playerId });
    setMessage(`Kick command issued for ${playerId}.`);
    setKickConfirm(null);
  }

  function assignTeam(teamId: TeamId) {
    socket.send({ type: "TEAM_TURN", teamId });
    setSelectedTeam(teamId);
    setMessage(`Turn assigned to ${TEAM_LABELS[teamId]}.`);
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050709] text-white/40">
        <p className="text-xs font-black uppercase tracking-[0.4em]">
          Loading…
        </p>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#050709] text-white">
        <div className="pointer-events-none fixed inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:100%_3px]" />
        <AdminLoginModal onSubmit={handleLogin} />
      </main>
    );
  }

  const onlineCount = players.filter((p) => p.connected).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050709] p-6 text-white sm:p-8">
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

          <div className="flex items-center gap-3">
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

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* CONNECTED PLAYERS */}
        <section
          style={clip(28)}
          className="relative mb-8 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-7"
        >
          <CornerTicks accent="rgba(103,232,249,.3)" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">
                Connected players
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                Roster
                <span className="ml-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-emerald-300">
                  {onlineCount} online
                </span>
              </h2>
            </div>
          </div>

          {players.length === 0 ? (
            <div
              style={clip(16)}
              className="mt-6 border border-white/10 bg-black/30 p-6 text-sm text-white/40"
            >
              No players yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {players.map((p) => {
                const accent = TEAM_ACCENT[p.teamId];
                const pct =
                  p.maxHp > 0 ? Math.round((p.hp / p.maxHp) * 100) : 0;

                return (
                  <div
                    key={p.id}
                    style={clip(14)}
                    className={`relative border p-4 ${
                      p.connected
                        ? "border-white/10 bg-black/30"
                        : "border-white/5 bg-black/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${
                              p.connected ? "bg-emerald-400" : "bg-white/25"
                            }`}
                            style={
                              p.connected
                                ? { boxShadow: `0 0 8px ${accent}` }
                                : undefined
                            }
                          />
                          <p
                            className={`truncate text-sm font-bold ${
                              p.status === "alive"
                                ? "text-white"
                                : "text-white/40 line-through"
                            }`}
                          >
                            {p.name}
                          </p>
                        </div>
                        <p
                          className="mt-0.5 text-[10px] font-black uppercase tracking-widest"
                          style={{ color: accent }}
                        >
                          {TEAM_LABELS[p.teamId]} · {p.status}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-white/30">
                          {p.id}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setKickConfirm(p.id)}
                        className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:bg-rose-500/20"
                      >
                        Kick
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/35">
                        <span>HP</span>
                        <span className="tabular-nums">
                          {p.hp}/{p.maxHp}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 60
                              ? "bg-emerald-400"
                              : pct >= 30
                                ? "bg-amber-400"
                                : "bg-rose-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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
                            {players.filter((p) => p.teamId === id).length >
                            0 ? (
                              players
                                .filter((p) => p.teamId === id)
                                .map((p) => (
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
                                    {!p.connected ? (
                                      <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-white/25">
                                        offline
                                      </span>
                                    ) : null}
                                  </li>
                                ))
                            ) : (
                              <li className="text-[11px] text-white/25">
                                No players yet.
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

        {/* Kick confirmation modal */}
        {kickConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div
              style={clip(24)}
              className="relative w-full max-w-md border border-rose-500/30 bg-[#0a0f13] p-6"
            >
              <CornerTicks accent="rgba(248,113,113,.4)" />
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-300/60">
                Confirm action
              </p>
              <h3 className="mt-2 text-xl font-black">Kick this player?</h3>
              <p className="mt-3 text-sm text-white/60">
                {players.find((p) => p.id === kickConfirm)?.name ??
                  "This player"}{" "}
                will be removed from the game. They can rejoin later if a slot
                is open.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setKickConfirm(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => kickPlayer(kickConfirm)}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-rose-500"
                >
                  Kick
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}