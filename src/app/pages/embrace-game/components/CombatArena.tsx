"use client";

import {
  ArrowLeft,
  Crosshair,
  HeartPulse,
  List,
  LogOut,
  Maximize,
  Minimize,
  Mic,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useCombatPresentation } from "../hooks/useCombatPresentation";
import { encounterPortrait } from "../lib/encounterAssets";
import { AudioController } from "../hooks/audioHandler";
import { type ArenaId, FINAL_BOSS_MUSIC, battleBackdrop, findArena, isNicholasFinalForm, preloadArena } from "../lib/arenaAssets";
import type {
  Battle,
  BattleItemId,
  CombatAction,
  CombatVariant,
  Player,
  Team,
  TeamId,
} from "../types/game";
import CombatStage from "./CombatStage";
import CombatStatuses, { statusSummary } from "./CombatStatuses";
import styles from "./combat-hud.module.css";
import dialogStyles from "./game-dialog.module.css";

interface Props {
  battle: Battle;
  arenaId?: ArenaId;
  player?: Player;
  teams: Record<TeamId, Team>;
  itemCount?: number;
  paused?: boolean;
  onAction?: (
    action: CombatAction,
    variant?: CombatVariant,
    targetId?: string,
  ) => void;
  onLeave?: () => void;
  notice?: string;
  connected?: boolean;
  enemyThinking?: boolean;
  waitingOn?: readonly string[];
  expectedActors?: number;
  roundTimerMs?: number;
  hasQueued?: boolean;
  spectator?: boolean;
  onLimitPresentationChange?: (active: boolean) => void;
}

const EMPTY_PLAYERS: readonly Player[] = [];
const EMPTY_WAITING: readonly string[] = [];
const COMMANDS = [
  { id: "attack", label: "Attack", icon: Swords },
  { id: "skill", label: "Skill", icon: Sparkles },
  { id: "heal", label: "Heal", icon: HeartPulse },
  { id: "block", label: "Block", icon: Shield },
  { id: "dodge", label: "Dodge", icon: Wind },
  { id: "item", label: "Item", icon: HeartPulse },
  { id: "limit", label: "Limit Break", icon: Zap },
] as const;

const HEAL_EFFECTS = {
  guarded: "Grants Guarded.",
  blessed: "Grants Blessed.",
  evading: "Grants Evading.",
  cleanse: "Removes poison, burn, and curse.",
};

const BATTLE_ITEMS = {
  bloodleaf_tonic: { name: "Bloodleaf Tonic", detail: "Restore 320 HP to a living ally or yourself." },
  ward_stone: { name: "Ward Stone", detail: "Guard yourself and gain 25 Focus." },
} satisfies Record<BattleItemId, { name: string; detail: string }>;

function Meter({
  value,
  max,
  label,
  health = false,
}: {
  value: number;
  max: number;
  label: string;
  health?: boolean;
}) {
  return (
    <progress
      className={styles.meter}
      data-health={health || undefined}
      aria-label={label}
      max={Math.max(1, max)}
      value={Math.max(0, Math.min(value, max))}
    />
  );
}

