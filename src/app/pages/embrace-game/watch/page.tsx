"use client";

import {
  ArrowLeft,
  Eye,
  LogOut,
  Radio,
  Swords,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import {
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
  Cutscene,
  GameState,
  StoryChoice,
  Team,
  TeamId,
} from "../types/game";
import { v4 as uuidv4 } from "uuid";
import CutsceneOverlay from "../components/cutsceneOverlay";
import CombatArena from "../components/CombatArena";
import EncounterPathBoard from "../components/EncounterPathBoard";
import { EncounterLoading, EncounterResult } from "../components/EncounterScreen";
import { useBattleResults } from "../hooks/useBattleResults";
import { useRouter } from "next/navigation";
import GameLandscape from "../components/GameLandscape";
import StoryScene from "../components/StoryScene";
import TeamPanel from "../components/TeamPanel";
import BattleIntro from "../components/BattleIntro";
import { story as fallbackStory } from "../lib/story";
import { CoreService } from "@/app/helpers/api-handler";
import CreditsScreen from "../credits/page";
import { AudioController } from "../hooks/audioHandler";
import { useWatchMusic } from "../hooks/useWatchMusic";
import styles from "./watch.module.css";

interface WatchEvent {
  id: string;
  text: string;
  time: string;
  tone: "story" | "combat" | "system" | "elimination" | "choice";
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
    battle: source.battle,
    encounterPath: source.encounterPath,
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

const service = new CoreService();



/* ---------------------------------------------------------------- */
/* Watch Page Main Component                                         */
/* ---------------------------------------------------------------- */

export default function WatchPage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [hasRoomSnapshot, setHasRoomSnapshot] = useState(false);
  const [watchError, setWatchError] = useState<string>();
  const { result, ready: resultsReady, captureResult, noteBattleUpdate, dismissResult, setLimitPresentationActive } = useBattleResults();
  const [watcherName, setWatcherName] = useState("");
  const [roomCode, setRoomCode] = useState("global");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [story, setStory] = useState(initialStory);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [game, setGame] = useState<GameState>(initialGameState);
  const [cutscene, setCutscene] = useState<Cutscene | null>(null);
  const [enemyThinking, setEnemyThinking] = useState(false);

  const [storyNodes, setStoryNodes] =
    useState<Record<string, StoryNode>>(defaultStoryNodes);

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
  const hasLiveState = hasRoomSnapshot && status === "connected";
  const serverBattle = game.phase === "battle" || game.phase === "combat"
    ? game.battle
    : undefined;
  const musicSource = !hasLiveState
    ? undefined
    : serverBattle?.status === "active"
      ? AudioController.encounterMusic(serverBattle, game.arenaId)
      : game.phase === "credits"
        ? "/assets/music/hope.mp3"
        : game.phase === "story" || game.phase === "waiting"
          ? "/assets/music/forest3.mp3"
          : undefined;
  const { prime, stop, blocked, enable } = useWatchMusic(
    musicSource,
    Boolean(game.paused),
    Boolean(cutscene || result),
  );

  // Check URL query for room param on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("room");
      if (r) setRoomCode(r);
    }
  }, []);

  useEffect(() => {
    storyNodesRef.current = storyNodes;
  }, [storyNodes]);

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
          setStoryNodes((prev) => ({ ...data.nodes, ...prev }));
          storyNodesRef.current = { ...storyNodesRef.current, ...data.nodes };
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
    if (!hasLiveState) return;
    const currentBattleId = serverBattle?.id ?? null;
    if (currentBattleId && currentBattleId !== previousBattleIdRef.current) {
      previousBattleIdRef.current = currentBattleId;
      const b = serverBattle;
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
  }, [hasLiveState, serverBattle]);

  // Socket communication (stable deps: no battle)
  useEffect(() => {
    if (!loggedIn) return;
    const requestedRoom = roomCode.trim() || "global";
    let joined = false;
    let awaitingSnapshot = true;

    const updateGame = (next: GameState) => {
      gameRef.current = next;
      currentNodeIdRef.current = next.currentNodeId;
      setGame(next);
    };

    const unsubscribeEvents = socket.onMessage((event) => {
      if (event.type === "STATE_SYNC" && event.roomCode && event.roomCode !== requestedRoom) return;
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

      // Choice splash
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
      }

      // STATE_SYNC normalization
      if (event.type === "STATE_SYNC") {
        if ("error" in event.payload) {
          setWatchError(typeof event.payload.error === "string" ? event.payload.error : "Unable to open this room.");
          return;
        }
        const next = normalizeGameState(event.payload, gameRef.current);
        if (awaitingSnapshot) {
          previousBattleIdRef.current = next.battle?.id ?? null;
          awaitingSnapshot = false;
        } else {
          captureResult(next);
        }
        if (next.paused && !gameRef.current.paused) AudioController.stopSoundEffects();
        updateGame(next);
        setWatchError(undefined);
        setHasRoomSnapshot(true);
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
        }
      }

      // BATTLE_UPDATE
      if (event.type === "BATTLE_UPDATE") {
        const previous = gameRef.current;
        const prevBattle = previous.battle;
        if (awaitingSnapshot || !prevBattle || prevBattle.status !== "active" ||
            (previous.phase !== "battle" && previous.phase !== "combat")) return;
        noteBattleUpdate(prevBattle, event);
        if (event.thinking !== undefined) setEnemyThinking(event.thinking);

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

        updateGame({ ...previous, battle: nextBattle });
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
        const prev = gameRef.current;
        updateGame({
          ...prev,
          currentTeamId: event.teamId,
          activePlayerId:
            event.activePlayerId !== undefined
              ? event.activePlayerId
              : prev.activePlayerId,
        });
      }

      // ELIMINATE
      if (event.type === "ELIMINATE") {
        const prev = gameRef.current;
        updateGame({
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
        });
      }
    });

    const unsubscribeStatus = socket.onStatus((next) => {
      setStatus(next);
      if (next === "connected") {
        if (!joined) {
          joined = true;
          socket.send({ type: "WATCH_GAME", watcherId: watcherName.trim(), roomCode: requestedRoom });
        }
      } else if (joined) {
        joined = false;
        awaitingSnapshot = true;
        stop();
        AudioController.stopSoundEffects();
        setHasRoomSnapshot(false);
        setCutscene(null);
        setBattleIntro(null);
        dismissResult();
        setEnemyThinking(false);
        setRoundTimerMs(0);
        setRoundState({ waitingOn: [], expected: 0 });
      }
    });
    socket.connect();

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      stop();
      AudioController.stopSoundEffects();
      socket.disconnect();
    };
  }, [captureResult, dismissResult, noteBattleUpdate, loggedIn, roomCode, watcherName, stop]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!watcherName.trim()) return;

    prime();
    setLoggedIn(true);
  }

  const handleCutsceneDone = useCallback(() => setCutscene(null), []);
  const handleBattleIntroDone = useCallback(() => setBattleIntro(null), []);
  const handleChoiceSplashDone = useCallback(() => setChoiceSplash(null), []);

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

  const activeBattle = result?.battle ?? serverBattle;
  const tickerItems = events.slice(0, 8);
  const soundPrompt = blocked && hasLiveState && !game.paused ? (
    <button type="button" onClick={enable} className={`${styles.primary} fixed bottom-4 right-4 z-[250] text-xs`}>
      <Volume2 size={16} aria-hidden="true" /> Enable sound
    </button>
  ) : null;

  if (hasLiveState && game.phase === "credits" && !result) {
    return (
      <>
        <CreditsScreen durationMs={game.creditsDurationMs ?? 68000} />
        {soundPrompt}
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Login Screen                                                      */
  /* ---------------------------------------------------------------- */

  if (!loggedIn) {
    return (
      <main className={styles.scene}>
        <FloatingParticles count={58} variant="entrance" />
        <div className={styles.entryLayout}>
          <Link href="/pages/embrace-game" className={`${styles.quiet} justify-self-start text-xs`}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to menu
          </Link>
          <form onSubmit={handleLogin} className={`${styles.join} ${styles.glass}`} aria-labelledby="watch-title">
            <p className={`${styles.eyebrow} flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]`}>
              <Eye size={17} aria-hidden="true" /> Spectator access
            </p>
            <h1 id="watch-title" className={`${styles.heading} mt-3 text-4xl sm:text-5xl`}>
              Watch the Chronicle
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-200/85">
              Follow the story, team turns, and battles live.
            </p>

            <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
              Watcher name
              <input
                value={watcherName}
                onChange={(event) => setWatcherName(event.target.value)}
                placeholder="Enter your spectator name"
                required
                className={`${styles.input} mt-2 text-sm normal-case tracking-normal`}
              />
            </label>
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
              Room code
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="global"
                className={`${styles.input} mt-2 text-sm normal-case tracking-normal`}
              />
            </label>
            <button type="submit" className={`${styles.primary} mt-6 w-full text-sm`}>
              <Radio size={16} aria-hidden="true" /> Enter live room
            </button>
          </form>
        </div>
      </main>
    );
  }

  function exitSpectating() {
    stop();
    AudioController.stopSoundEffects();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    socket.disconnect();
    router.replace("/pages/embrace-game");
  }

  if (!hasLiveState) {
    return <GameLandscape><EncounterLoading title={watchError || status === "error" ? "Unable to open the room" : "Joining as spectator"} detail={watchError ?? (status === "error" ? "The game server is unavailable." : "Waiting for the live room.")} failed={Boolean(watchError) || status === "error"} onBack={exitSpectating} /></GameLandscape>;
  }

  const connectionLabel =
    status === "connected"
      ? "Connected"
      : status === "error"
        ? "Connection error"
        : status === "connecting"
          ? "Connecting"
          : "Disconnected";

  /* ---------------------------------------------------------------- */
  /* Main Spectator View                                               */
  /* ---------------------------------------------------------------- */

  return (
    <GameLandscape>
    <main className={activeBattle ? "relative min-h-screen overflow-hidden bg-[#030608] text-white" : styles.scene}>
      {soundPrompt}
      {cutscene ? (
        <CutsceneOverlay
          key={cutscene.id}
          cutscene={cutscene}
          onDone={handleCutsceneDone}
          spectator={true}
        />
      ) : null}

      {battleIntro ? (
        <BattleIntro
          enemyName={battleIntro.enemyName}
          mode={battleIntro.mode}
          attackerTeamId={battleIntro.attackerTeamId}
          defenderTeamId={battleIntro.defenderTeamId}
          onDone={handleBattleIntroDone}
          duration={1900}
        />
      ) : null}

      {activeBattle ? <FloatingParticles /> : <FloatingParticles count={58} variant="entrance" />}

      {activeBattle ? (
        <CombatArena
          key={`arena-${activeBattle.id}`}
          onLimitPresentationChange={setLimitPresentationActive}
          battle={activeBattle}
          arenaId={game.arenaId}
          teams={result?.teams ?? teams}
          connected={status === "connected"}
          paused={game.paused}
          enemyThinking={enemyThinking}
          waitingOn={roundState.waitingOn}
          expectedActors={roundState.expected}
          roundTimerMs={roundTimerDisplayMs}
          onLeave={exitSpectating}
          spectator
        />
      ) : game.encounterPath ? (
        <EncounterPathBoard path={game.encounterPath} onExit={exitSpectating} />
      ) : (
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-8">
        {/* Header */}
        <header className={`${styles.glass} flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6`}>
          <div className="min-w-0">
            <div className={`${styles.eyebrow} flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]`}>
              <Radio size={15} aria-hidden="true" />
              Live Spectator Room
            </div>
            <h1 className={`${styles.heading} mt-2 text-4xl sm:text-5xl`}>The Chronicle</h1>
            <p className="mt-2 break-words text-sm text-slate-200/85">
              Spectating as{" "}
              <span className="font-bold text-white">{watcherName}</span> ·
              Room{" "}
              <span className="font-bold text-amber-100">
                {game.roomCode || roomCode}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div role="status" className={`${styles.connection} text-xs font-semibold`}>
              {status === "connected" ? (
                <Wifi className="size-4 text-emerald-300" aria-hidden="true" />
              ) : (
                <WifiOff className="size-4 text-amber-200" aria-hidden="true" />
              )}
              {connectionLabel}
            </div>

            <button
              type="button"
              onClick={exitSpectating}
              className={`${styles.quiet} text-xs`}
            >
              <LogOut className="size-3.5" aria-hidden="true" /> Leave
            </button>
          </div>
        </header>

        {/* Live event ticker */}
        <div className={`${styles.glass} relative mt-4 overflow-hidden`}>
          <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
            <span className={`${styles.eyebrow} shrink-0 border-r border-white/15 pr-3 text-[10px] font-bold uppercase tracking-[0.16em]`}>
              Live feed
            </span>
            <div className="flex-1 overflow-hidden">
              {tickerItems.length > 0 ? (
                <div className="watch-ticker flex w-max items-center gap-10 whitespace-nowrap text-xs font-semibold text-slate-200/90">
                  {[...tickerItems, ...tickerItems].map((e, i) => (
                    <span
                      key={`${e.id}-${i}`}
                      aria-hidden={i >= tickerItems.length || undefined}
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
                <span className="text-xs text-slate-300">
                  Waiting for events from the room…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Core Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className={`${styles.storyFrame} min-w-0`}>
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
          </div>

          <aside className="space-y-4">
            <section className={`${styles.glass} p-5`}>
              <h2 className={`${styles.eyebrow} flex items-center gap-2 text-xs font-bold uppercase tracking-widest`}>
                <Swords size={15} aria-hidden="true" /> Current turn
              </h2>
              <p className={`${styles.heading} mt-2 text-3xl`}>
                {currentTeam?.name ?? game.currentTeamId}
              </p>
              {activePlayerName ? (
                <p className="mt-1 text-sm text-slate-200">
                  {activePlayerName}&apos;s action
                </p>
              ) : null}
              <p className="mt-3 border-t border-white/15 pt-3 text-xs capitalize text-slate-300">
                Phase: {game.phase}
              </p>
            </section>

            <section className={`${styles.glass} p-4`} aria-labelledby="watch-log">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="watch-log" className={`${styles.heading} text-xl`}>
                  Chronicle log
                </h2>
                <span className="text-xs tabular-nums text-slate-300">
                  {events.length} events
                </span>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="text-xs leading-5 text-slate-300">
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
                        <div className="flex justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          <span
                            style={idx === 0 ? { color: accent } : undefined}
                          >
                            {event.tone}
                          </span>
                          <span>{event.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-5 text-slate-100">
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
            </section>

            <div className={`${styles.teams} grid gap-3 sm:grid-cols-2 lg:grid-cols-1`}>
              {TEAM_IDS.map((id) => {
                const team = teams[id];
                if (!team) return null;
                return <TeamPanel key={team.id} team={team} active={team.id === currentTeamId} />;
              })}
            </div>
          </aside>
        </div>
      </div>
      )}

      {result && resultsReady && !cutscene && !battleIntro && (
        <EncounterResult key={`results-${result.battle.id}`} result={result} continueLabel="Keep watching" onContinue={dismissResult} onExit={exitSpectating} />
      )}
      {choiceSplash ? (
        <ChoiceSplash
          trigger={choiceSplash.trigger}
          label={choiceSplash.label}
          teamName={choiceSplash.teamName}
          onDone={handleChoiceSplashDone}
        />
      ) : null}

      <style jsx>{`
        .watch-ticker {
          animation: watch-ticker-scroll 26s linear infinite;
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
        @media (prefers-reduced-motion: reduce) {
          .watch-ticker,
          .watch-feed-new {
            animation: none;
          }
          .watch-ticker {
            flex-wrap: wrap;
            width: 100%;
            gap: 0.25rem 1rem;
            white-space: normal;
          }
          .watch-ticker > [aria-hidden="true"] {
            display: none;
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
    </GameLandscape>
  );
}
