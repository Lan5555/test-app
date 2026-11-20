"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BriefcaseMedical, Check, ChevronLeft, ChevronRight, Coins, CreditCard, Shield, Sparkles, Sword, Swords } from "lucide-react";
import { gameApi, GameApiError, type Catalog, type CompanionSkillId, type GameProfile } from "../lib/progression";
import { matchesShopFilters, type ShopCategory, type ShopFilters } from "../lib/shopFilters";
import { fighterName } from "./CharacterSelect";

import { FEATURED_FIGHTERS, fighterArtwork, isFeaturedFighter, type FeaturedFighter } from "../lib/warriorSelection";
import ForgeItemCard, { ForgeProductArtwork } from "./ForgeItemCard";
import styles from "./highlands-interface.module.css";
import shopStyles from "./forge.module.css";

type Offer = { gearId: string; name: string; amountMinor: number; kind?: "fighter" | "gear" | "item" | "cinders" | "summon" | "skill" };
type Offers = { enabled: boolean; currency: string; offers: Offer[] };
type Order = {
  id: string;
  gearId: string;
  amountMinor: number;
  currency: string;
  status: "PENDING" | "FULFILLED" | "REVIEW" | "EXPIRED";
  checkoutUrl: string | null;
};

const states: Record<Order["status"], string> = {
  PENDING: "Awaiting payment confirmation",
  FULFILLED: "Delivered to your account",
  REVIEW: "Payment needs support review",
  EXPIRED: "Checkout expired",
};
const action = "rounded-lg border border-amber-200/45 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-100/10 disabled:opacity-45";
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount / 100);
const message = (error: unknown) => error instanceof Error ? error.message : "Checkout is temporarily unavailable.";
const dualSummoningDetails =
  "A one-time purchase permanently unlocks a second summon slot across your account. Buy companion skills separately with Cinders. In battle, use Skills to call two different companions you own for your current fighter, such as an attacker and a healer.";

