/* eslint-disable @typescript-eslint/no-unused-vars */

import { RoomSummary } from "./room-summary";

/* ================================================================== */
/* Core primitives                                                     */
/* ================================================================== */

export type TeamId = "ravens" | "wolves" | "dragons" | "serpents";

export type CombatAction = "attack" | "skill" | "heal" | "block" | "dodge";

export type SkillId =
  | "shadow_strike"
  | "blood_rage"
  | "fire_burst"
  | "void_blast";

export type HealId = "minor_heal" | "major_heal";
export type CombatVariant = SkillId | HealId;

export type PlayerStatus = "alive" | "eliminated" | "defeated" | "spectator";

export type ChoiceResult =
  | "safe"
  | "battle"
  | "random"
  | "elimination"
  | "credits";

export type AdminRole = "executioner" | "chronicler" | "scouter";
export type TeamCaps = Partial<Record<TeamId, number>>;

/* ================================================================== */
/* Status                                                              */
/* ================================================================== */

export type StatusId =
  | "immobilized"
  | "guarded"
  | "evading"
  | "enraged"
  | "blessed";

export interface StatusEffect {
  id: StatusId;
  turns: number;
}

/* ================================================================== */
/* Player and team                                                     */
/* ================================================================== */

export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  hp: number;
  maxHp: number;
  status: PlayerStatus;
  ready: boolean;
  connected: boolean;
  breakMeter?: number;
  statusEffects?: StatusEffect[];
  skillCharges?: number;
  healCharges?: number;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
}

/* ================================================================== */
/* Story                                                               */
/* ================================================================== */

export interface StoryChoice {
  id: string;
  text: string;
  result: ChoiceResult;
  nextNodeId?: string;
  versus?: [TeamId, TeamId];
  cutscene?: Cutscene;
  onBattle?: Cutscene;
  enemyTeamId?: TeamId;
  enemyName?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
  enemyAttack?: number;
  enemyAbilities?: CpuAbilityId[];
  enemyPhases?: CpuPhase[];
}

export interface StoryNode {
  id: string;
  title: string;
  text: string;
  background?: string;
  choices: StoryChoice[];
  onEnter?: Cutscene;
  onChoice?: Record<string, Cutscene>;
}

/* ================================================================== */
/* Combat                                                              */
/* ================================================================== */

export type CpuAbilityId =
  | "rend"
  | "howl"
  | "sweep"
  | "crush"
  | "mend"
  | "drain";

export type CpuPersonality =
  | "aggressive"
  | "strategic"
  | "defensive"
  | "chaotic"
  | "boss";

export interface CpuPhase {
  hpThreshold: number;
  attackMultiplier: number;
  announcement: string;
  healOnEnter?: number;
  signatureName?: string;
}

export interface QueuedAction {
  playerId: string;
  action: CombatAction;
  variant?: CombatVariant;
  targetId?: string;
  resolved?: boolean;
  log?: string[];
}

export interface TeamBattle {
  id: string;
  mode: "team";
  attackerTeamId: TeamId;
  defenderTeamId: TeamId;
  turnTeamId: TeamId;
  status: "active" | "victory" | "defeat";
  log: string[];
  activePlayerId?: string;
  sourceNodeId?: string;
  intro?: Cutscene;
  victory?: Cutscene;
  defeat?: Cutscene;
  queuedActions?: QueuedAction[];
  readyPlayerIds?: string[];
}

export interface CpuBattle {
  id: string;
  mode: "cpu";
  attackerTeamId: TeamId;
  defenderTeamId: TeamId;
  turnTeamId: TeamId;
  status: "active" | "victory" | "defeat";
  log: string[];
  activePlayerId?: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  round: number;
  intro?: Cutscene;
  victory?: Cutscene;
  defeat?: Cutscene;
  personality?: CpuPersonality;
  abilityChance?: number;
  signatureEveryNRounds?: number;
  signatureMultiplier?: number;
  telegraphs?: boolean;
  phases?: CpuPhase[];
  phaseIndex?: number;
  abilities?: CpuAbilityId[];
  queuedActions?: QueuedAction[];
  readyPlayerIds?: string[];
}

export type Battle = TeamBattle | CpuBattle;
export type BattleMode = "team" | "cpu";
export type RoomBattleMode = "pvp" | "cpu";

/* ================================================================== */
/* Game state                                                          */
/* ================================================================== */

export type GamePhase =
  | "waiting"
  | "story"
  | "combat"
  | "ended"
  | "battle"
  | "credits"
  

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  currentNodeId: string;
  currentTeamId: TeamId;
  teams: Record<TeamId, Team>;
  activeTeams?: TeamId[];
  teamCaps?: TeamCaps;
  battle?: Battle;
  events: GameEvent[];
  createdAt: number;
  pendingNextNodeId?: string;
  activePlayerId?: string;
  creditsStartedAt?: number;
  creditsDurationMs?: number;
  playerRotation?: Partial<Record<TeamId, number>>;
  lastActivePlayerId?: string;
  battleMode?: RoomBattleMode;
  hostPlayerId?: string;
  teamCap?: number;
}

