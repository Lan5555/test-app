"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Compass,
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
import { AudioController, DEFAULT_GAME_VOLUME } from "../hooks/audioHandler";
import dialogStyles from "../components/game-dialog.module.css";
import Image from "next/image";
import ChapterSelectModal, { Chapter } from "../components/chapterSelect";
import entranceStyles from "./entrance.module.css";

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
  onAdventure?: () => void;
  onStats?: () => void;
  onSettings?: () => void;
  utility?: ReactNode;
  version?: string;
}

const MENU_BACKGROUND = "/adventure/crownfall-citadel.webp";

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

  const [masterVolume, setMasterVolume] = useState<number>(DEFAULT_GAME_VOLUME.master);
  const [musicVolume, setMusicVolume] = useState<number>(DEFAULT_GAME_VOLUME.music);
  const [sfxVolume, setSfxVolume] = useState<number>(DEFAULT_GAME_VOLUME.effects);
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
  }, [musicVolume, masterVolume, sfxVolume, muteOnBlur]);

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${
        closing ? "settings-overlay-out" : "settings-overlay-in"
      }`}
    >
      <button
        type="button"
        aria-label="Close settings"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 ${dialogStyles.veil} ${dialogStyles.menuVeil}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`${dialogStyles.chrome} ${dialogStyles.menuGlass} ${dialogStyles.overlayPanel} relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-auto sm:flex-row ${
          closing ? "settings-panel-out" : "settings-panel-in"
        }`}
      >
        <CornerTicks />

        <div role="group" aria-label="Settings categories" className={`${dialogStyles.modalRail} flex shrink-0 gap-1 border-b p-3 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r sm:p-4`}>
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
                aria-pressed={active}
                onClick={() => {
                  AudioController.playerHoverAndClickSound();
                  setTab(t.id);
                }}
                className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 text-xs font-semibold transition sm:flex-none sm:flex-row sm:justify-start sm:gap-2 sm:px-3 ${
                  active
                    ? "bg-amber-100/15 text-amber-100"
                    : "text-slate-200/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 p-5 sm:p-7">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={`absolute right-4 top-4 ${dialogStyles.modalClose}`}
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
              className={`${dialogStyles.modalAction} px-5 py-2.5 text-xs font-black uppercase tracking-widest`}
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
        @media (prefers-reduced-motion: reduce) {
          .settings-overlay-in,
          .settings-overlay-out,
          .settings-panel-in,
          .settings-panel-out,
          .settings-fade {
            animation-duration: 1ms;
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
  onAdventure,
  onStats,
  onSettings,
  utility,
  version = "v0.1.0",
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [chapterSelectOpen, setChapterSelectOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const screen = useRef<HTMLElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const menuButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogOpener = useRef<HTMLButtonElement>(null);
  const dialogOpen = settingsOpen || chapterSelectOpen;

  /* Guard against double-confirm on the chapter modal. */
  const confirmingChapterRef = useRef(false);

  useEffect(() => {
    const target = hasEnteredGame ? menuButtons.current[0] : enterButton.current;
    target?.focus({ preventScroll: true });
  }, [hasEnteredGame]);

  useEffect(() => {
    if (dialogOpen) {
      screen.current?.querySelector<HTMLButtonElement>('[role="dialog"] button:not([disabled])')
        ?.focus({ preventScroll: true });
    } else {
      dialogOpener.current?.focus({ preventScroll: true });
      dialogOpener.current = null;
    }
  }, [dialogOpen]);

  const items: MenuItem[] = [
    {
      id: "continue",
      label: "Continue",
      description: "Return to your last chapter",
      icon: ScrollText,
      onSelect: () => {
        setChapterSelectOpen(true);
        AudioController.playerHoverAndClickSound();
      },
    },
    {
      id: "new",
      label: "New chronicle",
      description: "Begin a story from the start",
      icon: Users,
      onSelect: () => {
        setChapterSelectOpen(true);
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
      description: "PvP or fight the Highlands",
      icon: Swords,
      onSelect: () => {
        onBattle?.();
        AudioController.playerHoverAndClickSound();
      },
    },
    ...(onAdventure ? [{
      id: "adventure",
      label: "Adventure",
      description: "Explore the Highlands and follow the Buried Lantern",
      icon: Compass,
      onSelect: () => {
        AudioController.playerHoverAndClickSound();
        onAdventure();
      },
    }] : []),
    ...(onStats ? [{
      id: "stats",
      label: "Player Stats",
      description: "Level, experience, and combat attributes",
      icon: Gauge,
      onSelect: () => {
        AudioController.playerHoverAndClickSound();
        onStats();
      },
    }] : []),
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
  };

  function navigateMenu(event: ReactKeyboardEvent<HTMLElement>) {
    const index = menuButtons.current.findIndex((button) => button === event.target);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    switch (event.key) {
      case "ArrowUp": next = (index + items.length - 1) % items.length; break;
      case "ArrowDown": next = (index + 1) % items.length; break;
      case "Home": next = 0; break;
      case "End": next = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    menuButtons.current[next]?.focus();
  }

  async function handleChapterConfirm(chapter: Chapter) {
    if (confirmingChapterRef.current) return;
    confirmingChapterRef.current = true;

    try {
      setSelectedChapter(chapter);

      if (chapter.status === "locked") return;

      if (chapter.status === "completed") {
        await Promise.resolve(onContinue?.());
        return;
      }

      if (onNewGame) {
        await Promise.resolve(onNewGame());
        return;
      }

      if (onContinue) {
        await Promise.resolve(onContinue());
      }
    } finally {
      confirmingChapterRef.current = false;
      setChapterSelectOpen(false);
    }
  }

  return (
    <main ref={screen} className={entranceStyles.screen} data-entered={hasEnteredGame || undefined}>
      <div className={entranceStyles.art} aria-hidden="true">
        <Image src={MENU_BACKGROUND} alt="" fill preload sizes="100vw" className={entranceStyles.backdrop} />
      </div>
      <div className={entranceStyles.shade} aria-hidden="true" />
      {particlesEnabled && <FloatingParticles count={32} speed={0.65} variant="entrance" />}
      <div className={entranceStyles.frame} aria-hidden="true" />
      {utility && <div className={entranceStyles.utility} inert={dialogOpen}>{utility}</div>}

      <div className={entranceStyles.content} inert={dialogOpen}>
        <header className={entranceStyles.brand}>
          <p className={entranceStyles.kicker}>Embrace Your Horror</p>
          <h1 className={entranceStyles.title}><span>The</span> Chronicle</h1>
          <div className={entranceStyles.divider} aria-hidden="true" />
        </header>
        {hasEnteredGame ? (
          <>
            <nav aria-label="Highlands menu" className={entranceStyles.navigation} onKeyDown={navigateMenu}>
              {items.map(({ id, label, icon: Icon, onSelect }, index) => (
                <button key={id} type="button" ref={(button) => { menuButtons.current[index] = button; }}
                  className={entranceStyles.menuOption}
                  data-highlighted={highlighted === index || undefined}
                  onFocus={() => setHighlighted(index)}
                  onPointerEnter={() => setHighlighted(index)}
                  onClick={(event) => {
                    if (id === "continue" || id === "new" || id === "settings") dialogOpener.current = event.currentTarget;
                    onSelect();
                  }}>
                  <Icon className={entranceStyles.menuIcon} aria-hidden="true" />
                  <span>{label}</span>
                  <ArrowRight className={entranceStyles.marker} aria-hidden="true" />
                </button>
              ))}
            </nav>
            <p className={entranceStyles.description}>{items[highlighted]?.description}</p>
          </>
        ) : (
          <button ref={enterButton} type="button" onClick={handleStartGame} className={entranceStyles.enter}>
            Enter Game <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      <footer className={entranceStyles.footer}>
        {hasEnteredGame && <span className={entranceStyles.keyHelp}><kbd>↑</kbd><kbd>↓</kbd> Select <kbd>Enter</kbd> Confirm</span>}
        <span className={entranceStyles.version}>{version}</span>
      </footer>

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} onParticlesChange={setParticlesEnabled} />
      )}
      {chapterSelectOpen && (
        <ChapterSelectModal initialChapterId={selectedChapter?.id} onConfirm={handleChapterConfirm}
          onClose={() => setChapterSelectOpen(false)} />
      )}
    </main>
  );
}
