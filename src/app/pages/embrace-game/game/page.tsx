"use client";

import { DoorOpen, Radio, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../lib/websocket";
import type {
  CombatAction,
  CombatVariant,
  GameEvent,
  GameState,
  TeamId,
} from "../types/game";
import CombatArena from "../components/CombatArena";
import FloatingParticles from "../components/FloatingParticles";
import GameEventFeed from "../components/GameEventFeed";
import JoinRoomModal from "../components/JoinRoomModal";
import StoryScene from "../components/StoryScene";
import TeamPanel from "../components/TeamPanel";
import { CoreService } from "@/app/helpers/api-handler";
import FadeIn from "../components/fade";
import { duration } from "@mui/material";
import WhiteFlash from "../components/defeat-flash";
import { AudioController } from "../hooks/audioHandler";
import WutheringButton from "../../game/components/styled-button";
import BattleStartScreen from "../components/BattleStartScreen";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from 'uuid';

interface StoryNode {
  id: string;
  title: string;
  text: string;
  background?: string;
  choices: StoryChoice[];
}

interface StoryChoice {
  id: string;
  text: string;
  result: "safe" | "battle" | "random" | "elimination";
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

function loadStoredPlayer(): StoredPlayer | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = localStorage.getItem(playerStorageKey);
    if (!value) return undefined;
    const player = JSON.parse(value) as Partial<StoredPlayer>;
    if (
      typeof player.id !== "string" ||
      typeof player.name !== "string" ||
      !["ravens", "wolves", "dragons", "serpents"].includes(player.teamId ?? "")
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

export default function Game() {
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
  const [joinOpen, setJoinOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("disconnected");

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

  const previousTurnRef = useRef<TeamId | null>(null);
  const previousPhaseRef = useRef<GameState["phase"] | null>(null);
  const previousBattleIdRef = useRef<string | null>(null);
  const previousBattleStatusRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const [showingStartButton, setShowingStartButton] = useState<boolean>(false);
  const [enemyThinking, setEnemyThinking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const stored = loadStoredPlayer();
    if (stored) {
      setCurrentUser(stored);
      setJoinOpen(false);
    }
    setHydrated(true);
  }, []);
  const pendingStoryRef = useRef<
  Extract<GameEvent, { type: "STORY_UPDATE" }> | null
>(null);
  const [whiteFlash, setWhiteFlash] = useState<{
  trigger: number;
  kind: "victory" | "defeat" | "boss";
} | null>(null);

const previousBattleOutcomeRef = useRef<{
  id: string;
  status: "victory" | "defeat";
} | null>(null);

useEffect(() => {
  const battle = game.battle;
  if (!battle) {
    previousBattleOutcomeRef.current = null;
    return;
  }
  if (battle.status === "active") return;

  const prev = previousBattleOutcomeRef.current;
  if (prev && prev.id === battle.id && prev.status === battle.status) return;

  previousBattleOutcomeRef.current = { id: battle.id, status: battle.status };

  const isBoss = battle.mode === "cpu" && !!battle.enemyName?.includes("WARDEN");

  setWhiteFlash({
    trigger: Date.now(),
    kind:
      battle.status === "defeat"
        ? "defeat"
        : isBoss
          ? "boss"
          : "victory",
  });
}, [game.battle?.id, game.battle?.status, game.battle?.mode]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStory() {
      try {
        const res = await service.get("/game/api/story");
        const payload = res.data as StoryResponse;
        if (payload.initialNodeId && payload.nodes) {
          setStoryNodes(payload.nodes);
          setGame((previous) =>
            previous.currentNodeId
              ? previous
              : {
                  ...previous,
                  currentNodeId: payload.initialNodeId,
                },
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
    });
  }, [currentUser, status]);

  // ---------------------------------------------------------------------
// Audio — battle music on battle start, story music otherwise
// ---------------------------------------------------------------------
const lastBattleIdForAudioRef = useRef<string | null>(null);
const hadBattleRef = useRef(false);

useEffect(() => {
  const battleId = game.battle?.id ?? null;
  const inBattle = battleId !== null;

  // First render: just sync the refs, don't play anything.
  if (!hadBattleRef.current && !inBattle) {
    hadBattleRef.current = true;
    lastBattleIdForAudioRef.current = battleId;
    return;
  }
  hadBattleRef.current = true;

  // Battle just started.
  if (inBattle && lastBattleIdForAudioRef.current !== battleId) {
    lastBattleIdForAudioRef.current = battleId;
    setShowingStartButton(true);
    return;
  }

  // Battle just ended.
  if (!inBattle && lastBattleIdForAudioRef.current !== null) {
    lastBattleIdForAudioRef.current = null;
    //AudioController.playGameSong();
    return;
  }
}, [game.battle?.id]);

  useEffect(() => {
    socket.connect();
    const stopStatus = socket.onStatus(setStatus);
    const stopEvents = socket.onMessage((event) => {
      if (event.type === "STATE_SYNC") {
        if (isStateError(event.payload)) {
          setGameError(event.payload.error);
          return;
        }
        setGameError(undefined);
        setGame((previous) => normalizeGameState(event.payload, previous));
      }

      if (event.type === "STORY_UPDATE") {
        AudioController.playGameSong();
        if (whiteFlash) {
          pendingStoryRef.current = event;
          return;
        }

        
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
      }

if (event.type === "BATTLE_UPDATE") {
  if (event.thinking !== undefined) {
    setEnemyThinking(event.thinking);
  }


 
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
            log: event.message ? [...prev.log, event.message] : prev.log,
          }
        : {
            ...prev,
            log: event.message ? [...prev.log, event.message] : prev.log,
          };

    return {
      ...previous,
      phase: "battle",
      battle: nextBattle,
    };
  });

  const isCpu = event.mode === 'cpu';
  const myTeam = localPlayer?.teamId;

  // Only meaningful in PvP battles.
  const isMyAction =
    !isCpu && event.actingTeamId !== undefined && event.actingTeamId === myTeam;

  const isOpponentAction =
    !isCpu &&
    event.actingTeamId !== undefined &&
    event.actingTeamId !== myTeam;

  if (isCpu && event.source === 'enemy') {
    const index = Math.random() < 0.5 ? 0 : 1;
    if(index == 0){
      AudioController.playSlashSong();
    }else{
      AudioController.playFireSound();
    }
  } else if (isMyAction) {
    
  } else if (isOpponentAction) {
    const index = Math.random() < 0.5 ? 0 : 1;
    if(index == 0){
      AudioController.playSlashSong();
    }else{
      AudioController.playFireSound();
    }
  }
}

      if (event.type === "TEAM_TURN")
        setGame((previous) => ({ ...previous, currentTeamId: event.teamId }));

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
    });

    return () => {
      stopStatus();
      stopEvents();
      socket.disconnect();
    };
  }, []);

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

  const teams = game.teams ?? emptyTeams();
  const currentTeam = teams[game.currentTeamId];
  const activeStory: StoryNode = storyNodes[game.currentNodeId] ?? {
    id: game.currentNodeId,
    ...story,
    choices: [],
  };
  const localPlayer = useMemo(
    () =>
      Object.values(teams)
        .flatMap((team) => team.players)
        .find((player) => player.id === currentUser?.id),
    [teams, currentUser?.id],
  );

  const router = useRouter();

useEffect(() => {
  if (!localPlayer) return;
  if (localPlayer.status !== "alive") {
    router.push("/pages/embrace-game/watch");
  }
}, [localPlayer?.status, router]);

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
    if (game.phase === "story" && prev === "battle") {
      pushToast("The battle has ended.", "info", "Story");
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

  useEffect(() => {
    const status = game.battle?.status ?? null;
    if (status === previousBattleStatusRef.current) return;
    previousBattleStatusRef.current = status;

    if (status === "victory") {
      pushToast("The enemy has fallen.", "success", "Victory");
    }
    if (status === "defeat") {
      pushToast("Your team was overwhelmed.", "error", "Defeat");
    }
  }, [game.battle?.status]);

  const gameRef = useRef(game);
useEffect(() => {
  gameRef.current = game;
}, [game]);

  const canChoose = Boolean(
    currentUser &&
      localPlayer?.status === "alive" &&
      game.phase === "story" &&
      game.currentTeamId === currentUser.teamId,
  );

  const visibleTeams = useMemo(() => {
    return Object.values(teams).filter(
      (team) =>
        team.id === game.currentTeamId || team.id === currentUser?.teamId,
    );
  }, [teams, game.currentTeamId, currentUser?.teamId]);

  function join(teamId: TeamId, playerName: string) {
    const playerId = uuidv4();
    const player = { id: playerId, name: playerName, teamId };
    localStorage.setItem(playerStorageKey, JSON.stringify(player));
    setCurrentUser(player);
    setGameError(undefined);
    setJoinOpen(false);
    pushToast(`Welcome, ${playerName}.`, "success", "Joined");
  }

  const chooseCombat = useCallback(
  (action: CombatAction, variant?: CombatVariant) => {
    const g = gameRef.current;
    if (!currentUser || !localPlayer) return;
    const battle = g.battle;
    if (!battle || battle.status !== "active") return;
    const myTeam = localPlayer.teamId;
    if (battle.mode === "team" && battle.turnTeamId !== myTeam) return;
    if (battle.mode === "cpu" && battle.attackerTeamId !== myTeam) return;

    switch(action){
      case 'attack':
        AudioController.playSlashSong();
        break;
      case 'block':
        AudioController.playImpactSound();
        break;
      case 'heal':
        AudioController.playHealSound();
        break;
      case 'skill':
        AudioController.playFireSound();
      case 'dodge':
        AudioController.playImpactSound();
        break;
    }

    socket.send({
      type: "COMBAT_ACTION_SELECTED",
      playerId: currentUser.id,
      action,
      variant,
    });
  },
  [currentUser, localPlayer],
);


  function chooseStory(choiceId: string) {
    if (!currentUser || !canChoose) return;
    AudioController.playerHoverAndClickSound();
    socket.send({ type: "CHOICE", playerId: currentUser.id, choiceId });
  }

  function leaveRoom() {
  if (currentUser) {
    socket.send({
      type: "LEAVE_GAME",
      playerId: currentUser.id,
    });
  }

  // Give the socket a brief moment to flush the message before the
  // page reloads. 120ms is enough for a local websocket.
  window.setTimeout(() => {
    localStorage.removeItem(playerStorageKey);
    window.location.reload();
  }, 120);
}
  function applyStoryUpdate(event: Extract<GameEvent, { type: "STORY_UPDATE" }>) {
  setStory({ title: event.title, text: event.text });

  if (!event.nodeId) return;

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

if (showingStartButton && game.battle) {
  return (
    <BattleStartScreen
      enemyName={
        game.battle.mode === "cpu"
          ? game.battle.enemyName
          : `${game.battle.attackerTeamId} vs ${game.battle.defenderTeamId}`
      }
      mode={game.battle.mode}
      attackerTeamId={
        game.battle.mode === "team" ? game.battle.attackerTeamId : undefined
      }
      defenderTeamId={
        game.battle.mode === "team" ? game.battle.defenderTeamId : undefined
      }
      onStart={() => setShowingStartButton(false)}
    />
  );
}

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {whiteFlash ? (
  <WhiteFlash
    trigger={whiteFlash.trigger}
    kind={whiteFlash.kind}
    duration={whiteFlash.kind === "victory" ? 3000 : 1100}
    onDone={() => {
      setWhiteFlash(null)
    if (pendingStoryRef.current) {
    applyStoryUpdate(pendingStoryRef.current);
    pendingStoryRef.current = null;
   }
  }
}
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
      {/* accent edge */}
      <span
        className="absolute left-0 top-0 h-full w-0.75"
        style={{
          background:
            "linear-gradient(180deg, var(--toast-accent, #6fd6ff) 0%, transparent 90%)",
        }}
      />
      {/* corner tick */}
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
            <h1 className="mt-2 text-3xl font-black">THE CHRONICLE</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/50">
              {status}
            </span>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-4 py-2.5 text-xs font-black uppercase text-cyan-100"
            >
              <DoorOpen className="size-4" /> Join
            </button>

<button onClick={() => setConfirmLeave(true)}>
  Leave Room
</button>

{confirmLeave ? (
  <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0f13] p-6">
      <h2 className="text-lg font-black uppercase tracking-widest">
        Leave the game?
      </h2>
      <p className="mt-2 text-sm text-white/60">
        You will be removed from your team. Your teammates will continue
        without you.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => setConfirmLeave(false)}
          className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setConfirmLeave(false);
            leaveRoom();
          }}
          className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black"
        >
          Leave
        </button>
      </div>
    </div>
  </div>
) : null}
          </div>
        </header>

        {gameError ? (
          <p className="mb-6 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {gameError}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="min-w-0">
            <div>
              {game.phase === "battle" && game.battle ? (
                <CombatArena
                  battle={game.battle}
                  player={localPlayer}
                  teams={teams}
                  onAction={chooseCombat}
                  enemyThinking={enemyThinking}
                />
              ) : (
                <FadeIn trigger={game.currentNodeId}  duration={500}>
                  <StoryScene
                  nodeId={game.currentNodeId}
                  title={activeStory.title}
                  text={activeStory.text}
                  background={activeStory.background}
                  phase={game.phase}
                  currentTeamName={currentTeam?.name}
                  choices={activeStory.choices}
                  canChoose={canChoose}
                  onChoose={chooseStory}
                />
                </FadeIn>
                
              )}
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
              <p className="mt-2 text-sm text-white/45">
                Room {game.roomCode}
              </p>
              {currentUser ? (
                <p className="mt-1 text-xs uppercase tracking-widest text-cyan-200/70">
                  You are {currentUser.name} · {currentUser.teamId}
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

      {hydrated ? (
        <JoinRoomModal roomCode={game.roomCode} open={joinOpen} onJoin={join} />
      ) : null}
    </main>
  );
}