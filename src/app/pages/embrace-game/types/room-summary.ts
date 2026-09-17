import type { GamePhase } from "../types/game";

export interface RoomSummary {
  roomCode: string;
  phase: GamePhase;
  playerCount: number;
  teams: {
    ravens: number;
    wolves: number;
    dragons: number;
    serpents: number;
  };
  battleMode?: "pvp" | "cpu";
  hostPlayerId?: string;
}