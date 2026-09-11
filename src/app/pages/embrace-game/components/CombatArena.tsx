"use client";

import {
  HeartPulse,
  Lock,
  Shield,
  Sparkles,
  Swords,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Battle,
  CombatAction,
  CombatVariant,
  Player,
  StatusEffect,
  Team,
  TeamId,
} from "../types/game";
import BreakFlash from "./breakflash";
import { socket } from "../lib/websocket";
import { AudioController } from "../hooks/audioHandler";

interface Props {
  battle: Battle;
  player?: Player;
  teams: Record<TeamId, Team>;
  onAction: (
    action: CombatAction,
    variant?: CombatVariant,
    targetId?: string,
  ) => void;
  enemyThinking?: boolean;
}

const actions: {
  id: CombatAction;
  label: string;
  hint: string;
  icon: typeof Swords;
}[] = [
  { id: "attack", label: "Attack", hint: "Direct damage", icon: Swords },
  { id: "skill", label: "Skill", hint: "Choose a technique", icon: Sparkles },
  { id: "heal", label: "Heal", hint: "Restore vitality", icon: HeartPulse },
  { id: "block", label: "Block", hint: "Brace for impact", icon: Shield },
  { id: "dodge", label: "Dodge", hint: "Evade the strike", icon: Wind },
];

type FloatingNumber = {
  id: number;
  value: string;
  kind: "damage" | "heal" | "miss" | "block";
  x: number;
};

type ArenaToast = {
  id: number;
  variant: "info" | "success" | "warning" | "error";
  message: string;
};

const TOAST_STYLES: Record<ArenaToast["variant"], string> = {
  info: "border-cyan-300/30 bg-cyan-500/15 text-cyan-50",
  success: "border-emerald-300/30 bg-emerald-500/15 text-emerald-50",
  warning: "border-amber-300/30 bg-amber-500/15 text-amber-50",
  error: "border-red-400/30 bg-red-500/15 text-red-50",
};

type StatusId =
  | "immobilized"
  | "guarded"
  | "evading"
  | "enraged"
  | "blessed";

const BREAK_THRESHOLD = 100;

const STATUS_META: Record<
  StatusId,
  { label: string; icon: typeof Lock; tone: string; description: string }
> = {
  immobilized: {
    label: "Immobilized",
    icon: Lock,
    tone: "text-amber-200 border-amber-300/40 bg-amber-400/10",
    description: "Cannot act until the effect wears off.",
  },
  guarded: {
    label: "Guarded",
    icon: Shield,
    tone: "text-cyan-200 border-cyan-300/40 bg-cyan-400/10",
    description: "Incoming damage reduced.",
  },
  evading: {
    label: "Evading",
    icon: Wind,
    tone: "text-emerald-200 border-emerald-300/40 bg-emerald-400/10",
    description: "Chance to dodge the next strike.",
  },
  enraged: {
    label: "Enraged",
    icon: Zap,
    tone: "text-red-200 border-red-300/40 bg-red-400/10",
    description: "Deals increased damage.",
  },
  blessed: {
    label: "Blessed",
    icon: Sparkles,
    tone: "text-violet-200 border-violet-300/40 bg-violet-400/10",
    description: "Heals a small amount each round.",
  },
};

// Shared clipped-corner silhouette + corner tick, matching Watch/Admin/Menu.
const clip = (px = 20) => ({
  clipPath: `polygon(0 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% 100%, ${px}px 100%, 0 calc(100% - ${px}px))`,
});

function CornerTicks({ accent = "rgba(253,186,116,.35)" }: { accent?: string }) {
  return (
    <>
      <span
        className="pointer-events-none absolute left-3 top-3 size-3 border-l border-t sm:left-4 sm:top-4"
        style={{ borderColor: accent }}
      />
      <span
        className="pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r sm:bottom-4 sm:right-4"
        style={{ borderColor: accent }}
      />
    </>
  );
}

function classifyLogLine(line: string): ArenaToast["variant"] {
  const lower = line.toLowerCase();
  if (
    lower.includes("defeat") ||
    lower.includes("down") ||
    lower.includes("fallen") ||
    lower.includes("wiped out")
  )
    return "error";
  if (
    lower.includes("defeated") ||
    lower.includes("destroyed") ||
    lower.includes("victory") ||
    lower.includes("victorious")
  )
    return "success";
  if (
    lower.includes("break") ||
    lower.includes("stagger") ||
    lower.includes("hits") ||
    lower.includes("damage")
  )
    return "warning";
  return "info";
}

