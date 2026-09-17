"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import BattleLobbyModal from "./components/battleLobbyModal";
import { AudioController } from "./hooks/audioHandler";
import { socket } from "./lib/websocket";
import MainMenu from "./menu/page";
import { RoomBattleMode, TeamId } from "./types/game";

export const PLAYER_STORAGE_KEY = "embrace-game-player";
export const ROOM_STORAGE_KEY = "embrace-game-room";
export const MODE_STORAGE_KEY = "embrace-game-mode";

const GAME_ROUTE = "/pages/embrace-game/game";
const WATCH_ROUTE = "/pages/embrace-game/watch";

export default function MenuPage() {
  const router = useRouter();
  const [battleLobbyOpen, setBattleLobbyOpen] = useState(false);

  /* ---------------------------------------------------------------- */
  /* Story paths                                                       */
  /* ---------------------------------------------------------------- */

  const continueGame = async () => {
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
    setBattleLobbyOpen(true);
    AudioController.playerHoverAndClickSound();
  };

  /* ---------------------------------------------------------------- */
  /* Battle lobby                                                      */
  /* ---------------------------------------------------------------- */

  function ensureSocketConnected() {
    try {
      socket.connect();
    } catch {
      /* already connected */
    }
  }

  async function createBattleRoom(
    playerName: string,
    teamId: TeamId,
    battleMode: RoomBattleMode,
  ) {
    const playerId = uuidv4();
    const player = { id: playerId, name: playerName, teamId };

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    localStorage.setItem(MODE_STORAGE_KEY, battleMode);

    ensureSocketConnected();

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

    setBattleLobbyOpen(false);
    router.push(GAME_ROUTE);
  }

  async function joinBattleRoom(
    roomCode: string,
    playerName: string,
    teamId: TeamId,
  ) {
    const playerId = uuidv4();
    const player = { id: playerId, name: playerName, teamId };

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
    localStorage.setItem(MODE_STORAGE_KEY, "pvp");

    ensureSocketConnected();

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
        // Not fatal — Game.tsx will retry JOIN_GAME on mount.
        stop();
        resolve();
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

    setBattleLobbyOpen(false);
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
      />

      {battleLobbyOpen ? (
        <BattleLobbyModal
          onClose={() => setBattleLobbyOpen(false)}
          onCreate={createBattleRoom}
          onJoin={joinBattleRoom}
        />
      ) : null}
    </>
  );
}