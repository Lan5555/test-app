export type TeamId = "ravens" | "wolves" | "dragons" | "serpents";
export type PlayerStatus = "alive" | "eliminated" | "defeated" | "spectator";
export type GamePhase = "waiting" | "story" | "battle" | "finished" | 'credits';
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
   /** Remaining skill uses this battle. Reset when a battle starts. */
  skillCharges?: number;
  /** Remaining heal uses this battle. Reset when a battle starts. */
  healCharges?: number;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
}
export interface QueuedAction {
  playerId: string;
  action: CombatAction;
  variant?: CombatVariant;
  targetId?: string;
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
  queuedActions?: QueuedAction[];
  readyPlayerIds?: string[];
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
  /** Plays when this choice is selected, before the result resolves. */
  cutscene?: Cutscene;

  /** Plays when the choice resolves into a battle. */
  onBattle?: Cutscene;

}

export interface StoryNode {
  id: string;
  title: string;
  text: string;
  background?: string;
  choices: StoryChoice[];
   onEnter?: Cutscene;

  /** Optional cutscene for specific choices. Keyed by choice id. */
  onChoice?: Record<string, Cutscene>;
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
    /** New: who produced this line. */
     actingPlayerId?: string;
    }
  | { type: "TEAM_TURN"; teamId: TeamId; activePlayerId?: string  }
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
  | {type: 'LEAVE_GAME', playerId: string} |
  {
      type: 'CUTSCENE';
      cutscene: Cutscene;
      /** Where it came from — used by the client to know when to return. */
      context: 'story' | 'battle';
      /** Optional: pause the current phase until the cutscene finishes. */
      pausePhase?: boolean;
    }
  | {
      type: 'CUTSCENE_DONE';
      cutsceneId: string;
    }
    | {
    type: 'COMBAT_QUEUE_ACTION';
    playerId: string;
    action: CombatAction;
    variant?: CombatVariant;
    targetId?: string;
  }
| {
    type: 'COMBAT_ROUND_UPDATE';
    /** Player ids whose actions are still expected. */
    waitingOn: string[];
    /** Total players expected this round. */
    expected: number;
  } | { type: 'ROUND_TIMER'; remainingMs: number }
  | { type: 'CREDITS'; durationMs?: number; startedAt?: number }
  | { type: 'CREDITS_DONE' };

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
  activePlayerId?: string;
  creditsStartedAt?: number; // optional, useful for syncing the scroll
  creditsDurationMs?: number; // optional
  
}

export interface CutsceneLine {
  id: string;
  /** Big text displayed in the center. */
  text: string;
  /** Optional speaker shown above the text. */
  speaker?: string;
  /** Optional voice-over clip. Plays if present. */
  voice?: string;
  /** How long to display this line, in ms. Defaults to 3200. */
  duration?: number;
  /** Optional background image override for this line. */
  background?: string;
  /** Optional tint: 'neutral' | 'danger' | 'mystic'. */
  tone?: Tone;
}

export interface Cutscene {
  id: string;
  lines: CutsceneLine[];
  /** Play once per game, or every time the trigger fires. */
  once?: boolean;
}

export type Tone =
  | 'mystic'
  | 'danger'
  | 'calm'
  | 'fear'
  | 'sad'
  | 'angry'
  | 'ominous'
  | 'whisper'
  | 'emotional'
  | 'neutral'
  | 'cold'
  | 'desperate'
  | 'broken'
  | 'melancholic'
  | 'sincere'
  | 'aggressive'
  | 'rage'
  | 'distorted'
  | 'hollow'
  | 'exhausted'
  | 'dark'
  | 'horror'
  | 'worried'
  | 'tragic'
  | 'accusing'
  | 'gentle'
  | 'tempting'
  | 'pleased'
  | 'determined'
  | 'quiet'
  | 'regret'
  | 'philosophical'
  | 'hurt'
  | 'confession'
  | 'serious'
  | 'furious'
  | 'accepting'
  | 'reflective';