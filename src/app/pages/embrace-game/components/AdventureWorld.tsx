"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, DoorOpen, Flame, Gem, Lock, Maximize, MessageCircle, Moon, Swords, Waves } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  ADVENTURE_SPAWN, ADVENTURE_TITLE, adventureAmbience, adventureBackdrop, adventureChapter, adventureMusic, adventureStep, atAdventureGate,
  directionForKey, localAdventureTarget, runeNames, type Direction, type ExplorerNpc, type Point,
} from "../lib/adventure";
import { encounterPortrait } from "../lib/encounterAssets";
import type { Warrior } from "../lib/warriorSelection";
import { adventureIdleStyle, adventureSpriteStyle } from "../lib/adventureSprites";
import type { AdventureInteraction, AdventureQuest, EncounterPath } from "../types/game";
import { AudioController } from "../hooks/audioHandler";
import AdventureDialogue from "./AdventureDialogue";
import styles from "./adventure-world.module.css";

const controls = [
  { direction: "up", Icon: ArrowUp },
  { direction: "left", Icon: ArrowLeft },
  { direction: "down", Icon: ArrowDown },
  { direction: "right", Icon: ArrowRight },
] as const;
const runeIcons = { moon: Moon, wave: Waves, bell: Bell, flame: Flame };
const emptyQuest: AdventureQuest = { accepted: false, progress: [], ready: false };
const markerPosition = ({ x, y }: Point) => ({ left: `${x}%`, top: `${y}%` });

