"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cutscene, CutsceneLine, Tone } from "../types/game";
import { socket } from "../lib/websocket";
import { AudioController } from "../hooks/audioHandler";

interface Props {
  cutscene: Cutscene;
  onDone: () => void;
  spectator?: boolean;
}

/* ------------------------------------------------------------------ */
/* Tone families                                                      */
/* ------------------------------------------------------------------ */

type ToneFamily =
  | "neutral"
  | "mystic"
  | "danger"
  | "sad"
  | "warm"
  | "cold";

const TONE_FAMILY: Record<Tone, ToneFamily> = {
  neutral: "neutral",
  calm: "neutral",
  quiet: "neutral",
  reflective: "neutral",
  philosophical: "neutral",
  accepting: "neutral",
  sincere: "neutral",
  serious: "neutral",
  determined: "neutral",

  mystic: "mystic",
  whisper: "mystic",
  hollow: "mystic",
  distorted: "mystic",
  tempting: "mystic",
  ominous: "mystic",

  danger: "danger",
  fear: "danger",
  angry: "danger",
  aggressive: "danger",
  rage: "danger",
  furious: "danger",
  horror: "danger",
  dark: "danger",
  accusing: "danger",

  sad: "sad",
  melancholic: "sad",
  broken: "sad",
  tragic: "sad",
  regret: "sad",
  hurt: "sad",
  exhausted: "sad",
  desperate: "sad",
  confession: "sad",

  emotional: "warm",
  gentle: "warm",
  pleased: "warm",

  cold: "cold",
  worried: "cold",
};

const FAMILY_STYLES: Record<
  ToneFamily,
  {
    accent: string;
    border: string;
    glow: string;
    text: string;
    scan: string;
    /** rgb triplet used by the atmospheric layers */
    rgb: string;
  }
> = {
  neutral: {
    accent: "#22D3EE",
    border: "border-cyan-300/30",
    glow: "shadow-[0_0_70px_-12px_rgba(34,211,238,.45)]",
    text: "text-cyan-50",
    scan: "rgba(34,211,238,.9)",
    rgb: "34,211,238",
  },
  mystic: {
    accent: "#C084FC",
    border: "border-violet-300/30",
    glow: "shadow-[0_0_80px_-12px_rgba(192,132,252,.5)]",
    text: "text-violet-50",
    scan: "rgba(192,132,252,.9)",
    rgb: "192,132,252",
  },
  danger: {
    accent: "#FB7185",
    border: "border-rose-400/30",
    glow: "shadow-[0_0_80px_-12px_rgba(251,113,133,.5)]",
    text: "text-rose-50",
    scan: "rgba(251,113,133,.9)",
    rgb: "251,113,133",
  },
  sad: {
    accent: "#7DD3FC",
    border: "border-sky-300/30",
    glow: "shadow-[0_0_80px_-12px_rgba(125,211,252,.5)]",
    text: "text-sky-50",
    scan: "rgba(125,211,252,.9)",
    rgb: "125,211,252",
  },
  warm: {
    accent: "#FBBF24",
    border: "border-amber-300/30",
    glow: "shadow-[0_0_80px_-12px_rgba(251,191,36,.5)]",
    text: "text-amber-50",
    scan: "rgba(251,191,36,.9)",
    rgb: "251,191,36",
  },
  cold: {
    accent: "#67E8F9",
    border: "border-cyan-300/30",
    glow: "shadow-[0_0_80px_-12px_rgba(103,232,249,.5)]",
    text: "text-cyan-50",
    scan: "rgba(103,232,249,.9)",
    rgb: "103,232,249",
  },
};

const TONE_MODIFIERS: Partial<Record<Tone, string>> = {
  whisper: "italic opacity-80",
  distorted: "tracking-[0.2em]",
  hollow: "opacity-70",
  exhausted: "opacity-75",
  rage: "cutscene-shake",
  furious: "cutscene-shake",
  desperate: "cutscene-shake",
  quiet: "opacity-90",
};

function getToneStyle(tone?: Tone) {
  const family = (tone && TONE_FAMILY[tone]) || "neutral";
  return FAMILY_STYLES[family];
}

