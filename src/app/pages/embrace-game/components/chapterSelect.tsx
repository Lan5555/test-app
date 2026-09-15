"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  Check,
  Play,
  X,
  Skull,
  Flame,
  Snowflake,
} from "lucide-react";
import { AudioController } from "../hooks/audioHandler";

/* ---------------------------------------------------------------- */
/* Types                                                            */
/* ---------------------------------------------------------------- */

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;      // tailwind text color, e.g. "text-cyan-200"
  accentHex: string;   // hex for glow
  status: "locked" | "unlocked" | "completed";
  progress?: number;   // 0-100, only meaningful when unlocked
  nodeCount?: number;
}

/* ---------------------------------------------------------------- */
/* Default chapter list — replace with your real chapters            */
/* ---------------------------------------------------------------- */

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "Embrace Your Horror",
    subtitle: "The Awakening",
    description:
      "Four teams wake in a ruined cathedral with no memory of how they arrived. The sky is wrong. The doors are sealed. Something remembers them.",
    icon: Skull,
    accent: "text-red-300",
    accentHex: "#fca5a5",
    status: "completed",
    progress: 100,
    nodeCount: 6,
  },
  {
    id: "ch2",
    number: 2,
    title: "The Highlands",
    subtitle: "The Gate and the Wardens",
    description:
      "The gate stands between the teams and the mountain. Names are carved into its stone — some of them belong to the people standing beside you.",
    icon: Flame,
    accent: "text-orange-300",
    accentHex: "#fdba74",
    status: "unlocked",
    progress: 100,
    nodeCount: 8,
  },
  {
    id: "ch3",
    number: 3,
    title: "The Glitch",
    subtitle: "A Memory That Isn't Yours",
    description:
      "An abandoned village sits beneath the mountain. The photographs on the walls have your face in them. The journal is signed in a hand you almost recognise.",
    icon: Snowflake,
    accent: "text-cyan-200",
    accentHex: "#67e8f9",
    status: "locked",
    progress: 35,
    nodeCount: 10,
  },
];

/* ---------------------------------------------------------------- */
/* Status badge                                                     */
/* ---------------------------------------------------------------- */

