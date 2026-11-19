"use client";

import { useEffect, useRef } from "react";

interface Props {
  count?: number;
  speed?: number;
  className?: string;
  variant?: "ambient" | "entrance";
}

type Particle = {
  x: number;
  y: number;
  depth: number;
  phase: number;
  sprite: HTMLCanvasElement;
};

function makeGlow(hue: number, glint = false) {
  const sprite = document.createElement("canvas");
  const size = 64;
  const center = size / 2;
  sprite.width = sprite.height = size;
  const context = sprite.getContext("2d");
  if (!context) return sprite;

  const glow = context.createRadialGradient(center, center, 0, center, center, center);
  glow.addColorStop(0, `hsl(${hue} 100% 96%)`);
  glow.addColorStop(0.13, `hsl(${hue} 95% 76% / 0.9)`);
  glow.addColorStop(0.4, `hsl(${hue} 90% 62% / 0.28)`);
  glow.addColorStop(1, `hsl(${hue} 90% 62% / 0)`);
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  if (glint) {
    context.fillStyle = `hsl(${hue} 100% 96% / 0.85)`;
    context.beginPath();
    context.moveTo(center, center - 15);
    context.lineTo(center + 4, center - 3);
    context.lineTo(center + 10, center);
    context.lineTo(center + 4, center + 3);
    context.lineTo(center, center + 19);
    context.lineTo(center - 4, center + 3);
    context.lineTo(center - 10, center);
    context.lineTo(center - 4, center - 3);
    context.closePath();
    context.fill();
  }

  return sprite;
}

export default function FloatingParticles({
  count = 45,
  speed = 1,
  className = "",
  variant = "ambient",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sprites = [makeGlow(188), makeGlow(211), makeGlow(196, true)];
    if (variant === "entrance") sprites.push(makeGlow(43), makeGlow(39, true));

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let time = 0;
    const particles: Particle[] = [];

    const draw = (delta: number) => {
      time += delta;
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        const { depth, phase, sprite } = particle;
        const gust = Math.sin(time * 0.55 + particle.y * 0.007 + phase);
        particle.x += (3 + gust * (5 + depth * 9)) * speed * delta;
        particle.y -= (7 + depth * 25) * speed * delta;

        const margin = 20;
        if (particle.y < -margin) {
          particle.y = height + margin;
          particle.x = Math.random() * width;
        }
        if (particle.x < -margin) particle.x = width + margin;
        if (particle.x > width + margin) particle.x = -margin;

        const size = 4 + depth * 20;
        const flicker = 0.65 + 0.35 * Math.sin(time * (0.85 + depth) + phase);
        context.globalAlpha = (0.32 + depth * 0.65) * flicker;
        context.drawImage(sprite, particle.x - size / 2, particle.y - size / 2, size, size);
      }

      context.globalAlpha = 1;
    };

    const resize = () => {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const density = nextWidth < 640 ? 0.55 : 1;
      const total = Math.max(0, Math.round(count * density));
      const scaleX = width ? nextWidth / width : 1;
      const scaleY = height ? nextHeight / height : 1;

      if (particles.length > total) particles.length = total;
      for (const particle of particles) {
        particle.x *= scaleX;
        particle.y *= scaleY;
      }
      while (particles.length < total) {
        particles.push({
          x: Math.random() * nextWidth,
          y: Math.random() * nextHeight,
          depth: Math.random() ** 1.5,
          phase: Math.random() * Math.PI * 2,
          sprite: sprites[Math.floor(Math.random() * sprites.length)],
        });
      }

      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    };

    const animate = (now: number) => {
      draw(Math.min(0.05, (now - lastFrame) / 1000));
      lastFrame = now;
      frame = requestAnimationFrame(animate);
    };

    const updateAnimation = () => {
      cancelAnimationFrame(frame);
      if (!reducedMotion.matches && !document.hidden) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    updateAnimation();
    document.addEventListener("visibilitychange", updateAnimation);
    reducedMotion.addEventListener("change", updateAnimation);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateAnimation);
      reducedMotion.removeEventListener("change", updateAnimation);
    };
  }, [count, speed, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