/* ------------------------------------------------------------------ */
/* Ambient layer                                                      */
/* ------------------------------------------------------------------ */

/**
 * Sits behind the panel and renders the atmospheric effects:
 * chromatic drift, embers, tone pulse, scanline sweep, vignette
 * breathing. All driven by CSS animations — no per-frame JS.
 */
function CutsceneAtmosphere({ tone }: { tone: ReturnType<typeof getToneStyle> }) {
  // Deterministic ember field — fixed positions so React doesn't reshuffle
  // them on re-render.
  const embers = [
    { left: "8%", delay: 0, dur: 9, size: 3 },
    { left: "17%", delay: 1.4, dur: 11, size: 2 },
    { left: "26%", delay: 2.8, dur: 8.5, size: 4 },
    { left: "34%", delay: 0.6, dur: 12, size: 2 },
    { left: "43%", delay: 3.6, dur: 10, size: 3 },
    { left: "52%", delay: 1.1, dur: 9.5, size: 2 },
    { left: "61%", delay: 4.2, dur: 11.5, size: 3 },
    { left: "70%", delay: 0.3, dur: 10.5, size: 2 },
    { left: "79%", delay: 2.2, dur: 8.8, size: 3 },
    { left: "88%", delay: 3.1, dur: 12, size: 2 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Chromatic drift — slow rotating conic gradient */}
      <div
        className="cutscene-chromatic absolute -inset-1/2"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, rgba(${tone.rgb},0.08) 90deg, transparent 180deg, rgba(${tone.rgb},0.06) 270deg, transparent 360deg)`,
        }}
      />

      {/* Tone pulse — radial glow that breathes with the current mood */}
      <div
        className="cutscene-tone-pulse absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 70%, rgba(${tone.rgb},0.22) 0%, transparent 55%)`,
        }}
      />

      {/* Scanline sweep — a soft horizontal band that crawls upward */}
      <div
        className="cutscene-scanline absolute inset-x-0 h-[30vh]"
        style={{
          background: `linear-gradient(to bottom, transparent, rgba(${tone.rgb},0.06) 40%, rgba(${tone.rgb},0.12) 50%, rgba(${tone.rgb},0.06) 60%, transparent)`,
        }}
      />

      {/* Ember field — small glowing motes drifting upward */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="cutscene-ember absolute rounded-full"
          style={{
            left: e.left,
            bottom: "-4%",
            width: e.size,
            height: e.size,
            background: tone.accent,
            boxShadow: `0 0 ${e.size * 3}px ${tone.accent}`,
            animationDelay: `${e.delay}s`,
            animationDuration: `${e.dur}s`,
          }}
        />
      ))}

      {/* Vignette breathing — subtle pulse on the outer darkening */}
      <div className="cutscene-vignette-breathe absolute inset-0" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function CutsceneOverlay({
  cutscene,
  onDone,
  spectator = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [booted, setBooted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef(onDone);
  const spectatorRef = useRef(spectator);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    spectatorRef.current = spectator;
  }, [spectator]);

  const advance = useCallback(() => {
    if (index < cutscene.lines.length - 1) {
      setIndex((i) => i + 1);
    } else {
      if (!spectatorRef.current) {
        socket.send({ type: "CUTSCENE_DONE", cutsceneId: cutscene.id });
      }
      onDoneRef.current();
    }
  }, [index, cutscene.lines.length, cutscene.id]);

  const skipAll = useCallback(() => {
    if (!spectatorRef.current) {
      socket.send({ type: "CUTSCENE_DONE", cutsceneId: cutscene.id });
    }
    onDoneRef.current();
  }, [cutscene.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        advance();
      } else if (e.code === "Escape") {
        e.preventDefault();
        skipAll();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, skipAll]);

  const line: CutsceneLine | undefined = cutscene.lines[index];

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 520);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!line) return;

    let audio: HTMLAudioElement | null = null;

    if (line.voice) {
      audio = new Audio(line.voice);
      audio.volume = 0.4;
      audio.play().catch(() => {});
      audioRef.current = audio;
    }

    const duration = line.duration ?? 4200;
    const timer = window.setTimeout(() => {
      advance();
    }, duration);

    return () => {
      window.clearTimeout(timer);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      audioRef.current = null;
    };
  }, [line, advance]);

  if (!line) return null;

  const tone = getToneStyle(line.tone);
  const modifier = line.tone ? (TONE_MODIFIERS[line.tone] ?? "") : "";
  const duration = line.duration ?? 3200;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[250] flex items-end justify-center overflow-hidden pb-[12vh]">
      {/* Full-screen blur veil */}
      <div className="cutscene-blur-veil absolute inset-0 backdrop-blur-3xl backdrop-brightness-[0.4] backdrop-saturate-[0.35]" />

      {/* Atmospheric effects behind the panel */}
      <CutsceneAtmosphere tone={tone} />

      {/* Radial darkening — center slightly lighter for the panel */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.35)_0%,rgba(0,0,0,.8)_65%,rgba(0,0,0,.95)_100%)]" />

      {/* Cinematic letterbox bars */}
      <div className="cutscene-letterbox-top absolute inset-x-0 top-0 z-20 flex h-[8vh] items-center justify-between bg-black px-6 sm:px-10">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40">
          Cinematic Sequence
        </span>
        <button
          type="button"
          onClick={skipAll}
          className="cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          Skip (Esc)
        </button>
      </div>
      <div className="cutscene-letterbox-bottom absolute inset-x-0 bottom-0 h-[8vh] bg-black" />

      {/* Bottom gradient — grounds the panel */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

      {/* One-time boot sweep */}
      {!booted && (
        <div
          className="hud-boot-sweep absolute inset-y-0 left-0 w-24"
          style={{
            background: `linear-gradient(90deg, transparent, ${tone.scan}, transparent)`,
          }}
        />
      )}

      {/* Line panel */}
      <div
        key={line.id}
        onClick={advance}
        role="button"
        tabIndex={0}
        aria-label="Click to advance dialogue"
        className={`hud-panel relative mx-6 w-full max-w-3xl cursor-pointer border ${tone.border} bg-black/80 backdrop-blur-xl ${tone.glow} ${modifier} cutscene-line-enter`}
      >
        <span
          className="hud-corner hud-corner-tl"
          style={{ borderColor: tone.accent }}
        />
        <span
          className="hud-corner hud-corner-br"
          style={{ borderColor: tone.accent }}
        />

        <div className="hud-scanlines pointer-events-none absolute inset-0" />

        <div className="relative px-6 py-5">
          {(line.speaker || cutscene.lines.length > 1) && (
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-white/50">
              {line.speaker ? (
                <span className="flex items-center gap-2">
                  <span
                    className="hud-dot h-1.5 w-1.5 rounded-full"
                    style={{
                      background: tone.accent,
                      boxShadow: `0 0 8px ${tone.accent}`,
                    }}
                  />
                  {line.speaker}
                </span>
              ) : (
                <span />
              )}
              {cutscene.lines.length > 1 && (
                <span className="tabular-nums text-white/35">
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(cutscene.lines.length).padStart(2, "0")}
                </span>
              )}
            </div>
          )}

          <p
            className={`text-lg font-bold leading-relaxed sm:text-2xl ${tone.text}`}
            style={{ textShadow: "0 2px 8px rgba(0,0,0,.8)" }}
          >
            {line.text}
          </p>

          <div className="mt-4 flex items-center justify-between gap-4">
            {cutscene.lines.length > 1 ? (
              <div className="flex flex-1 gap-1">
                {cutscene.lines.map((l, i) => (
                  <div
                    key={l.id}
                    className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/10"
                  >
                    {i < index && (
                      <div
                        className="h-full w-full"
                        style={{ background: tone.accent, opacity: 0.5 }}
                      />
                    )}
                    {i === index && (
                      <div
                        key={l.id + "-fill"}
                        className="hud-fill h-full"
                        style={{
                          background: tone.accent,
                          boxShadow: `0 0 6px ${tone.accent}`,
                          animationDuration: `${duration}ms`,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <span className="select-none text-[10px] font-bold uppercase tracking-widest text-white/40">
              Click or Space to continue
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hud-panel {
          clip-path: polygon(
            0 14px,
            14px 0,
            100% 0,
            100% calc(100% - 14px),
            calc(100% - 14px) 100%,
            0 100%
          );
        }

        .hud-corner {
          position: absolute;
          width: 18px;
          height: 18px;
          border-style: solid;
          border-width: 0;
          opacity: 0.8;
        }
        .hud-corner-tl {
          top: -1px;
          left: -1px;
          border-top-width: 2px;
          border-left-width: 2px;
        }
        .hud-corner-br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 2px;
          border-right-width: 2px;
        }

        .hud-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.05) 0px,
            rgba(255, 255, 255, 0.05) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }

        .hud-dot {
          animation: hudPulse 1.8s ease-in-out infinite;
        }

        .hud-fill {
          width: 0%;
          animation-name: hudFill;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        .hud-boot-sweep {
          animation: hudBoot 520ms ease-out forwards;
        }

        .cutscene-line-enter {
          animation: cutsceneLineEnter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .cutscene-shake {
          animation: cutsceneShake 420ms ease-in-out both;
        }

        /* ---- Atmosphere ---- */

        /* Chromatic drift: slow rotation of the conic gradient. */
        .cutscene-chromatic {
          animation: cutsceneChromatic 42s linear infinite;
          opacity: 0.55;
          filter: blur(40px);
        }

        /* Tone pulse: breathing radial glow at the base of the screen. */
        .cutscene-tone-pulse {
          animation: cutsceneTonePulse 5.6s ease-in-out infinite;
          opacity: 0.9;
        }

        /* Scanline sweep: soft band crawling from bottom to top. */
        .cutscene-scanline {
          animation: cutsceneScanline 7.2s linear infinite;
          opacity: 0.9;
        }

        /* Ember motes: small glowing particles drifting upward. */
        .cutscene-ember {
          animation-name: cutsceneEmberRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          opacity: 0;
        }

        /* Vignette breathing: pulses the outer darkening. */
        .cutscene-vignette-breathe {
          animation: cutsceneVignetteBreathe 6.4s ease-in-out infinite;
          background: radial-gradient(
            ellipse at 50% 55%,
            transparent 30%,
            rgba(0, 0, 0, 0.55) 90%
          );
        }

        /* ---- Base animations ---- */

        @keyframes hudFill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        @keyframes hudPulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes hudBoot {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(120vw);
          }
        }

        @keyframes cutsceneLineEnter {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes cutsceneShake {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          20% {
            transform: translate3d(-3px, 1px, 0);
          }
          40% {
            transform: translate3d(3px, -1px, 0);
          }
          60% {
            transform: translate3d(-2px, 0, 0);
          }
          80% {
            transform: translate3d(2px, 0, 0);
          }
        }

        @keyframes cutsceneVeilIn {
          from {
            opacity: 0;
            backdrop-filter: blur(0px) brightness(1) saturate(1);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(64px) brightness(0.4) saturate(0.35);
          }
        }

        @keyframes letterboxTopIn {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes letterboxBottomIn {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        /* ---- Atmosphere keyframes ---- */

        @keyframes cutsceneChromatic {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes cutsceneTonePulse {
          0%,
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes cutsceneScanline {
          0% {
            transform: translateY(100vh);
          }
          100% {
            transform: translateY(-30vh);
          }
        }

        @keyframes cutsceneEmberRise {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(-110vh) translateX(12px);
            opacity: 0;
          }
        }

        @keyframes cutsceneVignetteBreathe {
          0%,
          100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }

        .cutscene-blur-veil {
          animation: cutsceneVeilIn 380ms ease-out both;
        }

        .cutscene-letterbox-top {
          animation: letterboxTopIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .cutscene-letterbox-bottom {
          animation: letterboxBottomIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .hud-dot,
          .hud-fill,
          .hud-boot-sweep,
          .cutscene-line-enter,
          .cutscene-shake,
          .cutscene-blur-veil,
          .cutscene-letterbox-top,
          .cutscene-letterbox-bottom,
          .cutscene-chromatic,
          .cutscene-tone-pulse,
          .cutscene-scanline,
          .cutscene-ember,
          .cutscene-vignette-breathe {
            animation: none;
          }
          .hud-fill {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}