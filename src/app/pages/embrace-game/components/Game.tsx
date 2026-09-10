"use client";

import { DoorOpen, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { socket } from "../lib/websocket";
import type {
  CombatAction,
  CombatVariant,
  GameEvent,
  GameState,
  TeamId,
} from "../types/game";
import CombatArena from "./CombatArena";
import FloatingParticles from "./FloatingParticles";
import GameEventFeed from "./GameEventFeed";
import JoinRoomModal from "./JoinRoomModal";
import StoryScene from "./StoryScene";
import TeamPanel from "./TeamPanel";
import { CoreService } from "@/app/helpers/api-handler";

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

  // Load stored player only after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = loadStoredPlayer();
    if (stored) {
      setCurrentUser(stored);
      setJoinOpen(false);
    }
    setHydrated(true);
  }, []);

  // Load the full story graph once so nodes are available as fallback
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

  // Re-announce ourselves whenever the socket connects
  useEffect(() => {
    if (!currentUser || status !== "connected") return;
    console.debug("[Embrace game] Rejoining global game", currentUser);
    socket.send({
      type: "JOIN_GAME",
      playerId: currentUser.id,
      playerName: currentUser.name,
      teamId: currentUser.teamId,
    });
  }, [currentUser, status]);

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
        // Flat snapshot (used as a fallback if the node isn't cached yet)
        setStory({ title: event.title, text: event.text });

        // Cache the node and sync currentNodeId for every client
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
        setGame((previous) => ({
          ...previous,
          phase: "battle",
          battle: previous.battle
            ? {
                ...previous.battle,
                enemyName: event.enemyName,
                enemyHp: event.enemyHp,
                enemyMaxHp: event.enemyMaxHp,
                log: [...previous.battle.log, event.message],
              }
            : undefined,
        }));
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
      }
    });

    return () => {
      stopStatus();
      stopEvents();
      socket.disconnect();
    };
  }, []);

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

  // Only the active team may pick. Everyone else watches.
  const canChoose = Boolean(
    currentUser &&
      localPlayer?.status === "alive" &&
      game.phase === "story" &&
      game.currentTeamId === currentUser.teamId,
  );

  // Teams to show: the active team plus the player's own team.
  const visibleTeams = useMemo(() => {
    return Object.values(teams).filter(
      (team) =>
        team.id === game.currentTeamId || team.id === currentUser?.teamId,
    );
  }, [teams, game.currentTeamId, currentUser?.teamId]);

  function join(teamId: TeamId, playerName: string) {
    const playerId = crypto.randomUUID();
    console.debug("[Embrace game] Joining player", {
      playerId,
      playerName,
      teamId,
    });
    const player = { id: playerId, name: playerName, teamId };
    localStorage.setItem(playerStorageKey, JSON.stringify(player));
    setCurrentUser(player);
    setGameError(undefined);
    setJoinOpen(false);
  }

  function chooseCombat(action: CombatAction, _variant?: CombatVariant) {
    if (
      !currentUser ||
      localPlayer?.status !== "alive" ||
      game.phase !== "battle" ||
      game.currentTeamId !== currentUser.teamId
    )
      return;
    socket.send({
      type: "COMBAT_ACTION",
      playerId: currentUser.id,
      action,
    });
  }

  function chooseStory(choiceId: string) {
    if (!currentUser || !canChoose) return;
    socket.send({ type: "CHOICE", playerId: currentUser.id, choiceId });
  }

  function leaveRoom() {
    localStorage.removeItem(playerStorageKey);
    window.location.reload();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <FloatingParticles />
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
              Embrace Your Horror
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
            <button
              type="button"
              onClick={leaveRoom}
              className="flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-4 py-2.5 text-xs font-black uppercase text-cyan-100"
            >
              <DoorOpen className="size-4" /> Leave Room
            </button>
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
                  onAction={chooseCombat}
                />
              ) : (
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