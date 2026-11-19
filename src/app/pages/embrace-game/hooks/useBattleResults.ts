"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACK_TIMING, LIMIT_RECOIL_DURATION } from "../lib/attackTiming";
import { CINEMATICS } from "../lib/combatCinematics";
import type { Battle, GameEvent, GameState } from "../types/game";

export interface BattleResult {
  battle: Battle;
  teams: GameState["teams"];
}

export function useBattleResults() {
  const seen = useRef(new Set<string>());
  const reported = useRef<Battle | undefined>(undefined);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [ready, setReady] = useState(false);
  const [limitPresentationActive, setLimitPresentationActive] = useState(false);
  const noteBattleUpdate = useCallback(
    (
      battle: Battle | undefined,
      event: Extract<GameEvent, { type: "BATTLE_UPDATE" }>,
    ) => {
      if (battle?.mode !== "cpu") return;
      const enemyName = event.enemyName ?? battle.enemyName;
      const status =
        event.message === "Your team has been wiped out."
          ? "defeat"
          : event.message === `${enemyName} has been destroyed.`
            ? "victory"
            : null;
      if (status)
        reported.current = {
          ...battle,
          enemyName,
          enemyHp: event.enemyHp ?? battle.enemyHp,
          enemyMaxHp: event.enemyMaxHp ?? battle.enemyMaxHp,
          log: [...battle.log, event.message],
          status,
        };
    },
    [],
  );

  const captureResult = useCallback(
    ({ battle: snapshot, teams }: GameState) => {
      const battle = snapshot ?? reported.current;
      reported.current = undefined;
      if (!battle) return;
      if (battle.status === "active") {
        setResult((current) =>
          current?.battle.id === battle.id ? current : null,
        );
        return;
      }
      if (seen.current.has(battle.id)) return;
      seen.current.add(battle.id);
      setReady(false);
      setResult({ battle, teams });
    },
    [],
  );

  useEffect(() => {
    if (!result) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const limitFinisher = result.battle.log.slice(-2).some((line) => /\bunleashed a limit break\b/i.test(line));
    const limitFinisherDelay =
      CINEMATICS.limit.duration + ATTACK_TIMING.jump.contact + LIMIT_RECOIL_DURATION;
    const delay = reducedMotion ? 0 : limitFinisher ? limitFinisherDelay : 1450;
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [result]);

  const dismissResult = useCallback(() => setResult(null), []);
  return {
    result,
    ready: ready && !limitPresentationActive,
    captureResult,
    noteBattleUpdate,
    dismissResult,
    setLimitPresentationActive,
  };
}
