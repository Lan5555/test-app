"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import ForgePanel from "./components/ForgePanel";
import type { ArenaId } from "./lib/arenaAssets";
import { gameApi, readGameSession, type GameProfile, type GameSession } from "./lib/progression";
import BattleLobbyModal from "./components/battleLobbyModal";
import { AudioController } from "./hooks/audioHandler";
import { socket } from "./lib/websocket";
import MainMenu from "./menu/MainMenu";
import { RoomBattleMode, TeamId } from "./types/game";

export const PLAYER_STORAGE_KEY = "embrace-game-player";
export const ROOM_STORAGE_KEY = "embrace-game-room";
export const MODE_STORAGE_KEY = "embrace-game-mode";

const GAME_ROUTE = "/pages/embrace-game/game";
const WATCH_ROUTE = "/pages/embrace-game/watch";

export default function MenuPage() {
  const router = useRouter();
  const [dialog, setDialog] = useState<"battle" | "forge" | "forge-for-battle" | null>(null);
  const [adventureNotice, setAdventureNotice] = useState("");
  const openingAdventure = useRef(false);

  const [session, setSession] = useState<GameSession | null>(null);
  const [moderatorId, setModeratorId] = useState<string>();
  const [returnOrder, setReturnOrder] = useState<string>();
  useEffect(() => {
    setSession(readGameSession());
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("gameOrder");
    if (orderId && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(orderId)) {
      setReturnOrder(orderId);
      setDialog("forge");
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    let current = true;
    gameApi<GameProfile>("/profile").then((profile) => {
      if (current) setModeratorId(profile.moderator ? profile.id : undefined);
    }).catch(() => { if (current) setModeratorId(undefined); });
    return () => { current = false; };
  }, [session]);

  function requireAccount() {
    if (readGameSession()) return true;
    setDialog("forge");
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* Story paths                                                       */
  /* ---------------------------------------------------------------- */

  const continueGame = async () => {
    if (!requireAccount()) return;
    try {
      AudioController.playInitialMusicOnLoad();
    } catch {
      /* audio not ready */
    }
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
    router.push(GAME_ROUTE);
  };

  const onNewGame = async () => {
    if (!requireAccount()) return;
    try {
      AudioController.playInitialMusicOnLoad();
    } catch {
      /* audio not ready */
    }
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
    router.push(GAME_ROUTE);
  };

  const onWatch = async () => {
    router.push(WATCH_ROUTE);
  };

  const onBattle = () => {
    const account = readGameSession();
    setSession(account);
    setDialog("forge-for-battle");
  };

  async function onAdventure() {
    if (openingAdventure.current || !requireAccount()) return;
    const account = readGameSession();
    if (!account) return;
    openingAdventure.current = true;
    setAdventureNotice("Opening Adventure…");
    try {
      await createBattleRoom(account.username, "ravens", "cpu", "moonlit-observatory", undefined, true);
    } catch (error) {
      setAdventureNotice(error instanceof Error ? error.message : "Could not open Adventure.");
    } finally {
      openingAdventure.current = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Battle lobby                                                      */
  /* ---------------------------------------------------------------- */

  async function createBattleRoom(
    playerName: string,
    teamId: TeamId,
    battleMode: RoomBattleMode,
    arenaId: ArenaId,
    startingHp?: number,
    adventure?: boolean,
  ) {
    const account = readGameSession();
    if (!account) throw new Error("Sign in before joining the arena.");
    await socket.waitUntilConnected();
    const playerId = account.id;
    const player = { id: playerId, name: playerName, teamId };

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    localStorage.setItem(MODE_STORAGE_KEY, battleMode);

    const waitForRoom = new Promise<{
      roomCode: string;
      battleMode: RoomBattleMode;
    }>((resolve, reject) => {
      const stop = socket.onMessage((event) => {
        if (event.type === "ROOM_CREATED") {
          stop();
          clearTimeout(timeout);
          resolve({
            roomCode: event.roomCode,
            battleMode: event.battleMode,
          });
        }
        if (event.type === "STATE_SYNC") {
          const payload = event.payload as { error?: string };
          if (payload?.error) {
            stop();
            clearTimeout(timeout);
            reject(new Error(payload.error));
          }
        }
      });

      const timeout = window.setTimeout(() => {
        stop();
        reject(new Error("Room creation timed out."));
      }, 8000);
    });

    socket.send({
      type: "CREATE_ROOM",
      playerId,
      playerName,
      teamId,
      battleMode,
      adventure,
      startingHp,
      arenaId,
    });

    try {
      const { roomCode, battleMode: confirmedMode } = await waitForRoom;
      localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
      localStorage.setItem(MODE_STORAGE_KEY, confirmedMode);
    } catch (err) {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
      localStorage.removeItem(MODE_STORAGE_KEY);
      throw err;
    }

    setDialog(null);
    router.push(GAME_ROUTE);
  }

  async function joinBattleRoom(
    roomCode: string,
    playerName: string,
    teamId: TeamId,
  ) {
    const account = readGameSession();
    if (!account) throw new Error("Sign in before joining the arena.");
    await socket.waitUntilConnected();
    const playerId = account.id;
    const player = { id: playerId, name: playerName, teamId };

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
    localStorage.setItem(MODE_STORAGE_KEY, "pvp");

    const waitForJoin = new Promise<void>((resolve, reject) => {
      const stop = socket.onMessage((event) => {
        if (event.type === "ROOM_NOT_FOUND") {
          stop();
          clearTimeout(timeout);
          reject(new Error(`Room ${event.roomCode} not found.`));
          return;
        }
        if (
          event.type === "STATE_SYNC" &&
          event.roomCode === roomCode &&
          !("error" in (event.payload ?? {}))
        ) {
          stop();
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (event.type === "STATE_SYNC") {
          const payload = event.payload as { error?: string };
          if (payload?.error) {
            stop();
            clearTimeout(timeout);
            reject(new Error(payload.error));
          }
        }
      });

      const timeout = window.setTimeout(() => {
        stop();
        reject(new Error("Could not join the room. Try again."));
      }, 8000);
    });

    socket.send({
      type: "JOIN_GAME",
      playerId,
      playerName,
      teamId,
      roomCode,
    });

    try {
      await waitForJoin;
    } catch (err) {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
      localStorage.removeItem(ROOM_STORAGE_KEY);
      localStorage.removeItem(MODE_STORAGE_KEY);
      throw err;
    }

    setDialog(null);
    router.push(GAME_ROUTE);
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <MainMenu
        onContinue={continueGame}
        onNewGame={onNewGame}
        onWatch={onWatch}
        onBattle={onBattle}
        onAdventure={() => void onAdventure()}
        onStats={() => {
          if (requireAccount()) router.push("/pages/embrace-game/stats");
        }}
        utility={<>
          <button type="button" onClick={() => setDialog("forge")}>
            <Sparkles size={16} aria-hidden="true" /> {session ? "Cinder Forge" : "Sign in / Forge"}
          </button>
          {session && moderatorId === session.id && (
            <Link href="/pages/embrace-game/admin">Game administration</Link>
          )}
        </>}
      />

      {adventureNotice && <p role="status" className="fixed left-4 top-4 z-[200] max-w-[45vw] rounded-lg border border-amber-200/40 bg-[#1b1519] px-3 py-2 text-sm text-amber-100">{adventureNotice}</p>}
      {(dialog === "forge" || dialog === "forge-for-battle") && (
        <ForgePanel
          returnOrder={dialog === "forge" ? returnOrder : undefined}
          onClose={() => {
            setDialog(null);
            setSession(readGameSession());
          }}
          onChooseFight={dialog === "forge-for-battle" ? () => {
            const account = readGameSession();
            setSession(account);
            if (account) setDialog("battle");
          } : undefined}
          onSession={(next) => {
            setSession(next);
            localStorage.removeItem(PLAYER_STORAGE_KEY);
            localStorage.removeItem(ROOM_STORAGE_KEY);
            localStorage.removeItem(MODE_STORAGE_KEY);
          }}
        />
      )}
      {dialog === "battle" && session ? (
        <BattleLobbyModal
          username={session.username}
          onClose={() => setDialog(null)}
          onCreate={createBattleRoom}
          onJoin={joinBattleRoom}
        />
      ) : null}
    </>
  );
}