function Roster({
  name,
  members,
  side,
  localId,
  selectedId,
  waiting,
  queued,
  activeId,
  onSelect,
}: {
  name: string;
  members: readonly Player[];
  side: "ally" | "enemy";
  localId?: string;
  selectedId?: string;
  waiting: ReadonlySet<string>;
  queued: ReadonlySet<string>;
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <section
      className={styles.roster}
      data-side={side}
      aria-label={`${name} roster`}
    >
      <h2 title={name}>{name}</h2>
      {members.length > 0 ? (
        <ul
          className={styles.members}
          tabIndex={members.length > 4 ? 0 : undefined}
        >
          {members.map((member) => {
            const down = member.status !== "alive";
            const broken = member.statusEffects?.some(
              ({ id }) => id === "immobilized",
            );
            const state = down
              ? "Down"
              : broken
                ? "Broken"
                : queued.has(member.id)
                  ? "Queued"
                  : waiting.has(member.id)
                    ? "Choosing"
                    : member.id === activeId
                      ? "Acting"
                      : !member.connected
                        ? "Offline"
                        : null;
            const selected = member.id === selectedId;
            const effects = down ? undefined : member.statusEffects;
            const effectSummary = statusSummary(effects);
            const contents = (
              <>
                <span className={styles.memberLine}>
                  <span title={member.name}>
                    {member.name}
                    {member.id === localId ? " (you)" : ""}
                  </span>
                  <small title={state ?? "Health"}>
                    {state ?? `${member.hp} HP`}
                  </small>
                </span>
                <Meter
                  max={member.maxHp}
                  value={member.hp}
                  label={`${member.name} health`}
                  health
                />
                <CombatStatuses effects={effects} />
              </>
            );
            return (
              <li key={member.id} data-down={down || undefined}>
                {onSelect ? (
                  <button
                    type="button"
                    disabled={down}
                    aria-pressed={selected}
                    aria-label={
                      (side === "enemy"
                        ? "Attack target: "
                        : "Support target: ") +
                      member.name +
                      (state ? `, ${state}` : "") +
                      (effectSummary ? `, ${effectSummary}` : "")
                    }
                    onClick={() => onSelect(member.id)}
                  >
                    {contents}
                  </button>
                ) : (
                  <div className={styles.memberSummary}>{contents}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyRoster}>No combatants connected</p>
      )}
    </section>
  );
}

function BattleLog({
  entries,
  onClose,
}: {
  entries: string[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`${dialogStyles.surface} ${dialogStyles.chrome} ${dialogStyles.logWidth} ${styles.log}`}
      aria-labelledby="battle-log-title"
      onClose={onClose}
    >
      <header>
        <h2 id="battle-log-title">Battle log</h2>
        <form method="dialog">
          <button type="submit" aria-label="Close battle log">
            <X size={18} />
          </button>
        </form>
      </header>
      <ol ref={list}>
        {entries.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ol>
      {entries.length === 0 && <p>The round hasn’t started yet.</p>}
    </dialog>
  );
}

function HudIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export default function CombatArena({
  battle,
  arenaId,
  player,
  teams,
  itemCount = 0,
  paused = false,
  connected = true,
  enemyThinking = false,
  waitingOn = EMPTY_WAITING,
  expectedActors = 0,
  roundTimerMs = 0,
  hasQueued = false,
  spectator = false,
  onLimitPresentationChange,
  onAction,
  onLeave,
  notice,
}: Props) {
  const [commandMenu, setCommandMenu] = useState<"skill" | "heal" | "item">();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsId = useId();
  const [limitCinematicLayer, setLimitCinematicLayer] = useState<HTMLDivElement | null>(null);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const actionsClose = useRef<HTMLButtonElement>(null);
  const submenuBack = useRef<HTMLButtonElement>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [attackId, setAttackId] = useState<string>();
  const [supportId, setSupportId] = useState<string>();

  const cpu = battle.mode === "cpu" ? battle : null;
  const enemyPortrait = cpu?.encounterId ? encounterPortrait(cpu.encounterId) : undefined;
  const signatureComing = cpu?.status === "active" && (cpu.enemyUnits ?? [cpu]).some((enemy) =>
    enemy.encounterId && enemy.enemyHp > 0 && enemy.signatureEveryNRounds &&
    cpu.round % enemy.signatureEveryNRounds === 0);
  const defending =
    battle.mode === "team" && player?.teamId === battle.defenderTeamId;
  const allyId = defending ? battle.defenderTeamId : battle.attackerTeamId;
  const opponentId = defending ? battle.attackerTeamId : battle.defenderTeamId;
  const allyName = teams[allyId]?.name ?? allyId;
  const opponentName = cpu?.enemyName ?? teams[opponentId]?.name ?? opponentId;
  const allies = teams[allyId]?.players ?? EMPTY_PLAYERS;
  const opponents = cpu
    ? EMPTY_PLAYERS
    : (teams[opponentId]?.players ?? EMPTY_PLAYERS);
  const arena = findArena(arenaId);
  const backdrop = battleBackdrop(battle, arenaId);
  const finalBoss = isNicholasFinalForm(battle);
  useEffect(() => {
    if (backdrop) void preloadArena(backdrop, finalBoss ? FINAL_BOSS_MUSIC : undefined);
  }, [backdrop, finalBoss]);
  const { impacts, attacks, pendingKnockbacks, limitActive } = useCombatPresentation(
    battle,
    allies,
    opponents,
    Boolean(arena),
    !spectator || !paused,
  );
  useEffect(() => {
    onLimitPresentationChange?.(limitActive);
  }, [limitActive, onLimitPresentationChange]);
  useEffect(() => () => onLimitPresentationChange?.(false), [onLimitPresentationChange]);

  const livingAllies = allies.filter(({ status }) => status === "alive");
  const livingOpponents = cpu?.enemyUnits
    ? cpu.enemyUnits.filter(({ enemyHp }) => enemyHp > 0).map(({ id, enemyName }) => ({ id, name: enemyName }))
    : opponents.filter(({ status }) => status === "alive");
  const attackTarget =
    livingOpponents.find(({ id }) => id === attackId) ?? livingOpponents[0];
  const supportTarget =
    livingAllies.find(({ id }) => id === supportId) ??
    livingAllies.find(({ id }) => id === player?.id) ??
    livingAllies[0];
  const waiting = new Set(waitingOn);
  const queued = new Set(battle.readyPlayerIds ?? []);
  const actingTeamId = cpu ? battle.attackerTeamId : battle.turnTeamId;
  if (hasQueued && player?.teamId === actingTeamId) queued.add(player.id);
  const viewing = spectator || !player;
  const lockedIn = player ? queued.has(player.id) : false;
  const immobilized =
    player?.statusEffects?.some(({ id }) => id === "immobilized") ?? false;
  const active = battle.status === "active";
  const turnName = teams[actingTeamId]?.name ?? actingTeamId;
  const canAct =
    !viewing &&
    connected &&
    active &&
    !paused &&
    !enemyThinking &&
    !lockedIn &&
    !immobilized &&
    player.status === "alive" &&
    actingTeamId === player.teamId &&
    (waiting.size === 0 || waiting.has(player.id));
  const roundLabel = !active
    ? battle.status === "victory"
      ? "Victory"
      : "Defeat"
    : !connected
      ? "Connection interrupted"
      : paused
        ? "Room paused"
        : enemyThinking
          ? "Enemy turn"
          : viewing
            ? `${turnName} turn`
            : lockedIn
              ? "Action queued"
              : immobilized
                ? "Immobilized"
                : canAct
                  ? "Choose an action"
                  : `${turnName} turn`;
  const seconds = Math.ceil(roundTimerMs / 1000);
  const skillCharges = player?.skillCharges ?? 0;
  const healCharges = player?.healCharges ?? 0;
  const focus = player?.focus ?? 0;
  const skills = player?.combatKit?.skills ?? [];
  const heal = player?.combatKit?.heal;
  const heals = player?.combatKit?.heals ?? [];
  const healTarget = heal?.target === "self" ? player : supportTarget;
  const starterItems = (Object.keys(BATTLE_ITEMS) as BattleItemId[]).map((id) => ({
    ...BATTLE_ITEMS[id],
    id,
    starter: player?.battleItems?.[id] ?? 0,
    inventory: id === player?.loadout?.item ? itemCount : 0,
  }));
  const equipped = player?.loadout?.equippedItem;
  const equippedId = player?.loadout?.item;
  const items = equipped && equippedId && !Object.hasOwn(BATTLE_ITEMS, equippedId)
    ? [...starterItems, { id: equippedId, name: equipped.name, detail: equipped.description, starter: 0, inventory: itemCount }]
    : starterItems;
  const availableItems = items.reduce((total, { starter, inventory }) => total + starter + inventory, 0);
  const limitReady = active && player?.status === "alive" && focus >= 100;
  const drawerOpen = canAct && actionsOpen;

  useEffect(() => {
    if (!canAct) setActionsOpen(false);
  }, [canAct]);

  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = actionsTrigger.current;
    const closeButton = actionsClose.current;
    closeButton?.focus();

    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setActionsOpen(false);
      trigger?.focus();
    }

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      if (closeButton?.closest("section")?.contains(document.activeElement)) {
        trigger?.focus();
      }
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen && commandMenu) submenuBack.current?.focus();
  }, [drawerOpen, commandMenu]);

  useEffect(() => {
    const root = document.documentElement;
    const oldOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    function updateFullscreen() {
      setFullscreen(Boolean(document.fullscreenElement));
      setFullscreenAvailable(document.fullscreenEnabled);
    }

    updateFullscreen();
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      root.style.overflow = oldOverflow;
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // The viewport remains filled if the browser denies fullscreen.
    }
  }

  function commandAvailable(action: CombatAction) {
    if (!canAct) return false;
    if (action === "heal") return healCharges > 0 && Boolean(healTarget);
    if (action === "item") return availableItems > 0 && Boolean(supportTarget);
    if (action === "skill" && skillCharges === 0) return false;
    if (action === "limit" && focus < 100) return false;
    if (action === "attack" || action === "skill" || action === "limit")
      return cpu ? cpu.enemyHp > 0 : Boolean(attackTarget);
    return true;
  }

  function queue(action: CombatAction, variant?: CombatVariant) {
    if (!commandAvailable(action)) return;
    const chosenHeal = heals.find(({ id }) => id === variant);
    const target =
      action === "heal"
        ? (chosenHeal ? (chosenHeal.target === "self" ? player : supportTarget) : healTarget)?.id
        : action === "item"
          ? (variant === "ward_stone" || (variant === equippedId && equipped?.effect === "guard") ? player : supportTarget)?.id
          : action === "attack" || action === "skill" || action === "limit"
            ? attackTarget?.id
            : undefined;
    setActionsOpen(false);
    actionsTrigger.current?.focus();
    onAction?.(action, variant, target);
  }

  return (
    <section
      className={styles.arena}
      data-encounter={cpu ? "enemy" : undefined}
      data-limit-ready={!viewing && limitReady ? true : undefined}
      aria-label="Combat arena"
    >
      <CombatStage
        limitCinematicLayer={limitCinematicLayer}
        backdrop={backdrop}
        usePersonalWarrior={!arena}
        allies={allies}
        opponents={opponents}
        defending={defending}
        cpu={cpu ?? undefined}
        localId={player?.id}
        activeId={battle.activePlayerId}
        alliedTargetId={drawerOpen && commandMenu !== "skill" ? supportTarget?.id : undefined}
        enemyTargetId={viewing ? undefined : attackTarget?.id}
        impacts={impacts}
        attacks={attacks}
        pendingKnockbacks={pendingKnockbacks}
      />

      <div className={styles.hud}>
        <header className={styles.top}>
          <p className={styles.mode}>
            {viewing ? "Spectating" : cpu ? "Encounter" : "Team battle"}
          </p>
          <div className={styles.round}>
            <strong aria-live="polite">{roundLabel}</strong>
            {active && expectedActors > 0 && (
              <span>
                {Math.max(0, expectedActors - waiting.size)}/{expectedActors}{" "}
                queued
              </span>
            )}
            {active && !paused && roundTimerMs > 0 && (
              <span
                className={styles.timer}
                data-urgent={seconds <= 5 || undefined}
                role="timer"
                aria-label={`${seconds} seconds remaining`}
              >
                <Timer size={14} aria-hidden="true" /> {seconds}s
              </span>
            )}
          </div>
          <nav className={styles.tools} aria-label="Battle tools">
            <HudIcon
              label="Battle log"
              onClick={() => {
                setActionsOpen(false);
                setLogOpen(true);
              }}
            >
              <List size={18} />
            </HudIcon>
            {fullscreenAvailable && (
              <HudIcon
                label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </HudIcon>
            )}
            {onLeave && (
              <HudIcon
                label={viewing ? "Stop watching" : "Leave room"}
                onClick={onLeave}
              >
                <LogOut size={17} />
              </HudIcon>
            )}
          </nav>
        </header>

        <div className={styles.rosters}>
          <Roster
            name={allyName}
            members={allies}
            side="ally"
            localId={player?.id}
            selectedId={viewing ? undefined : supportTarget?.id}
            waiting={waiting}
            queued={queued}
            activeId={battle.activePlayerId}
            onSelect={viewing ? undefined : setSupportId}
          />
          {cpu?.enemyUnits ? (
            <section className={styles.roster} data-side="enemy" aria-label="Enemy party">
              <h2>Enemy party</h2>
              <div className={styles.enemyParty}>
                {cpu.enemyUnits.map((enemy) => {
                  const selected = !viewing && attackTarget?.id === enemy.id;
                  const portrait = enemy.encounterId && encounterPortrait(enemy.encounterId);
                  return <button key={enemy.id} type="button" className={styles.enemyTarget}
                    disabled={viewing || enemy.enemyHp <= 0}
                    aria-pressed={selected}
                    aria-label={`Target ${enemy.enemyName}, ${enemy.enemyHp} of ${enemy.enemyMaxHp} HP`}
                    onClick={() => setAttackId(enemy.id)}>
                    {portrait && <img src={portrait} alt="" width={32} height={32} />}
                    <span>
                      <strong>{enemy.enemyName}</strong>
                      <Meter value={enemy.enemyHp} max={enemy.enemyMaxHp} label={`${enemy.enemyName} health`} health />
                    </span>
                  </button>;
                })}
              </div>
              {signatureComing && <p className={styles.signatureWarning} role="status">Signature attack incoming</p>}
            </section>
          ) : cpu ? (
            <section
              className={styles.roster}
              data-side="enemy"
              data-boss
              aria-label="Enemy vitals"
            >
              <div className={styles.enemyHeading}>
                {enemyPortrait && <img src={enemyPortrait} alt="" width={40} height={40} />}
                <h2 title={opponentName}>{opponentName}</h2>
              </div>
              <p className={styles.bossHp}>
                {cpu.enemyHp} / {cpu.enemyMaxHp} HP
              </p>
              <Meter
                value={cpu.enemyHp}
                max={cpu.enemyMaxHp}
                label={`${opponentName} health`}
                health
              />
              <CombatStatuses effects={cpu.enemyStatusEffects} />
              {signatureComing ? <p className={styles.signatureWarning} role="status">Signature attack incoming</p> : null}
            </section>
          ) : (
            <Roster
              name={opponentName}
              members={opponents}
              side="enemy"
              selectedId={viewing ? undefined : attackTarget?.id}
              waiting={waiting}
              queued={queued}
              activeId={battle.activePlayerId}
              onSelect={viewing ? undefined : setAttackId}
            />
          )}
        </div>

        <footer className={styles.bottom}>
          {notice ? (
            <p className={styles.notice} role="alert">
              {notice}
            </p>
          ) : (
            <p className={styles.ticker} title={battle.log.at(-1)}>
              {battle.log.at(-1)}
            </p>
          )}
          {!viewing && (
            <div className={styles.docks}>
              <div className={styles.actionRail}>
                <span className="sr-only" role="status">{limitReady ? "Limit Break ready" : ""}</span>
                {limitReady && (
                  <button type="button" className={styles.limitReady}
                    disabled={!commandAvailable("limit")} onClick={() => queue("limit")}>
                    <Zap size={17} aria-hidden="true" /> Limit Break ready
                  </button>
                )}
                <button
                  ref={actionsTrigger}
                  type="button"
                  className={styles.actionsTrigger}
                  aria-controls={actionsId}
                  aria-expanded={drawerOpen}
                  aria-disabled={!canAct}
                  onClick={() => {
                    if (!canAct) return;
                    if (!drawerOpen) setCommandMenu(undefined);
                    setActionsOpen(!drawerOpen);
                  }}
                >
                  <Swords size={17} aria-hidden="true" />
                  Actions
                </button>
              </div>
              <section
                id={actionsId}
                className={styles.actionDrawer}
                data-open={drawerOpen}
                inert={!drawerOpen}
                aria-label="Combat commands"
              >
                <div className={styles.drawerHeader}>
                  <h2>Actions</h2>
                  <button
                    ref={actionsClose}
                    type="button"
                    aria-label="Close actions"
                    onClick={() => {
                      setActionsOpen(false);
                      actionsTrigger.current?.focus();
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                {commandMenu ? (
                  <>
                    <div className={styles.dockHeader}>
                      <button
                        ref={submenuBack}
                        type="button"
                        className={styles.back}
                        onClick={() => {
                          setCommandMenu(undefined);
                          actionsClose.current?.focus();
                        }}
                      >
                        <ArrowLeft size={15} aria-hidden="true" /> Commands
                      </button>
                      <span>
                        {commandMenu === "skill" ? attackTarget?.name ?? cpu?.enemyName : supportTarget?.name}
                      </span>
                    </div>
                    <div className={styles.skillChoices}>
                      {commandMenu === "skill" && skills.map((skill) => (
                        <button
                          type="button"
                          key={skill.id}
                          disabled={!commandAvailable("skill") || (skill.summon && Boolean(player.companion))}
                          onClick={() => queue("skill", skill.id)}
                        >
                          <strong>{skill.name}</strong>
                          <span>{skill.summon && player.companion ? "Already used this battle." : skill.description}</span>
                        </button>
                      ))}
                      {commandMenu === "heal" && heals.map((option) => (
                        <button key={option.id} type="button" disabled={!commandAvailable("heal")} onClick={() => queue("heal", option.id)}>
                          <strong>{option.name}</strong>
                          <span>
                            Restore {option.amount + (player.loadout?.job === "warden" ? 90 : 0)} HP to {option.target === "self" || supportTarget?.id === player.id ? "yourself" : supportTarget?.name ?? "a living ally"}.
                            {option.effect && ` ${HEAL_EFFECTS[option.effect]}`}
                          </span>
                        </button>
                      ))}
                      {commandMenu === "item" && items.map((item) => (
                        <button key={item.id} type="button" disabled={!commandAvailable("item") || item.starter + item.inventory === 0} onClick={() => queue("item", item.id)}>
                          <strong>{item.name}</strong>
                          <span>{item.detail}</span>
                          <span>{item.starter} battle supplies{item.inventory > 0 && ` · ${item.inventory} equipped from inventory`}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.dockHeader}>
                      <span title="Attack target">
                        <Crosshair size={14} aria-hidden="true" />{" "}
                        {attackTarget?.name ??
                          cpu?.enemyName ??
                          "No enemy target"}
                      </span>
                      {supportTarget && (
                        <span title="Heal and item target">
                          <HeartPulse size={14} aria-hidden="true" />{" "}
                          {supportTarget.name}
                        </span>
                      )}
                    </div>
                    <div className={styles.commands}>
                      {COMMANDS.map(({ id, label: commandLabel, icon: Icon }) => {
                        const label = id === "heal" && !heals.length ? heal?.name ?? "Recovery" : commandLabel;
                        const count =
                          id === "skill"
                            ? skillCharges
                            : id === "heal"
                              ? healCharges
                              : id === "item"
                                ? availableItems
                                : undefined;
                        return (
                          <button
                            key={id}
                            type="button"
                            data-limit-ready={id === "limit" && limitReady ? true : undefined}
                            disabled={!commandAvailable(id)}
                            aria-label={
                              count === undefined
                                ? label
                                : `${label}, ${count} remaining`
                            }
                            title={label}
                            onClick={() =>
                              (id === "skill" && skills.length > 0) ||
                              (id === "heal" && heals.length > 0) ||
                              (id === "item" && player.battleItems)
                                ? setCommandMenu(id)
                                : queue(id)
                            }
                          >
                            <Icon size={16} aria-hidden="true" />
                            <span>{label}</span>
                            {count !== undefined && (
                              <small aria-hidden="true">{count}</small>
                            )}
                          </button>
                        );
                      })}
                      {player.fighterId && (
                        <button type="button" title="Play your fighter’s taunt" onClick={() => {
                          if (player.fighterId) void AudioController.playFighterVoice(player.fighterId, "taunt");
                        }}>
                          <Mic size={16} aria-hidden="true" />
                          <span>Taunt</span>
                        </button>
                      )}
                    </div>
                    {!heals.length && heal && healCharges > 0 && (
                      <p className={styles.healDetail}>
                        {heal.name} restores {heal.amount + (player.loadout?.job === "warden" ? 90 : 0)} HP to {healTarget?.id === player.id ? "you" : healTarget?.name ?? "a living ally"}.
                        {heal.effect && ` ${HEAL_EFFECTS[heal.effect]}`}
                      </p>
                    )}
                  </>
                )}
              </section>
              <section
                className={styles.vitals}
                aria-label="Your combat status"
              >
                <h2>{player.name}</h2>
                <div>
                  <span>HP</span>
                  <strong>
                    {player.hp} / {player.maxHp}
                  </strong>
                </div>
                <Meter
                  value={player.hp}
                  max={player.maxHp}
                  label="Your health"
                  health
                />
                <div data-focus-ready={limitReady || undefined}>
                  <span>Focus</span>
                  <strong>{focus} / 100</strong>
                </div>
                <Meter value={focus} max={100} label="Limit Break focus" />
                <div>
                  <span>Break</span>
                  <strong>{player.breakMeter ?? 0} / 200</strong>
                </div>
                <Meter
                  value={player.breakMeter ?? 0}
                  max={200}
                  label="Break meter"
                />
                {player.status === "alive" && <CombatStatuses effects={player.statusEffects} />}
              </section>
            </div>
          )}
        </footer>
      </div>
      <div ref={setLimitCinematicLayer} className={styles.limitCinematicLayer} aria-hidden="true" />
      {logOpen && (
        <BattleLog entries={battle.log} onClose={() => setLogOpen(false)} />
      )}
    </section>
  );
}
