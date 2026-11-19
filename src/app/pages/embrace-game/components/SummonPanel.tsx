import { ChevronDown, Coins, Flame, Gem, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { SUMMON_REVEAL_DELAY } from "../lib/arenaAssets";
import { formatCinders, type Catalog, type GameProfile } from "../lib/progression";
import { ForgeProductArtwork } from "./ForgeItemCard";
import styles from "./forge.module.css";

export type SummonReveal = {
  name: string;
  rarity: string;
  productId: string;
  requestId: string;
  duplicateCredits: number;
  guaranteed: boolean;
};

export default function SummonPanel({
  catalog,
  profile,
  reveal,
  busy,
  pendingProduct,
  onSummon,
}: {
  catalog: Catalog;
  profile: GameProfile;
  reveal?: SummonReveal;
  busy: boolean;
  pendingProduct?: string;
  onSummon: () => void;
}) {
  const { cost, pityAt, pool, duplicateCredits } = catalog.summon;
  const progress = Math.min(Math.max(profile.pity, 0), pityAt);
  const remaining = pityAt - progress;
  const shortfall = Math.max(cost - profile.credits, 0);
  const retryingSummon = pendingProduct === "summon";
  const summoning = busy && retryingSummon;
  const otherPurchasePending = Boolean(pendingProduct && !retryingSummon);

  return (
    <section className={styles.summon} aria-labelledby="summon-title">
      <div className={styles.banner}>
        {summoning && <div className={styles.ritual} aria-hidden="true">
          <div className={styles.ritualCore}><Gem size={36} /></div>
        </div>}
        <div className={styles.bannerContent}>
          <Flame className={styles.bannerIcon} size={28} strokeWidth={1.5} aria-hidden="true" />
          <h3 id="summon-title">The Ashen Reliquary</h3>
          <p>Weapons, armor, and battle items</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.guarantee}>
            <div className={styles.progressHeading}>
              <label htmlFor="summon-progress">Legendary guarantee</label>
              <span id="summon-progress-detail">
                {remaining <= 1 ? "Next summon" : `Within ${remaining} summons`}
              </span>
            </div>
            <progress id="summon-progress" value={progress} max={pityAt} aria-describedby="summon-progress-detail" />
          </div>
          <button
            type="button"
            className={styles.summonButton}
            disabled={busy || otherPurchasePending || (!retryingSummon && shortfall > 0)}
            onClick={onSummon}
          >
            <Sparkles size={18} aria-hidden="true" />
            {summoning ? "Summoning…" : retryingSummon ? "Retry summon" : `Summon for ${formatCinders(cost)}`}
          </button>
          {!busy && retryingSummon && <p>Resume your pending summon.</p>}
          {!busy && !pendingProduct && shortfall > 0 && <p>Short by {formatCinders(shortfall)}.</p>}
        </div>
      </div>

      <div className={styles.revealRegion} role="status">
        {reveal && (
          <div key={reveal.requestId} className={styles.reveal} data-rarity={reveal.rarity.toLowerCase()}
            style={{ "--reveal-delay": `${SUMMON_REVEAL_DELAY}ms` } as CSSProperties}>
            <span className={styles.revealBurst} aria-hidden="true" />
            <div className={styles.rewardArtwork}>
              <ForgeProductArtwork productId={reveal.productId} Icon={Sparkles} />
            </div>
            <div className={styles.rewardContent}>
              <p className={styles.rarity}>{reveal.rarity}{reveal.guaranteed && " · Guaranteed pull"}</p>
              <h4>{reveal.name}</h4>
              <p>{reveal.duplicateCredits > 0
                ? `Duplicate converted into ${formatCinders(reveal.duplicateCredits)}.`
                : "Added to your inventory."}</p>
            </div>
          </div>
        )}
      </div>

      <details className={styles.rates}>
        <summary>Drop rates <ChevronDown size={18} aria-hidden="true" /></summary>
        <div className={styles.ratesBody}>
          <table className={styles.pool} aria-label="Standard summon odds">
            <thead>
              <tr><th scope="col">Reward</th><th scope="col">Chance</th></tr>
            </thead>
            <tbody>
              {pool.map(({ id, weight }) => (
                <tr key={id} data-rarity={catalog.gear[id]?.rarity.toLowerCase()}>
                  <th scope="row">{catalog.gear[id]?.name ?? catalog.items[id]?.name ?? "Reward"}</th>
                  <td>{weight}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.rateNotes}>
            <p><Sparkles size={16} aria-hidden="true" /> Guaranteed summons give each legendary a 50% chance.</p>
            <p><Coins size={16} aria-hidden="true" /> Duplicate gear converts to {formatCinders(duplicateCredits)}.</p>
          </div>
        </div>
      </details>
    </section>
  );
}
