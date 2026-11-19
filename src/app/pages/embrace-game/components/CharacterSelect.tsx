"use client";

import { useId } from "react";
import {
  FEATURED_FIGHTERS,
  type FeaturedFighter,
  isFeaturedFighter,
  WARRIORS,
  type Warrior,
} from "../lib/warriorSelection";
import CombatSprite from "./CombatSprite";
import styles from "./character-select.module.css";

const FIGHTERS = {
  knight: { name: "Knight", description: "Crimson cape and blackened steel." },
  maiden: { name: "Maiden", description: "Silver hair and gilded armor." },
  warden: {
    name: "Warden",
    description: "Warhammer slams and golden shockwaves.",
  },
  duelist: { name: "Duelist", description: "Twin blades and icy blue arcs." },
  monk: { name: "Monk", description: "Bare-handed strikes and aerial kicks." },
  arcanist: {
    name: "Arcanist",
    description: "Crystal staff sweeps and spell rings.",
  },
  "ember-duelist": {
    ...FEATURED_FIGHTERS["ember-duelist"],
    description: "Burnished steel and ember-lit twin sabers.",
  },
  "eclipse-arcanist": {
    ...FEATURED_FIGHTERS["eclipse-arcanist"],
    description: "An amethyst staff and eclipse-lit robes.",
  },
};

export function fighterName(id?: Warrior) {
  return id ? FIGHTERS[id]?.name : undefined;
}

export default function CharacterSelect({
  selected,
  onSelect,
  disabled,
  unlocked,
}: {
  selected?: Warrior;
  onSelect: (fighter: Warrior) => void;
  disabled?: boolean;
  unlocked?: readonly FeaturedFighter[];
}) {
  const id = useId();
  return (
    <fieldset
      className={styles.gallery}
      aria-label="Fighter"
      disabled={disabled}
    >
      {WARRIORS.map((warrior) => {
        const locked =
          isFeaturedFighter(warrior) &&
          warrior !== selected &&
          !unlocked?.includes(warrior);
        return (
          <label
            className={styles.card}
            key={warrior}
            data-warrior={warrior}
            data-locked={locked || undefined}
          >
            <input
              type="radio"
              name={id}
              value={warrior}
              checked={warrior === selected}
              disabled={locked}
              onChange={() => onSelect(warrior)}
            />
            <div className={styles.preview} aria-hidden="true">
              <CombatSprite warrior={warrior} down={false} preview={warrior !== selected} />
            </div>
            <div className={styles.caption}>
              <strong>{FIGHTERS[warrior].name}</strong>
              <span>
                {locked
                  ? "Unlock in the Cinder Forge"
                  : FIGHTERS[warrior].description}
              </span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
