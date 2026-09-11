export type TeamId = "ravens" | "wolves" | "dragons" | "serpents";
export type PlayerStatus = "alive" | "eliminated" | "defeated" | "spectator";
export type GamePhase = "waiting" | "story" | "battle" | "finished";
export type CombatAction = "attack" | "skill" | "heal" | "block" | "dodge";

export type SkillVariant =
  | "shadow_strike"
  | "blood_rage"
  | "fire_burst"
  | "void_blast";

export type HealVariant = "minor_heal" | "major_heal";
export type CombatVariant = SkillVariant | HealVariant;

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
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
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
}

export type Battle = TeamBattle | CpuBattle;

export type ChoiceResult = "safe" | "battle" | "random" | "elimination";
export type TeamCaps = Partial<Record<TeamId, number>>;

export interface StoryChoice {
  id: string;
  text: string;
  result: ChoiceResult;
  nextNodeId?: string;
  versus?: [TeamId, TeamId];
  enemyTeamId?: TeamId;
  enemyName?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
}

export interface StoryNode {
  id: string;
  title: string;
  text: string;
  background?: string;
  choices: StoryChoice[];
}

export interface RoomSummary {
  roomCode: string;
  phase: GamePhase;
  playerCount: number;
  teams: { ravens: number; wolves: number; dragons: number; serpents: number };
  teamCaps?: TeamCaps;
}

export type GameEvent =
  | {
      type: "STATE_SYNC";
      roomCode: string;
      payload: GameState | { error: string };
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
      type: "BATTLE_UPDATE";
      mode: "team" | "cpu";
      message: string;
      enemyName?: string;
      enemyHp?: number;
      enemyMaxHp?: number;
      thinking?: boolean;
      source?: 'player' | 'enemy' | 'system';
      actingTeamId?: TeamId;
    }
  | { type: "TEAM_TURN"; teamId: TeamId }
  | { type: "ELIMINATE"; playerId: string }
  | { type: "BREAK"; playerId: string; teamId: TeamId }
  | {
      type: "JOIN_GAME";
      playerId: string;
      teamId: TeamId;
      playerName?: string;
      roomName?: string;
    }
  | { type: "WATCH_GAME"; watcherId: string; roomCode: string }
  | { type: "CHOICE"; playerId: string; choiceId: string }
  | { type: "COMBAT_ACTION"; playerId: string; action: CombatAction }
  | {
      type: "COMBAT_ACTION_SELECTED";
      playerId: string;
      action: CombatAction;
      variant?: CombatVariant;
    }
  | { type: "ROOM_PLAYER_READY"; playerId: string }
  | {
      type: "ADMIN_APPROVE_ROOM";
      roomId: string;
      teamCaps?: TeamCaps;
    }
  | { type: "ADMIN_GET_ROOMS" }
  | { type: "ROOM_LIST_UPDATE"; rooms: RoomSummary[] }
  | {
    type: 'COMBAT_ACTION_SELECTED';
    playerId: string;
    action: CombatAction;
    variant?: CombatVariant;
    targetId?: string;
  } | {type: 'LEAVE_ROOM', roomCode: string}
  | {type: 'LEAVE_GAME', playerId: string};

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  currentNodeId: string;
  currentTeamId: TeamId;
  teams: Record<TeamId, Team>;
  teamCaps?: TeamCaps;
  battle?: Battle;
  events: GameEvent[];
  createdAt: number;
}