"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** How many particles to render. Fewer on mobile. */
  count?: number;
  /** Base drift speed multiplier. 1 = normal, 2 = fast. */
  speed?: number;
  /** Optional className merged onto the canvas wrapper. */
  className?: string;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  pulse: number;
  hue: number;
};

export default function FloatingParticles({
  count = 45,
  speed = 1,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      particles.length = 0;
      const n =
        window.innerWidth < 640 ? Math.round(count * 0.6) : count;
      for (let i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25 * speed,
          vy: -(0.15 + Math.random() * 0.35) * speed,
          r: 0.8 + Math.random() * 2.2,
          alpha: 0.15 + Math.random() * 0.5,
          pulse: Math.random() * Math.PI * 2,
          hue: 180 + Math.random() * 40, // cyan → teal
        });
      }
    }

    resize();
    spawn();

    const onResize = () => {
      resize();
      spawn();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = Math.min(48, now - last) / 16.666; // frames since last
      last = now;

      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.pulse += 0.02 * dt;

        // Wrap around edges so the field never empties.
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const flicker = 0.6 + 0.4 * Math.sin(p.pulse);
        const alpha = p.alpha * flicker;

        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.r * 4,
        );
        gradient.addColorStop(
          0,
          `hsla(${p.hue}, 90%, 75%, ${alpha})`,
        );
        gradient.addColorStop(
          1,
          `hsla(${p.hue}, 90%, 60%, 0)`,
        );

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();

        // Small bright core
        ctx.fillStyle = `hsla(${p.hue}, 100%, 90%, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [count, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}