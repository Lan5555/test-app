"use client";

import { BookOpen, ChevronRight, Clock, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import ChoicePanel from "./ChoicePanel";
import Image from "next/image";

interface Props {
  nodeId: string;
  title: string;
  text: string;
  background?: string;
  phase: "waiting" | "story" | "battle" | "finished" | 'credits';
  currentTeamName?: string;
  /** Name of the player whose turn it currently is within the team. */
  activePlayerName?: string;
  choices?: { id: string; text: string }[];
  canChoose?: boolean;
  onChoose?: (choiceId: string) => void;
  /** Milliseconds remaining before the server auto-advances the turn. */
  decisionTimerMs?: number;
}

const sceneArt: Record<string, string> = {
  start: "/highlands.jpeg",
  cathedral: "/nacos.jpg",
  tower: "/dark-forest.jpeg",
  final_gate: "/uj.jpeg",
};

export default function StoryScene({
  nodeId,
  title,
  text,
  background: storyBackground,
  phase,
  currentTeamName,
  activePlayerName,
  choices,
  canChoose,
  onChoose,
  decisionTimerMs = 0,
}: Props) {
  const background = storyBackground ?? sceneArt[nodeId] ?? "/highlands.jpeg";
  const isWaiting = phase === "waiting";

  /* ------------------------------------------------------------------ */
  /* Local countdown — ticks between server updates                     */
  /* ------------------------------------------------------------------ */

  const [displayMs, setDisplayMs] = useState(decisionTimerMs);

  useEffect(() => {
    if (decisionTimerMs <= 0) {
      setDisplayMs(0);
      return;
    }

    const deadline = Date.now() + decisionTimerMs;
    setDisplayMs(decisionTimerMs);

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setDisplayMs(remaining);
      if (remaining === 0) window.clearInterval(interval);
    }, 100);

    return () => window.clearInterval(interval);
  }, [decisionTimerMs]);

  const secondsLeft = Math.ceil(displayMs / 1000);
  const showTimer = phase === "story" && displayMs > 0;
  const isUrgent = secondsLeft <= 5 && secondsLeft > 0;
  const progressPct = Math.max(
    0,
    Math.min(100, (displayMs / Math.max(1, decisionTimerMs || 1)) * 100),
  );

  /* ------------------------------------------------------------------ */
  /* Status text                                                        */
  /* ------------------------------------------------------------------ */

  const statusText = isWaiting
    ? "Waiting for the server to open the chronicle"
    : canChoose
      ? "Your turn — pick a path"
      : currentTeamName
        ? activePlayerName
          ? `Waiting for ${activePlayerName} (${currentTeamName})`
          : `${currentTeamName} is making the next decision`
        : "The server is resolving the next decision";

  const showChoices = choices && choices.length > 0 && onChoose;

  return (
    <section className="relative min-h-[min(680px,calc(100vh-3rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1012] shadow-2xl">
      <div className="absolute inset-0 opacity-45 transition-opacity duration-700">
        <Image
          src={'/highlands.jpeg'}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,11,.18),rgba(5,9,11,.55)_42%,rgba(5,9,11,.98)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,.45),transparent)]" />

      <div className="relative z-10 flex min-h-[min(680px,calc(100vh-3rem))] flex-col justify-between p-6 sm:p-10 lg:p-14">
        {/* Header */}
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-100/70">
            <BookOpen className="size-4" />
            {isWaiting ? "Room chronicle" : "Story event"}
          </div>

          <div className="flex items-center gap-3">
            {/* Decision timer */}
            {showTimer ? (
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-sm transition-colors ${
                  isUrgent
                    ? "border-rose-300/60 bg-rose-500/20 text-rose-100 animate-pulse"
                    : canChoose
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/15 bg-black/30 text-white/60"
                }`}
              >
                <Clock className="size-3.5" />
                <span className="tabular-nums">
                  {isUrgent ? "hurry" : "decide"} · {secondsLeft}s
                </span>
              </div>
            ) : null}

            <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 backdrop-blur-sm">
              {nodeId || "opening"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-4xl">
          <div className="mb-5 h-px w-16 bg-cyan-200/60" />
          <h2 className="max-w-4xl text-4xl font-black uppercase leading-[0.98] tracking-tight text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
            {title}
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
            {text}
          </p>

          {/* Status chip + timer bar */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur-sm ${
                canChoose
                  ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-black/35 text-white/55"
              }`}
            >
              <Radio
                className={`size-4 ${
                  canChoose ? "text-cyan-100 animate-pulse" : "text-cyan-200"
                }`}
              />
              {statusText}
            </div>
            <div className="hidden items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-white/35 sm:flex">
              Continue <ChevronRight className="size-4" />
            </div>
          </div>

          {/* Timer bar under the status chip — shows the draining progress */}
          {showTimer ? (
            <div className="mt-3 max-w-md">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    isUrgent
                      ? "bg-gradient-to-r from-rose-500 to-rose-300"
                      : "bg-gradient-to-r from-cyan-500 to-cyan-300"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Choices */}
          {showChoices ? (
            <div className="mt-6 max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/60">
                {canChoose ? "Choose your path" : "Awaiting the decision"}
              </p>
              <ChoicePanel
                choices={choices}
                disabled={!canChoose}
                onChoose={onChoose}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}