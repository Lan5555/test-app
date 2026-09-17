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

export default function MenuPage() {
  const router = useRouter();
  const [battleLobbyOpen, setBattleLobbyOpen] = useState(false);

  const continueGame = async () => {
    try {
      AudioController.playInitialMusicOnLoad();
    } catch {}
    // Clear any battle-room lock so the story path runs.
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
    router.push("/pages/embrace-game/game");
  };

  const onNewGame = async () => {
    try {
      AudioController.playInitialMusicOnLoad();
    } catch {}
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
    router.push("/pages/embrace-game/game");
  };

  const onWatch = async () => {
    router.push("/pages/embrace-game/watch");
  };

  const onBattle = () => {
    setBattleLobbyOpen(true);
    AudioController.playerHoverAndClickSound();
  };

  async function createBattleRoom(
    playerName: string,
    teamId: TeamId,
    battleMode: RoomBattleMode,
  ) {
    const playerId = uuidv4();
    const player = { id: playerId, name: playerName, teamId };
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));

    socket.connect();
    socket.send({
      type: "CREATE_ROOM",
      playerId,
      playerName,
      teamId,
      battleMode,
    });

    await new Promise<void>((resolve, reject) => {
      const stop = socket.onMessage((event) => {
        if (event.type === "ROOM_CREATED") {
          stop();
          localStorage.setItem(ROOM_STORAGE_KEY, event.roomCode);
          localStorage.setItem(MODE_STORAGE_KEY, event.battleMode);
          resolve();
        }
      });
      window.setTimeout(() => {
        stop();
        reject(new Error("Room creation timed out."));
      }, 8000);
    });

    setBattleLobbyOpen(false);
    router.push("/pages/embrace-game/game");
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

    setBattleLobbyOpen(false);
    router.push("/pages/embrace-game/game");
  }

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