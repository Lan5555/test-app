"use client";

import { BookOpen, ChevronRight, Radio } from "lucide-react";
import ChoicePanel from "./ChoicePanel";

interface Props {
  nodeId: string;
  title: string;
  text: string;
  background?: string;
  phase: "waiting" | "story" | "battle" | "finished";
  currentTeamName?: string;
  choices?: { id: string; text: string }[];
  canChoose?: boolean;
  onChoose?: (choiceId: string) => void;
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
  choices,
  canChoose,
  onChoose,
}: Props) {
  const background = storyBackground ?? sceneArt[nodeId] ?? "/highlands.jpeg";
  const isWaiting = phase === "waiting";

  return (
    <section className="relative min-h-[min(680px,calc(100vh-3rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1012] shadow-2xl">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45 transition-opacity duration-700"
        style={{ backgroundImage: `url(/highlands.jpeg)` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,11,.18),rgba(5,9,11,.55)_42%,rgba(5,9,11,.98)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,.45),transparent)]" />

      <div className="relative z-10 flex min-h-[min(680px,calc(100vh-3rem))] flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-100/70">
            <BookOpen className="size-4" />
            {isWaiting ? "Room chronicle" : "Story event"}
          </div>
          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 backdrop-blur-sm">
            {nodeId || "opening"}
          </span>
        </div>

        <div className="max-w-4xl">
          <div className="mb-5 h-px w-16 bg-cyan-200/60" />
          <h2 className="max-w-4xl text-4xl font-black uppercase leading-[0.98] tracking-tight text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
            {title}
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
            {text}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-xs text-white/55 backdrop-blur-sm">
              <Radio className="size-4 text-cyan-200" />
              {isWaiting
                ? "Waiting for the server to open the chronicle"
                : currentTeamName
                  ? `${currentTeamName} is making the next decision`
                  : "The server is resolving the next decision"}
            </div>
            <div className="hidden items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-white/35 sm:flex">
              Continue <ChevronRight className="size-4" />
            </div>
          </div>
          {choices?.length && onChoose ? (
            <div className="mt-6 max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/60">
                Choose your path
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
