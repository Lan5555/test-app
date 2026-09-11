"use client";

import { DoorOpen, Shield, Swords } from "lucide-react";
import { useState } from "react";
import type { TeamId } from "../types/game";

interface Props {
  roomCode: string;
  open: boolean;
  onJoin: (teamId: TeamId, playerName: string) => void;
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

export default function JoinRoomModal({ roomCode, open, onJoin }: Props) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<TeamId>();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-cyan-200/20 bg-[#10161b] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/70">
          <DoorOpen className="size-4" /> Join game room
        </div>
        <h2 className="mt-3 text-3xl font-black">
          {roomCode ? `Room ${roomCode}` : "Choose a team room"}
        </h2>
        <label className="mt-6 block text-xs font-bold uppercase tracking-widest text-white/45">
          Player name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-white!"
          />
        </label>
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/45">
          Choose a team
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {teams.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTeam(item.id)}
              className={`rounded-xl border p-4 text-left ${item.tone} ${team === item.id ? "ring-2 ring-cyan-200" : "opacity-70"}`}
            >
              <Shield className="mb-4 size-5" />
              <span className="font-bold">{item.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!name.trim() || !team}
          onClick={() => team && onJoin(team, name.trim())}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-4 py-3 font-black uppercase tracking-widest text-slate-950 disabled:opacity-30"
        >
          <Swords className="size-4" /> Join selected team
        </button>
      </div>
    </div>
  );
}
