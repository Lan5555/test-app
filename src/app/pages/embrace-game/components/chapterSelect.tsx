"use client";

import { useEffect, useRef, useState } from "react";
import {
  Lock,
  Check,
  Play,
  X,
  Skull,
  Flame,
  Snowflake,
  Loader2,
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
  accent: string;
  accentHex: string;
  status: "locked" | "unlocked" | "completed";
  progress?: number;
  nodeCount?: number;
}

/* ---------------------------------------------------------------- */
/* Default chapter list — kept as fallback                           */
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
/* Loaders                                                          */
/* ---------------------------------------------------------------- */

/**
 * Full-panel loader shown while the chapter list itself is being
 * fetched. Covers the left rail and the detail panel.
 */
function ChapterListSkeleton() {
  return (
    <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#070c10]/95 backdrop-blur-md lg:flex-row">
      {/* Left rail skeleton */}
      <div className="flex w-full shrink-0 flex-col border-b border-white/10 p-4 sm:p-5 lg:w-80 lg:border-b-0 lg:border-r lg:p-6">
        <div className="h-2.5 w-20 rounded bg-white/5 skeleton-pulse" />
        <div className="mt-2 h-4 w-32 rounded bg-white/5 skeleton-pulse" />

        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 border border-white/5 bg-white/[0.01] px-4 py-3 skeleton-pulse"
              style={{
                clipPath:
                  "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                animationDelay: `${i * 120}ms`,
              }}
            >
              <div className="mt-0.5 size-4 shrink-0 rounded bg-white/10" />
              <div className="min-w-0 flex-1">
                <div className="h-2 w-10 rounded bg-white/10" />
                <div className="mt-2 h-3 w-32 rounded bg-white/10" />
                <div className="mt-1.5 h-2 w-24 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right detail skeleton */}
      <div className="flex flex-1 flex-col p-5 sm:p-6 lg:p-8">
        <div className="flex items-start gap-5">
          <div className="size-12 shrink-0 bg-white/5 skeleton-pulse sm:size-16" />
          <div className="flex-1">
            <div className="h-2.5 w-24 rounded bg-white/5 skeleton-pulse" />
            <div className="mt-3 h-6 w-48 rounded bg-white/10 skeleton-pulse" />
          </div>
        </div>

        <div className="mt-6 h-3 w-20 rounded bg-white/5 skeleton-pulse" />

        <div className="mt-6 space-y-2">
          <div className="h-3 w-full rounded bg-white/5 skeleton-pulse" />
          <div className="h-3 w-5/6 rounded bg-white/5 skeleton-pulse" />
          <div className="h-3 w-3/4 rounded bg-white/5 skeleton-pulse" />
        </div>

        <div className="mt-auto flex justify-end pt-6">
          <div className="h-9 w-32 rounded-xl bg-white/5 skeleton-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline spinner used for the preview loader and the confirm
 * loader. Keeps the modal feel cohesive.
 */
function InlineSpinner({
  label,
  accentHex,
}: {
  label?: string;
  accentHex?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
      <Loader2
        className="size-3.5 animate-spin"
        style={accentHex ? { color: accentHex } : undefined}
      />
      {label ? <span className="text-white/40">{label}</span> : null}
    </div>
  );
}

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
  initialChapterId?: string;
  onConfirm: (chapter: Chapter) => void | Promise<void>;
  onClose: () => void;
  /** Optional: pass real chapters. Falls back to the built-in list. */
  chapters?: Chapter[];
  /** Optional: set to true while the parent is fetching chapters. */
  loadingChapters?: boolean;
}

export default function ChapterSelectModal({
  initialChapterId,
  onConfirm,
  onClose,
  chapters,
  loadingChapters = false,
}: Props) {
  const list = chapters ?? CHAPTERS;

  const defaultChapter =
    list.find((c) => c.status === "unlocked") ??
    list.find((c) => c.status === "completed") ??
    list[0];

  const [selectedId, setSelectedId] = useState<string>(
    initialChapterId ?? defaultChapter?.id ?? "",
  );
  const [closing, setClosing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const previewTimerRef = useRef<number | null>(null);

  const selected =
    list.find((c) => c.id === selectedId) ?? list[0] ?? undefined;
  const SelectedIcon = selected?.icon;
  const locked = selected?.status === "locked";
  const completed = selected?.status === "completed";

  /* -------------------------------------------------------------- */
  /* Preview loader — briefly shows when the selection changes       */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!selected) return;
    setPreviewLoading(true);
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewLoading(false);
    }, 260);

    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, [selectedId, selected?.id]);

  function close() {
    if (confirming) return;
    setClosing(true);
    window.setTimeout(onClose, 200);
  }

  async function confirm() {
    if (!selected || locked || completed || confirming) {
      if (locked) AudioController.playImpactSound?.();
      return;
    }

    AudioController.playerHoverAndClickSound();
    setConfirming(true);

    try {
      await onConfirm(selected);
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Enter") void confirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, confirming]);

  return (
    <div
      className={`fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-4 lg:p-6 ${
        closing ? "chap-overlay-out" : "chap-overlay-in"
      }`}
    >
      <button
        type="button"
        aria-label="Close chapter select"
        onClick={close}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Boot loader — replaces the whole panel while list is loading */}
      {loadingChapters ? (
        <ChapterListSkeleton />
      ) : (
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

          <button
            type="button"
            onClick={close}
            disabled={confirming}
            aria-label="Close"
            className="absolute right-3 top-3 z-30 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-30 sm:right-4 sm:top-4"
          >
            <X className="size-4" />
          </button>

          {/* ------------------------------------------------------- */}
          {/* Left rail                                                */}
          {/* ------------------------------------------------------- */}
          <div className="flex w-full shrink-0 flex-col border-b border-white/10 p-4 sm:p-5 lg:w-80 lg:border-b-0 lg:border-r lg:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200/50">
              The Chronicle
            </p>
            <h3 className="mt-1 text-base font-black uppercase tracking-wider sm:text-lg">
              Chapter Select
            </h3>

            <div className="mt-4 flex max-h-48 overflow-x-auto overflow-y-hidden pb-2 pr-1 sm:max-h-56 lg:mt-5 lg:max-h-full lg:flex-1 lg:flex-col lg:gap-2 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
              <div className="flex gap-2 lg:flex-col lg:gap-2">
                {list.map((c) => {
                  const Icon = c.icon;
                  const active = c.id === selectedId;
                  const isLocked = c.status === "locked";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={confirming}
                      onClick={() => {
                        AudioController.playerHoverAndClickSound();
                        setSelectedId(c.id);
                      }}
                      className={`group relative flex w-60 shrink-0 items-start gap-3 border px-3.5 py-2.5 text-left transition disabled:opacity-50 sm:w-64 lg:w-full lg:px-4 lg:py-3 ${
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

          {/* ------------------------------------------------------- */}
          {/* Right panel                                             */}
          {/* ------------------------------------------------------- */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-6 lg:p-8">
            {previewLoading || !selected ? (
              /* Preview loader — replaces the detail panel content */
              <div className="flex flex-1 flex-col">
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className="size-12 shrink-0 bg-white/5 skeleton-pulse sm:size-16" />
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="h-2.5 w-24 rounded bg-white/5 skeleton-pulse" />
                    <div className="mt-3 h-6 w-48 rounded bg-white/10 skeleton-pulse" />
                  </div>
                </div>

                <div className="mt-6 h-3 w-20 rounded bg-white/5 skeleton-pulse" />

                <div className="mt-6 space-y-2">
                  <div className="h-3 w-full rounded bg-white/5 skeleton-pulse" />
                  <div className="h-3 w-5/6 rounded bg-white/5 skeleton-pulse" />
                  <div className="h-3 w-3/4 rounded bg-white/5 skeleton-pulse" />
                </div>

                <div className="mt-6 flex items-center">
                  <InlineSpinner label="Loading preview" />
                </div>
              </div>
            ) : (
              <div className="flex-1">
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
                    {SelectedIcon ? (
                      <SelectedIcon
                        className={`size-6 sm:size-8 ${selected.accent}`}
                        // @ts-expect-error inline style is fine here
                        style={{
                          filter: locked
                            ? undefined
                            : `drop-shadow(0 0 10px ${selected.accentHex}88)`,
                        }}
                      />
                    ) : null}
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

                <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
                  <StatusBadge chapter={selected} />
                  {typeof selected.nodeCount === "number" ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                      {selected.nodeCount} scenes
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-4 max-w-xl text-xs leading-5 sm:mt-6 sm:text-sm sm:leading-6 ${
                    locked ? "text-white/35" : "text-white/60"
                  }`}
                >
                  {locked
                    ? "This chapter is sealed. Finish the one before it to unseal the path."
                    : selected.description}
                </p>

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

                {selected.status === "completed" ? (
                  <p className="mt-4 border-l-2 border-emerald-300/40 pl-4 text-xs italic text-emerald-200/70 sm:mt-6">
                    You have walked this chapter before. Replaying it will not
                    change what was written.
                  </p>
                ) : null}

                {locked ? (
                  <p className="mt-4 border-l-2 border-white/10 pl-4 text-xs italic text-white/35 sm:mt-6">
                    The Chronicler has not yet revealed this page.
                  </p>
                ) : null}
              </div>
            )}

            {/* Actions */}
            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 bg-[#070c10]/90 pt-4 backdrop-blur-sm sm:mt-8 sm:pt-5">
              <button
                type="button"
                onClick={close}
                disabled={confirming}
                className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-white disabled:opacity-40 sm:px-5 sm:py-2.5"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={locked || completed || confirming || !selected}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black uppercase tracking-widest transition sm:px-6 sm:py-2.5 ${
                  locked
                    ? "cursor-not-allowed border border-white/10 bg-white/3 text-white/25"
                    : "text-slate-950"
                } ${confirming ? "cursor-wait opacity-90" : ""}`}
                style={
                  locked
                    ? undefined
                    : {
                        background: selected?.accentHex,
                        boxShadow: `0 0 24px ${selected?.accentHex}66`,
                      }
                }
              >
                {confirming ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Entering…
                  </>
                ) : locked ? (
                  "Sealed"
                ) : completed ? (
                  `Completed Ch. ${selected?.number}`
                ) : (
                  `Enter Ch. ${selected?.number}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
        .skeleton-pulse {
          animation: skeleton-pulse 1.6s ease-in-out infinite;
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
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) {
          .chap-overlay-in,
          .chap-overlay-out,
          .chap-panel-in,
          .chap-panel-out,
          .skeleton-pulse {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </div>
  );
}