export default function FlutterwaveGear({ profile, onProfile, returnOrder, previewOnly = false, inventoryCatalog, children, filters }: {
  profile: GameProfile;
  onProfile: (profile: GameProfile) => void;
  returnOrder?: string;
  previewOnly?: boolean;
  inventoryCatalog: Catalog;
  children?: ReactNode;
  filters?: ShopFilters;
}) {
  const [catalog, setCatalog] = useState<Offers>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selection, setSelection] = useState<Offer>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const attemptedReturn = useRef<string | undefined>(undefined);
  const checkoutEmail = useRef<HTMLInputElement>(null);
  const checkoutTrigger = useRef<HTMLButtonElement>(null);
  const carousel = useRef<HTMLUListElement>(null);
  const carouselId = useId();
  const [navigation, setNavigation] = useState({ previous: false, next: false });

  const syncNavigation = useCallback(() => {
    const rail = carousel.current;
    if (!rail) return;
    const previous = rail.scrollLeft > 1;
    const next = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
    setNavigation((current) => current.previous === previous && current.next === next
      ? current : { previous, next });
  }, []);

  useEffect(() => {
    const rail = carousel.current;
    if (!rail) return;
    syncNavigation();
    const resize = new ResizeObserver(syncNavigation);
    resize.observe(rail);
    if (rail.firstElementChild) resize.observe(rail.firstElementChild);
    return () => resize.disconnect();
  }, [catalog, filters, syncNavigation]);

  function moveCarousel(direction: -1 | 1) {
    const rail = carousel.current;
    const first = rail?.firstElementChild;
    if (!rail || !first) return;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    const step = first.getBoundingClientRect().width + gap;
    rail.scrollBy({ left: step * direction });
  }

  const add = useCallback((order: Order) => {
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
  }, []);

  const check = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const order = await gameApi<Order>(`/checkout/${id}/verify`, { method: "POST", timeoutMs: 20000 });
      add(order);
      setNotice(states[order.status]);
      if (order.status === "FULFILLED") onProfile(await gameApi<GameProfile>("/profile"));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }, [add, onProfile]);

  useEffect(() => {
    let current = true;
    gameApi<Offers>("/checkout/offers").then((next) => {
      if (current) setCatalog(next);
    }).catch((reason) => { if (current) setError(message(reason)); });
    if (!previewOnly) {
      gameApi<Order[]>("/checkout/orders").then((history) => {
        if (current) {
          setOrders((latest) => [...latest, ...history.filter((order) => !latest.some(({ id }) => id === order.id))]);
        }
      }).catch((reason) => { if (current) setError(message(reason)); });
    }
    return () => { current = false; };
  }, [previewOnly]);

  useEffect(() => {
    if (previewOnly || !returnOrder || attemptedReturn.current === returnOrder) return;
    attemptedReturn.current = returnOrder;
    void check(returnOrder);
  }, [check, previewOnly, returnOrder]);

  useEffect(() => {
    if (selection) checkoutEmail.current?.focus();
  }, [selection]);

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || previewOnly || busy || !catalog?.enabled) return;
    const form = new FormData(event.currentTarget);
    const key = `embrace-cash-${profile.id}-${selection.gearId}`;
    const requestId = sessionStorage.getItem(key) ?? crypto.randomUUID();
    sessionStorage.setItem(key, requestId);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const order = await gameApi<Order>("/checkout", {
        method: "POST",
        timeoutMs: 20000,
        body: { requestId, gearId: selection.gearId, email: form.get("email") },
      });
      add(order);
      sessionStorage.removeItem(key);
      setSelection(undefined);
      if (order.checkoutUrl) {
        window.location.assign(order.checkoutUrl);
      } else {
        setNotice(states[order.status]);
        if (order.status === "FULFILLED") onProfile(await gameApi<GameProfile>("/profile"));
      }
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 400) sessionStorage.removeItem(key);
      setError(message(reason));
      const history = await gameApi<Order[]>("/checkout/orders").catch(() => undefined);
      if (history) setOrders(history);
    } finally {
      setBusy(false);
    }
  }

  const skillFor = (id: string) => inventoryCatalog.skills?.[id as CompanionSkillId];
  const owns = (offer: Offer) => offer.kind === "skill" ? Boolean(profile.unlockedSkills?.some((id) => id === offer.gearId))
    : offer.kind !== "item" && offer.kind !== "cinders" && profile.gear.includes(offer.gearId);
  const offers = catalog?.offers.filter((offer) => {
    if (offer.kind === "fighter" || isFeaturedFighter(offer.gearId)) return false;
    const gear = inventoryCatalog.gear[offer.gearId];
    const skill = skillFor(offer.gearId);
    const category: ShopCategory = offer.kind === "skill" ? "skills" : offer.kind === "summon" ? "upgrades"
      : offer.kind === "item" ? "items" : offer.kind === "cinders" ? "currency" : gear?.slot === "armor" ? "armor" : "weapons";
    return !filters || matchesShopFilters(filters, category, owns(offer), offer.name,
      skill?.description ?? inventoryCatalog.items[offer.gearId]?.description, fighterName(skill?.fighter));
  }) ?? [];
  const fighters = (Object.keys(FEATURED_FIGHTERS) as FeaturedFighter[]).filter((id) =>
    !filters || matchesShopFilters(filters, "fighters", Boolean(profile.fighters?.includes(id)), FEATURED_FIGHTERS[id].name));
  const activeProducts = new Set(orders.filter(({ status }) => status === "PENDING" || status === "REVIEW").map(({ gearId }) => gearId));
  const canPurchase = !previewOnly && catalog?.enabled;

  function selectOffer(offer: Offer, trigger: HTMLButtonElement) {
    checkoutTrigger.current = trigger;
    setSelection(offer);
  }

  return (
    <>
      {notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {filters?.payment !== "cinders" && filters?.category !== "fighters" && <section aria-labelledby="forge-cash-shop" className={shopStyles.premiumShelf}>
        <div className={shopStyles.premiumHeading}>
          <h3 id="forge-cash-shop" className={shopStyles.shopSectionTitle}><CreditCard size={22} aria-hidden="true" />Premium items</h3>
          {offers.length > 1 && <div className={shopStyles.carouselControls}>
            <button type="button" aria-label="Previous premium items" aria-controls={carouselId}
              aria-disabled={!navigation.previous} onClick={() => navigation.previous && moveCarousel(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" aria-label="Next premium items" aria-controls={carouselId}
              aria-disabled={!navigation.next} onClick={() => navigation.next && moveCarousel(1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>}
        </div>
        {previewOnly && <p className={shopStyles.shopEffect}>Use the Forge on the main menu to pay with Flutterwave.</p>}
        {!catalog && !error && <p role="status">Loading premium offers…</p>}
        {catalog && !catalog.enabled && <p className={shopStyles.shopEffect}>Premium checkout is currently unavailable.</p>}
        {catalog?.enabled && offers.length === 0 && <p className={shopStyles.shopEffect}>No premium items match these filters.</p>}
        {catalog && offers.length > 0 && <ul ref={carousel} id={carouselId} role="list" aria-label="Premium offers"
          className={shopStyles.premiumCarousel} onScroll={syncNavigation}>
          {offers.map((offer) => {
            const consumable = offer.kind === "item";
            const cinders = offer.kind === "cinders";
            const dualSummoning = offer.kind === "summon";
            const owned = owns(offer);
            const skill = offer.kind === "skill" ? skillFor(offer.gearId) : undefined;
            const fighterLocked = skill && isFeaturedFighter(skill.fighter) && !profile.fighters?.includes(skill.fighter);
            const gear = inventoryCatalog.gear[offer.gearId];
            const description = dualSummoning
              ? dualSummoningDetails
              : skill?.description ?? (consumable ? inventoryCatalog.items[offer.gearId]?.description : undefined);
            const stat = dualSummoning ? "Two companions per battle" : skill ? fighterName(skill.fighter) : !consumable && gear
              ? (gear.slot === "weapon" ? `+${gear.attack} attack` : `+${gear.armor} defense`)
              : undefined;
            const Icon = dualSummoning || offer.kind === "skill" ? Sparkles : cinders ? Coins : consumable ? BriefcaseMedical : gear?.slot === "armor" ? Shield : Sword;
            const price = money(offer.amountMinor, catalog.currency);
            const pending = activeProducts.has(offer.gearId);
            return <ForgeItemCard key={offer.gearId} productId={offer.gearId} name={offer.name} Icon={Icon}
              heading="h4" stat={stat} description={description} owned={owned}
              quantity={consumable ? profile.items[offer.gearId] ?? 0 : undefined}>
              {!owned && <div className={shopStyles.shopCardAction}>
                {canPurchase && !pending && !fighterLocked ? (
                  <button type="button" className={shopStyles.buyMotion} aria-label={`Buy ${offer.name} for ${price}`} disabled={busy}
                    onClick={(event) => selectOffer(offer, event.currentTarget)}>
                    {consumable ? "Buy one" : "Buy"} for {price}
                  </button>
                ) : <p>{price}{consumable && " each"}{pending && " · Checkout started"}</p>}
              </div>}
              {!owned && fighterLocked && <p className={shopStyles.shopEffect}>Unlock {fighterName(skill?.fighter)} first.</p>}
            </ForgeItemCard>;
          })}
        </ul>}
      </section>}
      {selection && catalog && (
        <form onSubmit={begin} className="space-y-3 rounded-lg border border-amber-200/20 p-3">
          {selection.kind === "summon" ? (
            <div className={shopStyles.shopCardHeader}>
              <ForgeProductArtwork productId={selection.gearId} Icon={Sparkles} />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{selection.name} · {money(selection.amountMinor, catalog.currency)}</p>
                <p>{dualSummoningDetails}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm">{selection.name}{selection.kind === "item" && " × 1"} · {money(selection.amountMinor, catalog.currency)}</p>
          )}
          <label className="block text-sm">Email for your Flutterwave receipt
            <input ref={checkoutEmail} name="email" type="email" autoComplete="email" required maxLength={254}
              className="mt-1 block w-full rounded-lg border border-white/20 bg-black px-3 py-2 text-white" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={`${action} ${shopStyles.buyMotion}`} disabled={busy}>{busy ? "Opening checkout…" : "Continue to Flutterwave"}</button>
            <button type="button" className={action} disabled={busy} onClick={() => {
              setSelection(undefined);
              checkoutTrigger.current?.focus();
            }}>Cancel</button>
          </div>
        </form>
      )}
      {children}
      {filters?.payment !== "cinders" && (fighters.length > 0 || filters?.category === "fighters") && <section aria-labelledby="forge-fighter-shop" className={styles.featured}>
        <h3 id="forge-fighter-shop" className={shopStyles.shopSectionTitle}><Swords size={22} aria-hidden="true" />Purchasable fighters</h3>
        {fighters.length === 0 && <p className={shopStyles.shopEffect}>No fighters match these filters.</p>}
        <ul role="list" className={styles.fighterBanners}>
          {fighters.map((id) => {
            const offer = catalog?.offers.find(({ gearId }) => gearId === id);
            const owned = profile.fighters?.includes(id);
            const pending = activeProducts.has(id);
            const price = offer && catalog ? money(offer.amountMinor, catalog.currency) : undefined;
            return (
              <li key={id} className={styles.fighterBanner}>
                <img src={fighterArtwork(id)} alt="" width={1152} height={648} />
                <div className={styles.fighterCaption}>
                  <h4>{FEATURED_FIGHTERS[id].name}</h4>
                  {owned ? <span className={shopStyles.shopOwned}><Check size={15} aria-hidden="true" />Owned</span> : canPurchase && offer && !pending ? (
                    <button type="button" className={`${action} ${shopStyles.buyMotion}`} aria-label={`Unlock ${offer.name} for ${price}`} disabled={busy}
                      onClick={(event) => selectOffer(offer, event.currentTarget)}>
                      Unlock for {price}
                    </button>
                  ) : (
                    <p className={shopStyles.shopEffect}>
                      {price ?? (!catalog && !error ? "Checking availability…" : "Checkout unavailable")}
                      {pending && " · Checkout started"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>}
      {orders.length > 0 && <section aria-labelledby="forge-checkout-orders" className="space-y-2">
        <h3 id="forge-checkout-orders" className="font-semibold">Your Flutterwave orders</h3>
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2">
              <div className="text-sm">
                <p>{catalog?.offers.find((offer) => offer.gearId === order.gearId)?.name
                  ?? (isFeaturedFighter(order.gearId) ? FEATURED_FIGHTERS[order.gearId].name : undefined)
                  ?? inventoryCatalog.gear[order.gearId]?.name
                  ?? inventoryCatalog.items[order.gearId]?.name
                  ?? "Shop purchase"} · {money(order.amountMinor, order.currency)}</p>
                <p className="text-stone-300">{states[order.status]}</p>
                {(order.status === "REVIEW" || (order.status === "PENDING" && !order.checkoutUrl)) &&
                  <p className="select-all break-all text-xs">Order {order.id}</p>}
              </div>
              {order.status === "PENDING" && <div className="flex flex-wrap gap-2">
                {order.checkoutUrl && <a className={action} href={order.checkoutUrl}>Resume checkout</a>}
                <button type="button" className={action} disabled={busy} onClick={() => void check(order.id)}>Check payment</button>
              </div>}
            </li>
          ))}
        </ul>
      </section>}
    </>
  );
}