export default function AdventureWorld({ path, quest = emptyQuest, fighter, disabled, onEnter, onInteract, onExit, notice }: {
  path: EncounterPath;
  quest?: AdventureQuest;
  fighter: Warrior;
  disabled?: boolean;
  onEnter: () => void;
  onInteract: (action: AdventureInteraction, target?: string) => void;
  onExit: () => void;
  notice?: string;
}) {
  const chapter = adventureChapter(path.index);
  const enemy = path.levels[path.index];
  const portrait = enemy && encounterPortrait(enemy.id);
  const position = useRef(ADVENTURE_SPAWN);
  const outdoorPosition = useRef(ADVENTURE_SPAWN);
  const previousProgress = useRef(quest.progress);
  const wasRunning = useRef(false);
  const wakeMovement = useRef<(() => void) | undefined>(undefined);
  const keys = useRef(new Map<string, Direction>());
  const pointers = useRef(new Map<number, Direction>());
  const [pose, setPose] = useState({ ...ADVENTURE_SPAWN, facing: 1, running: false });
  const [pending, setPending] = useState(false);
  const [indoors, setIndoors] = useState(false);
  const [sentAgainst, setSentAgainst] = useState<AdventureQuest>();
  const [speaker, setSpeaker] = useState<ExplorerNpc>();
  const [treasure, setTreasure] = useState<string>();
  const firstRune = useRef<HTMLButtonElement>(null);
  const home = chapter.home;
  const image = indoors && home ? home.image : chapter.image;
  const nearGate = !indoors && atAdventureGate(pose, chapter.gate);
  const target = localAdventureTarget(chapter, quest, pose, indoors);
  const task = chapter.task;
  const interacting = sentAgainst === quest;
  const movementLocked = Boolean(disabled || pending || speaker);

  useEffect(() => {
    if (home) new Image().src = adventureBackdrop(home.image);
  }, [home]);

  useEffect(() => () => AudioController.stopAdventureSoundscape(), []);

  useEffect(() => {
    if (disabled || pending) AudioController.stopAdventureSoundscape();
    else AudioController.playAdventureSoundscape(adventureMusic(path.index), adventureAmbience(image), indoors);
  }, [disabled, image, indoors, path.index, pending]);

  useEffect(() => {
    const reward = task.kind === "collect" && task.items.find(({ chest, id }) =>
      chest && quest.progress.includes(id) && !previousProgress.current.includes(id));
    if (reward) {
      setTreasure(reward.name);
      void AudioController.playAdventureEffect("chest");
    }
    previousProgress.current = quest.progress;
  }, [quest.progress, task]);

  useEffect(() => {
    if (!treasure) return;
    const timer = window.setTimeout(() => setTreasure(undefined), 3500);
    return () => window.clearTimeout(timer);
  }, [treasure]);

  const changeRoom = useCallback((inside: boolean) => {
    if (!home) return;
    if (inside) outdoorPosition.current = position.current;
    position.current = inside ? home.spawn : outdoorPosition.current;
    wasRunning.current = false;
    keys.current.clear();
    pointers.current.clear();
    setPose({ ...position.current, facing: 1, running: false });
    setIndoors(inside);
    void AudioController.playAdventureEffect("door");
  }, [home]);

  const interact = useCallback((action: AdventureInteraction, id?: string) => {
    if (disabled || pending || interacting) return;
    setSentAgainst(quest);
    onInteract(action, id);
  }, [disabled, interacting, onInteract, pending, quest]);

  useEffect(() => {
    if (!interacting) return;
    const timer = window.setTimeout(() => setSentAgainst(undefined), 1500);
    return () => window.clearTimeout(timer);
  }, [interacting]);

  const enterBattle = useCallback(() => {
    if (disabled || pending || indoors || !quest.ready || !atAdventureGate(position.current, chapter.gate)) return;
    setPending(true);
    onEnter();
  }, [chapter.gate, disabled, indoors, onEnter, pending, quest.ready]);

  const useNearby = useCallback(() => {
    if (movementLocked) return;
    const nearby = localAdventureTarget(chapter, quest, position.current, indoors);
    if (nearby?.kind === "enter-house" || nearby?.kind === "leave-house") changeRoom(!indoors);
    else if (nearby?.kind === "talk" || nearby?.kind === "chat") {
      if (nearby.kind === "talk") interact("talk");
      keys.current.clear();
      pointers.current.clear();
      setSpeaker(nearby.npc);
    }
    else if (nearby?.kind === "collect") interact("collect", nearby.id);
    else if (nearby?.kind === "rune") firstRune.current?.focus();
    else enterBattle();
  }, [changeRoom, chapter, enterBattle, indoors, interact, movementLocked, quest]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(false), 4000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const stop = () => {
      keys.current.clear();
      pointers.current.clear();
    };
    function down(event: KeyboardEvent) {
      if (movementLocked || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      const direction = directionForKey[key];
      if (direction) {
        event.preventDefault();
        keys.current.set(key, direction);
        wakeMovement.current?.();
      } else if (key === "e" && !event.repeat) {
        useNearby();
      }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      stop();
    };
  }, [movementLocked, useNearby]);

  useEffect(() => {
    if (movementLocked) {
      keys.current.clear();
      pointers.current.clear();
      if (wasRunning.current) {
        wasRunning.current = false;
        setPose((previous) => ({ ...previous, running: false }));
      }
      return;
    }
    let frame = 0;
    let lastTime = 0;
    const directions = new Set<Direction>();
    const tick = (now: number) => {
      frame = 0;
      directions.clear();
      for (const direction of keys.current.values()) directions.add(direction);
      for (const direction of pointers.current.values()) directions.add(direction);
      const before = position.current;
      const elapsed = lastTime ? (now - lastTime) / 1000 : 1 / 60;
      const next = directions.size ? adventureStep(before, directions, elapsed) : before;
      const running = next.x !== before.x || next.y !== before.y;
      position.current = next;
      if (running || wasRunning.current) {
        setPose((previous) => {
          const facing = next.x === before.x ? previous.facing : next.x < before.x ? -1 : 1;
          return { ...next, facing, running };
        });
      }
      wasRunning.current = running;
      lastTime = directions.size ? now : 0;
      if (directions.size) frame = requestAnimationFrame(tick);
    };
    wakeMovement.current = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    if (keys.current.size || pointers.current.size) wakeMovement.current();
    return () => {
      wakeMovement.current = undefined;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [movementLocked]);

  function beginPointer(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (movementLocked || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, direction);
    wakeMovement.current?.();
  }

  const motion = pose.running ? "run" : "idle";
  const sprite = { ...adventureSpriteStyle(fighter, motion), "--face": pose.facing } as CSSProperties;
  const interactionLabel = target?.kind === "enter-house" ? `Enter ${target.name}`
    : target?.kind === "leave-house" ? "Go outside"
      : target?.kind === "collect" ? target.chest ? "Open treasure chest" : `Collect ${target.name}`
        : target && `Talk to ${target.name}`;

  return (
    <section className={`${styles.screen} ${styles.explore}`} aria-label={ADVENTURE_TITLE}>
      <header className={styles.heading}>
        <div>
          <p>Adventure · Chapter {path.index + 1} of {path.levels.length}</p>
          <h1>{indoors ? home?.name : chapter.location}</h1>
          <p className={styles.keyHelp}>WASD / arrows · E to interact</p>
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.exit} aria-label="Full screen" title="Full screen" onClick={() => AudioController.makeFullScreen()}><Maximize size={17} /></button>
          <button type="button" className={styles.exit} onClick={onExit}><DoorOpen size={17} /> Leave</button>
        </div>
      </header>
      <div className={styles.world} style={{ backgroundImage: `url("${adventureBackdrop(image)}")` }}>
        {!indoors && <div className={styles.gate} data-near={nearGate && quest.ready || undefined} data-locked={!quest.ready || undefined}
          style={markerPosition(chapter.gate)} aria-hidden="true">
          {quest.ready ? <Swords size={21} /> : <Lock size={19} />}
        </div>}
        {home && <div className={styles.houseMarker} style={markerPosition(indoors ? home.exit : home.door)} aria-hidden="true">
          <span className={styles.questMarker}><DoorOpen size={18} /></span>
          <span className={styles.mapLabel} data-near={target?.kind === "enter-house" || target?.kind === "leave-house" || undefined}>
            {indoors ? "Exit" : home.name}
          </span>
        </div>}
        {[chapter.npc, ...(chapter.residents ?? [])].filter((npc) => Boolean(npc.indoors) === indoors).map((npc, index) => (
          <div key={npc.name} className={styles.npc} style={markerPosition(npc.at)} aria-hidden="true">
            <div className={styles.npcSprite} style={{ ...adventureIdleStyle(npc.fighter), animationDelay: `${index * -230}ms` }} />
            <span className={styles.mapLabel} data-near={target?.name === npc.name || undefined}>
              <MessageCircle size={13} />{npc.name}
            </span>
          </div>
        ))}
        {task.kind === "collect" ? task.items
          .filter((item) => Boolean(item.indoors) === indoors && (item.chest || quest.accepted && !quest.ready && !quest.progress.includes(item.id)))
          .map((item) => {
            const opened = quest.progress.includes(item.id);
            return <span key={item.id} className={styles.questMarker} data-chest={item.chest || undefined}
              data-opened={item.chest && opened || undefined} style={markerPosition(item.at)} aria-hidden="true">
              {item.chest ? <span className={styles.chestModel} /> : <Gem size={17} />}
            </span>;
          }) : quest.accepted && !quest.ready && !indoors && (
            <span className={styles.questMarker} style={markerPosition(task.at)} aria-hidden="true">
              <Moon size={18} />
            </span>
          )}
        <div className={styles.avatar} style={{ left: `${pose.x}%`, top: `${pose.y}%`, "--depth": 0.78 + (pose.y - 52) * 0.008 } as CSSProperties} aria-hidden="true">
          <div className={styles.avatarShadow} />
          <div className={styles.avatarSprite} data-warrior={fighter} data-running={pose.running || undefined} style={sprite} />
        </div>
      </div>
      <div className={styles.actions}>
        {target && target.kind !== "rune" && <button type="button" className={styles.interactButton}
          disabled={disabled || pending || (interacting && (target.kind === "talk" || target.kind === "collect"))} onClick={useNearby}>
          {interactionLabel}<span className={styles.keyHelp}> (E)</span>
        </button>}
        <div className={styles.controls}>
          <div className={styles.dpad} role="group" aria-label="Move fighter">
            {controls.map(({ direction, Icon }) => (
              <button key={direction} type="button" data-direction={direction} aria-label={`Move ${direction}`}
                disabled={movementLocked}
                onPointerDown={(event) => beginPointer(event, direction)}
                onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
                onClick={(event) => {
                  if (event.detail !== 0) return;
                  const next = adventureStep(position.current, new Set([direction]), 0.05);
                  position.current = next;
                  setPose((previous) => ({ ...previous, ...next, facing: direction === "left" ? -1 : direction === "right" ? 1 : previous.facing }));
                }}>
                <Icon size={21} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <article className={styles.chapter}>
          <h2>{chapter.title}</h2>
          {nearGate && quest.ready && <button type="button" className={styles.battleButton}
            disabled={disabled || pending} onClick={enterBattle}>
            {pending ? "Entering combat…" : <>Enter combat<span className={styles.keyHelp}> (E)</span></>}
          </button>}
          <div className={styles.journal}>
            {target?.kind === "rune" && task.kind === "rune" && (
              <div className={styles.runes} role="group" aria-label={task.name}>
                {task.runes.map((rune, index) => {
                  const Icon = runeIcons[rune];
                  return <button key={rune} ref={index === 0 ? firstRune : undefined} type="button"
                    disabled={disabled || interacting || pending} data-lit={quest.progress.includes(rune) || undefined}
                    onClick={() => interact("rune", rune)}><Icon size={18} aria-hidden="true" />{runeNames[rune]}</button>;
                })}
              </div>
            )}
            {!quest.accepted ? <p>Speak to <strong>{chapter.npc.name}</strong>{chapter.npc.indoors && !indoors && home ? ` in the ${home.name}` : ""}.</p> : <>
              <p role="status">{quest.ready ? "Quest complete. The encounter is unlocked."
                : task.kind === "collect" ? `Clues and supplies found ${quest.progress.length}/${task.items.length}`
                : quest.incorrect ? "The runes went dark. Try the sequence again."
                  : `Runes lit ${quest.progress.length}/${task.runes.length}`}</p>
              {!quest.ready && <p>{chapter.objective}</p>}
              {!quest.ready && task.kind === "rune" && target?.kind !== "rune" && <p>Approach {task.name} to inspect the runes.</p>}
            </>}
          </div>
          {!indoors && <div className={styles.encounter}>
            {portrait && <img src={portrait} width={44} height={44} alt="" />}
            <div>
              <span>{enemy?.name}</span>
              {!nearGate && quest.ready && <p>Approach the battle marker.</p>}
            </div>
          </div>}
          <details className={styles.story}>
            <summary>Story</summary>
            <p>{chapter.story}</p>
          </details>
        </article>
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {treasure && <p className={styles.treasure} role="status">Found {treasure}</p>}
      {speaker && <AdventureDialogue npc={speaker} onClose={() => setSpeaker(undefined)} />}
    </section>
  );
}

export function AdventureEnding({ path, onExit }: { path: EncounterPath; onExit: () => void }) {
  const completed = path.status === "cleared";
  const chapter = adventureChapter(completed ? 0 : path.index);
  return (
    <section className={styles.screen} aria-label="Adventure ending">
      <div className={styles.ending} style={{ backgroundImage: `linear-gradient(0deg, #070b14 4%, #070b1470 58%, transparent), url("${adventureBackdrop(chapter.image)}")` }}>
        <p>{ADVENTURE_TITLE}</p>
        <h1>{completed ? "Morning returns" : "The lantern goes dark"}</h1>
        <p>{completed
          ? "The last dawn breaks over Ashglass Crossing. For the first time in years, the ferryman sees the road home."
          : `Your journey ended at ${chapter.location}. The Highlands are still waiting for dawn.`}</p>
        <button type="button" className={styles.exit} onClick={onExit}>Back to the Highlands</button>
      </div>
    </section>
  );
}
