import { Flame, FlaskConical, Lock, Shield, Skull, Sparkles, Wind, Zap } from "lucide-react";
import type { StatusEffect, StatusId } from "../types/game";
import styles from "./combat-hud.module.css";

const STATUSES = {
  immobilized: { name: "Immobilized", icon: Lock, harmful: true, detail: "Cannot act." },
  guarded: { name: "Guarded", icon: Shield, harmful: false, detail: "Reduces incoming hits while active." },
  evading: { name: "Evading", icon: Wind, harmful: false, detail: "Chance to dodge incoming hits while active." },
  enraged: { name: "Enraged", icon: Zap, harmful: false, detail: "Deals 20% more damage." },
  blessed: { name: "Blessed", icon: Sparkles, harmful: false, detail: "Recovers 60 HP per turn." },
  poisoned: { name: "Poisoned", icon: FlaskConical, harmful: true, detail: "Loses 70 HP per turn." },
  burning: { name: "Burning", icon: Flame, harmful: true, detail: "Loses 45 HP per turn." },
  cursed: { name: "Cursed", icon: Skull, harmful: true, detail: "Deals 25% less damage." },
} satisfies Record<StatusId, { name: string; icon: typeof Lock; harmful: boolean; detail: string }>;

function statusName(id: StatusId) {
  return STATUSES[id]?.name ?? id;
}

export function statusSummary(effects?: readonly StatusEffect[]) {
  return effects?.map(({ id, turns }) => `${statusName(id)}, ${turns} turn${turns === 1 ? "" : "s"}`).join(", ") ?? "";
}

export default function CombatStatuses({ effects }: { effects?: readonly StatusEffect[] }) {
  if (!effects?.length) return null;
  return (
    <span className={styles.statuses}>
      {effects.map(({ id, turns }) => {
        const status = STATUSES[id];
        const Icon = status?.icon;
        const label = `${statusName(id)}, ${turns} turn${turns === 1 ? "" : "s"} remaining.`;
        return (
          <span className={styles.statusChip} key={id} data-harmful={status?.harmful || undefined}
            title={`${label} ${status?.detail ?? ""}`}>
            {Icon && <Icon size={12} aria-hidden="true" />}
            {statusName(id)} <span aria-hidden="true">{turns}</span>
            <span className="sr-only">, {turns} turn{turns === 1 ? "" : "s"} remaining</span>
          </span>
        );
      })}
    </span>
  );
}
