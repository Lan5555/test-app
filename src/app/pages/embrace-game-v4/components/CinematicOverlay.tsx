"use client";

interface Props {
  title: string;
  subtitle?: string;
}

export default function CinematicOverlay({ title, subtitle }: Props) {
  return (
    <div
      className="
      fixed
      inset-0
      z-50
      pointer-events-none
      flex
      items-center
      justify-center
      bg-black/40
    "
    >
      <div className="text-center">
        <div
          className="
          mb-4
          text-xs
          uppercase
          tracking-[0.5em]
          text-white/50
        "
        >
          The Chronicle Continues
        </div>

        <h1
          className="
          text-5xl
          font-black
          uppercase
          tracking-widest
          text-white
          drop-shadow-2xl
        "
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className="
            mt-4
            text-lg
            text-white/70
          "
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
