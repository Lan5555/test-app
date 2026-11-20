"use client";

import { type CSSProperties, useId } from "react";
import {
  FEATURED_FIGHTERS,
  fighterAtlasUrl,
  fighterIdleSprite,
  type FeaturedFighter,
  isFeaturedFighter,
  WARRIORS,
  type Warrior,
} from "../lib/warriorSelection";
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
  "lady-ley": { name: "Vesper Vale", description: "A crescent-blade duelist who tears open astral rifts and fights behind lunar mirrors." },
  "grave-chorister": { name: "Morcant the Hollow", description: "A masked bell-staff caster who fractures time and collapses dying stars." },
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
        const active = warrior === selected;
        const idle = fighterIdleSprite(warrior);
        const locked =
          isFeaturedFighter(warrior) &&
          !active &&
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
              checked={active}
              disabled={locked}
              onChange={() => onSelect(warrior)}
            />
            <div className={styles.preview} aria-hidden="true">
              <span
                className={styles.sprite}
                data-active={active || undefined}
                style={{
                  backgroundImage: `url("${active ? idle.src : fighterAtlasUrl(warrior, true)}")`,
                  backgroundSize: active ? `${idle.frames * 100}% 100%` : "100% 100%",
                  "--idle-frames": idle.frames,
                } as CSSProperties}
              />
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
