"use client";

import { useEffect, useState } from "react";

export type FlashKind = "victory" | "defeat" | "boss";

interface Props {
  /** Change to re-trigger the animation. Usually Date.now(). */
  trigger: number;
  /** Higher intensity for defeats and bosses. */
  kind?: FlashKind;
  /** Total duration in ms. Defaults to 900. */
  duration?: number;
  /** Called when the animation finishes — use to sequence the next step. */
  onDone?: () => void;
}

const KIND_STYLES: Record<
  FlashKind,
  { color: string; peakOpacity: number; ringColor: string }
> = {
  victory: {
    color: "bg-white",
    peakOpacity: 0.9,
    ringColor: "border-white/60",
  },
  defeat: {
    color: "bg-red-50",
    peakOpacity: 1,
    ringColor: "border-red-200/70",
  },
  boss: {
    color: "bg-white",
    peakOpacity: 1,
    ringColor: "border-amber-200/70",
  },
};

export default function WhiteFlash({
  trigger,
  kind = "victory",
  duration = 2000,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [trigger, duration, onDone]);

  if (!visible) return null;

  const style = KIND_STYLES[kind];

  return (
    <div
      key={trigger}
      className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {/* The white wash */}
      <div
        className={`absolute inset-0 ${style.color} ff-flash-wash`}
        style={
          {
            "--ff-peak": style.peakOpacity,
            animationDuration: `${duration}ms`,
          } as React.CSSProperties
        }
      />

      {/* Concentric shockwave rings — the classic FF impact */}
      <div
        className={`absolute size-[70vmin] rounded-full border-4 ${style.ringColor} ff-flash-ring`}
        style={{ animationDuration: `${duration}ms` }}
      />
      <div
        className={`absolute size-[70vmin] rounded-full border-2 ${style.ringColor} ff-flash-ring-delayed`}
        style={{ animationDuration: `${duration}ms` }}
      />

      {/* Brief diagonal streaks for extra impact on defeat/boss */}
      {kind !== "victory" ? (
        <div className="absolute inset-0 ff-flash-streaks">
          <div className="absolute left-0 top-[30%] h-[2px] w-full bg-black/15" />
          <div className="absolute left-0 top-[70%] h-[2px] w-full bg-black/15" />
        </div>
      ) : null}
    </div>
  );
}