function isPlayerBroken(p: Player): boolean {
  return (p.statusEffects ?? []).some((s) => s.id === "immobilized");
}

function HpPill({
  player,
  active,
  enemySide,
  selected,
  onSelect,
}: {
  player: Player;
  active: boolean;
  enemySide: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const down = player.status !== "alive";
  const broken = isPlayerBroken(player);
  const statuses = (player.statusEffects ?? []) as StatusEffect[];
  const breakPct = player.breakMeter ?? 0;
  const showBreak = breakPct > 0 && breakPct < BREAK_THRESHOLD;
  const interactive = Boolean(onSelect) && !down;

  const ring = down
    ? "border-white/10"
    : selected
      ? enemySide
        ? "border-red-300 shadow-[0_0_18px_rgba(248,113,113,.7)] ring-2 ring-red-300/50"
        : "border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.7)] ring-2 ring-cyan-300/50"
      : broken
        ? "border-amber-300/80 shadow-[0_0_14px_rgba(251,191,36,.5)]"
        : active
          ? enemySide
            ? "border-red-300/70 shadow-[0_0_12px_rgba(248,113,113,.35)]"
            : "border-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,.35)]"
          : "border-white/15";

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onSelect : undefined}
      title={`${player.name} — ${down ? "DOWN" : `${player.hp}/${player.maxHp}`}`}
      className={`relative w-16 shrink-0 rounded-md border bg-black/50 px-1.5 py-1 text-left backdrop-blur-sm transition sm:w-[76px] ${ring} ${
        down ? "opacity-45" : ""
      } ${broken ? "break-pill-pulse" : ""} ${
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-white/40"
          : "cursor-default"
      }`}
    >
      {broken ? (
        <span className="absolute -top-1.5 -right-1.5 rounded-sm bg-amber-400 px-1 text-[8px] font-black uppercase text-black">
          BRK
        </span>
      ) : null}

      {selected ? (
        <span
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm px-1 text-[8px] font-black uppercase ${
            enemySide ? "bg-red-300 text-black" : "bg-cyan-300 text-black"
          }`}
        >
          TARGET
        </span>
      ) : null}

      <p className="truncate text-center text-[9px] font-black uppercase tracking-wide text-white/70">
        {player.name}
      </p>

      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            down
              ? "bg-white/20"
              : enemySide
                ? "bg-gradient-to-r from-red-500 to-red-300"
                : "bg-gradient-to-r from-cyan-500 to-cyan-300"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {showBreak ? (
        <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-200 transition-all duration-300"
            style={{ width: `${breakPct}%` }}
          />
        </div>
      ) : null}

      <p className="mt-0.5 text-center text-[8px] font-bold tabular-nums text-white/50">
        {down ? "DOWN" : player.hp}
      </p>

      {statuses.length > 0 ? (
        <div className="mt-1 flex justify-center gap-0.5">
          {statuses.slice(0, 3).map((s) => {
            const meta = STATUS_META[s.id];
            const Icon = meta.icon;
            return (
              <span
                key={s.id}
                title={`${meta.label} · ${s.turns} turn${s.turns > 1 ? "s" : ""}`}
                className={`flex size-3.5 items-center justify-center rounded-sm border ${meta.tone}`}
              >
                <Icon className="size-2" />
              </span>
            );
          })}
        </div>
      ) : null}
    </button>
  );
}

export default function CombatArena({
  battle,
  player,
  teams,
  onAction,
  enemyThinking,
}: Props) {
  const [skill, setSkill] = useState<CombatVariant>("shadow_strike");
  const [heal, setHeal] = useState<CombatVariant>("minor_heal");

  const [impactPulse, setImpactPulse] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [enemyHitFlash, setEnemyHitFlash] = useState(false);
  const [playerHitFlash, setPlayerHitFlash] = useState(false);
  const [floating, setFloating] = useState<FloatingNumber[]>([]);

  const [atb, setAtb] = useState(0);

  const [logOpen, setLogOpen] = useState(false);
  const [toasts, setToasts] = useState<ArenaToast[]>([]);
  const lastToastedLogRef = useRef<string | null>(null);

  const previousEnemyHp = useRef<number | undefined>(undefined);
  const previousPlayerHp = useRef<number | undefined>(undefined);

  const [breakFlash, setBreakFlash] = useState<{
    trigger: number;
    playerName: string;
    friendly: boolean;
    playerId: string;
  } | null>(null);

  const previousImmobilizedRef = useRef<Set<string>>(new Set());

  /* Selected targets */
  const [attackTargetId, setAttackTargetId] = useState<string | null>(null);
  const [healTargetId, setHealTargetId] = useState<string | null>(null);

  const enemyName = battle.mode === "cpu" ? battle.enemyName : "Opposing team";
  const enemyHp = battle.mode === "cpu" ? battle.enemyHp : 0;
  const enemyMaxHp = battle.mode === "cpu" ? battle.enemyMaxHp : 1;

  const myStatuses = (player?.statusEffects ?? []) as StatusEffect[];
  const isImmobilized = myStatuses.some((s) => s.id === "immobilized");
  const myBreak = player?.breakMeter ?? 0;

  const canAct = Boolean(
  !enemyThinking &&
    player?.status === "alive" &&
    battle.status === "active" &&
    !isImmobilized &&
    (battle.mode === "team"
      ? battle.turnTeamId === player.teamId
      : battle.attackerTeamId === player.teamId) &&
    (!battle.activePlayerId || battle.activePlayerId === player.id),
);

  const lastLog = battle.log.at(-1)?.toLowerCase() ?? "";
  const breakPulse =
    lastLog.includes("break") || lastLog.includes("stagger");

  const { ownTeamId, enemyTeamId } = useMemo(() => {
    if (battle.mode !== "team") {
      return { ownTeamId: battle.attackerTeamId, enemyTeamId: null };
    }
    if (player?.teamId === battle.defenderTeamId) {
      return {
        ownTeamId: battle.defenderTeamId,
        enemyTeamId: battle.attackerTeamId,
      };
    }
    return {
      ownTeamId: battle.attackerTeamId,
      enemyTeamId: battle.defenderTeamId,
    };
  }, [battle, player?.teamId]);

  

  const ownTeam = teams[ownTeamId];
  const enemyTeam = enemyTeamId ? teams[enemyTeamId] : undefined;

  const aliveEnemies = (enemyTeam?.players ?? []).filter(
    (p) => p.status === "alive",
  );
  const aliveAllies = (ownTeam?.players ?? []).filter(
    (p) => p.status === "alive",
  );

  // Default the attack target to the first alive enemy whenever the current
  // selection is invalid or missing.
  useEffect(() => {
    if (!attackTargetId && aliveEnemies.length > 0) {
      setAttackTargetId(aliveEnemies[0].id);
      return;
    }
    if (
      attackTargetId &&
      !aliveEnemies.some((p) => p.id === attackTargetId)
    ) {
      setAttackTargetId(aliveEnemies[0]?.id ?? null);
    }
  }, [aliveEnemies, attackTargetId]);

  // Default the heal target to yourself whenever the current selection is
  // invalid or missing.
  useEffect(() => {
    if (!healTargetId && player) {
      setHealTargetId(player.id);
      return;
    }
    if (healTargetId && !aliveAllies.some((p) => p.id === healTargetId)) {
      setHealTargetId(player?.id ?? aliveAllies[0]?.id ?? null);
    }
  }, [aliveAllies, healTargetId, player]);


  /* Break event from server */
  useEffect(() => {
    const stop = socket.onMessage((event) => {
      if (event.type !== "BREAK") return;

      const broken = Object.values(teams)
        .flatMap((t) => t.players)
        .find((p) => p.id === event.playerId);
      if (!broken) return;

      setBreakFlash({
        trigger: Date.now(),
        playerName: broken.name,
        friendly: broken.teamId === player?.teamId,
        playerId: broken.id,
      });
      const isMyTeam = broken?.teamId === player?.teamId;

  if (isMyTeam) {
    AudioController.playShatterSound();
  } else {
    AudioController.playShatterSound();
  }
      pushToast(`${broken.name} is BROKEN — turn lost!`, "warning");
    });

    return stop;
  }, [teams, player?.teamId]);

  function pushToast(
    message: string,
    variant: ArenaToast["variant"] = "info",
  ) {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      const next = [...prev, { id, variant, message }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000,
    );
  }

  useEffect(() => {
    const latest = battle.log.at(-1);
    if (!latest) return;
    if (latest === lastToastedLogRef.current) return;
    lastToastedLogRef.current = latest;
    pushToast(latest, classifyLogLine(latest));
  }, [battle.log]);

  useEffect(() => {
    if (battle.status !== "active") return;

    const rate = canAct ? 3 : 1.2;
    const timer = window.setInterval(() => {
      setAtb((prev) => Math.min(100, prev + rate));
    }, 100);

    return () => window.clearInterval(timer);
  }, [battle.status, canAct]);

  useEffect(() => {
    if (canAct) return;
    if (atb >= 100) setAtb(0);
  }, [canAct, atb]);

  useEffect(() => {
    previousImmobilizedRef.current = new Set();
  }, [battle.id]);

  /* Fallback local break detection (in case the BREAK event is missed) */
  useEffect(() => {
    const allPlayers = Object.values(teams).flatMap((t) => t.players);

    const currentlyImmobilized = new Set(
      allPlayers.filter(isPlayerBroken).map((p) => p.id),
    );

    for (const p of allPlayers) {
      const wasBroken = previousImmobilizedRef.current.has(p.id);
      const isBroken = currentlyImmobilized.has(p.id);

      if (isBroken && !wasBroken) {
        setBreakFlash({
          trigger: Date.now(),
          playerName: p.name,
          friendly: p.teamId === player?.teamId,
          playerId: p.id,
        });
        pushToast(`${p.name} is BROKEN — turn lost!`, "warning");
      }
    }

    previousImmobilizedRef.current = currentlyImmobilized;
  }, [teams, player?.teamId]);

  useEffect(() => {
    if (battle.mode !== "cpu") return;

    const prev = previousEnemyHp.current;

    if (prev !== undefined && battle.enemyHp! < prev) {
      const delta = prev - battle.enemyHp!;
      spawnFloating(`-${delta}`, "damage", 75);
      triggerImpact();
    }

    previousEnemyHp.current = battle.enemyHp;
  }, [battle.mode, battle.mode === "cpu" ? battle.enemyHp : undefined]);

  useEffect(() => {
    const hp = player?.hp;
    const prev = previousPlayerHp.current;

    if (prev !== undefined && hp !== undefined && hp !== prev) {
      if (hp < prev) {
        spawnFloating(`-${prev - hp}`, "damage", 25);
        triggerPlayerHit();
        triggerImpact();
      } else {
        spawnFloating(`+${hp - prev}`, "heal", 25);
      }
    }

    previousPlayerHp.current = hp;
  }, [player?.hp]);

  function triggerImpact() {
    setImpactPulse(true);
    setEnemyHitFlash(true);
    setScreenShake(true);
    window.setTimeout(() => setImpactPulse(false), 450);
    window.setTimeout(() => setEnemyHitFlash(false), 260);
    window.setTimeout(() => setScreenShake(false), 320);
  }

  function triggerPlayerHit() {
    setPlayerHitFlash(true);
    window.setTimeout(() => setPlayerHitFlash(false), 260);
  }

  function spawnFloating(
    value: string,
    kind: FloatingNumber["kind"],
    x: number,
  ) {
    const id = Date.now() + Math.random();
    setFloating((prev) => [...prev, { id, value, kind, x }]);
    window.setTimeout(
      () => setFloating((prev) => prev.filter((f) => f.id !== id)),
      1100,
    );
  }

  function act(action: CombatAction, variant?: CombatVariant) {
    if (!player) return;

    if (isImmobilized) {
      pushToast(`${player.name} is immobilized and cannot act.`, "warning");
      return;
    }

    if (action === "attack" || action === "skill") triggerImpact();
    if (action === "dodge") spawnFloating("MISS", "miss", 25);
    if (action === "block") spawnFloating("BLOCK", "block", 25);

    const targetId =
      action === "heal"
        ? healTargetId ?? player.id
        : action === "attack" || action === "skill"
          ? attackTargetId ?? undefined
          : undefined;

    setAtb(0);
    onAction(action, variant, targetId);
  }

  const enemyHpPct =
    battle.mode === "cpu"
      ? Math.max(0, Math.min(100, (enemyHp! / enemyMaxHp!) * 100))
      : 0;
  const playerHpPct = player
    ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))
    : 0;

  const statusTone = useMemo(() => {
    switch (battle.status) {
      case "victory":
        return "border-emerald-300/40 text-emerald-200";
      case "defeat":
        return "border-red-400/40 text-red-200";
      default:
        return "border-white/15 text-white/55";
    }
  }, [battle.status]);

  return (
    <>
      {breakFlash && breakFlash.playerId === player?.id ? (
        <BreakFlash
          key={breakFlash.trigger}
          trigger={breakFlash.trigger}
          playerName={breakFlash.playerName}
          friendly={breakFlash.friendly}
          onDone={() => setBreakFlash(null)}
        />
      ) : null}

      <section
        style={clip(28)}
        className={`combat-arena relative min-h-[min(720px,calc(100vh-2rem))] overflow-hidden border border-orange-200/20 bg-[#17120f] shadow-2xl ${
          impactPulse ? "combat-impact" : ""
        } ${screenShake ? "combat-shake" : ""}`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/dark-forest-2.jpeg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,11,14,.25),rgba(9,11,14,.95)_78%)]" />

        <CornerTicks />

        {impactPulse && (
          <div className="pointer-events-none absolute inset-0 z-20 bg-orange-400/10" />
        )}

        {breakPulse && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-amber-300/10">
            <div className="animate-pulse px-4 text-center">
              <div className="text-5xl font-black uppercase tracking-[0.15em] text-amber-200 drop-shadow-[0_0_25px_rgba(253,230,138,.8)] sm:text-6xl lg:text-8xl">
                BREAK
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/80 sm:text-xs sm:tracking-[0.35em]">
                Server reported a stagger
              </p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 z-40">
          {floating.map((f) => (
            <span
              key={f.id}
              className={`combat-float absolute text-xl font-black drop-shadow-lg sm:text-2xl ${
                f.kind === "damage"
                  ? "text-red-300"
                  : f.kind === "heal"
                    ? "text-emerald-300"
                    : f.kind === "miss"
                      ? "text-white/80"
                      : "text-cyan-200"
              }`}
              style={{ left: `${f.x}%`, top: "45%" }}
            >
              {f.value}
            </span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3 sm:top-4 sm:px-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                clipPath:
                  "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
              }}
              className={`pointer-events-auto relative w-full max-w-sm border border-white/10 bg-[#0a0e12]/90 px-4 py-3 shadow-[0_0_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md animate-[toast-in_200ms_ease-out] ${TOAST_STYLES[toast.variant]}`}
            >
              <span
                className="absolute left-0 top-0 h-full w-0.75"
                style={{
                  background:
                    "linear-gradient(180deg, var(--toast-accent, #6fd6ff) 0%, transparent 90%)",
                }}
              />
              <span className="absolute right-2 top-2 h-2 w-2 border-r border-t border-(--toast-accent,#6fd6ff)/70" />

              <p className="pl-2 text-sm leading-5 text-white/85 tracking-wide">
                {toast.message}
              </p>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex min-h-[min(720px,calc(100vh-2rem))] flex-col justify-between gap-5 p-4 sm:gap-6 sm:p-8 lg:p-10">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-orange-200/75">
              <Swords className="size-4" /> Live encounter
            </span>
            <span
              className={`self-start rounded-full border bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] sm:self-auto ${statusTone}`}
            >
              {battle.status} ·{" "}
              {battle.mode === "cpu"
                ? "auto-resolve"
                : `${battle.turnTeamId} turn`}
            </span>
          </div>

          {/* Rosters */}
          {battle.mode === "team" ? (
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {/* Own team (also the heal target pool) */}
              <div className="min-w-0">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">
                  {ownTeam?.name ?? ownTeamId}
                  {battle.turnTeamId === ownTeamId ? " · turn" : ""}
                  <span className="ml-2 hidden text-white/30 sm:inline">
                    (click to set heal target)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ownTeam?.players.map((p) => (
                    <HpPill
                      key={p.id}
                      player={p}
                      active={battle.activePlayerId === p.id}
                      enemySide={false}
                      selected={healTargetId === p.id}
                      onSelect={() => setHealTargetId(p.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Enemy team (attack target pool) */}
              <div className="min-w-0">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-red-200/70 sm:text-right">
                  {enemyTeam?.name ?? enemyTeamId}
                  {battle.turnTeamId === enemyTeamId ? " · turn" : ""}
                  <span className="ml-2 hidden text-white/30 sm:inline">
                    (click to set attack target)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {enemyTeam?.players.map((p) => (
                    <HpPill
                      key={p.id}
                      player={p}
                      active={battle.activePlayerId === p.id}
                      enemySide={true}
                      selected={attackTargetId === p.id}
                      onSelect={() => setAttackTargetId(p.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full sm:ml-auto sm:max-w-md sm:text-right">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-200/70">
                Abyssal foe
              </p>
              <h2
  className={`mt-2 text-4xl font-black tracking-tight transition-colors duration-200 ${
    enemyHitFlash ? "text-red-200" : "text-white"
  }`}
>
  {enemyName}
</h2>

{enemyThinking ? (
  <div className="mt-3 flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-widest text-red-200/80">
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-red-300 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-red-300 [animation-delay:120ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-red-300 [animation-delay:240ms]" />
    </span>
    {enemyName} is thinking…
  </div>
) : null}
              <div className="mt-4 flex justify-between text-xs font-bold text-white/50">
                <span>Vitality</span>
                <span>
                  {enemyHp} / {enemyMaxHp}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    enemyHitFlash
                      ? "bg-white"
                      : "bg-linear-to-r from-red-500 to-red-300"
                  }`}
                  style={{ width: `${enemyHpPct}%` }}
                />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span>ATB</span>
                  <span>
                    {Math.round(battle.status === "active" ? 100 - atb : 0)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-orange-300/70 transition-all"
                    style={{
                      width: `${battle.status === "active" ? 100 - atb : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Player card */}
          <div className="w-full max-w-xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">
                  Your combatant
                </p>
                <h2
                  className={`mt-1 truncate text-2xl font-black transition-colors duration-200 sm:text-3xl ${
                    playerHitFlash ? "text-red-300" : "text-white"
                  }`}
                >
                  {player?.name ?? "Waiting for your player"}
                </h2>

                {myStatuses.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {myStatuses.map((s) => {
                      const meta = STATUS_META[s.id];
                      const Icon = meta.icon;
                      return (
                        <span
                          key={s.id}
                          title={meta.description}
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                        >
                          <Icon className="size-3" />
                          {meta.label}
                          <span className="text-white/50">· {s.turns}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {player ? (
                  <div className="mt-3 max-w-xs">
                    <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                      <span>Break</span>
                      <span>
                        {Math.round(myBreak)} / {BREAK_THRESHOLD}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-200 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (myBreak / BREAK_THRESHOLD) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {player && (
                <div className="shrink-0 text-left text-xs text-white/55 sm:text-right">
                  <div>
                    {player.hp} / {player.maxHp} HP
                  </div>
                  <div className="mt-1 text-cyan-200/70">
                    {player.connected ? "Connected" : "Offline"} ·{" "}
                    {player.ready ? "Ready" : "Not ready"}
                  </div>
                </div>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-cyan-500 to-cyan-300 transition-all duration-500"
                style={{ width: `${playerHpPct}%` }}
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span>ATB</span>
                <span>{Math.round(atb)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${
                    atb >= 100
                      ? "bg-linear-to-r from-cyan-300 to-white"
                      : "bg-linear-to-r from-cyan-600 to-cyan-300"
                  }`}
                  style={{ width: `${atb}%` }}
                />
              </div>
            </div>

            {/* Target summary */}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
              <span className="rounded-full border border-red-300/30 bg-red-400/10 px-2 py-0.5 text-red-200/80">
                Attack ·{" "}
                {aliveEnemies.find((p) => p.id === attackTargetId)?.name ??
                  "no target"}
              </span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200/80">
                Heal ·{" "}
                {aliveAllies.find((p) => p.id === healTargetId)?.name ??
                  "no target"}
              </span>
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
              {actions.map(({ id, label, hint, icon: Icon }) => {
                const needsTarget =
                  (id === "attack" || id === "skill") && aliveEnemies.length > 0;
                const canHeal = id === "heal" && aliveAllies.length > 0;
                const disabled =
                  !canAct || (needsTarget && !attackTargetId) || (id === "heal" && !canHeal);

                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      act(
                        id,
                        id === "skill"
                          ? skill
                          : id === "heal"
                            ? heal
                            : undefined,
                      )
                    }
                    style={clip(10)}
                    className={`group relative overflow-hidden border border-white/15 bg-black/35 p-2.5 text-left transition hover:-translate-y-1 hover:border-cyan-200/60 hover:bg-cyan-100/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:p-4 ${
                      isImmobilized ? "grayscale" : ""
                    }`}
                  >
                    <Icon className="size-4 text-white/75 transition group-hover:text-cyan-200 sm:size-5" />
                    <span className="mt-2 block text-[11px] font-black uppercase tracking-wider sm:mt-3 sm:text-xs">
                      {label}
                    </span>
                    <span className="mt-0.5 hidden text-[10px] leading-4 text-white/40 sm:block">
                      {isImmobilized ? "Immobilized" : hint}
                    </span>
                    {canAct && atb >= 100 && (
                      <span className="pointer-events-none absolute inset-0 animate-pulse ring-2 ring-cyan-300/60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Variant selectors */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Skill"
                value={skill}
                disabled={!canAct}
                onChange={(event) =>
                  setSkill(event.target.value as CombatVariant)
                }
                className="rounded-xl border border-violet-200/30 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none"
                style={{ colorScheme: "dark" }}
              >
                <option value="shadow_strike">Shadow Strike</option>
                <option value="blood_rage">Blood Rage</option>
                <option value="fire_burst">Fire Burst</option>
                <option value="void_blast">Void Blast</option>
              </select>
              <select
                aria-label="Heal"
                value={heal}
                disabled={!canAct}
                onChange={(event) =>
                  setHeal(event.target.value as CombatVariant)
                }
                className="rounded-xl border border-emerald-200/30 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none"
                style={{ colorScheme: "dark" }}
              >
                <option value="minor_heal">Minor Heal</option>
                <option value="major_heal">Major Heal</option>
              </select>
            </div>
          </div>

          {/* Log preview */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 sm:text-xs">
                Battle log
              </p>
              <button
                type="button"
                onClick={() => setLogOpen(true)}
                className="shrink-0 rounded-lg border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 transition hover:bg-black/60 hover:text-white"
              >
                View log ({battle.log.length})
              </button>
            </div>
            <div className="mt-2 space-y-1 text-sm text-white/65">
              {battle.log.slice(-5).map((entry, index, visibleLog) => (
                <p
                  key={`${entry}-${visibleLog
                    .slice(0, index)
                    .filter((item) => item === entry).length}`}
                  className={
                    entry.toLowerCase().includes("victory") ||
                    entry.toLowerCase().includes("victorious")
                      ? "text-emerald-300"
                      : entry.toLowerCase().includes("defeat") ||
                          entry.toLowerCase().includes("down") ||
                          entry.toLowerCase().includes("fallen")
                        ? "text-red-300"
                        : entry.toLowerCase().includes("broken")
                          ? "text-amber-200"
                          : undefined
                  }
                >
                  {entry}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Log modal */}
        {logOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setLogOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b0d] shadow-2xl sm:max-h-[80vh] sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-white/45">
                    Battle log
                  </p>
                  <p className="mt-1 truncate text-sm text-white/70">
                    {battle.mode === "cpu" ? enemyName : "PvP"} ·{" "}
                    {battle.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLogOpen(false)}
                  aria-label="Close log"
                  className="shrink-0 rounded-lg border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto px-4 py-4 sm:max-h-[60vh] sm:px-5">
                <ul className="space-y-2 text-sm text-white/75">
                  {battle.log.map((entry, index) => {
                    const tone = classifyLogLine(entry);
                    const toneClass =
                      tone === "success"
                        ? "text-emerald-300"
                        : tone === "error"
                          ? "text-red-300"
                          : tone === "warning"
                            ? "text-amber-200"
                            : "text-white/75";

                    return (
                      <li
                        key={`${index}-${entry}`}
                        className={`border-l-2 border-white/10 pl-3 ${toneClass}`}
                      >
                        <span className="mr-2 text-[10px] uppercase tracking-widest text-white/30">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {entry}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-white/10 px-4 py-3 text-right sm:px-5">
                <button
                  type="button"
                  onClick={() => setLogOpen(false)}
                  className="rounded-xl bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-black transition hover:bg-white/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}