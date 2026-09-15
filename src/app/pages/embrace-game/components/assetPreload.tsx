"use client";

import { useEffect, useRef, useState } from "react";
import { AudioController } from "../hooks/audioHandler";

/* ---------------------------------------------------------------- */
/* Asset manifest — every path you want loaded before the menu       */
/* ---------------------------------------------------------------- */

const AUDIO_ASSETS = [
  // Music
  "/assets/music/main.mp3",
  "/assets/music/forest.mp3",
  "/assets/music/main2.mp3",
  "/assets/music/forest3.mp3",
  "/assets/music/hope.mp3",
  "/assets/music/shadow-lord.mp3",
  "/assets/music/disturbance.mp3",
  "/assets/music/hell.mp3",
  "/assets/music/bestower.mp3",
  "/assets/music/gameOver.mp3",
  "/assets/music/nier.mp3",

  // SFX
  "/assets/music/click.mp3",
  "/assets/music/slash.mp3",
  "/assets/music/shatter.mp3",
  "/assets/music/impact.mp3",
  "/assets/music/heal.mp3",
  "/assets/music/fire.mp3",

  // Story Voice Lines
  "/audio/vo/welcome.mp3",
  "/audio/vo/four_teams.mp3",
  "/audio/vo/not_all_leave.mp3",
  "/audio/vo/been_here_before.mp3",
  "/audio/vo/do_not_remember.mp3",

  "/audio/vo/gate_warden_01.mp3",
  "/audio/vo/gate_warden_02.mp3",
  "/audio/vo/gate_warden_03.mp3",
  "/audio/vo/gate_ravens_01.mp3",
  "/audio/vo/gate_serpents_01.mp3",
  "/audio/vo/gate_unknown_01.mp3",

  "/audio/vo/abyss_01.mp3",
  "/audio/vo/abyss_02.mp3",

  "/audio/vo/echo_01.mp3",
  "/audio/vo/echo_02.mp3",
  "/audio/vo/echo_03.mp3",
  "/audio/vo/echo_beast_01.mp3",
  "/audio/vo/echo_beast_02.mp3",

  "/audio/vo/memory_woman_01.mp3",
  "/audio/vo/memory_child_01.mp3",
  "/audio/vo/memory_man_01.mp3",
  "/audio/vo/nicholas_memory_01.mp3",

  "/audio/vo/village_unknown_01.mp3",
  "/audio/vo/village_unknown_02.mp3",

  "/audio/vo/house_unknown_01.mp3",
  "/audio/vo/house_unknown_02.mp3",

  "/audio/vo/nicholas_house_01.mp3",
  "/audio/vo/nicholas_house_02.mp3",

  "/audio/vo/nicholas_journal_01.mp3",
  "/audio/vo/nicholas_journal_02.mp3",
  "/audio/vo/nicholas_journal_03.mp3",
  "/audio/vo/nicholas_journal_04.mp3",

  "/audio/vo/bell_keeper_01.mp3",
  "/audio/vo/bell_keeper_02.mp3",
  "/audio/vo/bell_keeper_03.mp3",

  "/audio/vo/blood_hunter_01.mp3",
  "/audio/vo/blood_hunter_02.mp3",
  "/audio/vo/blood_hunter_03.mp3",

  "/audio/vo/grave_voice_01.mp3",
  "/audio/vo/grave_voice_02.mp3",
  "/audio/vo/graveyard_whisper_01.mp3",
  "/audio/vo/graveyard_whisper_02.mp3",
  "/audio/vo/graveyard_whisper_03.mp3",
  "/audio/vo/graveyard_whisper_04.mp3",

  "/audio/vo/four_houses_01.mp3",
  "/audio/vo/four_houses_02.mp3",
  "/audio/vo/four_houses_03.mp3",

  "/audio/vo/ravens_captain_01.mp3",
  "/audio/vo/dragons_captain_01.mp3",
  "/audio/vo/ravens_dragons_battle.mp3",

  "/audio/vo/serpents_captain_01.mp3",
  "/audio/vo/wolves_captain_01.mp3",
  "/audio/vo/serpents_wolves_battle.mp3",

  "/audio/vo/faceless_01.mp3",
  "/audio/vo/faceless_02.mp3",

  "/audio/vo/nicholas_war_01.mp3",
  "/audio/vo/nicholas_war_02.mp3",
  "/audio/vo/nicholas_war_03.mp3",

  "/audio/vo/wolves_alliance_01.mp3",
  "/audio/vo/ravens_alliance_01.mp3",
  "/audio/vo/serpents_alliance_01.mp3",

  "/audio/vo/hollow_knight_01.mp3",
  "/audio/vo/hollow_knight_02.mp3",

  "/audio/vo/nicholas_truth_01.mp3",
  "/audio/vo/nicholas_truth_02.mp3",
  "/audio/vo/nicholas_truth_03.mp3",
  "/audio/vo/nicholas_truth_04.mp3",
  "/audio/vo/nicholas_truth_05.mp3",
  "/audio/vo/nicholas_truth_06.mp3",

  "/audio/vo/nicholas_confession_01.mp3",
  "/audio/vo/nicholas_confession_02.mp3",
  "/audio/vo/nicholas_confession_03.mp3",
  "/audio/vo/nicholas_confession_04.mp3",
  "/audio/vo/nicholas_confession_05.mp3",
  "/audio/vo/nicholas_confession_06.mp3",
  "/audio/vo/nicholas_confession_07.mp3",
  "/audio/vo/nicholas_confession_08.mp3",

  "/audio/vo/nicholas_betrayal_01.mp3",
  "/audio/vo/nicholas_betrayal_02.mp3",
  "/audio/vo/nicholas_betrayal_03.mp3",
  "/audio/vo/nicholas_betrayal_04.mp3",
  "/audio/vo/nicholas_betrayal_05.mp3",

  "/audio/vo/nicholas_betrayal_end_01.mp3",
  "/audio/vo/nicholas_betrayal_end_02.mp3",
  "/audio/vo/nicholas_betrayal_end_03.mp3",

  "/audio/vo/nicholas_sanctum_01.mp3",
  "/audio/vo/nicholas_sanctum_02.mp3",
  "/audio/vo/nicholas_sanctum_03.mp3",
  "/audio/vo/nicholas_sanctum_04.mp3",
  "/audio/vo/nicholas_sanctum_05.mp3",

  "/audio/vo/nicholas_final_01.mp3",
  "/audio/vo/nicholas_final_02.mp3",
  "/audio/vo/nicholas_final_03.mp3",
  "/audio/vo/nicholas_final_04.mp3",
  "/audio/vo/nicholas_final_05.mp3",
  "/audio/vo/nicholas_final_06.mp3",

  "/audio/vo/nicholas_phase_one_01.mp3",
  "/audio/vo/nicholas_phase_one_02.mp3",
  "/audio/vo/nicholas_phase_one_03.mp3",
  "/audio/vo/nicholas_phase_one_04.mp3",
  "/audio/vo/nicholas_phase_one_05.mp3",
  "/audio/vo/nicholas_phase_one_06.mp3",
  "/audio/vo/nicholas_phase_battle_01.mp3",

  "/audio/vo/nicholas_final_choice_01.mp3",
  "/audio/vo/nicholas_final_choice_02.mp3",
  "/audio/vo/nicholas_final_choice_03.mp3",
  "/audio/vo/nicholas_final_choice_04.mp3",
  "/audio/vo/nicholas_final_choice_05.mp3",
  "/audio/vo/nicholas_final_choice_06.mp3",
  "/audio/vo/nicholas_final_choice_07.mp3",

  "/audio/vo/nicholas_final_form_01.mp3",
  "/audio/vo/nicholas_final_form_02.mp3",
  "/audio/vo/nicholas_final_form_03.mp3",

  "/audio/vo/nicholas_ending_destroy_01.mp3",
  "/audio/vo/nicholas_ending_destroy_02.mp3",
  "/audio/vo/nicholas_ending_destroy_03.mp3",

  "/audio/vo/nicholas_ending_memory_01.mp3",
  "/audio/vo/nicholas_ending_memory_02.mp3",

  "/audio/vo/nicholas_true_ending_01.mp3",
  "/audio/vo/nicholas_true_ending_02.mp3",
  "/audio/vo/nicholas_true_ending_03.mp3",
  "/audio/vo/nicholas_true_ending_04.mp3",
  "/audio/vo/nicholas_true_ending_05.mp3",
  "/audio/vo/nicholas_true_ending_06.mp3",

  // Over voices
  "/audio/over/voice (1).mp3",
  "/audio/over/voice (2).mp3",
  "/audio/over/voice (3).mp3",
  "/audio/over/voice (4).mp3",
  "/audio/over/voice (5).mp3",
  "/audio/over/voice (6).mp3",
];

