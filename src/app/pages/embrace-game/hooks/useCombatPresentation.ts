"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACK_TIMING, LIMIT_RECOIL_DURATION } from "../lib/attackTiming";
import { CINEMATICS } from "../lib/combatCinematics";
import {
  type CombatAttack,
  type CombatCue,
  type CombatFrame,
  type CombatImpact,
  type CombatVoice,
  captureCombatFrame,
  companionActorId,
  getBuffVoices,
  getCombatImpacts,
  getImpactLightning,
  strongestImpact,
} from "../lib/combatPresentation";
import { socket } from "../lib/websocket";
import type { Battle, Player } from "../types/game";
import { AudioController } from "./audioHandler";

export type StageImpact = CombatImpact & { id: number; batch: number };
export type StageAttack = CombatAttack & { id: number };

const EMPTY_PRESENTATION = {
  impacts: [] as StageImpact[],
  attacks: [] as StageAttack[],
};

const IMPACT_DURATION = 1300;
const STATUS_SYNC_WINDOW = 700;

export function useCombatPresentation(
  battle: Battle,
  allies: readonly Player[],
  opponents: readonly Player[],
  arenaAudio = false,
  enabled = true,
) {
  const [presentation, setPresentation] = useState(EMPTY_PRESENTATION);
  const [pendingKnockbacks, setPendingKnockbacks] = useState<CombatImpact[]>([]);
  const [activeLimits, setActiveLimits] = useState(0);
  const lastFrame = useRef<CombatFrame | null>(null);
  const lastBuffBattle = useRef<string | null>(null);
  const lastEnemyEntrance = useRef<string | null>(null);
  const pendingCue = useRef<{ cue: CombatCue; expires: number } | null>(null);
  const contactAt = useRef(0);
  const presentationAvailableAt = useRef(0);
  const nextId = useRef(0);
  const timers = useRef(new Set<number>());
  const scheduledImpacts = useRef(new Map<number, CombatImpact[]>());
  const recentBreaks = useRef(new Map<string, number>());
  const recentPreparations = useRef(new Map<string, number>());
  const battleId = battle.id;
  const encounterId = battle.mode === "cpu" ? battle.encounterId : undefined;

  const schedule = useCallback((delay: number, run: () => void) => {
    if (delay <= 0) {
      run();
      return;
    }
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, delay);
    timers.current.add(timer);
  }, []);

  const publish = useCallback(
    (incoming: CombatImpact[], incomingAttacks: CombatAttack[] = []) => {
      const now = performance.now();
      const fresh = incoming.filter(({ kind, actorId }) => {
        if (kind !== "break" || !actorId) return true;
        const lastBreak = recentBreaks.current.get(actorId);
        if (lastBreak !== undefined && now - lastBreak < IMPACT_DURATION)
          return false;
        recentBreaks.current.set(actorId, now);
        return true;
      });
      if (fresh.length === 0 && incomingAttacks.length === 0) return;

      const firstId = nextId.current + 1;
      const batch = fresh.map((impact) => ({
        ...impact,
        id: ++nextId.current,
        batch: firstId,
      }));
      const attacks = incomingAttacks.map((attack) => ({
        ...attack,
        id: ++nextId.current,
      }));
      const ids = new Set([...batch, ...attacks].map(({ id }) => id));
      setPresentation((current) => ({
        impacts: [...current.impacts, ...batch].slice(-12),
        attacks: [...current.attacks, ...attacks].slice(-12),
      }));

      for (const { actorId, animation, cinematic, voiceCue } of attacks) {
        const combatant = lastFrame.current?.combatants.get(actorId);
        const enemyCue = combatant?.encounterId;
        if (enemyCue && animation !== "heal" && cinematic !== "limit") {
          void AudioController.playEncounterEnemy(enemyCue, "attack");
        }
        const fighter = combatant?.voiceFighterId;
        if (fighter && voiceCue) {
          AudioController.playCombatVoice(fighter, voiceCue, animation === "heal" ? "heal" : "attack");
        }
      }
      if (attacks.some(({ animation, companionStrike }) => animation === "attack2" && companionStrike !== undefined)) {
        void AudioController.playSummonEffect("strike");
      }
      for (const { actorId, kind, defeated } of fresh) {
        const fighter = actorId && lastFrame.current?.combatants.get(actorId)?.voiceFighterId;
        if (fighter && kind === "evade") {
          AudioController.playCombatVoice(fighter, "dodge");
        } else if (fighter && (kind === "hit" || kind === "heavy")) {
          if (!defeated && fresh.some((impact) => impact.actorId === actorId && impact.kind === "guard")) continue;
          void AudioController.playFighterVoice(fighter, defeated ? "defeat" : "hit");
        }
      }

      const contact = strongestImpact(
        fresh.filter(({ kind }) => kind !== "heal"),
      );
      if (contact) {
        if (contact.kind === "break") {
          const swordContact = strongestImpact(fresh.filter(({ swordHit }) => swordHit));
          if (swordContact) AudioController.playCombatImpact(swordContact.kind, swordContact.flair, true);
        }
        if (arenaAudio && contact.kind === "break") AudioController.playArenaImpact("break");
        else AudioController.playCombatImpact(contact.kind, contact.flair, contact.swordHit);
        if (getImpactLightning(contact))
          AudioController.playLightningEffect(contact.flair === "limit" ? 0.85 : 0.58);
        if (
          contact.kind !== "break" &&
          fresh.some(({ kind }) => kind === "break")
        ) {
          if (arenaAudio) AudioController.playArenaImpact("break");
          else AudioController.playCombatImpact("break");
        }
      }
      if (fresh.some(({ kind }) => kind === "heal"))
        AudioController.playCombatImpact("heal");

      const lifetime = attacks.reduce(
        (duration, { cinematic }) => cinematic ? Math.max(duration, CINEMATICS[cinematic].duration) : duration,
        IMPACT_DURATION,
      );
      schedule(lifetime, () => {
        setPresentation((current) => ({
          impacts: current.impacts.filter(({ id }) => !ids.has(id)),
          attacks: current.attacks.filter(({ id }) => !ids.has(id)),
        }));
      });
    },
    [arenaAudio, schedule],
  );

  const present = useCallback(
    (impacts: CombatImpact[], attacks: CombatAttack[] = [], companions: CombatAttack[] = [], voices: CombatVoice[] = []) => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const now = performance.now();
      if (attacks.length > 0) {
        const startDelay = reduced
          ? 0
          : Math.max(0, presentationAvailableAt.current - now);
        const cutIns = attacks.filter(({ cinematic }) => cinematic === "limit");
        const hasLimit = cutIns.length > 0;
        const cutInDuration = hasLimit && !reduced ? CINEMATICS.limit.duration : 0;
        const actionDelay = startDelay + cutInDuration;
        const contactDelay = Math.max(
          ...attacks.map(({ animation, cinematic }) =>
            cinematic && cinematic !== "limit"
              ? CINEMATICS[cinematic].contact
              : ATTACK_TIMING[animation].contact,
          ),
        );
        contactAt.current = now + actionDelay + contactDelay;
        if (hasLimit && !reduced) {
          // The server can send the next turn while the post-cinematic hit is still playing.
          presentationAvailableAt.current = contactAt.current + LIMIT_RECOIL_DURATION;
          setActiveLimits((count) => count + 1);
          schedule(actionDelay + contactDelay + LIMIT_RECOIL_DURATION, () => {
            setActiveLimits((count) => count - 1);
          });
        } else if (startDelay > 0) {
          presentationAvailableAt.current =
            now + startDelay + Math.max(...attacks.map(({ animation, cinematic }) =>
              cinematic && cinematic !== "limit"
                ? CINEMATICS[cinematic].duration
                : ATTACK_TIMING[animation].total,
            ));
        }
        if (hasLimit) schedule(startDelay, () => publish([], cutIns));
        const strikes = attacks.map((attack) =>
          attack.cinematic === "limit"
            ? { actorId: attack.actorId, animation: attack.animation }
            : attack,
        );
        schedule(actionDelay, () => publish([], strikes));
      }
      if (companions.length) {
        if (attacks.length === 0) contactAt.current = now + ATTACK_TIMING.attack2.contact;
        const companionDelay = reduced ? 0 : contactAt.current - now - ATTACK_TIMING.attack2.contact;
        schedule(companionDelay, () => publish([], companions));
      }
      if (voices.length) {
        schedule(reduced ? 0 : contactAt.current - now, () => {
          for (const { fighter, cue } of voices) AudioController.playCombatVoice(fighter, cue);
        });
      }
      if (!impacts.length) return;
      const impactTime = contactAt.current;
      const delay = reduced ? 0 : impactTime - now;
      if (delay <= 0) {
        publish(impacts);
        return;
      }
      const knockbacks = impacts.filter(({ flair, knockback }) => flair === "limit" && knockback);
      if (knockbacks.length) setPendingKnockbacks((current) => [...current, ...knockbacks]);
      const scheduled = scheduledImpacts.current.get(impactTime);
      if (scheduled) {
        scheduled.push(...impacts);
        return;
      }
      scheduledImpacts.current.set(impactTime, [...impacts]);
      schedule(delay, () => {
        const batch = scheduledImpacts.current.get(impactTime) ?? [];
        scheduledImpacts.current.delete(impactTime);
        setPendingKnockbacks((current) => current.filter((impact) => !batch.includes(impact)));
        publish(batch);
      });
    },
    [publish, schedule],
  );

  useEffect(() => {
    const pendingTimers = timers.current;
    const pendingImpacts = scheduledImpacts.current;
    const breakHistory = recentBreaks.current;
    const preparationHistory = recentPreparations.current;
    setPresentation(EMPTY_PRESENTATION);
    setPendingKnockbacks([]);
    setActiveLimits(0);
    if (!enabled) return;
    const unsubscribe = socket.onMessage((event) => {
      if (event.type !== "BREAK") return;
      const frame = lastFrame.current;
      const combatant = frame?.combatants.get(event.playerId);
      if (frame?.battleId !== battleId || !combatant) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      schedule(reduced ? 0 : 430, () => {
        present([{
          side: combatant.side,
          actor: combatant.name,
          actorId: event.playerId,
          kind: "break",
        }]);
      });
    });

    return () => {
      unsubscribe();
      AudioController.stopCombatVoices();
      for (const timer of pendingTimers) window.clearTimeout(timer);
      pendingTimers.clear();
      pendingImpacts.clear();
      breakHistory.clear();
      preparationHistory.clear();
      lastFrame.current = null;
      pendingCue.current = null;
      contactAt.current = 0;
      presentationAvailableAt.current = 0;
    };
  }, [battleId, enabled, present, schedule]);

  useEffect(() => {
    if (!enabled) return;
    const current = captureCombatFrame(battle, allies, opponents);
    const previous = lastFrame.current;
    lastFrame.current = current;
    if (!previous) {
      if (encounterId && battle.status === "active" && lastEnemyEntrance.current !== battleId) {
        schedule(1, () => {
          lastEnemyEntrance.current = battleId;
          void AudioController.playEncounterEnemy(encounterId, "entrance");
        });
      }
      if (lastBuffBattle.current !== battleId) {
        schedule(1, () => {
          lastBuffBattle.current = battleId;
          for (const { fighter, cue } of getBuffVoices(current)) {
            AudioController.playCombatVoice(fighter, cue);
          }
        });
      }
      return;
    }

    // The combat log can arrive before the roster's updated health.
    const now = performance.now();
    const pending = pendingCue.current;
    const {
      attacks,
      impacts: incoming,
      preparationVoices,
      nextCue,
    } = getCombatImpacts(
      previous,
      current,
      pending && now < pending.expires ? pending.cue : undefined,
    );
    const companions: CombatAttack[] = [];
    for (const [id, combatant] of current.combatants) {
      const before = previous.combatants.get(id)?.companions;
      for (const { skillId, strikes, role } of combatant.companions ?? []) {
        const previousSummon = before?.find((companion) => companion.skillId === skillId);
        if (!previousSummon) void AudioController.playSummonEffect("portal");
        if (strikes > (previousSummon?.strikes ?? 0)) {
          const animation = role === "healer" ? "heal" : role === "buffer" ? "cast" : "attack2";
          companions.push({ actorId: companionActorId(id, skillId), animation, companionStrike: strikes });
        }
      }
    }
    // Block and dodge announce the status before the roster sync may show it.
    const preparations = recentPreparations.current;
    for (const { actorId, cue } of preparationVoices) {
      preparations.set(`${actorId}:${cue}`, now);
    }
    const buffs = getBuffVoices(current, previous).filter(({ actorId, cue }) => {
      const key = `${actorId}:${cue}`;
      const preparation = preparations.get(key);
      preparations.delete(key);
      return preparation === undefined || now - preparation > STATUS_SYNC_WINDOW;
    });
    present(incoming, attacks, companions, [...preparationVoices, ...buffs]);
    pendingCue.current = nextCue
      ? {
          cue: nextCue,
          expires: nextCue === pending?.cue
            ? pending.expires
            : nextCue.flair === "limit" ? Math.max(now, contactAt.current) + 300 : now + 700,
        }
      : null;
  }, [battle, battleId, encounterId, allies, opponents, enabled, present, schedule]);

  return { ...presentation, pendingKnockbacks, limitActive: activeLimits > 0 };
}
