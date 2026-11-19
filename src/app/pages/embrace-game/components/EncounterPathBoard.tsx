import { ArrowRight, Check, Crown, Lock, Swords, X } from "lucide-react";
import Image from "next/image";
import { encounterPortrait } from "../lib/encounterAssets";
import type { EncounterPath, EncounterPathChoice } from "../types/game";
import styles from "./encounter-path.module.css";

export default function EncounterPathBoard({
  path, onEnter, onChoose, onExit, disabled, embedded = false, notice,
}: {
  path: EncounterPath;
  onEnter?: () => void;
  onChoose?: (choice: EncounterPathChoice) => void;
  onExit?: () => void;
  disabled?: boolean;
  embedded?: boolean;
  notice?: string;
}) {
  const current = path.levels[path.index];
  const active = path.status === "active";
  const title = path.status === "cleared" ? "Path cleared" : path.status === "defeated" ? "Run ended" : "Highlands Path";
  const tier = path.tier ?? 1;
  return (
    <section className={styles.board} data-embedded={embedded || undefined} aria-label="Highlands Path">
      <header className={styles.header}>
        <div>
          <h2>{title}</h2>
          {path.tier && <p>{`Tier ${tier}${tier > 1 ? " · Stronger rematches" : ""}`}</p>}
          <p>{active && current ? `Level ${path.index + 1} of ${path.levels.length} · ${current.name}`
            : path.status === "cleared" ? "Every encounter has been cleared."
            : current ? `Defeated at level ${path.index + 1} · ${current.name}` : ""}</p>
          {path.tier && path.status !== "cleared" && <p>
            {path.savePending ? "Level 6 won. Your checkpoint is waiting to save."
              : path.savedWins ? `Account progress saved after ${path.savedWins} wins on this tier.`
              : "Progress saves after six wins in this tier."}
          </p>}
        </div>
        {onExit && <button type="button" onClick={onExit}>Leave path</button>}
      </header>
      <ol className={styles.path}>
        {path.levels.map((level, index) => {
          const complete = path.status === "cleared" || index < path.index;
          const selected = index === path.index && path.status !== "cleared";
          const final = index === path.levels.length - 1;
          const status = complete ? "Cleared" : selected ? active ? "Next fight" : "Defeated" : "Locked";
          const Icon = complete ? Check : selected ? active ? Swords : X : final ? Crown : Lock;
          const portrait = encounterPortrait(level.id);
          return (
            <li key={level.id} className={styles.level} aria-current={selected ? "step" : undefined}
              data-current={selected || undefined} data-complete={complete || undefined}>
              <div className={styles.portrait}>
                {portrait && <Image src={portrait} alt="" fill sizes="(max-width: 40rem) 30vw, 12vw" />}
                <span className={styles.levelNumber}>{index + 1}</span>
              </div>
              <div className={styles.levelText}>
                <strong>{level.name}</strong>
                <span><Icon aria-hidden="true" size={13} />{final ? `Tier finale · ${status}` : status}</span>
                {level.allies?.length ? <span>{level.allies.length + 1} enemies</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
      {path.status === "cleared" && <div className={styles.footer}>
        <div>
          {path.completionReward
            ? <p role="status">Tier reward earned · {path.completionReward.cinders} Cinders and {path.completionReward.xp} XP</p>
            : path.savePending ? <p role="status">Tier cleared. Your checkpoint and reward are waiting to save.</p>
              : <p>Tier reward already claimed.</p>}
        </div>
        {onChoose && <div className={styles.choices}>
          {path.savePending && <button type="button" disabled={disabled} onClick={() => onChoose("save")}>Save reward</button>}
          <button type="button" disabled={disabled} onClick={() => onChoose("replay")}>Replay tier {tier}</button>
          {path.nextTier && <button type="button" disabled={disabled} onClick={() => onChoose("higher")}>
            Try tier {path.nextTier} <ArrowRight size={18} aria-hidden="true" />
          </button>}
        </div>}
      </div>}
      {path.status === "defeated" && onChoose && <div className={styles.footer}>
        <button type="button" disabled={disabled} onClick={() => onChoose("resume")}>
          {path.savedWins === 6 ? "Resume from level 7"
            : path.savedWins === 12 || tier > 1 ? "Return to saved progress" : "Restart path"}
        </button>
      </div>}
      {active && current && <div className={styles.footer}>
        <div>
          {current.allies?.length ? <p>{[current.name, ...current.allies.map(({ name }) => name)].join(" · ")}</p> : null}
          <p>{current.hint}</p>
        </div>
        {onEnter && <button type="button" onClick={onEnter} disabled={disabled}>
          Enter level {path.index + 1} <ArrowRight size={18} aria-hidden="true" />
        </button>}
      </div>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>
  );
}
