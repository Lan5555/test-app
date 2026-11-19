"use client";

import { ArrowRight, DoorOpen, Loader2, Shield, Swords, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AudioController } from "../hooks/audioHandler";
import {
  ARENAS,
  type ArenaId,
  arenaImage,
} from "../lib/arenaAssets";
import type { RoomBattleMode, TeamId } from "../types/game";
import roomStyles from "./battle-room.module.css";
import dialogStyles from "./game-dialog.module.css";
import styles from "./highlands-interface.module.css";

interface Props {
  username: string;
  onClose: () => void;
  onCreate: (
    playerName: string,
    teamId: TeamId,
    battleMode: RoomBattleMode,
    arenaId: ArenaId,
    startingHp?: number,
  ) => Promise<void> | void;
  onJoin: (
    roomCode: string,
    playerName: string,
    teamId: TeamId,
  ) => Promise<void> | void;
}

const HOUSES = {
  ravens: "Ravens",
  wolves: "Wolves",
  dragons: "Dragons",
  serpents: "Serpents",
} satisfies Record<TeamId, string>;
const MODES = [
  {
    id: "pvp",
    label: "Team clash",
    detail: "Host a match for two teams.",
    icon: Swords,
  },
  {
    id: "cpu",
    label: "Highlands Path",
    detail: "Fight through six levels to reach the final boss.",
    icon: Shield,
  },
] as const;

export default function BattleLobbyModal({
  username,
  onClose,
  onCreate,
  onJoin,
}: Props) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [mode, setMode] = useState<RoomBattleMode>("pvp");
  const [arenaId, setArenaId] = useState<ArenaId>(ARENAS[0].id);
  const [hp, setHp] = useState("2000");
  const [roomCode, setRoomCode] = useState("");
  const [teamId, setTeamId] = useState<TeamId>("ravens");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const arena = ARENAS.find(({ id }) => id === arenaId) ?? ARENAS[0];
  const arenaPreview = `url("${arenaImage(arena.id, true)}")`;
  const arenaBackdrop = tab === "create"
    ? `url("${arenaImage(arena.id)}"), ${arenaPreview}`
    : arenaPreview;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (tab === "join") {
        await onJoin(roomCode.trim().toUpperCase(), username, teamId);
      } else {
        await onCreate(
          username,
          teamId,
          mode,
          arenaId,
          mode === "pvp" ? Number(hp) : undefined,
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not open the room.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="battle-lobby-title"
      className={`${dialogStyles.surface} ${dialogStyles.menuGlass} ${styles.battleDialog}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onPointerDown={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const { left, right, top, bottom } =
          event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < left ||
          event.clientX > right ||
          event.clientY < top ||
          event.clientY > bottom
        )
          onClose();
      }}
    >
      <div className={styles.battleLayout}>
        <div
          className={styles.battleBackdrop}
          style={{ backgroundImage: arenaBackdrop }}
        >
          <div className={styles.battleTitle}>
            <p>Battle</p>
            <h2 id="battle-lobby-title">Choose your fight</h2>
            {tab === "create" && <span>{arena.name}</span>}
          </div>
        </div>
        <button
          type="button"
          className={`${styles.battleClose} ${dialogStyles.modalClose}`}
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
        >
          <X size={19} />
        </button>
        <form className={styles.battleForm} onSubmit={submit}>
          <div className={styles.battleTabs}>
            {(["create", "join"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={tab === value}
                onClick={() => {
                  setTab(value);
                  setError("");
                  AudioController.playerHoverAndClickSound();
                }}
              >
                {value === "create" ? (
                  <Swords size={16} />
                ) : (
                  <DoorOpen size={16} />
                )}
                {value === "create" ? "Create Room" : "Join Room"}
              </button>
            ))}
          </div>
          {tab === "create" ? (
            <>
              <fieldset className={styles.modePicker} disabled={busy}>
                <legend>Battle type</legend>
                <div>
                  {MODES.map(({ id, label, detail, icon: Icon }) => (
                    <label key={id}>
                      <input
                        type="radio"
                        name="mode"
                        checked={id === mode}
                        onChange={() => {
                          setMode(id);
                          AudioController.playFighterSelect();
                        }}
                      />
                      <Icon size={19} />
                      <strong>{label}</strong>
                      <span>{detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={roomStyles.arenaPicker} disabled={busy}>
                <legend>{mode === "cpu" ? "Opening arena" : "Select background"}</legend>
                <div className={roomStyles.arenaOptions} role="region" aria-label="Background previews" tabIndex={0}>
                  {ARENAS.map((option) => (
                    <label key={option.id} className={roomStyles.arenaOption}>
                      <input
                        type="radio"
                        name="host-arena"
                        value={option.id}
                        checked={option.id === arenaId}
                        onChange={() => {
                          setArenaId(option.id);
                          AudioController.playFighterSelect();
                        }}
                      />
                      <img
                        src={arenaImage(option.id, true)}
                        alt=""
                        width={360}
                        height={203}
                      />
                      <span>{option.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <label className={styles.battleField}>
              Room code
              <input
                value={roomCode}
                placeholder="ABC123"
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                required
                minLength={4}
                maxLength={14}
                pattern="[A-Z0-9]{4,14}"
                disabled={busy}
              />
            </label>
          )}
          <div className={styles.roomFields}>
            <label className={styles.battleField}>
              House
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value as TeamId)}
                disabled={busy}
              >
                {Object.entries(HOUSES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {tab === "create" && mode === "pvp" && (
              <label className={styles.battleField}>
                Starting HP
                <input
                  type="number"
                  min={250}
                  max={10000}
                  step={1}
                  required
                  value={hp}
                  onChange={(event) => setHp(event.target.value)}
                  disabled={busy}
                />
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className={styles.battleError}>
              {error}
            </p>
          )}
          <button className={styles.battleSubmit} type="submit" disabled={busy}>
            {busy
              ? "Connecting…"
              : tab === "join"
                ? "Enter Room"
                : mode === "pvp"
                  ? "Create PvP Room"
                  : "Create Enemy Room"}
            {busy ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
          <p className={styles.playerName}>Playing as {username}</p>
        </form>
      </div>
    </dialog>
  );
}
