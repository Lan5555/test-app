import { BriefcaseMedical, Coins, Shield, Sparkles, Sword } from "lucide-react";
import { useState } from "react";
import { formatCinders, type Catalog, type GameProfile } from "../lib/progression";
import { matchesShopFilters, type ShopCategory, type ShopFilters } from "../lib/shopFilters";
import { fighterAtlasUrl, isFeaturedFighter, WARRIORS } from "../lib/warriorSelection";
import { fighterName } from "./CharacterSelect";
import ForgeItemCard from "./ForgeItemCard";
import styles from "./forge.module.css";

type ShopItem = {
  id: string;
  name: string;
  price: number;
  portrait?: string;
  effect?: "heal" | "guard";
  stat?: string;
  description?: string;
  owned: boolean;
  quantity?: number;
  requirement?: string;
};

export default function ForgeShop({
  catalog,
  profile,
  locked,
  onBuy,
  filters,
}: {
  catalog: Catalog;
  profile: GameProfile;
  locked: boolean;
  onBuy: (product: string) => void;
  filters: ShopFilters;
}) {
  const [selectedFighter, setSelectedFighter] = useState("");
  const gear = Object.entries(catalog.gear)
    .filter(([, item]) => item.price > 0)
    .map(([id, item]) => ({
      id,
      name: item.name,
      price: item.price,
      slot: item.slot,
      stat: item.slot === "weapon" ? `+${item.attack} attack` : `+${item.armor} defense`,
      owned: profile.gear.includes(id),
    }));
  const sections: {
    id: ShopCategory;
    title: string;
    Icon: typeof Sword;
    items: ShopItem[];
  }[] = [
    {
      id: "skills",
      title: "Companion skills",
      Icon: Sparkles,
      items: Object.entries(catalog.skills ?? {}).flatMap(([id, skill]) => skill && (!selectedFighter || skill.fighter === selectedFighter) ? [{
        id, name: skill.name, price: skill.price,
        portrait: WARRIORS.includes(skill.fighter) ? fighterAtlasUrl(skill.fighter, true) : undefined,
        stat: skill.role ? `${fighterName(skill.fighter)} · ${skill.role[0].toUpperCase()}${skill.role.slice(1)}` : fighterName(skill.fighter),
        description: skill.description,
        owned: profile.unlockedSkills?.some((owned) => owned === id) ?? false,
        requirement: isFeaturedFighter(skill.fighter) && !profile.fighters?.includes(skill.fighter)
          ? `Unlock ${fighterName(skill.fighter)} first.`
          : undefined,
      }] : []),
    },
    { id: "weapons", title: "Weapons", Icon: Sword, items: gear.filter(({ slot }) => slot === "weapon") },
    { id: "armor", title: "Armor", Icon: Shield, items: gear.filter(({ slot }) => slot === "armor") },
    {
      id: "items",
      title: "Battle items",
      Icon: BriefcaseMedical,
      items: Object.entries(catalog.items).filter(([, item]) => item.price > 0).map(([id, item]) => ({
        id, name: item.name, price: item.price,
        effect: item.effect,
        description: item.description,
        owned: false, quantity: profile.items[id] ?? 0,
      })),
    },
  ];
  const visible = sections.map((section) => ({ ...section, items: section.items.filter((item) =>
    matchesShopFilters(filters, section.id, item.owned, item.name, item.stat, item.description),
  ) }));

  if (filters.payment === "cash") return null;

  return (
    <section className={styles.shop} aria-labelledby="forge-cinder-shop">
      <h3 id="forge-cinder-shop" className={styles.shopSectionTitle}><Coins size={22} aria-hidden="true" />Cinder items</h3>
      <div className={styles.shopReward}>
        <span className={styles.shopRewardIcon}><Coins size={24} aria-hidden="true" /></span>
        <div>
          <p className={styles.shopRewardAmount}>Earn {formatCinders(catalog.reward)}</p>
          <p>Take an action in a completed battle{catalog.battleXp ? ` to also earn ${catalog.battleXp} XP` : ""}.</p>
        </div>
      </div>
      {visible.every(({ items }) => !items.length) && <p className={styles.shopEffect}>No Cinder items match these filters.</p>}
      {visible.filter(({ id, items }) => items.length > 0 || id === "skills" && selectedFighter && (filters.category === "all" || filters.category === "skills")).map(({ id, title, Icon, items }) => (
        <section key={id} className={styles.shopCategory} aria-labelledby={`forge-shop-${id}`}>
          <h4 id={`forge-shop-${id}`}><Icon size={19} aria-hidden="true" />{title}</h4>
          {id === "skills" && (
            <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              Fighter
              <select className="rounded border border-white/25 bg-[#142631] p-2" value={selectedFighter}
                onChange={(event) => setSelectedFighter(event.target.value)}>
                <option value="">All fighters</option>
                {WARRIORS.filter((fighter) => Object.values(catalog.skills ?? {}).some((skill) => skill?.fighter === fighter))
                  .map((fighter) => <option key={fighter} value={fighter}>{fighterName(fighter)}</option>)}
              </select>
            </label>
          )}
          <ul role="list" className={styles.shopGrid}>
            {items.map((item) => {
              const shortfall = Math.max(item.price - profile.credits, 0);
              return (
                <ForgeItemCard key={item.id} productId={item.id} name={item.name} Icon={Icon}
                  heading="h5" portrait={item.portrait} effect={item.effect} stat={item.stat} description={item.description}
                  owned={item.owned} quantity={item.quantity}>
                  {!item.owned && (
                    <div className={styles.shopCardAction}>
                      <button
                        type="button"
                        className={styles.buyMotion}
                        disabled={locked || shortfall > 0 || Boolean(item.requirement)}
                        aria-label={`Buy ${item.name} for ${formatCinders(item.price)}`}
                        onClick={() => onBuy(item.id)}
                      >
                        Buy for {formatCinders(item.price)}
                      </button>
                      {item.requirement ? <p>{item.requirement}</p> : shortfall > 0 && <p>Short by {formatCinders(shortfall)}</p>}
                    </div>
                  )}
                </ForgeItemCard>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
