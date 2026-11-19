"use client";

import { Radio, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../lib/websocket";
import type {
  Battle,
  CombatAction,
  CombatVariant,
  Cutscene,
  GameEvent,
  GameState,
  RoomBattleMode,
  StoryNode,
  TeamId,
} from "../types/game";
import BattleRoom from "../components/BattleRoom";
import GameLandscape from "../components/GameLandscape";
import EncounterPathBoard from "../components/EncounterPathBoard";
import AdventureWorld, { AdventureEnding } from "../components/AdventureWorld";
import type { AdventureInteraction, EncounterPathChoice } from "../types/game";
import CombatArena from "../components/CombatArena";
import { EncounterLoading, EncounterResult, LeaveBattleDialog } from "../components/EncounterScreen";
import { useBattleResults } from "../hooks/useBattleResults";
import FloatingParticles from "../components/FloatingParticles";
import GameEventFeed from "../components/GameEventFeed";
import JoinRoomModal from "../components/JoinRoomModal";
import StoryScene from "../components/StoryScene";
import TeamPanel from "../components/TeamPanel";
import { CoreService } from "@/app/helpers/api-handler";
import FadeIn from "../components/fade";
import { AudioController } from "../hooks/audioHandler";
import { isNicholasBattle } from "../lib/arenaAssets";
import { useRouter } from "next/navigation";
import ForgePanel from "../components/ForgePanel";
import { gameApi, readGameSession, type GameProfile, type GameSession } from "../lib/progression";
import CutsceneOverlay from "../components/cutsceneOverlay";
import CreditsScreen from "../credits/page";
import GameOverScreen from "../components/Gameover";

/* ------------------------------------------------------------------ */
/* Local types                                                        */
/* ------------------------------------------------------------------ */

interface StoryChoice {
  id: string;
  text: string;
  result: "safe" | "battle" | "random" | "elimination" | "credits";
  nextNodeId?: string;
}

interface StoryResponse {
  initialNodeId: string;
  nodes: Record<string, StoryNode>;
}

interface StoredPlayer {
  id: string;
  name: string;
  teamId: TeamId;
}

type ToastVariant = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  variant: ToastVariant;
  title?: string;
  message: string;
}

const TOAST_STYLES: Record<ToastVariant, string> = {
  info: "border-cyan-300/30 bg-cyan-500/15 text-cyan-50",
  success: "border-emerald-300/30 bg-emerald-500/15 text-emerald-50",
  warning: "border-amber-300/30 bg-amber-500/15 text-amber-50",
  error: "border-red-400/30 bg-red-500/15 text-red-50",
};

const playerStorageKey = "embrace-game-player";
const roomStorageKey = "embrace-game-room";
const modeStorageKey = "embrace-game-mode";

function loadStoredPlayer(): StoredPlayer | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = localStorage.getItem(playerStorageKey);
    if (!value) return undefined;
    const player = JSON.parse(value) as Partial<StoredPlayer>;
    if (
      typeof player.id !== "string" ||
      typeof player.name !== "string" ||
      !["ravens", "wolves", "dragons", "serpents"].includes(
        player.teamId ?? "",
      )
    )
      return undefined;
    return player as StoredPlayer;
  } catch {
    localStorage.removeItem(playerStorageKey);
    return undefined;
  }
}

const emptyTeams = (): GameState["teams"] => ({
  ravens: { id: "ravens", name: "Ravens", players: [] },
  wolves: { id: "wolves", name: "Wolves", players: [] },
  dragons: { id: "dragons", name: "Dragons", players: [] },
  serpents: { id: "serpents", name: "Serpents", players: [] },
});

const initialState: GameState = {
  roomCode: "",
  phase: "waiting",
  currentNodeId: "",
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
    adventure: source.adventure,
    adventureQuest: source.adventureQuest,
    teams,
    currentTeamId,
    events: Array.isArray(source.events) ? source.events : previous.events,
  };
}

function isStateError(payload: GameEventPayload): payload is { error: string } {
  return "error" in payload;
}

type GameEventPayload = Extract<GameEvent, { type: "STATE_SYNC" }>["payload"];
const service: CoreService = new CoreService();

