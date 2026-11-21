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
  const totalWeight = pool.reduce((total, entry) => total + entry.weight, 0);
  const rewardCount = pool.length;
  const rarityOdds = Object.entries(
    pool.reduce<Record<string, number>>((totals, entry) => {
      const gear = catalog.gear[entry.id];
      const item = catalog.items[entry.id];
      const rarity = gear?.rarity ?? "common";
      totals[rarity] = (totals[rarity] ?? 0) + entry.weight;
      if (!gear && item) totals.common = (totals.common ?? 0) + entry.weight;
      return totals;
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right));

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
            <p className={styles.pityDetail}>{progress} / {pityAt} pulls · {formatCinders(profile.credits)} available</p>
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
              <ForgeProductArtwork productId={reveal.productId} Icon={Sparkles} portrait={catalog.gear[reveal.productId]?.imageUrl} />
            </div>
            <div className={styles.rewardContent}>
              <p className={styles.rarity}>{reveal.rarity}{reveal.guaranteed && " · Guaranteed pull"}</p>
              <h4>{reveal.name}</h4>
              {catalog.gear[reveal.productId] && (
                <p className={styles.rewardStats}>
                  {catalog.gear[reveal.productId].slot === "weapon"
                    ? `+${catalog.gear[reveal.productId].attack} attack`
                    : `+${catalog.gear[reveal.productId].armor} defense`}
                  {` · ${catalog.gear[reveal.productId].slot}`}
                </p>
              )}
              <p>{reveal.duplicateCredits > 0
                ? `Duplicate converted into ${formatCinders(reveal.duplicateCredits)}.`
                : "Added to your inventory."}</p>
            </div>
          </div>
        )}
      </div>

      <section className={styles.rates} aria-labelledby="summon-rewards-title">
        <div className={styles.ratesHeading}>
          <div>
            <p className={styles.ratesEyebrow}>Reliquary collection</p>
            <h3 id="summon-rewards-title">Possible rewards</h3>
          </div>
          <div className={styles.poolCount}>{rewardCount} discoveries</div>
        </div>

        <div className={styles.oddsSummary} aria-label="Summon odds summary">
          {rarityOdds.map(([rarity, weight]) => (
            <p key={rarity} data-rarity={rarity.toLowerCase()}>
              <strong>{rarity}</strong>
              <span>{totalWeight ? ((weight / totalWeight) * 100).toFixed(1) : "0.0"}%</span>
            </p>
          ))}
        </div>

        <ul className={styles.rewardGallery} aria-label="Standard summon rewards">
          {pool.map(({ id, weight }) => {
            const gear = catalog.gear[id];
            const item = catalog.items[id];
            const rarity = gear?.rarity ?? "common";
            const owned = gear ? profile.gear.includes(id) : Boolean(item && (profile.items[id] ?? 0) > 0);
            const odds = totalWeight ? ((weight / totalWeight) * 100).toFixed(1) : "0.0";
            return (
              <li key={id} className={styles.rewardCard} data-rarity={rarity.toLowerCase()}>
                <div className={styles.galleryArtwork}>
                  <ForgeProductArtwork productId={id} Icon={Sparkles} portrait={gear?.imageUrl} effect={item?.effect} />
                </div>
                <div className={styles.galleryContent}>
                  <div className={styles.galleryTopline}>
                    <span className={styles.galleryRarity}>{rarity}</span>
                    <span className={styles.galleryOdds}>{odds}% chance</span>
                  </div>
                  <h4>{gear?.name ?? item?.name ?? "Reward"}</h4>
                  {gear ? (
                    <p className={styles.galleryDetail}>{gear.slot} · {gear.slot === "weapon" ? `+${gear.attack} attack` : `+${gear.armor} defense`}</p>
                  ) : (
                    <p className={styles.galleryDetail}>{item?.effect === "heal" ? "Restore health" : item?.effect === "guard" ? "Raise guard and add Focus" : "Battle item"}</p>
                  )}
                  <p className={owned ? styles.galleryOwned : styles.galleryStatus}>{owned ? "Already owned" : rarity === "legendary" ? "Guaranteed at 90 pulls" : "Available in this reliquary"}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className={styles.rateNotes}>
          <p><Sparkles size={16} aria-hidden="true" /> At {pityAt} pulls: a random legendary reward is guaranteed.</p>
          <p><Coins size={16} aria-hidden="true" /> Duplicate gear converts to {formatCinders(duplicateCredits)}. Rare and legendary gear have stronger combat stats.</p>
        </div>
      </section>
    </section>
  );
}
