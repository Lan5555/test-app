"use client";

import Link from "next/link";
import { ArrowLeft, Gauge, Shield, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { gameApi, readGameSession, type GameProfile } from "../lib/progression";

export default function PlayerStatsPage() {
  const [profile, setProfile] = useState<GameProfile>();
  const [failure, setFailure] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const session = readGameSession();
    if (!session) {
      setFailure("Sign in through the Cinder Forge to view your player stats.");
      return;
    }
    let current = true;
    gameApi<GameProfile>("/profile", { token: session.token })
      .then((data) => { if (current) setProfile(data); })
      .catch((error: Error) => { if (current) setFailure(error.message); });
    return () => { current = false; };
  }, [revision]);

  const progression = profile?.progression;
  const attributes = [
    { name: "Strength", value: progression?.attack, icon: Swords, description: "Extra damage from your player level." },
    { name: "Endurance", value: progression?.defense, icon: Shield, description: "Damage absorbed per hit from your player level." },
    { name: "Speed", value: progression?.speed, icon: Gauge, description: "Higher speed resolves your action sooner among allies in the same round." },
  ];

  return (
    <main className="min-h-dvh bg-[#0d171f] px-5 py-8 text-[#fff0d8]">
      <div className="mx-auto grid max-w-4xl gap-7">
        <Link href="/pages/embrace-game" className="inline-flex w-fit items-center gap-2 text-sm text-amber-200 hover:underline">
          <ArrowLeft size={17} /> Back to the Highlands
        </Link>
        <header>
          <h1 className="font-serif text-4xl font-bold sm:text-5xl">Player Stats</h1>
          {profile && <p className="mt-2 text-slate-300">{profile.username}</p>}
        </header>
        {failure ? (
          <div className="rounded-lg border border-orange-300/40 bg-orange-950/30 p-4" role="alert">
            <p>{failure}</p>
            <button type="button" className="mt-3 underline" onClick={() => { setFailure(""); setRevision(revision + 1); }}>Try again</button>
          </div>
        ) : !profile ? (
          <p role="status" className="text-slate-300">Loading player stats…</p>
        ) : (
          <>
            {progression && <section aria-label="Level and experience" className="rounded-xl border border-amber-200/30 bg-[#192631] p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl font-semibold">Level {progression.level}</h2>
                <p className="text-sm text-amber-200">{progression.current} / {progression.required} XP to next level</p>
              </div>
              <progress aria-label="Experience to next level" className="h-3 w-full accent-amber-300" value={progression.current} max={progression.required} />
              {profile.xp !== undefined && <p className="mt-2 text-sm text-slate-300">{profile.xp.toLocaleString()} total XP</p>}
            </section>}
            <div className="grid gap-3 sm:grid-cols-3">
              {attributes.map(({ name, value, icon: Icon, description }) => (
                <section key={name} className="rounded-xl border border-slate-600 bg-[#17242e] p-5">
                  <h2 className="flex items-center gap-2 font-semibold text-amber-100"><Icon size={17} />{name}</h2>
                  <p className="my-2 text-3xl font-semibold">{value ?? "Unavailable"}</p>
                  <p className="text-sm text-slate-300">{description}</p>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
