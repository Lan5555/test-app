"use client";

import {
  Eye,
  Radio,
  Shield,
  Swords,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FloatingParticles from "../components/FloatingParticles";
import { type GameEvent, type SocketStatus, socket } from "../lib/websocket";
import type { Battle, GameState, Player, Team, TeamId } from "../types/game";
import { AudioController } from "../hooks/audioHandler";
import {v4 as uuidv4} from 'uuid';

interface WatchEvent {
  id: string;
  text: string;
  time: string;
  tone: "story" | "combat" | "system" | "elimination" | "choice";
  choiceLabel?: string;
  teamName?: string;
}

interface WatchToast {
  id: string;
  title?: string;
  message: string;
  tone: WatchEvent["tone"];
  choiceLabel?: string;
  teamName?: string;
}

interface StoryNodeSummary {
  id: string;
  choices: { id: string; text: string }[];
}

interface StoryResponse {
  initialNodeId: string;
  nodes: Record<string, StoryNodeSummary>;
}

const initialStory = {
  title: "The Chronicle is waiting",
  text: "Join a room to watch every decision, turn, and combat exchange in real time.",
};

const TEAM_IDS: TeamId[] = ["ravens", "wolves", "dragons", "serpents"];

const TEAM_LABELS: Record<TeamId, string> = {
  ravens: "Ravens",
  wolves: "Wolves",
  dragons: "Dragons",
  serpents: "Serpents",
};

const TONE_ACCENT: Record<WatchEvent["tone"], string> = {
  story: "#67e8f9",
  combat: "#fca5a5",
  choice: "#fbbf24",
  system: "rgba(255,255,255,.4)",
  elimination: "#f87171",
};

const GLASS_CLIP: CSSProperties = {
  clipPath:
    "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px))",
};

function CornerTicks({ tone = "white" }: { tone?: "white" | "cyan" }) {
  const c = tone === "cyan" ? "border-cyan-200/40" : "border-white/25";
  return (
    <>
      <span
        className={`pointer-events-none absolute left-3 top-3 size-3 border-l border-t ${c}`}
      />
      <span
        className={`pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r ${c}`}
      />
    </>
  );
}

function findTeamForPlayer(
  teams: Record<TeamId, Team> | undefined,
  playerId: string,
): TeamId | undefined {
  if (!teams) return undefined;
  for (const [teamId, team] of Object.entries(teams)) {
    if (team.players.some((p) => p.id === playerId)) {
      return teamId as TeamId;
    }
  }
  return undefined;
}

function formatEvent(
  event: GameEvent,
  context: {
    storyNodes: Record<string, StoryNodeSummary>;
    currentNodeId: string;
    teams?: Record<TeamId, Team>;
  },
): {
  text: string;
  tone: WatchEvent["tone"];
  choiceLabel?: string;
  teamName?: string;
} {
  switch (event.type) {
    case "CHOICE": {
      const node = context.storyNodes[context.currentNodeId];
      const choice = node?.choices.find((c) => c.id === event.choiceId);
      const label = choice?.text ?? event.choiceId;
      const teamId = findTeamForPlayer(context.teams, event.playerId);
      const teamName = teamId ? TEAM_LABELS[teamId] : undefined;
      return {
        text: teamName
          ? `${teamName} chose "${label}".`
          : `A player chose "${label}".`,
        tone: "choice",
        choiceLabel: label,
        teamName,
      };
    }

    case "COMBAT_ACTION_SELECTED":
      return {
        text: `A combatant locked in ${event.variant ?? event.action}.`,
        tone: "combat",
      };

    case "COMBAT_ACTION":
      return {
        text: `Combat action resolved: ${event.action}.`,
        tone: "combat",
      };

    case "JOIN_GAME": {
      const teamId = findTeamForPlayer(context.teams, event.playerId);
      const label = teamId ? TEAM_LABELS[teamId] : TEAM_LABELS[event.teamId];
      return {
        text: `${event.playerName ?? event.playerId} joined the ${label}.`,
        tone: "system",
      };
    }

    case "WATCH_GAME":
      return { text: "A watcher connected.", tone: "system" };

    case "ADMIN_APPROVE_ROOM":
      return { text: "The room was activated.", tone: "system" };

    case "STORY_UPDATE":
      return { text: `Story advanced: ${event.title}.`, tone: "story" };

    case "BATTLE_UPDATE":
      return { text: event.message, tone: "combat" };

    case "TEAM_TURN":
      return {
        text: `Turn passes to the ${TEAM_LABELS[event.teamId]}.`,
        tone: "system",
      };

    case "ELIMINATE":
      return {
        text: `${event.playerId} has been eliminated.`,
        tone: "elimination",
      };

    default:
      return { text: `Event: ${event.type}.`, tone: "system" };
  }
}

/* ---------------------------------------------------------------- */
/* Choice splash                                                     */
/* ---------------------------------------------------------------- */

function ChoiceSplash({
  trigger,
  label,
  teamName,
  onDone,
}: {
  trigger: number;
  label: string;
  teamName?: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [trigger, onDone]);

  if (!visible) return null;

  return (
    <div
      key={trigger}
      className="pointer-events-none fixed inset-0 z-[260] flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-black/60 choice-splash-veil" />
      <div className="absolute inset-0 choice-splash-glow" />

      <div className="absolute inset-0 choice-splash-bars">
        <div className="absolute left-0 top-[38%] h-[2px] w-full bg-amber-300/70" />
        <div className="absolute left-0 top-[62%] h-[2px] w-full bg-amber-300/70" />
      </div>

      <div className="relative z-10 flex max-w-[85vw] flex-col items-center px-6 text-center choice-splash-content">
        {teamName ? (
          <span className="rounded-full border border-amber-200/50 bg-amber-300/15 px-4 py-1 text-[11px] font-black uppercase tracking-[0.4em] text-amber-100">
            {teamName}
          </span>
        ) : (
          <span className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-200/80">
            A decision
          </span>
        )}

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.5em] text-white/45">
          has chosen
        </p>

        <h2
          className="mt-3 text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-6xl"
          style={{
            textShadow:
              "0 0 40px rgba(251,191,36,.5), 6px 6px 0 rgba(0,0,0,.85)",
          }}
        >
          {label}
        </h2>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Toast stack                                                       */
/* ---------------------------------------------------------------- */

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: WatchToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[280] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      {toasts.map((t) => {
        const accent = TONE_ACCENT[t.tone];
        const isChoice = t.tone === "choice";
        return (
          <div
            key={t.id}
            style={{
              clipPath:
                "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
              borderColor: accent,
            }}
            className={`pointer-events-auto relative w-full max-w-sm border bg-[#0a0e12]/95 px-4 py-3 shadow-2xl backdrop-blur-md toast-enter ${
              isChoice ? "toast-choice" : ""
            }`}
          >
            <span
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ background: accent }}
            />
            <span
              className="absolute right-2 top-2 size-2 border-r border-t"
              style={{ borderColor: accent }}
            />

            <div className="flex items-start gap-3 pl-2">
              <div className="min-w-0 flex-1">
                {t.title ? (
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.25em]"
                    style={{ color: accent }}
                  >
                    {t.title}
                  </p>
                ) : null}

                <p className="mt-1 text-sm leading-5 text-white/85">
                  {t.message}
                </p>

                {isChoice && t.choiceLabel ? (
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-200/80">
                    {t.choiceLabel}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* HpPill                                                            */
/* ---------------------------------------------------------------- */

function HpPill({
  player,
  active,
  enemySide,
}: {
  player: Player;
  active: boolean;
  enemySide: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const down = player.status !== "alive";

  const prevHp = useRef(player.hp);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (player.hp < prevHp.current) {
      setHit(true);
      const t = window.setTimeout(() => setHit(false), 480);
      prevHp.current = player.hp;
      return () => window.clearTimeout(t);
    }
    prevHp.current = player.hp;
  }, [player.hp]);

  const ring = down
    ? "border-white/10"
    : active
      ? enemySide
        ? "border-red-300/70 shadow-[0_0_12px_rgba(248,113,113,.35)]"
        : "border-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,.35)]"
      : "border-white/15";

  return (
    <div
      className={`relative w-[72px] shrink-0 overflow-hidden rounded-md border bg-black/50 px-1.5 py-1 backdrop-blur-sm transition ${ring} ${
        down ? "opacity-45" : ""
      } ${hit ? "watch-hit-shake" : ""}`}
    >
      {hit ? (
        <span className="pointer-events-none absolute inset-0 watch-hit-flash" />
      ) : null}
      {active && !down ? (
        <span
          className={`pointer-events-none absolute -inset-px rounded-md ${
            enemySide ? "border border-red-300/50" : "border border-cyan-300/50"
          } watch-active-pulse`}
        />
      ) : null}
      <p className="relative truncate text-center text-[9px] font-black uppercase tracking-wide text-white/70">
        {player.name}
      </p>
      <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-white/10">
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
      <p className="relative mt-0.5 text-center text-[8px] font-bold tabular-nums text-white/50">
        {down ? "DOWN" : `${player.hp}`}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function WatchPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [watcherName, setWatcherName] = useState("");
  const [roomCode, setRoomCode] = useState("global");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [story, setStory] = useState(initialStory);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [game, setGame] = useState<GameState>();
  const [battle, setBattle] = useState<Battle>();
  const [storyNodes, setStoryNodes] = useState<Record<string, StoryNodeSummary>>(
    {},
  );

  const [toasts, setToasts] = useState<WatchToast[]>([]);
  const [choiceSplash, setChoiceSplash] = useState<{
    trigger: number;
    label: string;
    teamName?: string;
  } | null>(null);

  const currentNodeIdRef = useRef<string>("");
  const gameRef = useRef<GameState | undefined>(undefined);
  const storyNodesRef = useRef<Record<string, StoryNodeSummary>>({});

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    storyNodesRef.current = storyNodes;
  }, [storyNodes]);

  function pushToast(toast: Omit<WatchToast, "id">) {
    const id = uuidv4();
    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetch("/game/api/story")
      .then((r) => r.json())
      .then((data: StoryResponse) => {
        if (cancelled) return;
        if (data.nodes) {
          setStoryNodes(data.nodes);
          storyNodesRef.current = data.nodes;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    socket.connect();
    const unsubscribeStatus = socket.onStatus(setStatus);
    const unsubscribeEvents = socket.onMessage((event) => {
      const formatted = formatEvent(event, {
        storyNodes: storyNodesRef.current,
        currentNodeId: currentNodeIdRef.current,
        teams: gameRef.current?.teams,
      });

      // Push into the feed.
      setEvents((previous) =>
        [
          {
            id: uuidv4(),
            ...formatted,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...previous,
        ].slice(0, 60),
      );

      // Choice: splash + toast.
      if (event.type === "CHOICE") {
        const node = storyNodesRef.current[currentNodeIdRef.current];
        const choice = node?.choices.find((c) => c.id === event.choiceId);
        const label = choice?.text ?? event.choiceId;
        const teamId = findTeamForPlayer(
          gameRef.current?.teams,
          event.playerId,
        );
        const teamName = teamId ? TEAM_LABELS[teamId] : undefined;

        setChoiceSplash({ trigger: Date.now(), label, teamName });

        pushToast({
          title: "Decision made",
          message: teamName
            ? `${teamName} chose "${label}".`
            : `A player chose "${label}".`,
          tone: "choice",
          choiceLabel: label,
          teamName,
        });
      }

      // Other important events get toasts too.
      if (
        event.type === "ELIMINATE" ||
        event.type === "STORY_UPDATE" ||
        event.type === "ADMIN_APPROVE_ROOM" ||
        (event.type === "BATTLE_UPDATE" &&
          /BROKEN|victory|defeat|destroyed|fallen/i.test(event.message))
      ) {
        pushToast({
          title:
            event.type === "ELIMINATE"
              ? "Elimination"
              : event.type === "STORY_UPDATE"
                ? "Story"
                : event.type === "ADMIN_APPROVE_ROOM"
                  ? "Room live"
                  : "Battle",
          message: formatted.text,
          tone: formatted.tone,
        });
      }

      // State updates.
      if (event.type === "STATE_SYNC") {
        if ("error" in event.payload) return;
        setGame(event.payload);
        setBattle(event.payload.battle);
        if (event.payload.currentNodeId) {
          currentNodeIdRef.current = event.payload.currentNodeId;
        }
        if (event.roomCode) setRoomCode(event.roomCode);
      }

      if (event.type === "STORY_UPDATE") {
        setStory({ title: event.title, text: event.text });
        currentNodeIdRef.current = event.nodeId;
        setStoryNodes((prev) => {
          const next = {
            ...prev,
            [event.nodeId]: {
              id: event.nodeId,
              choices: event.choices ?? [],
            },
          };
          storyNodesRef.current = next;
          return next;
        });
      }

      if (event.type === "BATTLE_UPDATE") {
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(prev.mode === "cpu"
              ? {
                  enemyName: event.enemyName ?? prev.enemyName,
                  enemyHp: event.enemyHp ?? prev.enemyHp,
                  enemyMaxHp: event.enemyMaxHp ?? prev.enemyMaxHp,
                }
              : {}),
            log: [...prev.log, event.message],
          } as Battle;
        });
      }

      if (event.type === "TEAM_TURN") {
        setGame((prev) =>
          prev ? { ...prev, currentTeamId: event.teamId } : prev,
        );
      }

      if (event.type === "ELIMINATE") {
        setGame((prev) =>
          prev
            ? {
                ...prev,
                teams: Object.fromEntries(
                  Object.entries(prev.teams).map(([id, team]) => [
                    id,
                    {
                      ...team,
                      players: team.players.map((player) =>
                        player.id === event.playerId
                          ? { ...player, status: "eliminated", hp: 0 }
                          : player,
                      ),
                    },
                  ]),
                ) as GameState["teams"],
              }
            : prev,
        );
      }
    });
    socket.send({ type: "WATCH_GAME", watcherId: watcherName, roomCode });
    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      socket.disconnect();
    };
  }, [loggedIn, roomCode, watcherName]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (watcherName.trim()) setLoggedIn(true);
  }

  const teams = game?.teams;
  const currentTeamId = game?.currentTeamId;
  const currentTeam = currentTeamId ? teams?.[currentTeamId] : undefined;

  const pvpSides = useMemo(() => {
    if (!battle || battle.mode !== "team" || !teams) return null;
    return {
      leftId: battle.attackerTeamId,
      rightId: battle.defenderTeamId,
      left: teams[battle.attackerTeamId],
      right: teams[battle.defenderTeamId],
    };
  }, [battle, teams]);

  const totalPlayers = useMemo(() => {
    if (!teams) return 0;
    return TEAM_IDS.reduce(
      (sum, id) => sum + (teams[id]?.players.length ?? 0),
      0,
    );
  }, [teams]);

  const lastChoice = useMemo(
    () => events.find((e) => e.tone === "choice"),
    [events],
  );

  const tickerItems = events.slice(0, 8);

  if (!loggedIn) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030608] px-5 text-white">
        <FloatingParticles />
        <form
          onSubmit={login}
          style={GLASS_CLIP}
          className="relative z-10 w-full max-w-md border border-cyan-200/20 bg-[#0d151b]/95 p-7 shadow-2xl backdrop-blur-md sm:p-9"
        >
          <CornerTicks tone="cyan" />
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
            <Eye className="size-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/65">
            Spectator access
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Watch the Chronicle
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Follow every story choice and every combat exchange without joining
            a team.
          </p>
          <label className="mt-7 block text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Watcher name
            <input
              value={watcherName}
              onChange={(event) => setWatcherName(event.target.value)}
              placeholder="Enter your name"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-cyan-200/60"
            />
          </label>
          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 py-3.5 text-sm font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-cyan-100"
          >
            <Radio className="size-4" /> Enter live room
          </button>
        </form>
      </main>
    );
  }

  const connectionLabel =
    status === "connected"
      ? "Backend connected"
      : status === "error"
        ? "Backend connection error"
        : status;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030608] text-white">
      <FloatingParticles />
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-red-300/75">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
                <span className="relative inline-flex size-2 rounded-full bg-red-400" />
              </span>
              Live spectator room
            </div>
            <h1 className="mt-3 flex flex-wrap items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl">
              THE CHRONICLE
              {currentTeam ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100 watch-turn-chip">
                  <Swords className="size-3" /> {currentTeam.name}'s turn
                </span>
              ) : null}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Watching as {watcherName} · Room {game?.roomCode ?? roomCode}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/55">
            <span className="relative flex size-4 items-center justify-center">
              {status === "connected" ? (
                <>
                  <span className="absolute inline-flex size-4 animate-ping rounded-full bg-emerald-400/40" />
                  <Wifi className="relative size-4 text-emerald-300" />
                </>
              ) : (
                <WifiOff className="size-4 text-amber-200" />
              )}
            </span>
            {connectionLabel}
          </div>
        </header>

        {/* Ticker */}
        <div className="relative mt-5 overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#030608] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#030608] to-transparent" />
          <div className="flex items-center gap-2 py-2 pl-4 pr-2">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
              Feed
            </span>
            <div className="flex-1 overflow-hidden">
              {tickerItems.length > 0 ? (
                <div className="watch-ticker flex w-max items-center gap-10 whitespace-nowrap text-xs font-semibold text-white/60">
                  {[...tickerItems, ...tickerItems].map((e, i) => (
                    <span
                      key={`${e.id}-${i}`}
                      className={`flex items-center gap-2 ${
                        e.tone === "choice" ? "text-amber-100/80" : ""
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          e.tone === "choice" ? "animate-pulse" : ""
                        }`}
                        style={{ background: TONE_ACCENT[e.tone] }}
                      />
                      {e.text}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-semibold text-white/30">
                  Waiting for the first event from the room…
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_370px]">
          <section
            style={GLASS_CLIP}
            className="relative min-h-[min(650px,calc(100vh-9rem))] overflow-hidden border border-white/10 bg-[url('/dark-forest-2.jpeg')] bg-cover bg-center p-6 sm:p-10"
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,11,.2),rgba(4,8,11,.95)_85%)]" />
            <CornerTicks tone="cyan" />
            <div className="relative flex min-h-[min(570px,calc(100vh-13rem))] flex-col gap-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100/65">
                  <Eye className="size-4" /> Observer view
                </span>
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  {totalPlayers} players · phase {game?.phase ?? "waiting"}
                </span>
              </div>

              <div key={story.title} className="watch-fade-slide">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                  Current story
                </p>
                <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {story.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
                  {story.text}
                </p>
              </div>

              {lastChoice ? (
                <div className="watch-fade-slide rounded-2xl border border-amber-200/25 bg-amber-400/[0.06] p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">
                    Last decision
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    {lastChoice.teamName ? (
                      <span className="rounded-full border border-amber-200/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-100">
                        {lastChoice.teamName}
                      </span>
                    ) : null}
                    <span className="text-lg font-black tracking-tight text-white/90">
                      {lastChoice.choiceLabel ?? lastChoice.text}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {lastChoice.time}
                  </p>
                </div>
              ) : null}

              {battle ? (
                <div className="rounded-2xl border border-red-200/25 bg-black/45 p-5 backdrop-blur-sm">
                  {battle.mode === "cpu" ? (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200/75">
                          <Swords className="size-4" /> CPU encounter ·{" "}
                          {battle.status}
                        </div>
                        <span className="text-xs font-bold text-white/55">
                          {battle.enemyHp ?? 0} / {battle.enemyMaxHp ?? 0} HP
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black">
                        {battle.enemyName ?? "Unknown foe"}
                      </h3>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-red-400 transition-all duration-500"
                          style={{
                            width: `${
                              ((battle.enemyHp ?? 0) /
                                Math.max(1, battle.enemyMaxHp ?? 1)) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200/75">
                          <Swords className="size-4" /> PvP battle ·{" "}
                          {battle.status}
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-white/55">
                          <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
                          {battle.turnTeamId} turn
                        </span>
                      </div>

                      {pvpSides ? (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                              {pvpSides.left?.name ?? pvpSides.leftId}
                              {battle.turnTeamId === pvpSides.leftId
                                ? " · turn"
                                : ""}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {pvpSides.left?.players.map((p) => (
                                <HpPill
                                  key={p.id}
                                  player={p}
                                  active={battle.activePlayerId === p.id}
                                  enemySide={false}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-red-200/70">
                              {pvpSides.right?.name ?? pvpSides.rightId}
                              {battle.turnTeamId === pvpSides.rightId
                                ? " · turn"
                                : ""}
                            </p>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {pvpSides.right?.players.map((p) => (
                                <HpPill
                                  key={p.id}
                                  player={p}
                                  active={battle.activePlayerId === p.id}
                                  enemySide={true}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Combat log
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-white/70">
                      {battle.log.slice(-4).map((entry, i) => (
                        <li
                          key={`${battle.log.length - 4 + i}-${entry}`}
                          className={
                            i === battle.log.slice(-4).length - 1
                              ? "watch-fade-slide"
                              : ""
                          }
                        >
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-200/5 p-4 text-sm text-cyan-100/70">
                  <Shield className="size-5" /> Story decisions and combat
                  updates will appear here live.
                </div>
              )}

              {teams ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                    <Users className="size-3.5" /> Team overview
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {TEAM_IDS.map((id) => {
                      const team: Team | undefined = teams[id];
                      const alive =
                        team?.players.filter((p) => p.status === "alive")
                          .length ?? 0;
                      const isTurn = id === currentTeamId;
                      return (
                        <div
                          key={id}
                          className={`relative rounded-xl border p-3 transition ${
                            isTurn
                              ? "border-cyan-300/50 bg-cyan-300/5 watch-turn-glow"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                            {TEAM_LABELS[id]}
                            {isTurn ? " · turn" : ""}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {alive}/{team?.players.length ?? 0} alive
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {team?.players.map((p) => (
                              <span
                                key={p.id}
                                title={`${p.name} — ${p.hp}/${p.maxHp}`}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition ${
                                  p.status === "alive"
                                    ? "bg-cyan-500/30 text-cyan-100"
                                    : "bg-white/10 text-white/30 line-through"
                                }`}
                              >
                                {p.name.charAt(0).toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside
            style={GLASS_CLIP}
            className="relative flex max-h-[80vh] flex-col border border-white/10 bg-white/5 p-5 backdrop-blur-md lg:max-h-none"
          >
            <CornerTicks />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/45">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-cyan-300" />
                </span>
                Live feed
              </h2>
              <span className="text-xs text-white/30">
                {events.length} events
              </span>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 *:scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 max-h-[80vh]">
              {events.length === 0 ? (
                <p className="text-sm leading-6 text-white/35">
                  Waiting for the first event from the room...
                </p>
              ) : (
                events.map((event, idx) => {
                  const accent = TONE_ACCENT[event.tone];
                  const isChoice = event.tone === "choice";
                  return (
                    <div
                      key={event.id}
                      style={{ borderColor: accent }}
                      className={`relative border-l-2 pl-3 ${
                        idx === 0 ? "watch-feed-new" : ""
                      } ${isChoice ? "watch-feed-choice" : ""}`}
                    >
                      <div className="flex justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                        <span
                          style={idx === 0 ? { color: accent } : undefined}
                        >
                          {event.tone}
                        </span>
                        <span>{event.time}</span>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-white/75">
                        {event.text}
                      </p>
                      {isChoice && event.teamName ? (
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-200/70">
                          {event.teamName}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Toast stack */}
      <ToastStack
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* Choice splash */}
      {choiceSplash ? (
        <ChoiceSplash
          trigger={choiceSplash.trigger}
          label={choiceSplash.label}
          teamName={choiceSplash.teamName}
          onDone={() => setChoiceSplash(null)}
        />
      ) : null}

      <style jsx>{`
        .watch-ticker {
          animation: watch-ticker-scroll 26s linear infinite;
        }
        .watch-turn-chip {
          animation: watch-chip-pulse 1.8s ease-in-out infinite;
        }
        .watch-turn-glow {
          animation: watch-panel-glow 1.8s ease-in-out infinite;
        }
        .watch-active-pulse {
          animation: watch-active-pulse 1.1s ease-out infinite;
        }
        .watch-hit-flash {
          background: rgba(248, 113, 113, 0.5);
          animation: watch-hit-flash 480ms ease-out both;
        }
        .watch-hit-shake {
          animation: watch-hit-shake 350ms ease-in-out both;
        }
        .watch-feed-new {
          animation:
            watch-feed-new 400ms ease-out both,
            watch-feed-tint 1600ms ease-out both;
        }
        .watch-feed-choice {
          background: linear-gradient(
            90deg,
            rgba(251, 191, 36, 0.08) 0%,
            transparent 100%
          );
        }
        .watch-fade-slide {
          animation: watch-fade-slide 450ms ease-out both;
        }

        .toast-enter {
          animation: toast-enter 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .toast-choice {
          box-shadow:
            0 0 0 1px rgba(251, 191, 36, 0.4),
            0 0 40px -8px rgba(251, 191, 36, 0.35);
        }

        .choice-splash-veil {
          animation: choice-splash-veil 2000ms ease-out both;
        }
        .choice-splash-glow {
          animation: choice-splash-glow 2000ms ease-out both;
        }
        .choice-splash-bars {
          animation: choice-splash-bars 2000ms ease-out both;
        }
        .choice-splash-content {
          animation: choice-splash-content 2000ms
            cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes watch-ticker-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes watch-chip-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.35);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(34, 211, 238, 0);
          }
        }
        @keyframes watch-panel-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.25);
          }
          50% {
            box-shadow: 0 0 18px 2px rgba(34, 211, 238, 0.2);
          }
        }
        @keyframes watch-active-pulse {
          0% {
            opacity: 0.9;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }
        @keyframes watch-hit-flash {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes watch-hit-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-2px);
          }
          50% {
            transform: translateX(2px);
          }
          75% {
            transform: translateX(-1px);
          }
        }
        @keyframes watch-feed-new {
          0% {
            opacity: 0;
            transform: translateY(-6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes watch-feed-tint {
          0% {
            background: rgba(255, 255, 255, 0.06);
          }
          100% {
            background: transparent;
          }
        }
        @keyframes watch-fade-slide {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes toast-enter {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes choice-splash-veil {
          0% {
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes choice-splash-glow {
          0% {
            opacity: 0;
            background: radial-gradient(
              circle,
              rgba(251, 191, 36, 0.6) 0%,
              transparent 60%
            );
          }
          25% {
            opacity: 1;
            background: radial-gradient(
              circle,
              rgba(251, 191, 36, 0.35) 0%,
              transparent 70%
            );
          }
          100% {
            opacity: 0;
            background: radial-gradient(
              circle,
              rgba(251, 191, 36, 0.1) 0%,
              transparent 80%
            );
          }
        }
        @keyframes choice-splash-bars {
          0% {
            opacity: 0;
            transform: scaleX(0);
            transform-origin: left;
          }
          14% {
            opacity: 1;
            transform: scaleX(1);
          }
          70% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes choice-splash-content {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
            filter: blur(6px);
          }
          18% {
            opacity: 1;
            transform: translateY(0) scale(1.02);
            filter: blur(0);
          }
          28% {
            transform: scale(1);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.02);
          }
        }
      `}</style>
    </main>
  );
}