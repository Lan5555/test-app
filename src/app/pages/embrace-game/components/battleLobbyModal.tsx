"use client";

import { useState } from "react";
import {
  DoorOpen,
  Loader2,
  Plus,
  Skull,
  Swords,
  Users,
  X,
} from "lucide-react";
import { AudioController } from "../hooks/audioHandler";
import type { RoomBattleMode, TeamId } from "../types/game";

interface Props {
  onClose: () => void;
  onCreate: (
    playerName: string,
    teamId: TeamId,
    battleMode: RoomBattleMode,
  ) => Promise<void> | void;
  onJoin: (
    roomCode: string,
    playerName: string,
    teamId: TeamId,
  ) => Promise<void> | void;
}

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

export default function BattleLobbyModal({
  onClose,
  onCreate,
  onJoin,
}: Props) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [mode, setMode] = useState<RoomBattleMode>("pvp");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [teamId, setTeamId] = useState<TeamId>("ravens");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const name = playerName.trim();
    if (name.length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (tab === "create") {
        await onCreate(name, teamId, mode);
      } else {
        const code = roomCode.trim().toUpperCase();
        if (code.length < 4) {
          setError("Enter a valid room code.");
          return;
        }
        await onJoin(code, name, teamId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close battle lobby"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div
        style={{
          clipPath:
            "polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))",
        }}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto border border-white/10 bg-[#0a0f13]/95 p-6 shadow-2xl backdrop-blur-md sm:p-8"
      >
        <span className="pointer-events-none absolute left-3 top-3 size-3 border-l border-t border-cyan-200/40" />
        <span className="pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r border-cyan-200/40" />

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-200/10">
            <Swords className="size-6 text-cyan-200" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200/60">
              Battle
            </p>
            <h2 className="mt-1 text-xl font-black uppercase tracking-wider">
              Choose your fight
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2">
          {(
            [
              ["create", "Create Room"],
              ["join", "Join Room"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError("");
                AudioController.playerHoverAndClickSound();
              }}
              disabled={busy}
              className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-widest transition ${
                tab === value
                  ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10"
              }`}
            >
              {value === "create" ? (
                <Plus className="inline size-3.5" />
              ) : (
                <DoorOpen className="inline size-3.5" />
              )}{" "}
              {label}
            </button>
          ))}
        </div>

        {/* Battle type picker — create only */}
        {tab === "create" && (
          <div className="mt-5">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Battle Type
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("pvp");
                  AudioController.playerHoverAndClickSound();
                }}
                disabled={busy}
                className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition ${
                  mode === "pvp"
                    ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                }`}
              >
                <Users className="size-4" />
                <span className="mt-1 text-[11px] font-black uppercase tracking-widest">
                  PvP
                </span>
                <span className="text-[10px] normal-case tracking-normal text-white/40">
                  Fight your friends
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("cpu");
                  AudioController.playerHoverAndClickSound();
                }}
                disabled={busy}
                className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition ${
                  mode === "cpu"
                    ? "border-red-300/50 bg-red-300/10 text-red-100"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                }`}
              >
                <Skull className="size-4" />
                <span className="mt-1 text-[11px] font-black uppercase tracking-widest">
                  Vs Enemies
                </span>
                <span className="text-[10px] normal-case tracking-normal text-white/40">
                  Fight the Highlands
                </span>
              </button>
            </div>

            {mode === "pvp" ? (
              <p className="mt-3 border-l-2 border-cyan-300/40 pl-3 text-[11px] leading-4 text-white/40">
                Share the room code with friends. The fight begins the moment a
                second team joins.
              </p>
            ) : (
              <p className="mt-3 border-l-2 border-red-300/40 pl-3 text-[11px] leading-4 text-white/40">
                Combat starts immediately. No other players required.
              </p>
            )}
          </div>
        )}

        {/* Room code — join only */}
        {tab === "join" && (
          <div className="mt-5">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Room Code
            </label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-white outline-none focus:border-cyan-200/50"
            />
          </div>
        )}

        {/* Name */}
        <div className="mt-5">
          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Your Name
          </label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={16}
            disabled={busy}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/50"
          />
        </div>

        {/* Team */}
        <div className="mt-5">
          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Choose your house
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TEAM_IDS.map((id) => {
              const accent = TEAM_ACCENT[id];
              const active = id === teamId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTeamId(id);
                    AudioController.playerHoverAndClickSound();
                  }}
                  disabled={busy}
                  style={{
                    borderColor: active ? accent : undefined,
                    boxShadow: active ? `0 0 14px -2px ${accent}` : undefined,
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left font-black uppercase tracking-widest transition ${
                    active
                      ? "bg-white/5 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className="mb-1 block h-0.5 w-6 rounded-full"
                    style={{ background: accent }}
                  />
                  {TEAM_LABELS[id]}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <p className="mt-4 border-l-2 border-rose-400/60 pl-3 text-xs text-rose-200/80">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-cyan-100 disabled:opacity-70"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {tab === "create" ? "Creating…" : "Joining…"}
            </>
          ) : (
            <>
              {tab === "create"
                ? mode === "pvp"
                  ? "Create PvP Room"
                  : "Start Enemy Battle"
                : "Join Room"}
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">
          {tab === "create"
            ? mode === "pvp"
              ? "You will receive a code to share"
              : "Entering the arena"
            : "Ask your host for the code"}
        </p>
      </div>
    </div>
  );
}