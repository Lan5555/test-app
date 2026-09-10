"use client";

import { Eye, Radio, Shield, Swords, Wifi, WifiOff } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import FloatingParticles from "../components/FloatingParticles";
import { type GameEvent, type SocketStatus, socket } from "../lib/websocket";
import type { GameState } from "../types/game";

interface WatchEvent {
  id: string;
  text: string;
  time: string;
  tone: "story" | "combat" | "system";
}

interface BattleView {
  active: boolean;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  message: string;
}

const initialStory = {
  title: "The Chronicle is waiting",
  text: "Join a room to watch every decision, turn, and combat exchange in real time.",
};

function formatEvent(event: GameEvent): {
  text: string;
  tone: WatchEvent["tone"];
} {
  switch (event.type) {
    case "CHOICE":
      return {
        text: `Player ${event.playerId} chose story path ${event.choiceId}.`,
        tone: "story",
      };
    case "COMBAT_ACTION_SELECTED":
      return {
        text: `Player ${event.playerId} locked ${event.variant ?? event.action}.`,
        tone: "combat",
      };
    case "COMBAT_ACTION":
      return {
        text: `Player ${event.playerId} action resolved: ${event.action}.`,
        tone: "combat",
      };
    case "JOIN_GAME":
      return {
        text: `${event.playerName ?? event.playerId} joined the ${event.teamId}.`,
        tone: "system",
      };
    case "WATCH_GAME":
      return { text: "Watcher connected to the room.", tone: "system" };
    case "ADMIN_APPROVE_ROOM":
      return { text: "Admin approved the room.", tone: "system" };
    case "STORY_UPDATE":
      return { text: `Story advanced: ${event.title}.`, tone: "story" };
    case "BATTLE_UPDATE":
      return { text: event.message, tone: "combat" };
    default:
      return { text: `Game event received: ${event.type}.`, tone: "system" };
  }
}

export default function WatchPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [watcherName, setWatcherName] = useState("");
  const [roomCode, setRoomCode] = useState("ASH-714");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [story, setStory] = useState(initialStory);
  const [battle, setBattle] = useState<BattleView>({
    active: false,
    enemyName: "Awaiting encounter",
    enemyHp: 0,
    enemyMaxHp: 1,
    message: "No battle is active.",
  });
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [syncedState, setSyncedState] = useState<GameState>();

  useEffect(() => {
    if (!loggedIn) return;
    socket.connect();
    const unsubscribeStatus = socket.onStatus(setStatus);
    const unsubscribeEvents = socket.onMessage((event) => {
      const formatted = formatEvent(event);
      setEvents((previous) =>
        [
          {
            id: crypto.randomUUID(),
            ...formatted,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...previous,
        ].slice(0, 40),
      );
      if (event.type === "STATE_SYNC") {
        if ("error" in event.payload) return;
        setSyncedState(event.payload);
        setRoomCode(event.roomCode);
        if (event.payload.battle) {
          setBattle({
            active: event.payload.battle.status === "active",
            enemyName: event.payload.battle.enemyName,
            enemyHp: event.payload.battle.enemyHp,
            enemyMaxHp: event.payload.battle.enemyMaxHp,
            message:
              event.payload.battle.log.at(-1) ?? "Battle state synchronized.",
          });
        }
      }
      if (event.type === "STORY_UPDATE")
        setStory({ title: event.title, text: event.text });
      if (event.type === "BATTLE_UPDATE")
        setBattle({
          active: true,
          enemyName: event.enemyName,
          enemyHp: event.enemyHp,
          enemyMaxHp: event.enemyMaxHp,
          message: event.message,
        });
    });
    socket.send({ type: "WATCH_GAME", watcherId: watcherName, roomCode });
    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      socket.disconnect();
    };
  }, [loggedIn, roomCode, watcherName]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (watcherName.trim() && roomCode.trim()) setLoggedIn(true);
  }

  if (!loggedIn) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030608] px-5 text-white">
        <FloatingParticles />
        <form
          onSubmit={login}
          className="relative z-10 w-full max-w-md rounded-3xl border border-cyan-200/20 bg-[#0d151b]/95 p-7 shadow-2xl backdrop-blur-md sm:p-9"
        >
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
            <Eye className="size-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/65">
            Spectator access
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Watch the Chronicle
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Follow every story choice and every combat exchange without joining
            a team.
          </p>
          <label className="mt-7 block text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Watcher name
            <input
              value={watcherName}
              onChange={(event) => setWatcherName(event.target.value)}
              placeholder="Enter your name"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-cyan-200/60"
            />
          </label>
          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Room code
            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-cyan-200/60"
            />
          </label>
          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 py-3.5 text-sm font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-cyan-100"
          >
            <Radio className="size-4" /> Enter live room
          </button>
        </form>
      </main>
    );
  }

  const connectionLabel =
    status === "connected"
      ? "Backend connected"
      : status === "error"
        ? "Backend connection error"
        : status;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030608] text-white">
      <FloatingParticles />
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <header className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-red-300/75">
              <span className="size-2 animate-pulse rounded-full bg-red-400" />{" "}
              Live spectator room
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              THE CHRONICLE
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Watching as {watcherName} · Room{" "}
              {syncedState?.roomCode ?? roomCode}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/55">
            {status === "connected" ? (
              <Wifi className="size-4 text-emerald-300" />
            ) : (
              <WifiOff className="size-4 text-amber-200" />
            )}
            {connectionLabel}
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_370px]">
          <section className="relative min-h-[min(650px,calc(100vh-9rem))] overflow-hidden rounded-3xl border border-white/10 bg-[url('/dark-forest-2.jpeg')] bg-cover bg-center p-6 sm:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,11,.2),rgba(4,8,11,.95)_85%)]" />
            <div className="relative flex min-h-[min(570px,calc(100vh-13rem))] flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100/65">
                  <Eye className="size-4" /> Observer view
                </span>
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  All decisions visible
                </span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                  Current story
                </p>
                <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
                  {story.title}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/60">
                  {story.text}
                </p>
              </div>
              {battle.active ? (
                <div className="rounded-2xl border border-red-200/25 bg-black/45 p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200/75">
                      <Swords className="size-4" /> Battle live
                    </div>
                    <span className="text-xs font-bold text-white/55">
                      {battle.enemyHp} / {battle.enemyMaxHp} HP
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black">
                    {battle.enemyName}
                  </h3>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-red-400 transition-all"
                      style={{
                        width: `${(battle.enemyHp / battle.enemyMaxHp) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/55">{battle.message}</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-200/5 p-4 text-sm text-cyan-100/70">
                  <Shield className="size-5" /> Story decisions and combat
                  updates will appear here live.
                </div>
              )}
            </div>
          </section>
          <aside className="flex max-h-162.5 flex-col rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white/45">
                Live decisions
              </h2>
              <span className="text-xs text-white/30">
                {events.length} events
              </span>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <p className="text-sm leading-6 text-white/35">
                  Waiting for the first event from the room...
                </p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-cyan-300/40 pl-3"
                  >
                    <div className="flex justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                      <span>{event.tone}</span>
                      <span>{event.time}</span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-white/75">
                      {event.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
