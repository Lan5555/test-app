import type { FeaturedFighter, Warrior } from "./warriorSelection";

export type CompanionSkillId = `call_${string}`;

export interface GameSession {
  id: string;
  username: string;
  token: string;
}

export interface Loadout {
  job: string;
  weapon: string;
  armor: string;
  item: string;
  equippedItem?: { name: string; description: string; effect: "heal" | "guard"; power: number };
}

export interface GameProfile {
  id: string;
  username: string;
  moderator: boolean;
  credits: number;
  xp?: number;
  progression?: { level: number; current: number; required: number; attack: number; defense: number; speed?: number };
  pity: number;
  gear: string[];
  fighters?: FeaturedFighter[];
  items: Record<string, number>;
  unlockedSkills?: CompanionSkillId[];
  loadout: Loadout;
}

export interface Catalog {
  gear: Record<string, { name: string; slot: string; rarity: string; attack: number; armor: number; price: number }>;
  items: Record<string, { name: string; description: string; price: number; effect?: "heal" | "guard" }>;
  skills?: Partial<Record<CompanionSkillId, { name: string; fighter: Warrior; description: string; price: number }>>;
  jobs: Record<string, { name: string; description: string }>;
  reward: number;
  battleXp?: number;
  summon: { cost: number; pityAt: number; pool: { id: string; weight: number }[]; duplicateCredits: number };
}

export function formatCinders(amount: number) {
  return `${amount.toLocaleString()} ${amount === 1 ? "Cinder" : "Cinders"}`;
}

export const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";
const sessionKey = "embrace-game-session";

export function readGameSession(): GameSession | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
    return session?.token && session?.id && session?.username ? session : null;
  } catch {
    return null;
  }
}

export function storeGameSession(session: GameSession | null) {
  if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
  else sessionStorage.removeItem(sessionKey);
}

export class GameApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function gameApi<T>(path: string, options: { method?: string; body?: unknown; token?: string; timeoutMs?: number } = {}): Promise<T> {
  const { method = "GET", body, token = readGameSession()?.token, timeoutMs = 10000 } = options;
  const isForm = body instanceof FormData;
  const response = await fetch(`${gameServerUrl.replace(/\/$/, "")}/game/api${path}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    const message = payload?.message;
    throw new GameApiError(Array.isArray(message) ? message.join(" ") : message ?? "Game service unavailable.", response.status);
  }
  return payload as T;
}
