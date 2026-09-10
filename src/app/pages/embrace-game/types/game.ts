export type TeamId = "ravens" | "wolves" | "dragons" | "serpents";
export type PlayerStatus = "alive" | "eliminated" | "spectator";
export type GamePhase = "waiting" | "story" | "battle" | "finished";
export type CombatAction = "attack" | "skill" | "heal" | "block" | "dodge";
export type SkillVariant =
  | "shadow_strike"
  | "blood_rage"
  | "fire_burst"
  | "void_blast";
export type HealVariant = "minor_heal" | "major_heal";
export type CombatVariant = SkillVariant | HealVariant;

export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  hp: number;
  maxHp: number;
  status: PlayerStatus;
  ready: boolean;
  connected: boolean;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
}

export interface Battle {
  id: string;
  attackerTeamId: TeamId;
  defenderTeamId: TeamId;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  activePlayerId?: string;
  turnTeamId: TeamId;
  status: "active" | "victory" | "defeat";
  log: string[];
}

export interface StoryUpdate {
  nodeId: string;
  title: string;
  text: string;
}
export interface RoomSummary {
  roomCode: string;
  phase: GameState['phase'];
  playerCount: number;
  teams: {
    ravens: number;
    wolves: number;
    dragons: number;
    serpents: number;
  };
}
export type ChoiceResult = 'safe' | 'battle' | 'random' | 'elimination';
export interface StoryChoice {
  id: string;
  text: string;
  result: ChoiceResult;

  nextNodeId?: string;

  enemyTeamId?: TeamId;

  enemyName?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
}

export type GameEvent =
  | {
      type: "STATE_SYNC";
      roomCode: string;
      payload: GameState | { error: string };
    }
  | {
    type: 'STORY_UPDATE';
    nodeId: string;
    title: string;
    text: string;
    background?: string;
    choices: StoryChoice[];
  }
  | {
      type: "BATTLE_UPDATE";
      enemyName: string;
      enemyHp: number;
      enemyMaxHp: number;
      message: string;
    }
  | { type: "TEAM_TURN"; teamId: TeamId }
  | { type: "ELIMINATE"; playerId: string }
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
  | { type: "ADMIN_APPROVE_ROOM"; roomId: string }
   | {
      type: 'ADMIN_GET_ROOMS';
    }
| {
      type: 'ROOM_LIST_UPDATE';
      rooms: RoomSummary[];
    }  | { type: "TEAM_TURN"; teamId: TeamId }
  | { type: "ELIMINATE"; playerId: string }
  | {
    type: "ADMIN_APPROVE_ROOM";
    roomId: string;
    teamCaps?: Partial<Record<TeamId, number>>;
  };

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  currentNodeId: string;
  currentTeamId: TeamId;
  teams: Record<TeamId, Team>;
  battle?: Battle;
  events: GameEvent[];
  createdAt: number;
}