function StatusBadge({ chapter }: { chapter: Chapter }) {
  if (chapter.status === "locked") {
    return (
      <span className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/35">
        <Lock className="size-3" /> Locked
      </span>
    );
  }
  if (chapter.status === "completed") {
    return (
      <span className="flex items-center gap-1.5 border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
        <Check className="size-3" /> Complete
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{
        color: chapter.accentHex,
        borderColor: `${chapter.accentHex}55`,
        background: `${chapter.accentHex}15`,
      }}
    >
      <Play className="size-3" /> In progress
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Main modal                                                       */
/* ---------------------------------------------------------------- */

interface Props {
  /** Optional preselected chapter id. */
  initialChapterId?: string;
  /** Called when a chapter is confirmed. */
  onConfirm: (chapter: Chapter) => void;
  /** Called when the player closes without choosing. */
  onClose: () => void;
}

export default function ChapterSelectModal({
  initialChapterId,
  onConfirm,
  onClose,
}: Props) {
  const defaultChapter =
    CHAPTERS.find((c) => c.status === "unlocked") ??
    CHAPTERS.find((c) => c.status === "completed") ??
    CHAPTERS[0];

  const [selectedId, setSelectedId] = useState<string>(
    initialChapterId ?? defaultChapter.id,
  );
  const [closing, setClosing] = useState(false);

  const selected =
    CHAPTERS.find((c) => c.id === selectedId) ?? CHAPTERS[0];
  const SelectedIcon = selected.icon;
  const locked = selected.status === "locked";
  const completed = selected.status === "completed";

  function close() {
    setClosing(true);
    window.setTimeout(onClose, 200);
  }

  function confirm() {
    if (locked) {
      AudioController.playImpactSound?.();
      return;
    }
    AudioController.playerHoverAndClickSound();
    onConfirm(selected);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Enter") confirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div
      className={`fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-4 lg:p-6 ${
        closing ? "chap-overlay-out" : "chap-overlay-in"
      }`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close chapter select"
        onClick={close}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Main Container */}
      <div
        style={{
          clipPath:
            "polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))",
        }}
        className={`relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#070c10]/95 shadow-2xl backdrop-blur-md lg:max-h-[85vh] lg:flex-row ${
          closing ? "chap-panel-out" : "chap-panel-in"
        }`}
      >
        <span className="pointer-events-none absolute left-3 top-3 z-20 size-3 border-l border-t border-cyan-200/40" />
        <span className="pointer-events-none absolute bottom-3 right-3 z-20 size-3 border-b border-r border-cyan-200/40" />

        {/* Close Button */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-30 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white sm:right-4 sm:top-4"
        >
          <X className="size-4" />
        </button>

        {/* -------------------------------------------------------- */}
        {/* Left rail — chapter list                                  */}
        {/* -------------------------------------------------------- */}
        <div className="flex w-full shrink-0 flex-col border-b border-white/10 p-4 sm:p-5 lg:w-80 lg:border-b-0 lg:border-r lg:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200/50">
            The Chronicle
          </p>
          <h3 className="mt-1 text-base font-black uppercase tracking-wider sm:text-lg">
            Chapter Select
          </h3>

          {/* Horizontal scroll on mobile/tablet, Vertical scroll on desktop */}
          <div className="mt-4 flex max-h-48 overflow-x-auto overflow-y-hidden pb-2 pr-1 sm:max-h-56 lg:mt-5 lg:max-h-full lg:flex-1 lg:flex-col lg:gap-2 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
            <div className="flex gap-2 lg:flex-col lg:gap-2">
              {CHAPTERS.map((c) => {
                const Icon = c.icon;
                const active = c.id === selectedId;
                const isLocked = c.status === "locked";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      AudioController.playerHoverAndClickSound();
                      setSelectedId(c.id);
                    }}
                    className={`group relative flex w-60 shrink-0 items-start gap-3 border px-3.5 py-2.5 text-left transition sm:w-64 lg:w-full lg:px-4 lg:py-3 ${
                      active
                        ? "border-cyan-200/40 bg-cyan-200/[0.06]"
                        : isLocked
                          ? "border-white/5 bg-white/[0.01] hover:border-white/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                    style={{
                      clipPath:
                        "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                    }}
                  >
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 transition ${
                        active
                          ? c.accent
                          : isLocked
                            ? "text-white/20"
                            : "text-white/40"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-[0.3em] ${
                            isLocked ? "text-white/25" : "text-white/40"
                          }`}
                        >
                          Ch. {c.number}
                        </span>
                        {c.status === "completed" ? (
                          <Check className="size-3 text-emerald-300/80" />
                        ) : null}
                        {isLocked ? (
                          <Lock className="size-3 text-white/25" />
                        ) : null}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-xs font-black uppercase tracking-widest transition sm:text-sm ${
                          isLocked
                            ? "text-white/30"
                            : active
                              ? "text-white"
                              : "text-white/60"
                        }`}
                      >
                        {c.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-widest text-white/30">
                        {c.subtitle}
                      </span>
                    </span>
                    {active ? (
                      <span
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{
                          background: c.accentHex,
                          boxShadow: `0 0 12px ${c.accentHex}99`,
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- */}
        {/* Right — detail panel                                     */}
        {/* -------------------------------------------------------- */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-6 lg:p-8">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-start gap-4 sm:gap-5">
              <div
                className="flex size-12 shrink-0 items-center justify-center border sm:size-16"
                style={{
                  borderColor: `${selected.accentHex}55`,
                  background: `${selected.accentHex}0d`,
                  clipPath:
                    "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <SelectedIcon
                  className={`size-6 sm:size-8 ${selected.accent}`}
                  // @ts-expect-error inline style is fine here
                  style={{
                    filter: locked
                      ? undefined
                      : `drop-shadow(0 0 10px ${selected.accentHex}88)`,
                  }}
                />
              </div>

              <div className="min-w-0 flex-1 pr-6">
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.4em] ${
                    locked ? "text-white/25" : selected.accent
                  }`}
                >
                  Chapter {selected.number} · {selected.subtitle}
                </p>
                <h2
                  className={`mt-1 text-2xl font-black uppercase tracking-tight sm:text-3xl lg:text-4xl ${
                    locked ? "text-white/40" : "text-white"
                  }`}
                >
                  {selected.title}
                </h2>
              </div>
            </div>

            {/* Status row */}
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
              <StatusBadge chapter={selected} />
              {typeof selected.nodeCount === "number" ? (
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                  {selected.nodeCount} scenes
                </span>
              ) : null}
            </div>

            {/* Description */}
            <p
              className={`mt-4 max-w-xl text-xs leading-5 sm:mt-6 sm:text-sm sm:leading-6 ${
                locked ? "text-white/35" : "text-white/60"
              }`}
            >
              {locked
                ? "This chapter is sealed. Finish the one before it to unseal the path."
                : selected.description}
            </p>

            {/* Progress */}
            {selected.status === "unlocked" &&
            typeof selected.progress === "number" ? (
              <div className="mt-4 sm:mt-6">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  <span>Progress</span>
                  <span className="tabular-nums text-white/60">
                    {selected.progress}%
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selected.progress}%`,
                      background: selected.accentHex,
                      boxShadow: `0 0 8px ${selected.accentHex}88`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Completed note */}
            {selected.status === "completed" ? (
              <p className="mt-4 border-l-2 border-emerald-300/40 pl-4 text-xs italic text-emerald-200/70 sm:mt-6">
                You have walked this chapter before. Replaying it will not change
                what was written.
              </p>
            ) : null}

            {/* Locked note */}
            {locked ? (
              <p className="mt-4 border-l-2 border-white/10 pl-4 text-xs italic text-white/35 sm:mt-6">
                The Chronicler has not yet revealed this page.
              </p>
            ) : null}
          </div>

          {/* Actions - Sticky at bottom of detail panel */}
          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 bg-[#070c10]/90 pt-4 backdrop-blur-sm sm:mt-8 sm:pt-5">
            <button
              type="button"
              onClick={close}
              className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-white sm:px-5 sm:py-2.5"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={locked || completed}
              className={`rounded-xl px-5 py-2 text-xs font-black uppercase tracking-widest transition sm:px-6 sm:py-2.5 ${
                locked
                  ? "cursor-not-allowed border border-white/10 bg-white/3 text-white/25"
                  : "text-slate-950"
              }`}
              style={
                locked
                  ? undefined
                  : {
                      background: selected.accentHex,
                      boxShadow: `0 0 24px ${selected.accentHex}66`,
                    }
              }
            >
              {locked
                ? "Sealed"
                : selected.status === "completed"
                  ? `Completed Ch. ${selected.number}`
                  : `Enter Ch. ${selected.number}`}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .chap-overlay-in {
          animation: chap-overlay-in 180ms ease-out both;
        }
        .chap-overlay-out {
          animation: chap-overlay-out 200ms ease-in both;
        }
        .chap-panel-in {
          animation: chap-panel-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .chap-panel-out {
          animation: chap-panel-out 200ms ease-in both;
        }
        @keyframes chap-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes chap-overlay-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes chap-panel-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chap-panel-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(8px) scale(0.98); }
        }
        @media (prefers-reduced-motion: reduce) {
          .chap-overlay-in,
          .chap-overlay-out,
          .chap-panel-in,
          .chap-panel-out {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </div>
  );
}