"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Coins, Shield, Sparkles, UserRound, X } from "lucide-react";
import {
  formatCinders, gameApi, GameApiError, readGameSession, storeGameSession,
  type Catalog, type GameProfile, type GameSession, type Loadout,
} from "../lib/progression";
import { socket } from "../lib/websocket";
import { AudioController } from "../hooks/audioHandler";
import { SUMMON_REVEAL_DELAY } from "../lib/arenaAssets";
import interfaceStyles from "./highlands-interface.module.css";
import dialogStyles from "./game-dialog.module.css";
import FlutterwaveGear from "./FlutterwaveGear";
import ForgeLoadout from "./ForgeLoadout";
import ForgeShop from "./ForgeShop";
import SummonPanel, { type SummonReveal } from "./SummonPanel";
import styles from "./forge.module.css";

type Tab = "loadout" | "summon" | "shop";
type Attempt = { requestId: string; product: string };
type Purchase = { profile: GameProfile; result: { itemId: string; duplicateCredits: number; spent: number; guaranteed: boolean } };
const input = "w-full rounded border border-emerald-100/25 bg-[#0a141a] px-3 py-2 text-stone-100";
const button = "rounded border border-emerald-100/50 bg-emerald-100 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-50 disabled:opacity-40";
const quietButton = "rounded-lg border border-stone-500/50 px-3 py-2 text-sm text-stone-200 hover:bg-white/10 disabled:opacity-40";
function errorMessage(error: unknown) {
  if (error instanceof GameApiError && error.message === "You do not have enough credits.") {
    return "You do not have enough Cinders.";
  }
  return error instanceof Error ? error.message : "The game service is unavailable.";
}

