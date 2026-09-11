"use client";

import { useEffect, useRef, useState } from "react";
import {
  Gauge,
  Monitor,
  Music,
  Radio,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  Swords,
  Users,
  Volume2,
  X,
} from "lucide-react";
import FloatingParticles from "../components/FloatingParticles";
import WutheringButton from "../../game/components/styled-button";
import { AudioController } from "../hooks/audioHandler";
import { useRouter } from "next/navigation";

interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface Props {
  onContinue: () => void;
  onNewGame: () => void;
  onWatch: () => void;
  onBattle: () => void;
  onSettings?: () => void;
  version?: string;
}

const TITLE = "THE CHRONICLE";

/**
 * Background image for the menu. Swap this one path to change the scene.
 * Point it at a different asset in /public when you want a new backdrop.
 */
const MENU_BACKGROUND = "/highlands.jpeg";

const clip = (px = 14) => ({
  clipPath: `polygon(0 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% 100%, ${px}px 100%, 0 calc(100% - ${px}px))`,
});

function CornerTicks({ accent = "rgba(103,232,249,.3)" }: { accent?: string }) {
  return (
    <>
      <span
        className="pointer-events-none absolute left-3 top-3 size-3 border-l border-t"
        style={{ borderColor: accent }}
      />
      <span
        className="pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r"
        style={{ borderColor: accent }}
      />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Settings primitives                                               */
/* ---------------------------------------------------------------- */

function SettingSlider({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-bold uppercase tracking-[0.15em] text-white/60">
          {Icon ? <Icon className="size-3.5 text-cyan-200/70" /> : null}
          {label}
        </span>
        <span className="font-black tabular-nums text-cyan-100/80">
          {value}%
        </span>
      </div>
      <div className="relative mt-3 h-1 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-cyan-200"
          style={{ width: `${value}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="settings-range absolute inset-0 -my-2 h-5 w-full cursor-pointer appearance-none bg-transparent"
          style={{ ["--fill" as string]: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 border-t border-white/5 py-3.5 text-left first:border-t-0"
    >
      <span>
        <span className="block text-xs font-bold uppercase tracking-[0.15em] text-white/70">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] text-white/35">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
          checked
            ? "border-cyan-200/60 bg-cyan-200/25"
            : "border-white/15 bg-white/5"
        }`}
      >
        <span
          className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${
            checked
              ? "left-[18px] bg-cyan-200 shadow-[0_0_8px_rgba(103,232,249,.6)]"
              : "left-[3px] bg-white/40"
          }`}
        />
      </span>
    </button>
  );
}

function SettingSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="border-t border-white/5 py-3.5 first:border-t-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-white/70">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition ${
              value === opt.value
                ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-white/45 hover:bg-white/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Settings modal                                                    */
/* ---------------------------------------------------------------- */

type SettingsTab = "audio" | "display" | "battle";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "audio", label: "Audio", icon: Music },
  { id: "display", label: "Display", icon: Monitor },
  { id: "battle", label: "Battle", icon: Swords },
];

function SettingsModal({
  onClose,
  onParticlesChange,
}: {
  onClose: () => void;
  onParticlesChange?: (enabled: boolean) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("audio");
  const [closing, setClosing] = useState(false);

  const [masterVolume, setMasterVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(65);
  const [sfxVolume, setSfxVolume] = useState(75);
  const [muteOnBlur, setMuteOnBlur] = useState(true);

  const [quality, setQuality] = useState<"low" | "balanced" | "high">(
    "balanced",
  );
  const [particles, setParticles] = useState(true);
  const [screenShake, setScreenShake] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [battleSpeed, setBattleSpeed] = useState(50);
  const [damageNumbers, setDamageNumbers] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [breakFlashes, setBreakFlashes] = useState(true);

  function close() {
    setClosing(true);
    window.setTimeout(onClose, 200);
  }

  function toggleParticles(value: boolean) {
    setParticles(value);
    onParticlesChange?.(value);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  useEffect(() => {
      AudioController.setMusicVolume(musicVolume);
      AudioController.setMasterVolume(masterVolume);
      AudioController.setSfxVolume(sfxVolume);
  },[musicVolume, masterVolume, sfxVolume, muteOnBlur])

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${
        closing ? "settings-overlay-out" : "settings-overlay-in"
      }`}
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={close}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        style={clip(28)}
        className={`relative flex w-full max-w-2xl flex-col border border-white/10 bg-[#0a0f13]/95 shadow-2xl backdrop-blur-md sm:flex-row ${
          closing ? "settings-panel-out" : "settings-panel-in"
        }`}
      >
        <CornerTicks />

        <div className="flex shrink-0 gap-1 border-b border-white/10 p-3 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
          <div className="mb-2 hidden items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 sm:flex">
            <SettingsIcon className="size-3" /> Settings
          </div>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  AudioController.playerHoverAndClickSound();
                  setTab(t.id)
                }}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition sm:flex-none ${
                  active
                    ? "bg-cyan-200/10 text-cyan-100"
                    : "text-white/45 hover:bg-white/5 hover:text-white/70"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 p-5 sm:p-7">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>

          {tab === "audio" && (
            <div key="audio" className="settings-fade">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/50">
                Sound
              </p>
              <h3 className="mt-1 text-xl font-black">Audio settings</h3>
              <div className="mt-4 divide-y divide-white/5">
                <SettingSlider
                  label="Master volume"
                  value={masterVolume}
                  onChange={setMasterVolume}
                  icon={Volume2}
                />
                <SettingSlider
                  label="Music"
                  value={musicVolume}
                  onChange={setMusicVolume}
                  icon={Music}
                />
                <SettingSlider
                  label="Sound effects"
                  value={sfxVolume}
                  onChange={setSfxVolume}
                  icon={Sparkles}
                />
                <SettingToggle
                  label="Mute when unfocused"
                  description="Silence audio while the tab isn't active"
                  checked={muteOnBlur}
                  onChange={setMuteOnBlur}
                />
              </div>
            </div>
          )}

          {tab === "display" && (
            <div key="display" className="settings-fade">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/50">
                Visuals
              </p>
              <h3 className="mt-1 text-xl font-black">Display settings</h3>
              <div className="mt-4 divide-y divide-white/5">
                <SettingSelect
                  label="Graphics quality"
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "balanced", label: "Balanced" },
                    { value: "high", label: "High" },
                  ]}
                />
                <SettingToggle
                  label="Floating particles"
                  description="Ambient particles across menus and rooms"
                  checked={particles}
                  onChange={toggleParticles}
                />
                <SettingToggle
                  label="Screen shake"
                  description="Camera shake on heavy hits"
                  checked={screenShake}
                  onChange={setScreenShake}
                />
                <SettingToggle
                  label="Reduce motion"
                  description="Minimize animation across the interface"
                  checked={reduceMotion}
                  onChange={setReduceMotion}
                />
              </div>
            </div>
          )}

          {tab === "battle" && (
            <div key="battle" className="settings-fade">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/50">
                Combat
              </p>
              <h3 className="mt-1 text-xl font-black">Battle settings</h3>
              <div className="mt-4 divide-y divide-white/5">
                <SettingSlider
                  label="Battle speed"
                  value={battleSpeed}
                  onChange={setBattleSpeed}
                  icon={Gauge}
                />
                <SettingToggle
                  label="Damage numbers"
                  description="Show floating damage on hit"
                  checked={damageNumbers}
                  onChange={setDamageNumbers}
                />
                <SettingToggle
                  label="Break flashes"
                  description="Full-screen flash when a target breaks"
                  checked={breakFlashes}
                  onChange={setBreakFlashes}
                />
                <SettingToggle
                  label="Auto-confirm actions"
                  description="Skip the confirmation step in combat"
                  checked={autoConfirm}
                  onChange={setAutoConfirm}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={close}
              className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-xl bg-cyan-200 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-cyan-100"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-overlay-in {
          animation: settings-overlay-in 180ms ease-out both;
        }
        .settings-overlay-out {
          animation: settings-overlay-out 200ms ease-in both;
        }
        .settings-panel-in {
          animation: settings-panel-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .settings-panel-out {
          animation: settings-panel-out 200ms ease-in both;
        }
        .settings-fade {
          animation: settings-fade 220ms ease-out both;
        }
        @keyframes settings-overlay-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes settings-overlay-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes settings-panel-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes settings-panel-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
        }
        @keyframes settings-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Main menu                                                         */
/* ---------------------------------------------------------------- */

export default function MainMenu({
  onContinue,
  onNewGame,
  onWatch,
  onBattle,
  onSettings,
  version = "v0.1.0",
}: Props) {
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [hasEnteredGame, setHasEnteredGame] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  

  const items: MenuItem[] = [
    {
      id: "continue",
      label: "Continue",
      description: "Return to your last chapter",
      icon: ScrollText,
      onSelect: () => {
        onContinue?.();
        AudioController.playerHoverAndClickSound();
      },
    },
    {
      id: "new",
      label: "New chronicle",
      description: "Begin a story from the start",
      icon: Users,
      onSelect: () => {
        onNewGame?.();
        AudioController.playerHoverAndClickSound();
      },
    },
    {
      id: "watch",
      label: "Spectate",
      description: "Watch a room live",
      icon: Radio,
      onSelect: () => {
        onWatch?.();
        AudioController.playerHoverAndClickSound();
      },
    },
    {
      id: "battle",
      label: "Battle",
      description: "Battle with friends",
      icon: Swords,
      onSelect: () => {
        onBattle?.();
        AudioController.playerHoverAndClickSound();
      },
    },
    {
      id: "settings",
      label: "Settings",
      description: "Audio, display, controls",
      icon: SettingsIcon,
      onSelect: () => {
        onSettings?.();
        setSettingsOpen(true);
        AudioController.playerHoverAndClickSound();
      },
    },
  ];
  const handleStartGame = () => {
    AudioController.playMenuSong();
    AudioController.makeFullScreen();
    setHasEnteredGame(true);
  }

  if(!hasEnteredGame){
    return (
        <div className="min-h-screen w-full flex justify-center items-center bg-black">
            <FloatingParticles/>
            <WutheringButton onClick={handleStartGame}>Enter Game</WutheringButton>
        </div>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030608] text-white">
      {/* Background image — swap MENU_BACKGROUND to change the scene */}
      <div
        className="absolute inset-0 menu-bg-pan bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url('${MENU_BACKGROUND}')` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,8,.55)_0%,rgba(3,6,8,.35)_45%,rgba(3,6,8,.96)_100%)]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[20%] menu-sweep bg-[conic-gradient(from_200deg_at_50%_30%,rgba(103,232,249,.10),transparent_25%,transparent_75%,rgba(103,232,249,.06))]" />
      </div>

      {/* Floating particles — toggled by settings */}
      {particlesEnabled ? <FloatingParticles /> : null}

      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgba(0,0,0,.75)]" />
      <span className="pointer-events-none absolute left-6 top-6 size-8 border-l border-t border-cyan-200/20 sm:left-10 sm:top-10" />
      <span className="pointer-events-none absolute bottom-6 right-6 size-8 border-b border-r border-cyan-200/20 sm:bottom-10 sm:right-10" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-20">
        <p
          className={`text-[11px] font-black uppercase tracking-[0.6em] text-cyan-200/60 menu-fade-up ${
            ready ? "menu-in" : "menu-pre"
          }`}
          style={{ animationDelay: "80ms" }}
        >
          Explore the chronicles of the fallen.
        </p>

        <h1 className="relative mt-5 flex flex-wrap justify-center text-6xl font-black uppercase tracking-tight sm:text-8xl">
          {TITLE.split("").map((ch, i) => (
            <span
              key={i}
              className={`menu-glyph inline-block ${ready ? "menu-glyph-in" : ""}`}
              style={{
                animationDelay: `${140 + i * 28}ms`,
                textShadow:
                  "0 0 60px rgba(103,232,249,.25), 4px 4px 0 rgba(0,0,0,.5)",
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        <div
          className={`mt-6 h-px w-56 bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent menu-fade-up ${
            ready ? "menu-in" : "menu-pre"
          }`}
          style={{ animationDelay: "560ms" }}
        />

        <p
          className={`mt-6 max-w-md text-center text-sm leading-6 text-white/45 menu-fade-up ${
            ready ? "menu-in" : "menu-pre"
          }`}
          style={{ animationDelay: "620ms" }}
        >
          Every choice is watched. Every fall is remembered.
        </p>

        <nav className="mt-14 flex w-full max-w-md flex-col gap-2">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onSelect}
                className={`menu-item group relative flex items-center gap-4 overflow-hidden border border-white/10 bg-white/[0.03] px-5 py-4 text-left backdrop-blur-sm transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.04] menu-fade-up ${
                  ready ? "menu-in" : "menu-pre"
                }`}
                style={{
                  animationDelay: `${720 + i * 90}ms`,
                  clipPath:
                    "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
                }}
              >
                <span className="menu-item-edge absolute left-0 top-0 h-full w-[3px] bg-cyan-200/70" />
                <Icon className="size-5 shrink-0 text-cyan-100/70 transition group-hover:text-cyan-100" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black uppercase tracking-[0.15em] text-white/85">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/35">
                    {item.description}
                  </span>
                </span>
                <span className="menu-item-arrow text-cyan-100/0 transition group-hover:text-cyan-100">
                  →
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div
        className={`absolute bottom-6 left-6 text-[10px] font-bold uppercase tracking-[0.25em] text-white/25 menu-fade-up sm:left-10 ${
          ready ? "menu-in" : "menu-pre"
        }`}
        style={{ animationDelay: "1000ms" }}
      >
        {version}
      </div>
      <div
        className={`absolute bottom-6 right-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/25 menu-fade-up sm:right-10 ${
          ready ? "menu-in" : "menu-pre"
        }`}
        style={{ animationDelay: "1040ms" }}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        Server online
      </div>

      {settingsOpen ? (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onParticlesChange={setParticlesEnabled}
        />
      ) : null}

      <style jsx>{`
        .menu-bg-pan {
          animation: menu-bg-pan 40s ease-in-out infinite alternate;
        }
        .menu-sweep {
          animation: menu-sweep 22s linear infinite;
        }
        .menu-pre {
          opacity: 0;
        }
        .menu-fade-up.menu-in {
          animation: menu-fade-up 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .menu-glyph {
          opacity: 0;
          filter: blur(6px);
          transform: translate3d(0, 18px, 0) scale(1.05);
        }
        .menu-glyph-in {
          animation: menu-glyph-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .menu-item-edge {
          transform: scaleY(0);
          transform-origin: top;
          transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .menu-item:hover .menu-item-edge {
          transform: scaleY(1);
        }
        .menu-item-arrow {
          transform: translateX(-4px);
          transition:
            transform 300ms ease,
            color 300ms ease;
        }
        .menu-item:hover .menu-item-arrow {
          transform: translateX(0);
        }

        @keyframes menu-bg-pan {
          from {
            transform: scale(1.06) translate(-1%, 0);
          }
          to {
            transform: scale(1.06) translate(1%, -1%);
          }
        }
        @keyframes menu-sweep {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes menu-fade-up {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes menu-glyph-in {
          0% {
            opacity: 0;
            filter: blur(6px);
            transform: translate3d(0, 18px, 0) scale(1.05);
          }
          60% {
            opacity: 1;
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .menu-bg-pan,
          .menu-sweep {
            animation: none;
          }
          .menu-fade-up.menu-in,
          .menu-glyph-in {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </main>
  );
}