/* ------------------------------------------------------------------ */
/* Battle intro helpers — pure functions, module scope                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface GameProps {
  /** Optional — the room code from the lobby (battle rooms only). */
  initialRoomCode?: string;
}

export default function Game({ initialRoomCode }: GameProps = {}) {
  const [game, setGame] = useState<GameState>(initialState);
  const [storyNodes, setStoryNodes] = useState<Record<string, StoryNode>>({});
  const [story, setStory] = useState({
    title: "Waiting for the story",
    text: "The server will reveal the next scene when the room is ready.",
  });
  const [currentUser, setCurrentUser] = useState<StoredPlayer | undefined>(
    undefined,
  );
  const [gameError, setGameError] = useState<string>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [profile, setProfile] = useState<GameProfile>();
  const [profileRevision, setProfileRevision] = useState(0);
  const [joinOpen, setJoinOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("disconnected");

  const [roomCode, setRoomCode] = useState<string | undefined>(
    initialRoomCode,
  );
  const [battleMode, setBattleMode] = useState<RoomBattleMode | undefined>();

  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(
    message: string,
    variant: ToastVariant = "info",
    title?: string,
  ) {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      const next = [...prev, { id, variant, title, message }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3200,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Refs                                                               */
  /* ------------------------------------------------------------------ */

  const previousTurnRef = useRef<TeamId | null>(null);
  const previousPhaseRef = useRef<GameState["phase"] | null>(null);
  const previousBattleIdRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const lastBattleIdForAudioRef = useRef<string | null>(null);
  const hadBattleRef = useRef(false);
  const gameRef = useRef(game);
  const seenCutsceneIds = useRef<Set<string>>(new Set());
  const lastBossVoiceRoundRef = useRef<number>(-1);
  const lastRoundTimerRef = useRef<number>(0);
  const roomCodeRef = useRef<string | undefined>(roomCode);

  const { result, ready: resultsReady, captureResult, noteBattleUpdate, dismissResult, setLimitPresentationActive } = useBattleResults();
  const [hasRoomSnapshot, setHasRoomSnapshot] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [enemyThinking, setEnemyThinking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showBattleCutscene, setBattleCutsceneVisible] =
    useState<boolean>(false);
  const [cutscene, setCutscene] = useState<Cutscene | null>(null);

  const [deathInfo, setDeathInfo] = useState<{
    cause: "battle" | "elimination" | "abandon";
    killerName?: string;
    nodeTitle?: string;
    epitaph?: string;
  } | null>(null);

  const [roundState, setRoundState] = useState<{
    waitingOn: string[];
    expected: number;
  }>({ waitingOn: [], expected: 0 });
  const [roundTimerMs, setRoundTimerMs] = useState(0);
  const [roundTimerDisplayMs, setRoundTimerDisplayMs] = useState(0);
  const roundDeadlineRef = useRef<number>(0);
  const [queuedPlayerId, setQueuedPlayerId] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Bootstrap                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const account = readGameSession();
    setSession(account);
    const saved = loadStoredPlayer();
    const stored = saved?.id === account?.id ? saved : undefined;
    const storedRoom = localStorage.getItem(roomStorageKey) ?? undefined;
    const storedMode = (localStorage.getItem(modeStorageKey) ??
      undefined) as RoomBattleMode | undefined;

    if (stored) {
      setCurrentUser(stored);
      setJoinOpen(false);
    }
    if (stored && storedRoom) {
      setRoomCode(storedRoom);
      roomCodeRef.current = storedRoom;
    }
    if (stored && storedMode) setBattleMode(storedMode);

    setHydrated(true);
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStory() {
      try {
        const res = await service.get("/game/api/story");
        const payload = res.data as StoryResponse;
        if (payload.initialNodeId && payload.nodes) {
          setStoryNodes((previous) => ({ ...payload.nodes, ...previous }));
          setGame((previous) =>
            previous.currentNodeId
              ? previous
              : { ...previous, currentNodeId: payload.initialNodeId },
          );
        }
      } catch (error) {
        if ((error as DOMException).name !== "AbortError")
          console.error("Unable to load story content", error);
      }
    }

    loadStory();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!currentUser || status !== "connected") return;
    socket.send({
      type: "JOIN_GAME",
      playerId: currentUser.id,
      playerName: currentUser.name,
      teamId: currentUser.teamId,
      roomCode: roomCodeRef.current,
    });
  }, [currentUser, status]);

  /* ------------------------------------------------------------------ */
  /* Battle intro screen trigger                                        */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const battleId = game.battle?.id ?? null;
    const inBattle = battleId !== null;

    if (!hadBattleRef.current && !inBattle) {
      hadBattleRef.current = true;
      lastBattleIdForAudioRef.current = battleId;
      return;
    }
    hadBattleRef.current = true;

    if (game.battle && lastBattleIdForAudioRef.current !== battleId) {
      lastBattleIdForAudioRef.current = battleId;
      AudioController.playEncounterSong(game.battle, game.arenaId);
      return;
    }

    if (!inBattle && lastBattleIdForAudioRef.current !== null) {
      lastBattleIdForAudioRef.current = null;
    }
  }, [game.battle, game.arenaId]);

  /* ------------------------------------------------------------------ */
  /* Round timer countdown                                              */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* Socket                                                             */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!session) return;
    socket.connect();
    const stopStatus = socket.onStatus(setStatus);
    const stopEvents = socket.onMessage((event) => {
      if (event.type === "PROFILE_UPDATED") {
        setProfileRevision((value) => value + 1);
        return;
      }
      if (event.type === "STATE_SYNC") {
        if (isStateError(event.payload)) {
          setQueuedPlayerId(null);
          setGameError(event.payload.error);
          return;
        }
        setGameError(undefined);
        setHasRoomSnapshot(true);
        captureResult(normalizeGameState(event.payload, gameRef.current));

        setGame((previous) => {
          const next = normalizeGameState(event.payload, previous);

          // Sync room code + mode from server-side state.
          if (next.roomCode && next.roomCode !== roomCodeRef.current) {
            roomCodeRef.current = next.roomCode;
            setRoomCode(next.roomCode);
          }
          if (next.battleMode && next.battleMode !== battleMode) {
            setBattleMode(next.battleMode);
          }

          return next;
        });
        return;
      }

      if (event.type === "STORY_UPDATE") {
        setStory({ title: event.title, text: event.text });

        if (event.nodeId) {
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
          setGame((prev) => ({ ...prev, currentNodeId: event.nodeId }));
        }
        return;
      }

      if (event.type === "BATTLE_UPDATE") {
        noteBattleUpdate(gameRef.current.battle, event);
        if (event.thinking !== undefined) setEnemyThinking(event.thinking);

        setGame((previous) => {
          const prev = previous.battle;
          if (!prev) return previous;

          const nextBattle =
            prev.mode === "cpu"
              ? {
                  ...prev,
                  enemyName: event.enemyName ?? prev.enemyName,
                  enemyHp: event.enemyHp ?? prev.enemyHp,
                  enemyMaxHp: event.enemyMaxHp ?? prev.enemyMaxHp,
                  log: event.message
                    ? [...prev.log, event.message]
                    : prev.log,
                }
              : {
                  ...prev,
                  log: event.message
                    ? [...prev.log, event.message]
                    : prev.log,
                };

          return {
            ...previous,
            phase: "battle",
            battle: nextBattle,
          };
        });

        if (event.mode === "cpu" && event.source === "enemy") {
          const battle = gameRef.current.battle;
          if (battle?.mode === "cpu" && isNicholasBattle(battle)) {
            const round = battle.round ?? 1;
            if (round !== lastBossVoiceRoundRef.current) {
              lastBossVoiceRoundRef.current = round;
              AudioController.playBossVoice();
            }
          }
        }
        return;
      }

      if (event.type === "COMBAT_ROUND_UPDATE") {
        setRoundState({
          waitingOn: event.waitingOn ?? [],
          expected: event.expected ?? 0,
        });

        if (currentUser && !event.waitingOn?.includes(currentUser.id)) {
          setQueuedPlayerId(currentUser.id);
        } else {
          setQueuedPlayerId(null);
        }
        return;
      }

      if (event.type === "ROUND_TIMER") {
        const incoming = event.remainingMs ?? 0;
        if (Math.abs(incoming - lastRoundTimerRef.current) < 500) return;
        lastRoundTimerRef.current = incoming;
        setRoundTimerMs(incoming);
        return;
      }

      if (event.type === "CUTSCENE") {
        if (event.cutscene.once && seenCutsceneIds.current.has(event.cutscene.id)) return;
        if (event.cutscene.once) seenCutsceneIds.current.add(event.cutscene.id);

        setCutscene(event.cutscene);
        if (event.context === "story") setBattleCutsceneVisible(true);
        return;
      }

      if (event.type === "TEAM_TURN") {
        setGame((previous) => ({
          ...previous,
          currentTeamId: event.teamId,
          activePlayerId:
            event.activePlayerId !== undefined
              ? event.activePlayerId
              : previous.activePlayerId,
        }));
        return;
      }

      if (event.type === "ELIMINATE") {
        setGame((previous) => ({
          ...previous,
          teams: Object.fromEntries(
            Object.entries(previous.teams).map(([id, team]) => [
              id,
              {
                ...team,
                players: team.players.map((player) =>
                  player.id === event.playerId
                    ? { ...player, status: "eliminated" }
                    : player,
                ),
              },
            ]),
          ) as GameState["teams"],
        }));

        pushToast(`A player has been eliminated.`, "error", "Elimination");
      }

      if (event.type === "ROOM_REMOVED") {
        pushToast("A moderator removed you from this room.", "warning", "Removed from room");
        localStorage.removeItem(roomStorageKey);
        localStorage.removeItem(modeStorageKey);
        window.setTimeout(() => { window.location.href = "/pages/embrace-game"; }, 1500);
        return;
      }

      if (event.type === "ROOM_NOT_FOUND") {
        pushToast(
          `Room ${event.roomCode} not found. Returning to menu.`,
          "error",
          "Room not found",
        );
        localStorage.removeItem(roomStorageKey);
        localStorage.removeItem(modeStorageKey);
        window.setTimeout(() => {
          window.location.href = "/pages/embrace-game";
        }, 1500);
      }
    });

    return () => {
      stopStatus();
      stopEvents();
      socket.disconnect();
    };
  }, [captureResult, noteBattleUpdate, session]);

  useEffect(() => {
    if (!session) return;
    let current = true;
    gameApi<GameProfile>("/profile").then((next) => {
      if (current) setProfile(next);
    }).catch(() => { if (current) setProfile(undefined); });
    return () => { current = false; };
  }, [session, profileRevision]);

  /* ------------------------------------------------------------------ */
  /* Status toasts                                                      */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const prev = previousStatusRef.current;
    if (prev === status) return;
    previousStatusRef.current = status;

    if (status === "error") {
      pushToast("Could not reach the game server.", "error", "Connection");
    } else if (status === "disconnected" && prev === "connected") {
      pushToast("Disconnected from the server.", "warning", "Offline");
    } else if (status === "connected" && prev !== null) {
      pushToast("Connected.", "success", "Online");
    }
  }, [status]);

  useEffect(() => {
    if (!gameError) return;
    pushToast(gameError, "error", "Game error");
  }, [gameError]);

  /* ------------------------------------------------------------------ */
  /* Derived state                                                      */
  /* ------------------------------------------------------------------ */

  const teams = game.teams ?? emptyTeams();
  const currentTeam = teams[game.currentTeamId];
  const activeStory: StoryNode = storyNodes[game.currentNodeId] ?? {
    id: game.currentNodeId,
    ...story,
    choices: [],
  };
  const currentNode = storyNodes[game.currentNodeId];

  const localPlayer = useMemo(
    () =>
      Object.values(teams)
        .flatMap((team) => team.players)
        .find((player) => player.id === currentUser?.id),
    [teams, currentUser?.id],
  );

  const activePlayerName = useMemo(() => {
    if (!game.activePlayerId) return undefined;
    for (const team of Object.values(teams)) {
      const p = team.players.find((p) => p.id === game.activePlayerId);
      if (p) return p.name;
    }
    return undefined;
  }, [game.activePlayerId, teams]);

  const router = useRouter();

  /* ------------------------------------------------------------------ */
  /* Host / PvP controls                                                */
  /* ------------------------------------------------------------------ */

  const isHost = Boolean(currentUser && game.hostPlayerId === currentUser.id);

  const handleStartRoom = useCallback(() => {
    if (!currentUser) return;
    if (!document.fullscreenElement && window.matchMedia("(pointer: fine)").matches) {
      AudioController.makeFullScreen();
    }
    const type = game.adventure && game.phase === "waiting"
      ? "BEGIN_ADVENTURE"
      : battleMode === "cpu" ? "START_CPU" : "START_PVP";
    socket.send({ type, playerId: currentUser.id });
  }, [currentUser, battleMode, game.adventure, game.phase]);

  const chooseEncounterPath = useCallback((pathChoice: EncounterPathChoice) => {
    if (!currentUser || !isHost) return;
    socket.send({ type: "START_CPU", playerId: currentUser.id, pathChoice });
  }, [currentUser, isHost]);

  const interactInAdventure = useCallback((action: AdventureInteraction, target?: string) => {
    if (!currentUser || !game.encounterPath) return;
    socket.send({ type: "ADVENTURE_INTERACT", playerId: currentUser.id,
      chapter: game.encounterPath.index, action, target });
  }, [currentUser, game.encounterPath]);

  /* ------------------------------------------------------------------ */
  /* Death handling                                                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!localPlayer) return;
    if (battleMode === "pvp") return;
    if (localPlayer.status === "alive" && deathInfo) setDeathInfo(null);
    if (localPlayer.status !== "eliminated") return;
    if (deathInfo) return;

    const battle = game.battle;
    const storyNode = currentNode;

    if (battle && battle.status === "defeat") {
      setDeathInfo({
        cause: "battle",
        killerName:
          battle.mode === "cpu"
            ? battle.enemyName
            : `${battle.attackerTeamId} vs ${battle.defenderTeamId}`,
        nodeTitle: storyNode?.title,
        epitaph:
          battle.mode === "cpu"
            ? "It was never going to let you leave."
            : "Two houses entered. One left.",
      });
      return;
    }

    setDeathInfo({
      cause: "elimination",
      nodeTitle: storyNode?.title,
      epitaph: "You chose to step into the dark. It did not step back.",
    });
  }, [
    battleMode,
    localPlayer?.status,
    game.battle?.status,
    game.currentNodeId,
    currentNode,
    deathInfo,
  ]);

  useEffect(() => {
    if (!localPlayer) return;
    if (localPlayer.status === "alive") return;
    AudioController.pause();
  }, [localPlayer?.status]);

  /* ------------------------------------------------------------------ */
  /* Toasts on turn / phase changes                                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!game.currentTeamId) return;
    if (previousTurnRef.current === game.currentTeamId) return;
    previousTurnRef.current = game.currentTeamId;

    if (game.phase === "story" || game.phase === "waiting") {
      const name = teams[game.currentTeamId]?.name ?? game.currentTeamId;
      pushToast(`${name}'s turn.`, "info", "Turn");
    }
  }, [game.currentTeamId, game.phase, teams]);

  useEffect(() => {
    const prev = previousPhaseRef.current;
    if (prev === game.phase) return;
    previousPhaseRef.current = game.phase;

    if (game.phase === "story" && prev === "waiting") {
      pushToast("The Chronicle begins.", "success", "Story");
    }
    if (game.phase === "waiting" && prev === "battle") AudioController.playMenuSong();
    if (game.phase === "story" && prev === "battle") {
      pushToast("The battle has ended.", "info", "Story");
      AudioController.playGameSong();
    }
  }, [game.phase]);

  useEffect(() => {
    const id = game.battle?.id ?? null;
    if (id === previousBattleIdRef.current) return;
    previousBattleIdRef.current = id;

    if (!game.battle) return;

    if (game.battle.mode === "team") {
      pushToast(
        `${game.battle.attackerTeamId} clashes with ${game.battle.defenderTeamId}.`,
        "warning",
        "Battle!",
      );
    } else if (game.battle.mode === "cpu") {
      pushToast(
        `${game.battle.enemyName} attacks your team.`,
        "warning",
        "Ambush!",
      );
    }
  }, [game.battle]);

  const canChoose = Boolean(
    currentUser &&
      !game.paused &&
      localPlayer?.status === "alive" &&
      game.phase === "story" &&
      game.currentTeamId === localPlayer.teamId &&
      (!game.activePlayerId || game.activePlayerId === currentUser.id),
  );

  const visibleTeams = useMemo(() => {
    return Object.values(teams).filter(
      (team) =>
        team.id === game.currentTeamId || team.id === localPlayer?.teamId,
    );
  }, [teams, game.currentTeamId, localPlayer?.teamId]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  function join(teamId: TeamId) {
    if (!session) return;
    const { id: playerId, username: playerName } = session;
    const player = { id: playerId, name: playerName, teamId };
    localStorage.setItem(playerStorageKey, JSON.stringify(player));
    setCurrentUser(player);
    setGameError(undefined);
    setJoinOpen(false);
    seenCutsceneIds.current = new Set();
    pushToast(`Welcome, ${playerName}.`, "success", "Joined");
  }

  const chooseCombat = useCallback(
    (action: CombatAction, variant?: CombatVariant, targetId?: string) => {
      const g = gameRef.current;
      if (!currentUser || !localPlayer || g.paused) return;

      const battle = g.battle;
      if (!battle || battle.status !== "active") return;

      if (
        roundState.waitingOn.length > 0 &&
        !roundState.waitingOn.includes(currentUser.id)
      ) {
        return;
      }

      const myTeam = localPlayer.teamId;
      if (battle.mode === "team" && battle.turnTeamId !== myTeam) return;
      if (battle.mode === "cpu" && battle.attackerTeamId !== myTeam) return;

      AudioController.playerHoverAndClickSound();
      socket.send({
        type: "COMBAT_QUEUE_ACTION",
        playerId: currentUser.id,
        action,
        variant,
        targetId,
      });

      setQueuedPlayerId(currentUser.id);
    },
    [currentUser, localPlayer, roundState.waitingOn],
  );

  function chooseStory(choiceId: string) {
    if (!currentUser || !canChoose) return;
    AudioController.playerHoverAndClickSound();
    socket.send({ type: "CHOICE", playerId: currentUser.id, choiceId });
  }

  function leaveRoom() {
    if (leavingRoom) return;
    setLeavingRoom(true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if (currentUser) {
      socket.send({ type: "LEAVE_GAME", playerId: currentUser.id });
    }

    localStorage.removeItem(roomStorageKey);
    localStorage.removeItem(modeStorageKey);

    window.setTimeout(() => {
      localStorage.removeItem(playerStorageKey);
      router.replace("/pages/embrace-game");
    }, 120);
  }

  /* ------------------------------------------------------------------ */
  /* Early returns                                                      */
  /* ------------------------------------------------------------------ */

  const arenaBattle = result?.battle ?? (game.phase === "battle" ? game.battle : undefined);
  const arenaTeams = result?.teams ?? teams;

  if (leavingRoom) return <EncounterLoading title="Returning to the Highlands" detail="Leaving the room." />;
  if (!hydrated) return <EncounterLoading />;

  if (deathInfo && !result && !game.encounterPath) {
    return (
      <GameOverScreen
        onLeave={leaveRoom}
        cause={deathInfo.cause}
        killerName={deathInfo.killerName}
        nodeTitle={deathInfo.nodeTitle}
        epitaph={deathInfo.epitaph}
        stats={{
          turnsSurvived: game.events?.length,
          battlesWon: 0,
          kills: 0,
          teamsLeft: Object.values(game.teams).filter(
            (t) => t.players.some((p) => p.status === "alive"),
          ).length,
        }}
      />
    );
  }

  if (hydrated && !session) {
    return <main className="grid min-h-screen place-items-center bg-[#141018] text-white">
      <button type="button" onClick={() => router.push("/pages/embrace-game")} className="rounded-xl border border-amber-200/40 px-5 py-3 text-amber-100">
        Return to the Highlands menu to sign in
      </button>
    </main>;
  }

  if (currentUser && !hasRoomSnapshot && !arenaBattle && !gameError) {
    return <EncounterLoading title={status === "error" ? "Connection interrupted" : "Joining the room"} detail={status === "error" ? "The game server has not accepted the connection yet." : "Waiting for the game server."} failed={status === "error"} onBack={leaveRoom} />;
  }

  if (game.phase === "credits" && !result) {
    return (
      <CreditsScreen
        durationMs={game.creditsDurationMs ?? 68000}
        onDone={() => socket.send({ type: "CREDITS_DONE" })}
      />
    );
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <GameLandscape required={game.phase !== "waiting"}>
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {cutscene && showBattleCutscene ? (
        <CutsceneOverlay
          cutscene={cutscene}
          onDone={() => {
            setCutscene(null);
            setBattleCutsceneVisible(false);
          }}
        />
      ) : null}

      <FloatingParticles />

      <div className="pointer-events-none fixed inset-x-0 top-4 z-120 flex flex-col items-center gap-2 px-4">
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

            <div className="flex items-start gap-3 pl-2">
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-(--toast-accent,#6fd6ff)">
                    {toast.title}
                  </p>
                ) : null}
                <p className="mt-1 text-sm leading-5 text-white/85 tracking-wide">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                aria-label="Dismiss"
                className="shrink-0 rounded-none p-1 text-white/50 transition hover:text-[color:var(--toast-accent,#6fd6ff)]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmLeave && <LeaveBattleDialog onCancel={() => setConfirmLeave(false)} onLeave={leaveRoom} />}

      {arenaBattle ? (
        <CombatArena
          key={`arena-${arenaBattle.id}`}
          onLimitPresentationChange={setLimitPresentationActive}
          battle={arenaBattle}
          arenaId={game.arenaId}
          player={result ? Object.values(arenaTeams).flatMap(({ players }) => players).find(({ id }) => id === currentUser?.id) : localPlayer}
          teams={arenaTeams}
          onAction={chooseCombat}
          onLeave={() => setConfirmLeave(true)}
          connected={status === "connected"}
          paused={game.paused}
          notice={gameError || undefined}
          enemyThinking={enemyThinking}
          waitingOn={roundState.waitingOn}
          expectedActors={roundState.expected}
          roundTimerMs={game.paused ? 0 : roundTimerDisplayMs}
          hasQueued={Boolean(currentUser && queuedPlayerId === currentUser.id)}
          itemCount={localPlayer?.loadout ? profile?.items[localPlayer.loadout.item] ?? 0 : 0}
        />
      ) : game.phase === "waiting" && battleMode && hasRoomSnapshot ? (
        <BattleRoom
          game={game}
          roomCode={game.roomCode || roomCode}
          mode={battleMode}
          player={localPlayer}
          unlocked={profile?.fighters}
          connected={status === "connected"}
          error={gameError}
          onLeave={() => setConfirmLeave(true)}
          onForge={() => setForgeOpen(true)}
          onStart={handleStartRoom}
        />
      ) : game.adventure && game.encounterPath && game.phase === "ended" ? (
        <AdventureEnding path={game.encounterPath} onExit={leaveRoom} />
      ) : game.adventure && game.encounterPath && game.phase === "battle" && localPlayer?.fighterId ? (
        <AdventureWorld key={game.encounterPath.index} path={game.encounterPath} fighter={localPlayer.fighterId}
          quest={game.adventureQuest} onEnter={handleStartRoom} onInteract={interactInAdventure}
          onExit={() => setConfirmLeave(true)}
          disabled={!isHost || status !== "connected" || game.paused || confirmLeave}
          notice={gameError || (game.paused ? "The room is paused." : undefined)} />
      ) : game.encounterPath && (game.phase === "battle" || game.phase === "ended") ? (
        <EncounterPathBoard path={game.encounterPath}
          onEnter={isHost && game.phase === "battle" ? handleStartRoom : undefined}
          onChoose={isHost && game.phase === "ended" ? chooseEncounterPath : undefined}
          disabled={status !== "connected" || game.paused}
          notice={gameError || (game.paused ? "The room is paused." : undefined)}
          onExit={() => { if (game.phase === "ended") leaveRoom(); else setConfirmLeave(true); }} />
      ) : game.phase === "battle" && battleMode === "cpu" ? (
        <EncounterLoading title="The next encounter" detail={game.paused ? "The room is paused." : "Waiting for the next opponent."} onBack={() => setConfirmLeave(true)} />
      ) : (
      <div
        className="relative z-10 mx-auto max-w-400 px-6 py-8"
        suppressHydrationWarning
      >
        <header
          className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6"
          suppressHydrationWarning
        >
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-white/30">
              Embrace
            </p>
            <h1 className="mt-2 text-3xl font-black">
              THE CHRONICLE
              {battleMode ? (
                <span
                  className={`ml-3 rounded-full border px-2.5 py-0.5 align-middle text-[10px] font-black uppercase tracking-widest ${
                    battleMode === "pvp"
                      ? "border-cyan-200/40 bg-cyan-200/10 text-cyan-100"
                      : "border-red-300/40 bg-red-300/10 text-red-100"
                  }`}
                >
                  {battleMode === "pvp" ? "PvP Room" : "Vs Enemies"}
                </span>
              ) : null}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/50">
              {status}
            </span>

            <button onClick={() => setConfirmLeave(true)}>Leave Room</button>

          </div>
        </header>

        {game.paused && <p role="status" className="mb-4 rounded-xl border border-amber-200/40 bg-amber-950/50 px-4 py-3 text-sm text-amber-100">A moderator paused this room.</p>}
        {gameError ? (
          <p className="mb-6 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {gameError}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="min-w-0">
            <div>
                <FadeIn trigger={game.currentNodeId} duration={500}>
                  <StoryScene
                    nodeId={game.currentNodeId}
                    title={activeStory.title}
                    text={activeStory.text}
                    background={activeStory.background}
                    phase={game.phase}
                    currentTeamName={currentTeam?.name}
                    activePlayerName={activePlayerName}
                    choices={activeStory.choices}
                    canChoose={canChoose}
                    onChoose={chooseStory}
                    isLocalPlayerActive={
                      game.activePlayerId === currentUser?.id &&
                      game.phase === "story"
                    }
                  />
                </FadeIn>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-widest text-white/35">
                Current turn
              </p>
              <div className="mt-2 flex items-center gap-2 text-2xl font-black uppercase">
                <Radio className="size-5 text-cyan-200" />
                {currentTeam?.name ?? game.currentTeamId}
              </div>
              {game.activePlayerId ? (
                <p className="mt-1 text-xs uppercase tracking-widest text-cyan-200/60">
                  {activePlayerName ?? "…"}&apos;s action
                </p>
              ) : null}
              <p className="mt-2 text-sm text-white/45">
                Room {game.roomCode || roomCode || "—"}
              </p>
              {currentUser ? (
                <p className="mt-1 text-xs uppercase tracking-widest text-cyan-200/70">
                  You are {currentUser.name} · {localPlayer?.teamId ?? currentUser.teamId}
                </p>
              ) : null}
              {isHost ? (
                <p className="mt-1 text-xs uppercase tracking-widest text-emerald-300/70">
                  Host
                </p>
              ) : null}
            </div>

            {visibleTeams.map((team) => (
              <TeamPanel
                key={team.id}
                team={team}
                active={team.id === game.currentTeamId}
              />
            ))}

            <GameEventFeed events={game.events} />
          </aside>
        </div>
      </div>

      )}

      {result && resultsReady && (!cutscene || !showBattleCutscene) && (
        <EncounterResult
          key={`results-${result.battle.id}`}
          result={result}
          viewerTeam={localPlayer?.teamId ?? currentUser?.teamId}
          continueLabel={game.adventure ? (game.phase === "ended" ? "See ending" : "Continue adventure") : game.encounterPath ? "View path" : game.phase === "ended" ? "Back to Highlands" : battleMode === "pvp" ? "Return to lobby" : battleMode === "cpu" ? "Continue to next encounter" : "Continue the Chronicle"}
          onContinue={game.phase === "ended" && !game.encounterPath ? leaveRoom : dismissResult}
          onExit={game.phase === "ended" ? undefined : leaveRoom}
          confirmExit
        />
      )}
      {forgeOpen && game.phase === "waiting" && <ForgePanel inLobby onClose={() => { setForgeOpen(false); setProfileRevision((value) => value + 1); }} />}
      {hydrated && session && <JoinRoomModal roomCode={game.roomCode} username={session.username} open={joinOpen} onJoin={join} onBack={leaveRoom} />}
    </main>
    </GameLandscape>
  );
}
