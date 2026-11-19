"use client";

import { ArrowLeft, DoorOpen, Shield, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TeamId } from "../types/game";
import dialogStyles from "./game-dialog.module.css";
import styles from "./highlands-interface.module.css";

interface Props {
  roomCode: string;
  open: boolean;
  username: string;
  onJoin: (teamId: TeamId) => void;
  onBack: () => void;
}
const teams: { id: TeamId; name: string; tone: string }[] = [
  { id: "ravens", name: "Ravens", tone: "border-cyan-300/40 bg-cyan-300/10" },
  { id: "wolves", name: "Wolves", tone: "border-slate-300/40 bg-slate-300/10" },
  {
    id: "dragons",
    name: "Dragons",
    tone: "border-orange-300/40 bg-orange-300/10",
  },
  {
    id: "serpents",
    name: "Serpents",
    tone: "border-emerald-300/40 bg-emerald-300/10",
  },
];

export default function JoinRoomModal({
  roomCode,
  username,
  open,
  onJoin,
  onBack,
}: Props) {
  const [team, setTeam] = useState<TeamId>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="join-team-title"
      className={`${dialogStyles.surface} ${dialogStyles.join} ${styles.joinDialog}`}
      onCancel={(event) => {
        event.preventDefault();
        onBack();
      }}
    >
      <div className={dialogStyles.body}>
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/70">
          <DoorOpen className="size-4" /> Join game room
        </div>
        <h2
          id="join-team-title"
          className="mt-2 font-serif text-3xl sm:text-4xl"
        >
          {roomCode ? `Room ${roomCode}` : "Choose a team room"}
        </h2>
        <p className="mt-1 text-sm text-slate-300">Playing as {username}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/60">
          Choose a team
        </p>
        <div className={`mt-2 ${dialogStyles.teamGrid}`}>
          {teams.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={team === item.id}
              onClick={() => setTeam(item.id)}
              className={`rounded-xl border p-4 text-left ${item.tone} ${team === item.id ? "ring-2 ring-cyan-200" : "opacity-70"}`}
            >
              <Shield className="mb-4 size-5" />
              <span className="font-bold">{item.name}</span>
            </button>
          ))}
        </div>
        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-bold"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            disabled={!team}
            onClick={() => team && onJoin(team)}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-emerald-100 px-3 text-sm font-black text-slate-950 disabled:opacity-40"
          >
            <Swords size={16} /> Join team
          </button>
        </footer>
      </div>
    </dialog>
  );
}
