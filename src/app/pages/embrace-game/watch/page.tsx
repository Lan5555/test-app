"use client";

import {
  Eye,
  LogOut,
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FloatingParticles from "../components/FloatingParticles";
import { type GameEvent, type SocketStatus, socket } from "../lib/websocket";
import type {
  Battle,
  CombatVariant,
  Cutscene,
  GameState,
  Player,
  StoryChoice,
  Team,
  TeamId,
} from "../types/game";
import { v4 as uuidv4 } from "uuid";
import CutsceneOverlay from "../components/cutsceneOverlay";
import CombatArena from "../components/CombatArena";
import StoryScene from "../components/StoryScene";
import TeamPanel from "../components/TeamPanel";
import BattleIntro from "../components/BattleIntro";
import WhiteFlash from "../components/defeat-flash";
import { story as fallbackStory } from "../lib/story";
import { CoreService } from "@/app/helpers/api-handler";

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

interface StoryNode {
  id: string;
  title: string;
  text: string;
  background?: string;
  choices: StoryChoice[];
}

interface StoryResponse {
  initialNodeId: string;
  nodes: Record<string, StoryNode>;
}

const defaultStoryNodes: Record<string, StoryNode> = Object.fromEntries(
  Object.entries(fallbackStory).map(([id, node]) => [
    id,
    {
      id,
      title: node.title,
      text: node.text,
      background: node.image,
      choices: (node.choices ?? []).map((c) => ({
        id: c.id,
        text: c.text,
        result: c.result as any,
        nextNodeId: (c as any).next,
      })),
    },
  ]),
);

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

const emptyTeams = (): GameState["teams"] => ({
  ravens: { id: "ravens", name: "Ravens", players: [] },
  wolves: { id: "wolves", name: "Wolves", players: [] },
  dragons: { id: "dragons", name: "Dragons", players: [] },
  serpents: { id: "serpents", name: "Serpents", players: [] },
});

const initialGameState: GameState = {
  roomCode: "",
  phase: "waiting",
  currentNodeId: "start",
  currentTeamId: "ravens",
  teams: emptyTeams(),
  events: [],
  createdAt: 0,
};

function normalizeGameState(value: unknown, previous: GameState): GameState {
  if (!value || typeof value !== "object") return previous;

  const envelope = value as Record<string, unknown>;
  const source =
    envelope.game && typeof envelope.game === "object"
      ? (envelope.game as Partial<GameState>)
      : envelope.state && typeof envelope.state === "object"
        ? (envelope.state as Partial<GameState>)
        : (envelope as Partial<GameState>);
  const incomingTeams: Partial<GameState["teams"]> =
    source.teams && typeof source.teams === "object" ? source.teams : {};
  const teams = Object.fromEntries(
    Object.entries(emptyTeams()).map(([id, defaultTeam]) => {
      const fallback = previous.teams[id as TeamId] ?? defaultTeam;
      const incoming = incomingTeams[id as TeamId];
      return [
        id,
        incoming && typeof incoming === "object"
          ? {
              ...fallback,
              ...incoming,
              players: Array.isArray(incoming.players)
                ? incoming.players
                : fallback.players,
            }
          : fallback,
      ];
    }),
  ) as GameState["teams"];
  const currentTeamId =
    source.currentTeamId && teams[source.currentTeamId]
      ? source.currentTeamId
      : previous.currentTeamId;

  return {
    ...previous,
    ...source,
    teams,
    currentTeamId,
    events: Array.isArray(source.events) ? source.events : previous.events,
  };
}

function parseVersusName(
  name: string | undefined,
): [string, string] | undefined {
  if (!name) return undefined;
  const parts = name.split(/\s+vs\s+/i);
  if (parts.length !== 2) return undefined;
  return [parts[0].trim().toLowerCase(), parts[1].trim().toLowerCase()];
}

function formatEvent(
  event: GameEvent,
  context: {
    storyNodes: Record<string, StoryNode>;
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
      const choice = node?.choices?.find((c) => c.id === event.choiceId);
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
        text: `Player has been eliminated.`,
        tone: "elimination",
      };

    default:
      return { text: `Event: ${(event as any).type}.`, tone: "system" };
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

const service = new CoreService();

/* ---------------------------------------------------------------- */
/* Watch Page Main Component                                         */
/* ---------------------------------------------------------------- */

export default function WatchPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [watcherName, setWatcherName] = useState("");
  const [roomCode, setRoomCode] = useState("global");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [story, setStory] = useState(initialStory);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [game, setGame] = useState<GameState>(initialGameState);
  const [battle, setBattle] = useState<Battle | undefined>(undefined);
  const [cutscene, setCutscene] = useState<Cutscene | null>(null);
  const [enemyThinking, setEnemyThinking] = useState(false);

  const [storyNodes, setStoryNodes] =
    useState<Record<string, StoryNode>>(defaultStoryNodes);

  const [toasts, setToasts] = useState<WatchToast[]>([]);
  const [choiceSplash, setChoiceSplash] = useState<{
    trigger: number;
    label: string;
    teamName?: string;
  } | null>(null);

  const [battleIntro, setBattleIntro] = useState<{
    enemyName: string;
    mode: "team" | "cpu";
    attackerTeamId?: string;
    defenderTeamId?: string;
  } | null>(null);

  const [whiteFlash, setWhiteFlash] = useState<{
    trigger: number;
    kind: "victory" | "defeat" | "boss";
  } | null>(null);

  /* Round queue & timer */
  const [roundState, setRoundState] = useState<{
    waitingOn: string[];
    expected: number;
  }>({ waitingOn: [], expected: 0 });
  const [roundTimerMs, setRoundTimerMs] = useState(0);
  const [roundTimerDisplayMs, setRoundTimerDisplayMs] = useState(0);
  const roundDeadlineRef = useRef<number>(0);

  const currentNodeIdRef = useRef<string>("start");
  const gameRef = useRef<GameState>(game);
  const storyNodesRef = useRef<Record<string, StoryNode>>(defaultStoryNodes);
  const previousBattleIdRef = useRef<string | null>(null);
  const previousBattleOutcomeRef = useRef<{
    id: string;
    status: "victory" | "defeat";
  } | null>(null);

  // Check URL query for room param on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("room");
      if (r) setRoomCode(r);
    }
  }, []);

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

  // Load story nodes from backend API if available
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;

    async function loadStory() {
      try {
        const res = await service.get("/game/api/story");
        const data = res.data as StoryResponse;
        if (cancelled) return;
        if (data?.nodes) {
          setStoryNodes((prev) => ({ ...prev, ...data.nodes }));
          storyNodesRef.current = { ...storyNodesRef.current, ...data.nodes };
          if (data.initialNodeId) {
            currentNodeIdRef.current = data.initialNodeId;
            setGame((prev) =>
              prev.currentNodeId
                ? prev
                : { ...prev, currentNodeId: data.initialNodeId },
            );
          }
        }
      } catch (err) {
        // Fallback to default story nodes already configured
      }
    }

    loadStory();
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  // Round timer interval countdown
  useEffect(() => {
    if (roundTimerMs <= 0) {
      setRoundTimerDisplayMs(0);
      return;
    }

    roundDeadlineRef.current = Date.now() + roundTimerMs;
    setRoundTimerDisplayMs(roundTimerMs);

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, roundDeadlineRef.current - Date.now());
      setRoundTimerDisplayMs(remaining);
      if (remaining === 0) window.clearInterval(interval);
    }, 100);

    return () => window.clearInterval(interval);
  }, [roundTimerMs]);

  // Battle entrance intro trigger
  useEffect(() => {
    const currentBattleId = game.battle?.id ?? battle?.id ?? null;
    if (currentBattleId && currentBattleId !== previousBattleIdRef.current) {
      previousBattleIdRef.current = currentBattleId;
      const b = game.battle ?? battle;
      if (b) {
        const versus = parseVersusName(
          b.mode === "cpu" ? b.enemyName : undefined,
        );
        const isVersus = Boolean(versus);
        setBattleIntro({
          enemyName:
            b.mode === "cpu"
              ? b.enemyName
              : `${b.attackerTeamId} vs ${b.defenderTeamId}`,
          mode: isVersus ? "team" : b.mode,
          attackerTeamId: isVersus
            ? versus![0]
            : b.mode === "team"
              ? b.attackerTeamId
              : undefined,
          defenderTeamId: isVersus
            ? versus![1]
            : b.mode === "team"
              ? b.defenderTeamId
              : undefined,
        });
      }
    } else if (!currentBattleId) {
      previousBattleIdRef.current = null;
    }
  }, [game.battle, battle]);

  // White flash on battle resolution
  useEffect(() => {
    const currentBattle = game.battle ?? battle;
    if (!currentBattle || currentBattle.status === "active") {
      previousBattleOutcomeRef.current = null;
      return;
    }

    const prev = previousBattleOutcomeRef.current;
    if (
      prev &&
      prev.id === currentBattle.id &&
      prev.status === currentBattle.status
    ) {
      return;
    }

    previousBattleOutcomeRef.current = {
      id: currentBattle.id,
      status: currentBattle.status,
    };

    const isBoss =
      currentBattle.mode === "cpu" &&
      !!currentBattle.enemyName?.toUpperCase().includes("WARDEN");

    setWhiteFlash({
      trigger: Date.now(),
      kind:
        currentBattle.status === "defeat"
          ? "defeat"
          : isBoss
            ? "boss"
            : "victory",
    });
  }, [game.battle?.id, game.battle?.status, battle?.id, battle?.status]);

  // Socket communication
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

      // Push into the feed
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

      // Choice splash & notification
      if (event.type === "CHOICE") {
        const node = storyNodesRef.current[currentNodeIdRef.current];
        const choice = node?.choices?.find((c) => c.id === event.choiceId);
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

      // Toasts for notable game events
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

      // STATE_SYNC normalization
      if (event.type === "STATE_SYNC") {
        if ("error" in event.payload) return;
        setGame((prev) => {
          const next = normalizeGameState(event.payload, prev);
          if (next.currentNodeId) {
            currentNodeIdRef.current = next.currentNodeId;
          }
          if (next.battle) {
            setBattle(next.battle);
          }
          return next;
        });
        if (event.roomCode) setRoomCode(event.roomCode);
      }

      // STORY_UPDATE
      if (event.type === "STORY_UPDATE") {
        setStory({ title: event.title, text: event.text });
        if (event.nodeId) {
          currentNodeIdRef.current = event.nodeId;
          setStoryNodes((prev) => ({
            ...prev,
            [event.nodeId]: {
              id: event.nodeId,
              title: event.title,
              text: event.text,
              background: event.background,
              choices: event.choices ?? [],
            },
          }));
          setGame((prev) => ({
            ...prev,
            currentNodeId: event.nodeId,
            phase: "story",
          }));
        }
      }

      // BATTLE_UPDATE
      if (event.type === "BATTLE_UPDATE") {
        if (event.thinking !== undefined) setEnemyThinking(event.thinking);

        setGame((previous) => {
          const prevBattle = previous.battle ?? battle;
          if (!prevBattle) return previous;

          const nextBattle: Battle =
            prevBattle.mode === "cpu"
              ? {
                  ...prevBattle,
                  enemyName: event.enemyName ?? prevBattle.enemyName,
                  enemyHp: event.enemyHp ?? prevBattle.enemyHp,
                  enemyMaxHp: event.enemyMaxHp ?? prevBattle.enemyMaxHp,
                  log: event.message
                    ? [...prevBattle.log, event.message]
                    : prevBattle.log,
                }
              : {
                  ...prevBattle,
                  log: event.message
                    ? [...prevBattle.log, event.message]
                    : prevBattle.log,
                };

          setBattle(nextBattle);
          return {
            ...previous,
            phase: "battle",
            battle: nextBattle,
          };
        });
      }

      // COMBAT_ROUND_UPDATE
      if (event.type === "COMBAT_ROUND_UPDATE") {
        setRoundState({
          waitingOn: event.waitingOn ?? [],
          expected: event.expected ?? 0,
        });
      }

      // ROUND_TIMER
      if (event.type === "ROUND_TIMER") {
        setRoundTimerMs(event.remainingMs);
      }

      // CUTSCENE
      if (event.type === "CUTSCENE") {
        setCutscene(event.cutscene);
      }

      // TEAM_TURN
      if (event.type === "TEAM_TURN") {
        setGame((prev) => ({
          ...prev,
          currentTeamId: event.teamId,
          activePlayerId:
            event.activePlayerId !== undefined
              ? event.activePlayerId
              : prev.activePlayerId,
        }));
      }

      // ELIMINATE
      if (event.type === "ELIMINATE") {
        setGame((prev) => ({
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
        }));
      }
    });

    socket.send({ type: "WATCH_GAME", watcherId: watcherName, roomCode });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      socket.disconnect();
    };
  }, [loggedIn, roomCode, watcherName, battle]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (watcherName.trim()) {
      setLoggedIn(true);
    }
  }

  const teams = game.teams ?? emptyTeams();
  const currentTeamId = game.currentTeamId;
  const currentTeam = teams[currentTeamId];
  const activeStory: StoryNode = storyNodes[game.currentNodeId] ?? {
    id: game.currentNodeId,
    ...story,
    choices: [],
  };

  const activePlayerName = useMemo(() => {
    if (!game.activePlayerId) return undefined;
    for (const team of Object.values(teams)) {
      const p = team.players.find((p) => p.id === game.activePlayerId);
      if (p) return p.name;
    }
    return undefined;
  }, [game.activePlayerId, teams]);

  const activeBattle = game.battle ?? battle;
  const tickerItems = events.slice(0, 8);

  const handleCutsceneDone = useCallback(() => {
    setCutscene(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Login Screen                                                      */
  /* ---------------------------------------------------------------- */

  if (!loggedIn) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030608] px-5 text-white">
        <FloatingParticles />
        <form
          onSubmit={handleLogin}
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
            Spectate every story choice, team turn, and live combat exchange as
            it happens.
          </p>

          <label className="mt-6 block text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Watcher name
            <input
              value={watcherName}
              onChange={(event) => setWatcherName(event.target.value)}
              placeholder="Enter your spectator name"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-cyan-200/60"
            />
          </label>

          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Room code
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="global"
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
      ? "Live connected"
      : status === "error"
        ? "Connection error"
        : status;

  /* ---------------------------------------------------------------- */
  /* Main Spectator View                                               */
  /* ---------------------------------------------------------------- */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030608] text-white">
      {/* Cutscene overlay for spectators */}
      {cutscene ? (
        <CutsceneOverlay
          cutscene={cutscene}
          onDone={handleCutsceneDone}
          spectator={true}
        />
      ) : null}

      {/* Battle intro entrance screen */}
      {battleIntro ? (
        <BattleIntro
          enemyName={battleIntro.enemyName}
          mode={battleIntro.mode}
          attackerTeamId={battleIntro.attackerTeamId}
          defenderTeamId={battleIntro.defenderTeamId}
          onDone={() => setBattleIntro(null)}
          duration={1900}
        />
      ) : null}

      {/* Outcome white flash */}
      {whiteFlash ? (
        <WhiteFlash
          trigger={whiteFlash.trigger}
          kind={whiteFlash.kind}
          duration={whiteFlash.kind === "victory" ? 3000 : 1100}
          onDone={() => setWhiteFlash(null)}
        />
      ) : null}

      <FloatingParticles />

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/80">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/70" />
                <span className="relative inline-flex size-2 rounded-full bg-cyan-400" />
              </span>
              Live Spectator Room
            </div>
            <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
              THE CHRONICLE
              {currentTeam ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100 watch-turn-chip">
                  <Swords className="size-3" /> {currentTeam.name}&apos;s turn
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Spectating as <span className="font-bold text-white/70">{watcherName}</span> · Room{" "}
              <span className="font-bold text-cyan-200/80">{game.roomCode || roomCode}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/60">
              <span className="relative flex size-3 items-center justify-center">
                {status === "connected" ? (
                  <>
                    <span className="absolute inline-flex size-3 animate-ping rounded-full bg-emerald-400/40" />
                    <Wifi className="relative size-3 text-emerald-300" />
                  </>
                ) : (
                  <WifiOff className="size-3 text-amber-200" />
                )}
              </span>
              {connectionLabel}
            </div>

            <button
              type="button"
              onClick={() => {
                socket.disconnect();
                setLoggedIn(false);
              }}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" /> Leave
            </button>
          </div>
        </header>

        {/* Live event ticker */}
        <div className="relative mt-4 overflow-hidden rounded-full border border-white/10 bg-black/40">
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
                  Waiting for events from the room…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Core Content Grid: Game View (Left) & Sidebar (Right) */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Game Interface Mirror */}
          <section className="min-w-0">
            {game.phase === "battle" && activeBattle ? (
              <CombatArena
                battle={activeBattle}
                teams={teams}
                enemyThinking={enemyThinking}
                waitingOn={roundState.waitingOn}
                expectedActors={roundState.expected}
                roundTimerMs={roundTimerDisplayMs}
                spectator={true}
              />
            ) : (
              <StoryScene
                nodeId={game.currentNodeId}
                title={activeStory.title}
                text={activeStory.text}
                background={activeStory.background}
                phase={game.phase}
                currentTeamName={currentTeam?.name}
                activePlayerName={activePlayerName}
                choices={activeStory.choices}
                canChoose={false}
              />
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Current Turn & Room Info Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-white/35">
                  Current Turn
                </p>
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-100">
                  Spectator
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-black uppercase">
                <Radio className="size-5 text-cyan-200 animate-pulse" />
                {currentTeam?.name ?? game.currentTeamId}
              </div>
              {activePlayerName ? (
                <p className="mt-1 text-xs uppercase tracking-widest text-cyan-200/70">
                  {activePlayerName}&apos;s action
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/45">
                <span>Room {game.roomCode || roomCode}</span>
                <span>Phase: {game.phase.toUpperCase()}</span>
              </div>
            </div>

            {/* Team Panels for all active teams */}
            <div className="space-y-3">
              {TEAM_IDS.map((id) => {
                const team = teams[id];
                if (!team) return null;
                return (
                  <TeamPanel
                    key={team.id}
                    team={team}
                    active={team.id === game.currentTeamId}
                  />
                );
              })}
            </div>

            {/* Live Feed Component */}
            <div
              style={GLASS_CLIP}
              className="relative flex flex-col border border-white/10 bg-white/5 p-4 backdrop-blur-md"
            >
              <CornerTicks />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/50">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-cyan-300" />
                  </span>
                  Chronicle Log
                </h2>
                <span className="text-[10px] text-white/30">
                  {events.length} events
                </span>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="text-xs leading-5 text-white/35">
                    Waiting for events from the game session...
                  </p>
                ) : (
                  events.slice(0, 25).map((event, idx) => {
                    const accent = TONE_ACCENT[event.tone];
                    const isChoice = event.tone === "choice";
                    return (
                      <div
                        key={event.id}
                        style={{ borderColor: accent }}
                        className={`relative border-l-2 pl-2.5 ${
                          idx === 0 ? "watch-feed-new" : ""
                        } ${isChoice ? "watch-feed-choice" : ""}`}
                      >
                        <div className="flex justify-between gap-2 text-[9px] font-bold uppercase tracking-wider text-white/30">
                          <span style={idx === 0 ? { color: accent } : undefined}>
                            {event.tone}
                          </span>
                          <span>{event.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-4 text-white/75">
                          {event.text}
                        </p>
                        {isChoice && event.teamName ? (
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-200/70">
                            {event.teamName}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Spectator Toast Stack */}
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* Choice Splash */}
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