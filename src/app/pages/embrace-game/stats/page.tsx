"use client";

import { ArrowLeft, BriefcaseMedical, Coins, Gauge, Shield, ShieldHalf, Sword, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ForgeProductArtwork } from "../components/ForgeItemCard";
import { formatCinders, gameApi, GameApiError, readGameSession, type Catalog, type GameProfile } from "../lib/progression";
import styles from "./stats.module.css";

const menuUrl = "/pages/embrace-game";

type ProfileState =
  | { status: "loading" | "signed-out" }
  | { status: "ready"; profile: GameProfile }
  | { status: "error"; message: string };

function EquippedLoadout({ profile, catalog }: { profile: GameProfile; catalog?: Catalog | null }) {
  const { job, weapon, armor, item, equippedItem } = profile.loadout;
  const slots = [
    { label: "Job", id: job, name: catalog?.jobs[job]?.name, Icon: Swords },
    { label: "Weapon", id: weapon, name: catalog?.gear[weapon]?.name, Icon: Sword },
    { label: "Armor", id: armor, name: catalog?.gear[armor]?.name, Icon: Shield },
    { label: "Battle item", id: item, name: equippedItem?.name ?? catalog?.items[item]?.name, Icon: BriefcaseMedical,
      effect: equippedItem?.effect ?? catalog?.items[item]?.effect },
  ];

  return (
    <section className={styles.equipment} aria-labelledby="player-equipment">
      <h2 id="player-equipment">Equipped loadout</h2>
      {!catalog && <p className={styles.catalogStatus} role="status">
        {catalog === undefined ? "Loading equipment…" : "Equipment details are unavailable."}
      </p>}
      <dl className={styles.equipmentGrid}>
        {slots.map(({ label, id, name, Icon, effect }) => (
          <div className={styles.equipmentSlot} key={label}>
            <dt>{label}</dt>
            <dd>
              <div className={styles.equipmentArt}><ForgeProductArtwork productId={id} Icon={Icon} effect={effect} /></div>
              {name ?? (catalog === undefined ? "Loading…" : "Unavailable")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CharacterSheet({ profile, catalog }: { profile: GameProfile; catalog?: Catalog | null }) {
  const progression = profile.progression;
  const attributes = [
    { name: "Strength", value: progression?.attack, icon: Swords, tone: "amber", detail: "Bonus damage on attacks." },
    { name: "Endurance", value: progression?.defense, icon: Shield, tone: "jade", detail: "Damage absorbed per hit." },
    { name: "Speed", value: progression?.speed, icon: Gauge, tone: "ice", detail: "Higher Speed acts earlier among allies." },
  ];

  return (
    <>
      <section className={styles.hero} aria-labelledby="player-name">
        <div className={styles.identity}>
          {progression && <div className={styles.level} aria-label={`Level ${progression.level}`}>
            <span>Level</span><strong>{progression.level}</strong>
          </div>}
          <h2 id="player-name">{profile.username}</h2>
        </div>
        {progression ? (
          <div className={styles.experience}>
            <div className={styles.experienceHeading}>
              <strong>Experience</strong><span>Level {progression.level + 1}</span>
            </div>
            <progress aria-label="Experience toward next level" value={progression.current} max={progression.required} />
            <div className={styles.experienceDetails}>
              <span>{progression.current.toLocaleString()} / {progression.required.toLocaleString()} XP</span>
              <span>{Math.max(0, progression.required - progression.current).toLocaleString()} XP to level up</span>
            </div>
          </div>
        ) : <p className={styles.catalogStatus}>Level and experience are unavailable.</p>}
        <div className={styles.playerTotals}>
          {profile.xp !== undefined && <span><ShieldHalf size={16} aria-hidden="true" /> {profile.xp.toLocaleString()} total XP</span>}
          <span><Coins size={16} aria-hidden="true" /> {formatCinders(profile.credits)}</span>
        </div>
      </section>

      <section className={styles.attributes} aria-labelledby="combat-attributes">
        <h2 id="combat-attributes">Combat attributes</h2>
        <dl className={styles.attributeGrid}>
          {attributes.map(({ name, value, icon: Icon, tone, detail }) => (
            <div className={styles.attribute} data-tone={tone} key={name}>
              <dt><Icon size={20} aria-hidden="true" /> {name}</dt>
              <dd>
                <span className={styles.statValue} data-unavailable={value === undefined || undefined}>
                  {value === undefined ? "Unavailable" : value.toLocaleString()}
                </span>
                <span className={styles.statDetail}>{detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <EquippedLoadout profile={profile} catalog={catalog} />
    </>
  );
}

export default function PlayerStatsPage() {
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const session = readGameSession();
    if (!session) {
      setState({ status: "signed-out" });
      return;
    }
    let current = true;
    void gameApi<GameProfile>("/profile", { token: session.token })
      .then((profile) => { if (current) setState({ status: "ready", profile }); })
      .catch((error: unknown) => {
        if (!current) return;
        if (error instanceof GameApiError && error.status === 401) setState({ status: "signed-out" });
        else setState({ status: "error", message: error instanceof Error ? error.message : "Player stats are unavailable." });
      });
    void gameApi<Catalog>("/catalog", { token: session.token })
      .then((data) => { if (current) setCatalog(data); })
      .catch(() => { if (current) setCatalog(null); });
    return () => { current = false; };
  }, [revision]);

  return (
    <main className={styles.screen}>
      <div className={styles.sheet}>
        <header className={styles.pageHeader}>
          <Link href={menuUrl} className={styles.back}><ArrowLeft size={17} aria-hidden="true" /> Back to the Highlands</Link>
          <h1>Player Stats</h1>
        </header>
        {state.status === "ready" && <CharacterSheet profile={state.profile} catalog={catalog} />}
        {state.status === "loading" && <p className={styles.feedback} role="status">Loading player stats…</p>}
        {state.status === "signed-out" && <div className={styles.feedback} role="status">
          <p>Sign in through the Cinder Forge to view your player stats.</p>
          <Link href={menuUrl}>Return to the menu</Link>
        </div>}
        {state.status === "error" && <div className={styles.feedback} role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => {
            setState({ status: "loading" });
            setCatalog(undefined);
            setRevision((value) => value + 1);
          }}>Try again</button>
        </div>}
      </div>
    </main>
  );
}