const IMAGE_ASSETS = [
  "/highlands2.png",
];

/* ---------------------------------------------------------------- */
/* Preload helpers                                                    */
/* ---------------------------------------------------------------- */

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // fail silently, don't block
    img.src = src;
  });
}

function preloadAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.oncanplaythrough = () => resolve();
    audio.onerror = () => resolve(); // fail silently
    // Timeout safeguard so a slow/404 asset can't hang the loader forever.
    const timeout = window.setTimeout(resolve, 8000);
    audio.oncanplaythrough = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    audio.src = src;
  });
}

/* ---------------------------------------------------------------- */
/* Component                                                          */
/* ---------------------------------------------------------------- */

interface Props {
  /** Called when all assets are loaded or the user skips. */
  onDone: () => void;
  /** Optional: max time to wait before auto-advancing. Default 30s. */
  timeoutMs?: number;
}

export default function PreloadScreen({ onDone, timeoutMs = 30_000 }: Props) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentAsset, setCurrentAsset] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "fading">("loading");
  const [fadeIn, setFadeIn] = useState(false);

  const doneRef = useRef(false);

  const total = AUDIO_ASSETS.length + IMAGE_ASSETS.length;

  useEffect(() => {
    const t = window.setTimeout(() => setFadeIn(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function preloadAll() {
      const queue: { src: string; kind: "audio" | "image" }[] = [
        ...AUDIO_ASSETS.map((src) => ({ src, kind: "audio" as const })),
        ...IMAGE_ASSETS.map((src) => ({ src, kind: "image" as const })),
      ];

      const failed: string[] = [];

      for (const asset of queue) {
        if (cancelled) return;
        const freshSrc = asset.src.replace('.mp3','.pak');
        setCurrentAsset(freshSrc);

        try {
          if (asset.kind === "audio") {
            await preloadAudio(asset.src);
          } else {
            await preloadImage(asset.src);
          }
        } catch {
          failed.push(asset.src);
        }

        if (cancelled) return;
        setLoadedCount((n) => n + 1);
      }

      if (cancelled) return;
      setErrors(failed);
      setPhase("ready");

      // Short pause so the bar visually completes.
      window.setTimeout(() => {
        if (cancelled) return;
        setPhase("fading");
        window.setTimeout(() => {
          if (cancelled || doneRef.current) return;
          doneRef.current = true;
          onDone();
        }, 700);
      }, 400);
    }

    preloadAll();

    // Safety timeout — always advance.
    const guard = window.setTimeout(() => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      setPhase("fading");
      window.setTimeout(() => {
        if (!cancelled) onDone();
      }, 700);
    }, timeoutMs);

    return () => {
      cancelled = true;
      window.clearTimeout(guard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = total > 0 ? Math.round((loadedCount / total) * 100) : 0;

  const handleSkip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("fading");
    window.setTimeout(() => onDone(), 400);
  };

  return (
    <div
      className={`preload-root fixed inset-0 z-[400] flex flex-col items-center justify-center overflow-hidden bg-black transition-opacity duration-700 ${
        fadeIn ? "opacity-100" : "opacity-0"
      } ${phase === "fading" ? "pointer-events-none opacity-0" : ""}`}
    >
      {/* Slow red pulse behind everything */}
      <div className="preload-pulse absolute inset-0" />

      {/* Grain */}
      <div className="preload-grain absolute inset-0 opacity-[0.06]" />

      {/* Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_220px_80px_rgba(0,0,0,0.9)]" />

      <div className="relative z-10 w-full max-w-md px-8">
        {/* Title */}
        <p className="text-center text-[10px] font-black uppercase tracking-[0.6em] text-cyan-200/60">
          The Highlands
        </p>
        <h1
          className="mt-4 text-center text-3xl font-black uppercase tracking-tight text-white sm:text-4xl"
          style={{
            textShadow:
              "0 0 40px rgba(103,232,249,.25), 4px 4px 0 rgba(0,0,0,.6)",
          }}
        >
          Loading the Chronicle
        </h1>

        {/* Progress bar */}
        <div className="mt-12">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            <span>
              {phase === "ready" || phase === "fading"
                ? "Ready"
                : "Loading assets"}
            </span>
            <span className="tabular-nums text-cyan-200/80">
              {progress}%
            </span>
          </div>

          <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400/70 to-cyan-200 transition-[width] duration-200 ease-out"
              style={{
                width: `${progress}%`,
                boxShadow: "0 0 12px rgba(103,232,249,.6)",
              }}
            />
          </div>

          {/* Current asset + counter */}
          <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/30">
            <span className="truncate max-w-[70%]">
              {phase === "ready" || phase === "fading"
                ? errors.length > 0
                  ? `${errors.length} asset${errors.length === 1 ? "" : "s"} failed`
                  : "All assets loaded"
                : currentAsset
                  ? currentAsset.split("/").pop()
                  : "Preparing…"}
            </span>
            <span className="tabular-nums shrink-0">
              {loadedCount} / {total}
            </span>
          </div>
        </div>

        {/* Skip button */}
        {phase === "loading" ? (
          <div className="mt-10 text-center">
            {/* <button
              type="button"
              onClick={handleSkip}
              className="rounded-none border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 transition hover:border-white/20 hover:text-white/70"
            >
              Skip
            </button> */}
          </div>
        ) : (
          <div className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200/70">
            Entering the Highlands…
          </div>
        )}
      </div>

      {/* Corner ticks */}
      <span className="pointer-events-none absolute left-6 top-6 size-6 border-l border-t border-cyan-200/20" />
      <span className="pointer-events-none absolute bottom-6 right-6 size-6 border-b border-r border-cyan-200/20" />

      <style jsx>{`
        .preload-pulse {
          background: radial-gradient(
            circle at 50% 50%,
            rgba(103, 232, 249, 0.06) 0%,
            transparent 60%
          );
          animation: preload-pulse 5s ease-in-out infinite;
        }
        @keyframes preload-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        .preload-grain {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          background-size: 180px 180px;
        }
        @media (prefers-reduced-motion: reduce) {
          .preload-pulse { animation: none; }
        }
      `}</style>
    </div>
  );
}