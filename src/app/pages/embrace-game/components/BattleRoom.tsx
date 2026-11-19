"use client";

import { Check, Circle, Copy, DoorOpen, Shield, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { AudioController } from "../hooks/audioHandler";
import {
  arenaImage,
  findArena,
  preloadArena,
  preloadArenaImage,
} from "../lib/arenaAssets";
import { preloadFighterCinematics } from "../lib/combatCinematics";
import { enemyAtlasUrl, enemySpriteFor } from "../lib/enemySprites";
import { encounterSprite } from "../lib/encounterAssets";
import { ADVENTURE_TITLE, adventureBackdrop, adventureChapter } from "../lib/adventure";
import { fighterAtlasUrl, type FeaturedFighter } from "../lib/warriorSelection";
import { socket } from "../lib/websocket";
import type { GameState, Player, RoomBattleMode } from "../types/game";
import styles from "./battle-room.module.css";
import CharacterSelect, { fighterName } from "./CharacterSelect";
import EncounterPathBoard from "./EncounterPathBoard";

interface Props {
  game: GameState;
  roomCode?: string;
  mode: RoomBattleMode;
  player?: Player;
  unlocked?: readonly FeaturedFighter[];
  connected: boolean;
  error?: string;
  onLeave: () => void;
  onForge: () => void;
  onStart: () => void;
}

export default function BattleRoom({
  game,
  roomCode,
  mode,
  player,
  unlocked,
  connected,
  error,
  onLeave,
  onForge,
  onStart,
}: Props) {
  const arena = findArena(game.arenaId);
  const pvp = mode === "pvp";
  const path = game.encounterPath;
  const adventure = game.adventure;
  const adventureIntro = adventure ? adventureChapter(0) : undefined;
  const enemy = pvp
    ? undefined
    : encounterSprite(path?.levels[path.index]?.id) ?? enemySpriteFor(game.openingEnemy ?? "Echo Beast");
  const isHost = Boolean(player && game.hostPlayerId === player.id);
  const teams = Object.values(game.teams);
  const entered = teams.flatMap((team) =>
    team.players.filter((member) => member.connected),
  );
  const populated = new Set(entered.map(({ teamId }) => teamId)).size;
  const needsFighter = Boolean(arena && !player?.fighterId);
  const allReady = entered.every(
    (member) => member.ready && (!arena || member.fighterId),
  );
  const [copyStatus, setCopyStatus] = useState("");
  const [hp, setHp] = useState("");
  const [targetId, setTargetId] = useState("");
  const [loaded, setLoaded] = useState<typeof arena>();
  const pendingArt = Boolean(arena && loaded !== arena);
  const canStart =
    connected &&
    !game.paused &&
    !needsFighter &&
    !pendingArt &&
    (pvp ? populated === 2 && allReady : Boolean(player));

  useEffect(() => {
    if (enemy) void preloadArenaImage(enemyAtlasUrl(enemy));
  }, [enemy]);

  useEffect(() => {
    for (const team of Object.values(game.teams)) {
      for (const { connected, fighterId, ready } of team.players) {
        if (!connected || !fighterId) continue;
        void preloadArenaImage(fighterAtlasUrl(fighterId));
        if (ready) preloadFighterCinematics(fighterId);
      }
    }
  }, [game.teams]);

  useEffect(() => {
    if (!arena) return;
    let current = true;
    const done = () => {
      if (current) setLoaded(arena);
    };
    const timeout = window.setTimeout(done, 3500);
    void preloadArena(arena.id).then(done);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [arena]);

  async function copyCode() {
    try {
      if (!roomCode) return;
      await navigator.clipboard.writeText(roomCode);
      setCopyStatus("Room code copied.");
    } catch {
      setCopyStatus("Select and copy the room code.");
    }
  }

  const status = !connected
    ? "Reconnecting…"
    : game.paused
      ? "Room paused"
      : needsFighter
        ? "Choose your fighter"
        : pendingArt
          ? "Loading battleground…"
          : pvp && populated < 2
            ? "Waiting for a second team"
            : pvp && !allReady
              ? "Waiting for players to ready up"
              : isHost
                ? "Ready to start"
                : "Waiting for the host";

  return (
    <section className={styles.room} aria-label="Battle room">
      <header
        className={styles.hero}
        style={
          adventureIntro
            ? { backgroundImage: `linear-gradient(90deg, #0b101aee, #0b101a42 90%), url("${adventureBackdrop(adventureIntro.image)}")` }
            : arena
            ? {
                backgroundImage: `linear-gradient(90deg, #0b101aee, #0b101a42 90%), url("${arenaImage(arena.id, pendingArt)}")`,
              }
            : undefined
        }
      >
        <div>
          <p className={styles.kicker}>{adventure ? "Adventure" : pvp ? "Multiplayer" : path ? "Highlands Path" : "Vs Enemies"}</p>
          <h1>{adventure ? ADVENTURE_TITLE : arena?.name ?? "Battle room"}</h1>
          {adventureIntro && <p>Follow the ferryman’s lantern through the Highlands.</p>}
          {pvp && roomCode && (
            <div className={styles.invite}>
              <span>
                Room code <strong>{roomCode}</strong>
              </span>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy room code"
              >
                <Copy size={16} />
              </button>
              <output className={styles.copyStatus}>{copyStatus}</output>
            </div>
          )}
        </div>
        <button type="button" onClick={onLeave} className={styles.leave}>
          <DoorOpen size={16} /> Leave room
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {path && !adventure && <div className={styles.pathPreview}><EncounterPathBoard path={path} embedded /></div>}

      <div className={styles.sections}>
        <div className={styles.panel}>
          {arena && (
            <>
              <h2>Choose your fighter</h2>
              <CharacterSelect
                selected={player?.fighterId}
                unlocked={unlocked}
                disabled={!player || !connected}
                onSelect={(fighterId) => {
                  if (!player) return;
                  AudioController.playFighterSelect();
                  socket.send({
                    type: "SELECT_FIGHTER",
                    playerId: player.id,
                    fighterId,
                  });
                }}
              />
            </>
          )}
          <div className={styles.loadout}>
            <div>
              <h2>Loadout</h2>
              {player && <p>{player.maxHp.toLocaleString()} starting HP</p>}
            </div>
            <button type="button" onClick={onForge}>
              <Shield size={16} /> Edit loadout
            </button>
            {pvp && player && (
              <button
                type="button"
                aria-pressed={player.ready}
                disabled={!connected || needsFighter || pendingArt}
                onClick={() =>
                  socket.send({
                    type: "ROOM_PLAYER_READY",
                    playerId: player.id,
                    ready: !player.ready,
                  })
                }
              >
                <Check size={16} /> {player.ready ? "Ready · Undo" : "Ready up"}
              </button>
            )}
          </div>
          <footer className={styles.launch}>
            <output>{status}</output>
            {isHost && (
              <button type="button" onClick={onStart} disabled={!canStart}>
                <Swords size={19} /> {adventure ? "Start adventure" : pvp ? "Start match"
                  : path?.status === "cleared" ? "Choose difficulty" : path ? `Enter level ${path.index + 1}` : "Start encounter"}
              </button>
            )}
          </footer>
        </div>

        {pvp && (
          <aside className={styles.panel}>
            <h2>Team roster</h2>
            <div className={styles.roster}>
              {teams.map((team) => {
                const members = team.players.filter(
                  (member) => member.connected,
                );
                return (
                  <div
                    key={team.id}
                    data-house={team.id}
                    className={styles.house}
                  >
                    <h3>
                      {team.name}
                      <span>
                        {members.length}/{game.teamCap ?? 4}
                      </span>
                    </h3>
                    {members.length > 0 && (
                      <ul>
                        {members.map((member) => (
                          <li key={member.id}>
                            <div>
                              <strong>
                                {member.name}
                                {member.id === game.hostPlayerId
                                  ? " · Host"
                                  : ""}
                              </strong>
                              <span>
                                {fighterName(member.fighterId) ??
                                  (arena
                                    ? "Choosing fighter"
                                    : "Preparing loadout")}
                              </span>
                            </div>
                            <span data-ready={member.ready}>
                              {member.ready ? (
                                <Check size={14} />
                              ) : (
                                <Circle size={11} />
                              )}
                              {member.ready ? "Ready" : "Preparing"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            {isHost && player && (
              <details className={styles.settings}>
                <summary>Match settings</summary>
                <label>
                  Players per team
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={game.teamCap ?? 4}
                    disabled={!connected}
                    onChange={(event) => {
                      const teamCap = event.currentTarget.valueAsNumber;
                      if (
                        event.currentTarget.validity.valid &&
                        Number.isInteger(teamCap)
                      )
                        socket.send({
                          type: "SET_TEAM_CAP",
                          playerId: player.id,
                          teamCap,
                        });
                    }}
                  />
                </label>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    socket.send({
                      type: "SET_STARTING_HP",
                      playerId: player.id,
                      hp: Number(hp),
                      targetId: targetId || undefined,
                    });
                  }}
                >
                  <label>
                    Apply HP to
                    <select
                      value={targetId}
                      onChange={(event) => setTargetId(event.target.value)}
                    >
                      <option value="">Everyone</option>
                      {entered.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Starting HP
                    <input
                      required
                      type="number"
                      min={250}
                      max={10000}
                      value={hp}
                      onChange={(event) => setHp(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={!connected}>
                    Apply
                  </button>
                </form>
              </details>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
