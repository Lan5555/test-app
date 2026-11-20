"use client";

import { ArrowLeft, ArrowRight, Flag, Shield, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { BattleResult } from "../hooks/useBattleResults";
import type { TeamId } from "../types/game";
import styles from "./encounter-screen.module.css";
import dialogStyles from "./game-dialog.module.css";

export function LeaveBattleDialog({
  onCancel,
  onLeave,
}: {
  onCancel: () => void;
  onLeave: () => void;
}) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={title}
      className={`${dialogStyles.surface} ${dialogStyles.chrome} ${dialogStyles.compact}`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className={dialogStyles.body}>
        <h2 id={title} className="text-xl font-black">
          Leave this room?
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Your teammates will continue without you.
        </p>
        <footer className={dialogStyles.dialogActions}>
          <button
            type="button"
            className={dialogStyles.quiet}
            onClick={onCancel}
          >
            Stay
          </button>
          <button
            type="button"
            className={dialogStyles.danger}
            onClick={onLeave}
          >
            Leave room
          </button>
        </footer>
      </div>
    </dialog>
  );
}

export function EncounterLoading({
  title = "Entering the Highlands",
  detail = "Loading the game.",
  onBack,
  failed = false,
}: {
  title?: string;
  detail?: string;
  onBack?: () => void;
  failed?: boolean;
}) {
  return (
    <section className={styles.loading} aria-label={title}>
      <div className={styles.loadingContent}>
        <span
          className={styles.seal}
          data-loading={!failed || undefined}
          aria-hidden="true"
        >
          <Swords size={32} />
        </span>
        <div>
          <h1>{title}</h1>
          <output>{detail}</output>
        </div>
        {onBack ? (
          <button type="button" className={styles.secondary} onClick={onBack}>
            <ArrowLeft size={16} /> Back to Highlands
          </button>
        ) : (
          <Link className={styles.secondary} href="/pages/embrace-game">
            <ArrowLeft size={16} /> Back to Highlands
          </Link>
        )}
      </div>
    </section>
  );
}

export function EncounterResult({
  result: { battle, teams },
  viewerTeam,
  viewerId,
  continueLabel,
  onContinue,
  onExit,
  confirmExit,
}: {
  result: BattleResult;
  viewerTeam?: TeamId;
  viewerId?: string;
  continueLabel: string;
  onContinue: () => void;
  onExit?: () => void;
  confirmExit?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const attacker = teams[battle.attackerTeamId];
  const defenderId = battle.mode === "team" ? battle.defenderTeamId : undefined;
  const defender = defenderId ? teams[defenderId] : undefined;
  const draw =
    battle.mode === "team" && battle.log.includes("Both sides have fallen.");
  const winnerId = draw
    ? undefined
    : battle.status === "victory"
      ? battle.attackerTeamId
      : defenderId;
  const won = viewerTeam !== undefined && viewerTeam === winnerId;
  const involved =
    viewerTeam !== undefined &&
    (viewerTeam === battle.attackerTeamId || viewerTeam === defenderId);
  const victory = Boolean(winnerId && (!involved || won));
  const title = draw
    ? "Draw"
    : involved
      ? won
        ? "Victory"
        : "Defeat"
      : winnerId
        ? `${teams[winnerId]?.name ?? winnerId} wins`
        : "Defeat";
  const match = `${attacker?.name ?? battle.attackerTeamId} vs ${battle.mode === "cpu" ? battle.enemyName : (defender?.name ?? battle.defenderTeamId)}`;
  const sides = [attacker, defender].filter((team) => team !== undefined);
  const reward = viewerId ? battle.rewards?.earned[viewerId] : undefined;
  const tierReward = viewerId && battle.rewards?.tierPlayerId === viewerId ? battle.rewards?.tier : undefined;
  const rewardUnavailable = viewerId && battle.rewards?.unavailable?.includes(viewerId);

  return (
    <dialog
      ref={dialog}
      className={`${dialogStyles.surface} ${dialogStyles.chrome} ${dialogStyles.resultWidth} ${styles.result}`}
      aria-labelledby={titleId}
      data-encounter={battle.mode === "cpu" ? "enemy" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (leaving) setLeaving(false);
        else onContinue();
      }}
    >
      <div
        className={styles.resultContent}
        data-outcome={draw ? "draw" : victory ? "victory" : "defeat"}
      >
        <header className={styles.resultHeader}>
          <span className={styles.seal} aria-hidden="true">
            {victory ? <Flag size={25} /> : <Shield size={25} />}
          </span>
          <div>
            <p>{match}</p>
            <h1 id={titleId}>{title}</h1>
          </div>
        </header>
        <div className={styles.standings}>
          {sides.map((team) => {
            const standing = team.players.filter(
              ({ hp, status }) => hp > 0 && status === "alive",
            ).length;
            return (
              <section key={team.id}>
                <h2>{team.name}</h2>
                <p>
                  {standing} / {team.players.length} standing
                </p>
              </section>
            );
          })}
          {battle.mode === "cpu" && (
            <section>
              <h2>{battle.enemyName}</h2>
              <p>
                {battle.enemyHp} / {battle.enemyMaxHp} HP
              </p>
            </section>
          )}
        </div>
        {viewerId && involved && <section className={styles.rewardRecap} aria-live="polite">
          <h2>Rewards earned</h2>
          {reward && <p>Battle participation: +{reward.xp} XP ? +{reward.cinders} Cinders</p>}
          {tierReward && <p>Tier clear: +{tierReward.xp} XP ? +{tierReward.cinders} Cinders</p>}
          {(tierReward?.level ?? reward?.level) !== undefined && <p>Current level: {tierReward?.level ?? reward?.level}</p>}
          {rewardUnavailable && <p>Some rewards could not be confirmed.</p>}
          {!reward && !tierReward && !rewardUnavailable && <p>{battle.rewards ? "No rewards awarded." : "No confirmed rewards yet."}</p>}
        </section>}
        {battle.log.length > 0 && (
          <details className={styles.recap}>
            <summary>Battle recap</summary>
            <ol>
              {battle.log.slice(-12).map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ol>
          </details>
        )}
        <footer className={styles.actions}>
          {leaving ? (
            <>
              <p>Leave this room?</p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setLeaving(false)}
              >
                Stay
              </button>
              <button type="button" className={styles.primary} onClick={onExit}>
                Leave room <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              {onExit && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => (confirmExit ? setLeaving(true) : onExit())}
                >
                  <ArrowLeft size={16} /> Back to Highlands
                </button>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={onContinue}
              >
                {continueLabel} <ArrowRight size={16} />
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