export default function ForgePanel({ onClose, onSession, inLobby = false, returnOrder }: {
  onClose: () => void;
  onSession?: (session: GameSession | null) => void;
  inLobby?: boolean;
  returnOrder?: string;
}) {
  const [session, setSession] = useState(readGameSession);
  const [profile, setProfile] = useState<GameProfile>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [draft, setDraft] = useState<Loadout>();
  const [tab, setTab] = useState<Tab>(returnOrder ? "shop" : "loadout");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Attempt>();
  const [reveal, setReveal] = useState<SummonReveal>();
  const lastHeardReveal = useRef<string>(undefined);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (tab !== "summon" || !reveal || reveal.requestId === lastHeardReveal.current) return;
    lastHeardReveal.current = reveal.requestId;
    const sound = reveal.rarity === "legendary" ? "legendary" : "reveal";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void AudioController.playSummonEffect(sound);
      return;
    }
    void AudioController.playSummonEffect("burst");
    const timer = window.setTimeout(() => void AudioController.playSummonEffect(sound), SUMMON_REVEAL_DELAY);
    return () => window.clearTimeout(timer);
  }, [reveal, tab]);

  useEffect(() => {
    dialog?.showModal();
  }, [dialog]);

  useEffect(() => {
    if (!session) return;
    let current = true;
    try {
      const saved = sessionStorage.getItem(`embrace-purchase-${session.id}`);
      if (saved) setPending(JSON.parse(saved) as Attempt);
    } catch {
      // Unavailable browser storage leaves the current attempt in memory.
    }
    Promise.all([gameApi<GameProfile>("/profile"), gameApi<Catalog>("/catalog")])
      .then(([next, items]) => {
        if (!current) return;
        setProfile(next);
        setDraft(next.loadout);
        setCatalog(items);
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(errorMessage(reason));
        if (reason instanceof GameApiError && reason.status === 401) {
          storeGameSession(null);
          socket.disconnect();
          setSession(null);
        }
      });
    return () => { current = false; };
  }, [session, reload]);

  const report = (reason: unknown) => {
    setError(errorMessage(reason));
    if (reason instanceof GameApiError && reason.status === 401 && session) {
      storeGameSession(null);
      socket.disconnect();
      setSession(null);
      onSession?.(null);
    }
  };

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const next = await gameApi<GameSession>(register ? "/auth/register" : "/auth/login", {
        method: "POST", body: { username: form.get("username"), password: form.get("password") },
      });
      storeGameSession(next);
      socket.disconnect();
      setSession(next);
      onSession?.(next);
    } catch (reason) {
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await gameApi<void>("/auth/logout", { method: "POST" });
      storeGameSession(null);
      socket.disconnect();
      setSession(null);
      setProfile(undefined);
      setPending(undefined);
      setReveal(undefined);
      onSession?.(null);
    } catch (reason) {
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await gameApi<GameProfile>("/loadout", { method: "PUT", body: draft });
      setProfile(next);
      setDraft(next.loadout);
      setNotice("Loadout saved.");
      if (inLobby) socket.send({ type: "REFRESH_LOADOUT", playerId: next.id });
    } catch (reason) {
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  async function buy(product: string) {
    if (!session || !catalog) return;
    const attempt = pending ?? { requestId: crypto.randomUUID(), product };
    const key = `embrace-purchase-${session.id}`;
    setPending(attempt);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      sessionStorage.setItem(key, JSON.stringify(attempt));
      if (attempt.product === "summon") {
        setTab("summon");
        setReveal(undefined);
        void AudioController.playSummonEffect("charge");
      }
      const { result, profile: next } = await gameApi<Purchase>("/purchases", { method: "POST", body: attempt });
      setProfile(next);
      const gear = catalog.gear[result.itemId];
      const skill = result.itemId.startsWith("call_")
        ? catalog.skills?.[result.itemId as `call_${string}`]
        : undefined;
      const name = gear?.name ?? catalog.items[result.itemId]?.name ?? skill?.name ?? "Reward";
      if (attempt.product === "summon") {
        const rarity = gear?.rarity ?? "consumable";
        setReveal({ name, rarity, productId: result.itemId, requestId: attempt.requestId, duplicateCredits: result.duplicateCredits, guaranteed: result.guaranteed });
      } else if (skill) {
        setNotice(`${name} unlocked. It appears in its fighter’s Skills menu.`);
        if (inLobby) socket.send({ type: "REFRESH_LOADOUT", playerId: next.id });
      } else {
        setNotice(result.duplicateCredits ? `${name} duplicate converted into ${formatCinders(result.duplicateCredits)}.` : `${name} added to your inventory.`);
      }
      sessionStorage.removeItem(key);
      setPending(undefined);
    } catch (reason) {
      if (reason instanceof GameApiError && [400, 409].includes(reason.status)) {
        sessionStorage.removeItem(key);
        setPending(undefined);
      }
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={setDialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className={`${dialogStyles.surface} ${interfaceStyles.forgeDialog} ${inLobby ? "" : dialogStyles.menuGlass}`} aria-labelledby="forge-heading">
      <header className={`${dialogStyles.body} ${dialogStyles.modalRail} flex items-start justify-between gap-4 ${interfaceStyles.forgeHeader}`}>
        <div>
          <p className="text-xs uppercase tracking-[.24em] text-emerald-100">Embrace Your Horror</p>
          <h2 id="forge-heading" className="mt-2 font-serif text-3xl">{session ? "The Cinder Forge" : "Enter the Highlands"}</h2>
        </div>
        <button type="button" className={`${quietButton} ${dialogStyles.modalClose}`} aria-label="Close Forge" onClick={onClose} disabled={busy}><X size={18} /></button>
      </header>
      <div className={`${dialogStyles.body} space-y-5`}>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-100">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-100">{notice}</p>}
        {!session ? (
          <form onSubmit={authenticate} className="mx-auto max-w-sm space-y-4">
            <label className="block space-y-1 text-sm">Username
              <input className={input} name="username" autoComplete="username" pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers, or underscores" required />
            </label>
            <label className="block space-y-1 text-sm">Password
              <input className={input} name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={10} maxLength={128} required />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={button} disabled={busy}>{register ? "Create account" : "Sign in"}</button>
              <button type="button" className={quietButton} disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>
                {register ? "Use existing account" : "Create an account"}
              </button>
            </div>
          </form>
        ) : !profile || !catalog || !draft ? <div className="flex items-center gap-3"><p>Loading your inventory…</p>{error && <button type="button" className={quietButton} onClick={() => { setError(""); setReload(reload + 1); }}>Retry</button>}</div> : (
          <>
            <div className={styles.accountBar}>
              <div className={styles.account}>
                <span className={styles.accountIcon}><UserRound size={17} aria-hidden="true" /></span>
                <strong>{profile.username}</strong>
                {profile.progression && (
                  <span className={styles.forgeExperience}>
                    <span>Level {profile.progression.level} · {profile.progression.current}/{profile.progression.required} XP</span>
                    <progress aria-label="Experience toward next level" value={profile.progression.current} max={profile.progression.required} />
                    <span>+{profile.progression.attack} attack · +{profile.progression.defense} defense</span>
                  </span>
                )}
              </div>
              <div className={styles.accountActions}>
                <span className={styles.balance}><Coins size={17} aria-hidden="true" /> {formatCinders(profile.credits)}</span>
                {!inLobby && <button type="button" disabled={busy} className={styles.signOut} onClick={signOut}>Sign out</button>}
              </div>
            </div>
            <nav aria-label="Forge" className={styles.forgeNav}>
              {([["loadout", "Loadout", Shield], ["summon", "Summon", Sparkles], ["shop", "Shop", Coins]] as const).map(([id, label, Icon]) => (
                <button type="button" key={id} aria-current={tab === id ? "page" : undefined} disabled={busy}
                  onClick={() => { setTab(id); setNotice(""); }}
                ><Icon size={18} aria-hidden="true" />{label}</button>
              ))}
            </nav>
            {pending && (tab !== "summon" || pending.product !== "summon") && <button type="button" className={quietButton} disabled={busy} onClick={() => buy(pending.product)}>Retry pending purchase</button>}
            {tab === "loadout" && (
              <ForgeLoadout catalog={catalog} profile={profile} draft={draft} busy={busy} onChange={setDraft} onSubmit={save} />
            )}
            {tab === "summon" && (
              <SummonPanel catalog={catalog} profile={profile} reveal={reveal} busy={busy}
                pendingProduct={pending?.product} onSummon={() => buy("summon")} />
            )}
            {tab === "shop" && (
              <section aria-label="Forge shop" className={styles.shopSections}>
                <FlutterwaveGear profile={profile} onProfile={setProfile} returnOrder={returnOrder}
                  previewOnly={inLobby} inventoryCatalog={catalog}>
                  <ForgeShop catalog={catalog} profile={profile} locked={busy || Boolean(pending)} onBuy={buy} />
                </FlutterwaveGear>
              </section>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
