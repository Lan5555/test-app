import { type CSSProperties, useEffect, useState } from "react";
import { CINEMATICS, cinematicClip, loadCinematicClip, type CinematicMove } from "../lib/combatCinematics";
import type { Warrior } from "../lib/warriorSelection";
import styles from "./combat-cinematic.module.css";

export default function CombatCinematic({
  move,
  side,
  fighter,
}: {
  move: CinematicMove;
  side: "left" | "right";
  fighter?: Warrior;
}) {
  const [image, setImage] = useState<{ clip: string; url: string }>();
  const [failedClip, setFailedClip] = useState<string>();
  const cinematic = CINEMATICS[move];
  const primaryClip = cinematicClip(move, fighter);
  const highQuality = move === "limit" && primaryClip !== failedClip;
  const clip = move === "limit" && !highQuality
    ? cinematicClip(move, fighter, "gif")
    : primaryClip;

  useEffect(() => {
    if (!clip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let active = true;
    let objectUrl: string | undefined;
    void loadCinematicClip(clip).then((blob) => {
      if (!active) return;
      if (!blob) {
        if (highQuality) setFailedClip(clip);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setImage({ clip, url: objectUrl });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip, highQuality]);

  return (
    <div
      className={styles.cinematic}
      data-move={move}
      data-side={side}
      data-fighter={fighter}
      aria-hidden="true"
      style={{ "--cinematic-duration": `${cinematic.duration}ms` } as CSSProperties}
    >
      {image && image.clip === clip && (
        <img
          className={styles.art}
          src={image.url}
          alt=""
          data-format={highQuality ? "webp" : undefined}
          onError={highQuality ? () => setFailedClip(image.clip) : undefined}
        />
      )}
      <div className={styles.surge}>
        <div className={styles.plasma} />
        <div className={styles.ripple} />
        {move === "limit" && <div className={styles.fracture} />}
      </div>
      <span className={styles.moveName}>{cinematic.name}</span>
    </div>
  );
}