/* ================================================================== */
/* Admin                                                               */
/* ================================================================== */

export interface AdminPlayerSummary {
  id: string;
  name: string;
  teamId: TeamId;
  hp: number;
  maxHp: number;
  status: PlayerStatus;
  connected: boolean;
  ready: boolean;
}

/* ================================================================== */
/* Events                                                              */
/* ================================================================== */

export type GameEvent =
  | {
      type: "CREATE_ROOM";
      playerId: string;
      playerName: string;
      teamId: TeamId;
      battleMode: RoomBattleMode;
      enemyName?: string;
    }
  | {
      type: "ROOM_CREATED";
      roomCode: string;
      teamId: TeamId;
      battleMode: RoomBattleMode;
    }
  | {
      type: "ROOM_NOT_FOUND";
      roomCode: string;
    }
  | {
      type: "START_PVP";
      playerId: string;
    }
  | {
      type: "JOIN_GAME";
      playerId: string;
      teamId: TeamId;
      playerName?: string;
      roomName?: string;
      roomCode?: string;
    }
  | {
      type: "WATCH_GAME";
      watcherId: string;
      roomCode: string;
    }
  | {
      type: "CHOICE";
      playerId: string;
      choiceId: string;
    }
  | {
      type: "COMBAT_ACTION";
      playerId: string;
      action: CombatAction;
    }
  | {
      type: "COMBAT_ACTION_SELECTED";
      playerId: string;
      action: CombatAction;
      variant?: CombatVariant;
      targetId?: string;
    }
  | {
      type: "COMBAT_QUEUE_ACTION";
      playerId: string;
      action: CombatAction;
      variant?: CombatVariant;
      targetId?: string;
    }
  | {
      type: "COMBAT_ROUND_UPDATE";
      waitingOn: string[];
      expected: number;
    }
  | {
      type: "TEAM_TURN";
      teamId: TeamId;
      activePlayerId?: string;
    }
  | {
      type: "ELIMINATE";
      playerId: string;
    }
  | {
      type: "ROOM_PLAYER_READY";
      playerId: string;
    }
  | {
      type: "ADMIN_APPROVE_ROOM";
      roomId: string;
      teamCaps?: TeamCaps;
    }
  | { type: "ADMIN_GET_ROOMS" }
  | { type: "ADMIN_KICK_PLAYER"; playerId: string }
  | { type: "PLAYER_LIST_UPDATE"; players: AdminPlayerSummary[] }
  | {
      type: "BATTLE_UPDATE";
      mode: "team" | "cpu";
      message: string;
      enemyName?: string;
      enemyHp?: number;
      enemyMaxHp?: number;
      thinking?: boolean;
      source?: "player" | "enemy" | "system";
      actingTeamId?: TeamId;
      actingPlayerId?: string;
    }
  | {
      type: "STATE_SYNC";
      roomCode: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "ROOM_LIST_UPDATE";
      rooms: RoomSummary[];
    }
  | {
      type: "STORY_UPDATE";
      nodeId: string;
      title: string;
      text: string;
      background?: string;
      choices: StoryChoice[];
    }
  | {
      type: "BREAK";
      teamId: TeamId;
      playerId: string;
    }
  | { type: "CONNECTED"; roomCode: string; message: string }
  | { type: "LEAVE_ROOM"; roomCode: string; playerId: string }
  | { type: "LEAVE_GAME"; playerId: string }
  | {
      type: "CUTSCENE";
      cutscene: Cutscene;
      context: "story" | "battle";
      pausePhase?: boolean;
    }
  | {
      type: "CUTSCENE_DONE";
      cutsceneId: string;
    }
  | { type: "ROUND_TIMER"; remainingMs: number }
  | { type: "CREDITS"; durationMs?: number; startedAt?: number }
  | { type: "CREDITS_DONE" }
  | {
    type: "SET_TEAM_CAP";
    playerId: string;
    teamCap: number;
  };

/* ================================================================== */
/* Cutscenes                                                           */
/* ================================================================== */

export type Tone =
  | "mystic"
  | "danger"
  | "calm"
  | "fear"
  | "sad"
  | "angry"
  | "ominous"
  | "whisper"
  | "emotional"
  | "neutral"
  | "cold"
  | "desperate"
  | "broken"
  | "melancholic"
  | "sincere"
  | "aggressive"
  | "rage"
  | "distorted"
  | "hollow"
  | "exhausted"
  | "dark"
  | "horror"
  | "worried"
  | "tragic"
  | "accusing"
  | "gentle"
  | "tempting"
  | "pleased"
  | "determined"
  | "quiet"
  | "regret"
  | "philosophical"
  | "hurt"
  | "confession"
  | "serious"
  | "furious"
  | "accepting"
  | "reflective";

export interface CutsceneLine {
  id: string;
  text: string;
  speaker?: string;
  voice?: string;
  duration?: number;
  background?: string;
  tone?: Tone;
}

export interface Cutscene {
  id: string;
  lines: CutsceneLine[];
  once?: boolean;
}