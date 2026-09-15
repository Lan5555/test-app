"use client";

import { Headphones } from "lucide-react";
import React, { useEffect } from "react";
import FloatingParticles from "./FloatingParticles";

interface Props {
  onDone: () => void;
}

const SplashScreen: React.FC<Props> = ({ onDone }) => {
  useEffect(() => {
    const t = window.setTimeout(() => onDone?.(), 4000);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash-root relative w-full min-h-screen flex justify-center items-center bg-black overflow-hidden">
      {/* Ambient pulse behind everything */}
      <div className="splash-glow absolute inset-0" />

      {/* Vignette to darken the edges */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_220px_80px_rgba(0,0,0,0.95)]" />

      {/* Corner ticks — matches the menu style */}
      <span className="pointer-events-none absolute left-6 top-6 size-6 border-l border-t border-cyan-200/20" />
      <span className="pointer-events-none absolute bottom-6 right-6 size-6 border-b border-r border-cyan-200/20" />

      <FloatingParticles />

      {/* Content */}
      <div className="splash-content relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        {/* Icon with a soft halo */}
        <div className="splash-icon-wrap relative flex items-center justify-center">
          <span className="splash-halo absolute inline-flex h-28 w-28 rounded-full bg-cyan-400/15 blur-2xl" />
          <Headphones
            size={64}
            strokeWidth={1.6}
            className="splash-icon relative text-white"
          />
        </div>

        <h1 className="splash-title text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
          Better with Headphones
        </h1>

        <p className="splash-tagline max-w-xs text-[10px] font-bold uppercase tracking-[0.5em] text-white/35">
          The Highlands is best heard, not just seen
        </p>

        {/* Thin divider, mirrors the menu's under-title rule */}
        <div className="splash-rule mt-2 h-px w-40 bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
      </div>

      <style jsx>{`
        .splash-glow {
          background: radial-gradient(
            circle at 50% 45%,
            rgba(103, 232, 249, 0.08) 0%,
            transparent 55%
          );
          animation: splash-pulse 5s ease-in-out infinite;
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }

        .splash-content {
          animation: splash-fade-in 1200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splash-fade-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .splash-icon-wrap {
          animation: splash-icon-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splash-icon-in {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          60% {
            opacity: 1;
            transform: scale(1.06);
          }
          100% {
            transform: scale(1);
          }
        }

        .splash-icon {
          filter: drop-shadow(0 0 20px rgba(103, 232, 249, 0.35));
        }
        .splash-halo {
          animation: splash-halo 3s ease-in-out infinite;
        }
        @keyframes splash-halo {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.12); }
        }

        .splash-title {
          text-shadow:
            0 0 40px rgba(103, 232, 249, 0.25),
            4px 4px 0 rgba(0, 0, 0, 0.6);
          animation: splash-title-in 1600ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splash-title-in {
          0% {
            opacity: 0;
            letter-spacing: 0.3em;
            filter: blur(6px);
          }
          100% {
            opacity: 1;
            letter-spacing: -0.02em;
            filter: blur(0);
          }
        }

        .splash-tagline {
          animation: splash-fade-in 1800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both;
        }
        .splash-rule {
          animation: splash-rule-in 1600ms cubic-bezier(0.16, 1, 0.3, 1) 500ms both;
        }
        @keyframes splash-rule-in {
          0% { opacity: 0; transform: scaleX(0.2); }
          100% { opacity: 1; transform: scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-glow,
          .splash-content,
          .splash-icon-wrap,
          .splash-icon,
          .splash-halo,
          .splash-title,
          .splash-tagline,
          .splash-rule {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;