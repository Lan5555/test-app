import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./forge.module.css";

const itemArtwork: Record<string, string> = {
  iron_blade: "/forge/loadout/iron-blade.webp",
  traveler_coat: "/forge/loadout/traveler-coat.webp",
  vanguard: "/forge/loadout/vanguard.webp",
  spellblade: "/forge/loadout/spellblade.webp",
  warden: "/forge/loadout/warden.webp",
  cinders_300: "/forge/loadout/cinders.webp",
  cinders_1000: "/forge/loadout/cinders.webp",
  ashblade: "/forge/shop/ashblade.webp",
  hollowfang: "/forge/shop/hollowfang.webp",
  bellwarden_mail: "/forge/shop/bellwarden-mail.webp",
  oathkeeper_plate: "/forge/shop/oathkeeper-plate.webp",
  bloodleaf_tonic: "/forge/shop/bloodleaf-tonic.webp",
  ward_stone: "/forge/shop/ward-stone.webp",
  crownforged_blade: "/forge/shop/hollowfang.webp",
  sovereign_plate: "/forge/shop/oathkeeper-plate.webp",
  royal_bloodleaf: "/forge/shop/bloodleaf-tonic.webp",
  sovereign_ward: "/forge/shop/ward-stone.webp",
};

export function ForgeProductArtwork({ productId, Icon, portrait, effect }: {
  productId: string;
  Icon: LucideIcon;
  portrait?: string;
  effect?: "heal" | "guard";
}) {
  const known = Object.hasOwn(itemArtwork, productId) ? itemArtwork[productId] : undefined;
  const effectArtwork = effect === "heal" ? itemArtwork.bloodleaf_tonic
    : effect === "guard" ? itemArtwork.ward_stone : undefined;
  const artwork = portrait ?? known ?? effectArtwork;
  return (
    <div className={styles.shopArtwork} aria-hidden="true">
      {artwork ? (
        <Image src={artwork} alt="" fill sizes="112px" className={portrait ? styles.shopPortrait : undefined} />
      ) : <Icon size={30} />}
    </div>
  );
}

export default function ForgeItemCard({
  productId, name, Icon, portrait, effect, stat, description, owned, quantity,
  heading: Heading, children,
}: {
  productId: string;
  name: string;
  Icon: LucideIcon;
  portrait?: string;
  effect?: "heal" | "guard";
  stat?: string;
  description?: string;
  owned?: boolean;
  quantity?: number;
  heading: "h4" | "h5";
  children?: ReactNode;
}) {
  return (
    <li className={styles.shopCard}>
      <div className={styles.shopCardHeader}>
        <ForgeProductArtwork productId={productId} Icon={Icon} portrait={portrait} effect={effect} />
        <div className={styles.shopCardTitle}>
          <Heading>{name}</Heading>
          {stat && <p className={styles.shopStat}>{stat}</p>}
          {owned && <span className={styles.shopOwned}><Check size={15} aria-hidden="true" />Owned</span>}
          {quantity !== undefined && <span className={styles.shopQuantity}>{quantity} owned</span>}
        </div>
      </div>
      {description && (
        <details className={styles.shopDetails}>
          <summary aria-label={`Details for ${name}`}>
            Details <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <p>{description}</p>
        </details>
      )}
      {children}
    </li>
  );
}
