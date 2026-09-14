"use client";

import { useEffect, useState } from "react";
import { Crown, Feather, Heart, Sparkles } from "lucide-react";
import FloatingParticles from "../components/FloatingParticles";

interface CreditsScreenProps {
  onDone?: () => void;
  durationMs?: number; // total scroll duration; defaults to 68000
}

export default function CreditsScreen({
  onDone,
  durationMs = 68000,
}: CreditsScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showT = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(showT);
  }, []);

  return (
    <main className="credits-root relative min-h-screen overflow-hidden bg-[#030608] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 credits-vignette" />
      <div className="pointer-events-none absolute inset-0 credits-glow" />
      <FloatingParticles />

      {/* Top & bottom fade masks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-[#030608] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-[#030608] to-transparent" />

      {/* Scrolling content */}
      <div
        className={`credits-scroll relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center ${
          visible ? "credits-scroll-run" : ""
        }`}
        style={{ animationDuration: `${durationMs}ms` }}
        onAnimationEnd={onDone}
      >
        {/* Spacer so first text starts below the fold */}
        <div className="h-[60vh]" />

        {/* --- Title card --- */}
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-200/70">
          HighLands
        </p>
        <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">
          THE CHRONICLE
        </h1>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.4em] text-white/40">
          End Credits
        </p>

        <Divider />

        {/* --- Created by --- */}
        <Section label="Created by" />
        <div className="mt-4 flex flex-col items-center">
          <div className="credits-crown mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-200/10 text-amber-100">
            <Crown className="size-7" />
          </div>
          <h2
            className="text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl"
            style={{
              textShadow:
                "0 0 40px rgba(251,191,36,.35), 4px 4px 0 rgba(0,0,0,.85)",
            }}
          >
            Nicholas Johnson
          </h2>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.35em] text-cyan-200/70">
            Designer · Developer · Director
          </p>
        </div>

        <Divider />

        {/* --- Everything --- */}
        <Section label="Everything you just experienced" />
        <ul className="mt-6 space-y-3 text-sm text-white/70">
          {[
            "Game Design",
            "Frontend & Backend Architecture",
            "Story Engine & Narrative",
            "Combat Systems",
            "Real-Time Multiplayer",
            "Visual Effects & Animation",
            "Sound & Atmosphere",
            "UI / UX",
          ].map((item) => (
            <li key={item} className="flex items-center justify-center gap-2">
              <Sparkles className="size-3 text-cyan-200/60" />
              <span className="tracking-wide">{item}</span>
            </li>
          ))}
        </ul>

        <Divider />

        {/* --- Built with --- */}
        <Section label="Built With" />
        <ul className="mt-6 space-y-2 text-sm text-white/60">
          {[
            "Next.js · React · TypeScript",
            "NestJS · Socket.IO",
            "Tailwind CSS",
            "Custom Story & Combat Engines",
          ].map((item) => (
            <li key={item} className="tracking-wide">
              {item}
            </li>
          ))}
        </ul>

        <Divider />

        {/* --- A Message --- */}
        <Section label="A Message" />
        <div className="mt-6 flex flex-col items-center">
          <div className="credits-feather mb-5 flex size-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
            <Feather className="size-6" />
          </div>
          <p className="mx-auto max-w-xl text-base leading-8 text-white/75">
            This game was never just about winning. It was about the moment
            before every choice — when the room goes quiet, the torch flickers,
            and you have to decide what kind of player you are.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/60">
            Thank you for playing, for watching, and for choosing.
          </p>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.4em] text-cyan-200/60">
            — Nicholas Johnson
          </p>
        </div>

        <Divider />

        {/* --- Moral of the Game --- */}
        <Section label="The Moral of the Game" />
        <div className="mt-6 flex flex-col items-center">
          <div className="credits-heart mb-6 flex size-12 items-center justify-center rounded-2xl border border-amber-200/35 bg-amber-200/10 text-amber-100">
            <Heart className="size-6" />
          </div>

          <blockquote className="mx-auto max-w-2xl">
            <p
              className="text-2xl font-black uppercase leading-snug tracking-tight text-white/90 sm:text-3xl"
              style={{
                textShadow:
                  "0 0 30px rgba(34,211,238,.25), 3px 3px 0 rgba(0,0,0,.85)",
              }}
            >
              “Every choice is a door.
              <br />
              Every door is a consequence.
              <br />
              And every consequence is a story
              <br />
              someone else will have to live in.”
            </p>
          </blockquote>

          <div className="mt-10 space-y-5 text-sm leading-7 text-white/65 sm:text-base">
            <p className="mx-auto max-w-xl">
              There is no safe path through the dark. There is only the path
              you choose — and the people you choose it with.
            </p>
            <p className="mx-auto max-w-xl">
              Teams rise. Teams fall. Names are remembered, or they are not.
              But the willingness to <em>act</em>, even when the outcome is
              uncertain, is the only thing that ever moves the story forward.
            </p>
            <p className="mx-auto max-w-xl text-white/80">
              So choose boldly. Choose together. And if you fall —{" "}
              <span className="font-bold text-cyan-200/90">
                fall forward.
              </span>
            </p>
          </div>

          <div className="mt-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-cyan-100">
              <Sparkles className="size-3" /> Fall Forward
            </span>
          </div>
        </div>

        <Divider />

        {/* --- Special thanks --- */}
        <Section label="Special Thanks" />
        <div className="mt-4 space-y-2 text-sm text-white/60">
          <p>To everyone who played, watched, and endured the horror.</p>
          <p>And to the teams who dared to choose.</p>
        </div>

        <Divider />

        {/* --- Closing --- */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/35">
            A Nicholas Johnson Production
          </p>
          <p
            className="mt-6 text-3xl font-black uppercase tracking-tight text-white/90 sm:text-4xl"
            style={{
              textShadow:
                "0 0 30px rgba(34,211,238,.35), 4px 4px 0 rgba(0,0,0,.85)",
            }}
          >
            Thank You
          </p>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.5em] text-white/25">
            © {new Date().getFullYear()} Nicholas Johnson
          </p>
        </div>

        {/* Spacer so last text scrolls fully off screen */}
        <div className="h-[60vh]" />
      </div>

      {/* Skip button */}
      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="fixed bottom-6 right-6 z-30 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 backdrop-blur-md transition hover:border-cyan-200/40 hover:bg-cyan-200/10 hover:text-cyan-100"
        >
          Skip
        </button>
      ) : null}

      <style jsx>{`
        .credits-root {
          background:
            radial-gradient(
              ellipse at 50% 0%,
              rgba(34, 211, 238, 0.08) 0%,
              transparent 55%
            ),
            radial-gradient(
              ellipse at 50% 100%,
              rgba(251, 191, 36, 0.05) 0%,
              transparent 60%
            ),
            #030608;
        }
        .credits-vignette {
          background: radial-gradient(
            ellipse at center,
            transparent 40%,
            rgba(0, 0, 0, 0.65) 100%
          );
        }
        .credits-glow {
          background:
            radial-gradient(
              circle at 20% 30%,
              rgba(34, 211, 238, 0.06) 0%,
              transparent 40%
            ),
            radial-gradient(
              circle at 80% 70%,
              rgba(251, 191, 36, 0.05) 0%,
              transparent 45%
            );
        }

        .credits-scroll {
          opacity: 0;
        }
        .credits-scroll-run {
          animation: credits-roll linear forwards;
        }

        .credits-crown {
          animation: credits-crown-pulse 3s ease-in-out infinite;
        }
        .credits-feather {
          animation: credits-feather-drift 4.5s ease-in-out infinite;
        }
        .credits-heart {
          animation: credits-heart-beat 2.4s ease-in-out infinite;
        }

        @keyframes credits-roll {
          0% {
            opacity: 0;
            transform: translateY(30vh);
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(calc(-100% + 40vh));
          }
        }

        @keyframes credits-crown-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.35);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 40px 0 rgba(251, 191, 36, 0.25);
            transform: scale(1.04);
          }
        }

        @keyframes credits-feather-drift {
          0%,
          100% {
            transform: translateY(0) rotate(-4deg);
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.25);
          }
          50% {
            transform: translateY(-6px) rotate(4deg);
            box-shadow: 0 0 30px 0 rgba(34, 211, 238, 0.2);
          }
        }

        @keyframes credits-heart-beat {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.35);
          }
          20% {
            transform: scale(1.08);
          }
          40% {
            transform: scale(1);
            box-shadow: 0 0 34px 0 rgba(251, 191, 36, 0.25);
          }
        }
      `}</style>
    </main>
  );
}

/* ---------------------------------------------------------------- */
/* Small helpers                                                     */
/* ---------------------------------------------------------------- */

function Divider() {
  return (
    <div className="my-14 flex w-full items-center justify-center gap-3">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-cyan-200/30" />
      <span className="size-1.5 rotate-45 bg-cyan-200/50" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-cyan-200/30" />
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/35">
      {label}
    </p>
  );
}