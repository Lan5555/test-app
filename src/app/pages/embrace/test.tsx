 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AudioLines,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Eye,
  Flame,
  Heart,
  Map,
  Menu,
  MessageSquare,
  Moon,
  Radio,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";

type Role = "Executioner" | "Scout" | "Medic" | "Analyst" | "Chronicler";
type Screen = "lobby" | "story" | "scene" | "explore" | "battle";

type Player = {
  id: string;
  name: string;
  role: Role;
  hp: number;
  maxHp: number;
  ready: boolean;
  online: boolean;
};

type Scene = {
  id: string;
  title: string;
  location: string;
  environment: string;
  description: string;
  threat: string;
  music: string;
  boss: string;
  image: string;
};

type Choice = {
  id: string;
  title: string;
  description: string;
  consequence: string;
  nextScene?: string;
  encounter?: boolean;
};

const scenes: Scene[] = [
  {
    id: "frozen-valley",
    title: "The Frozen Valley",
    location: "Northern Expanse",
    environment: "Snowstorm · Frozen river · Pine forest",
    description:
      "The snow has buried the old road, but something has left fresh footprints beside the radio tower.",
    threat: "Unconfirmed",
    music: "The Frozen Valley",
    boss: "The Winter Warden",
    image:
      "https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=1800&q=85",
  },
  {
    id: "abandoned-facility",
    title: "The Abandoned Facility",
    location: "Research Sector 09",
    environment: "Broken laboratories · Emergency lights · Underground chambers",
    description:
      "The facility is without power, yet every monitor is displaying the same image: your group standing at the entrance.",
    threat: "High",
    music: "Static Beneath the Floor",
    boss: "The Architect",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1800&q=85",
  },
  {
    id: "collapsed-village",
    title: "The Collapsed Village",
    location: "Old Saint Vey",
    environment: "Ash-covered streets · Abandoned houses · Bell tower",
    description:
      "A bell rings from the ruined church. The village records say the church burned thirty years ago.",
    threat: "Severe",
    music: "The Last Bell",
    boss: "The Last Witness",
    image:
      "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1800&q=85",
  },
];

const choices: Choice[] = [
  {
    id: "signal",
    title: "Follow the signal",
    description: "A weak transmission is coming from the abandoned research station.",
    consequence: "The group discovers a hidden route to the research sector.",
    nextScene: "abandoned-facility",
  },
  {
    id: "footprints",
    title: "Follow the footprints",
    description: "The tracks lead into a dense section of forest untouched by the storm.",
    consequence: "Something notices the group before the group notices it.",
    encounter: true,
  },
  {
    id: "cabin",
    title: "Investigate the cabin",
    description: "A light is visible behind the frozen windows.",
    consequence: "A survivor is found, but the cabin door locks behind you.",
    encounter: true,
  },
  {
    id: "camp",
    title: "Return to camp",
    description: "The storm is getting worse. The safest choice may be to retreat.",
    consequence: "The group recovers, but the signal moves to another location.",
  },
];

const initialPlayers: Player[] = [
  { id: "p1", name: "Nicholas", role: "Executioner", hp: 850, maxHp: 1000, ready: true, online: true },
  { id: "p2", name: "Player 02", role: "Scout", hp: 620, maxHp: 800, ready: true, online: true },
  { id: "p3", name: "Player 03", role: "Medic", hp: 940, maxHp: 950, ready: true, online: true },
  { id: "p4", name: "Player 04", role: "Analyst", hp: 700, maxHp: 750, ready: false, online: true },
];

const roleDescriptions: Record<Role, string> = {
  Executioner: "Frontline damage and execution abilities.",
  Scout: "Reconnaissance, mobility and target marking.",
  Medic: "Recovery, cleansing and emergency revival.",
  Analyst: "Weakness detection and battlefield control.",
  Chronicler: "Story manipulation, information and reality distortion.",
};

function Bar({ value, max, danger = false }: { value: number; max: number; danger?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full transition-all duration-500 ${danger ? "bg-red-500" : "bg-cyan-300"}`}
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-white/10 bg-black/45 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

export default function EmbraceGame() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [players, setPlayers] = useState(initialPlayers);
  const [selectedScene, setSelectedScene] = useState(scenes[0]);
  const [selectedRole, setSelectedRole] = useState<Role>("Executioner");
  const [currentHp, setCurrentHp] = useState(850);
  const [enemyHp, setEnemyHp] = useState(4200);
  const [energy, setEnergy] = useState(72);
  const [log, setLog] = useState<string[]>([
    "THE CHRONICLER HAS OPENED A NEW SESSION",
    "GROUP CONNECTION ESTABLISHED",
    "THE FROZEN VALLEY IS AWAITING YOUR ARRIVAL",
  ]);
  const [notice, setNotice] = useState("CONNECTION ESTABLISHED");
  const [musicOn, setMusicOn] = useState(true);
  const [encounter, setEncounter] = useState<Choice | null>(null);
  const [objective, setObjective] = useState("Locate the source of the transmission");
  const [bossPhase, setBossPhase] = useState(1);

  const allReady = players.every((player) => player.ready);

  const addLog = (message: string) => {
    setLog((items) => [message, ...items].slice(0, 8));
    setNotice(message);
  };

  const toggleReady = () => {
    setPlayers((items) =>
      items.map((player) =>
        player.id === "p1" ? { ...player, ready: !player.ready } : player
      )
    );
  };

  const chooseScene = (scene: Scene) => {
    setSelectedScene(scene);
    setObjective(`Explore ${scene.title} and uncover its hidden route`);
    addLog(`SCENE SELECTED: ${scene.title.toUpperCase()}`);
    setScreen("scene");
  };

  const choosePath = (choice: Choice) => {
    addLog(`GROUP CHOICE: ${choice.title.toUpperCase()}`);
    setObjective(choice.consequence);

    if (choice.nextScene) {
      const next = scenes.find((scene) => scene.id === choice.nextScene);
      if (next) {
        setSelectedScene(next);
        addLog(`NEW PATH UNLOCKED: ${next.title.toUpperCase()}`);
      }
    }

    if (choice.encounter) {
      setEncounter(choice);
      addLog("UNKNOWN ENTITY DETECTED");
    } else {
      setEncounter(null);
    }
  };

  const attack = (skill: string, damage: number, cost: number) => {
    if (energy < cost) {
      addLog("NOT ENOUGH ENERGY");
      return;
    }

    setEnergy((value) => value - cost);
    setEnemyHp((value) => Math.max(0, value - damage));
    addLog(`${skill.toUpperCase()} DEALT ${damage} DAMAGE`);

    if (enemyHp - damage <= 2800 && bossPhase === 1) {
      setBossPhase(2);
      addLog("BOSS PHASE 2: THE STORM HAS BEGUN");
    }

    if (enemyHp - damage <= 0) {
      addLog("FINAL BATTLE COMPLETE — THE CHRONICLER IS SILENT");
    }
  };

  const takeDamage = () => {
    const damage = 75;
    setCurrentHp((value) => Math.max(0, value - damage));
    addLog(`THE ${selectedScene.boss.toUpperCase()} DEALT ${damage} DAMAGE`);
  };

  useEffect(() => {
    if (screen !== "battle") return;
    const timer = setInterval(() => {
      setEnergy((value) => Math.min(100, value + 4));
    }, 2000);
    return () => clearInterval(timer);
  }, [screen]);

  const background = useMemo(
    () => ({
      backgroundImage: `linear-gradient(90deg, rgba(3,7,12,.96), rgba(3,7,12,.48)), url(${selectedScene.image})`,
    }),
    [selectedScene]
  );

  return (
    <main className="min-h-screen bg-[#03070c] text-white selection:bg-cyan-300 selection:text-black">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(42,70,92,.22),transparent_45%)] pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-10">
        <button onClick={() => setScreen("lobby")} className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center border border-cyan-200/50 text-cyan-200">
            <Eye size={18} />
          </div>
          <div className="text-left">
            <div className="text-lg font-black tracking-[.35em]">EMBRACE</div>
            <div className="text-[9px] tracking-[.3em] text-white/40">THE CHRONICLER SYSTEM</div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {(["lobby", "story", "scene", "explore", "battle"] as Screen[]).map((item) => (
            <button
              key={item}
              onClick={() => setScreen(item)}
              className={`px-4 py-2 text-[10px] uppercase tracking-[.25em] transition ${
                screen === item ? "bg-white text-black" : "text-white/45 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-white/50">
          <button onClick={() => setMusicOn((value) => !value)} title="Toggle music">
            {musicOn ? <Volume2 size={17} /> : <AudioLines size={17} />}
          </button>
          <Menu size={19} className="md:hidden" />
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-74px)]">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 p-6 lg:block">
          <div className="mb-8 text-[10px] uppercase tracking-[.3em] text-white/35">Session status</div>
          <div className="space-y-5 text-xs">
            <div>
              <div className="mb-2 flex justify-between text-white/45">
                <span>Group</span><span>04 / 04</span>
              </div>
              <Bar value={4} max={4} />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-white/45">
                <span>Readiness</span><span>{players.filter((p) => p.ready).length} / 4</span>
              </div>
              <Bar value={players.filter((p) => p.ready).length} max={4} />
            </div>
          </div>

          <div className="mt-10 text-[10px] uppercase tracking-[.3em] text-white/35">Current objective</div>
          <p className="mt-3 text-sm leading-6 text-white/65">{objective}</p>

          <div className="mt-10 border-t border-white/10 pt-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.25em] text-cyan-200">
              <Radio size={13} /> {musicOn ? selectedScene.music : "Audio muted"}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {screen === "lobby" && (
            <div className="mx-auto max-w-6xl p-5 md:p-10">
              <div className="mb-10">
                <div className="mb-3 text-[10px] uppercase tracking-[.4em] text-cyan-200">Multiplayer session</div>
                <h1 className="text-4xl font-light tracking-tight md:text-6xl">Assemble your group.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/45">
                  Four players. One environment. No decision is without consequence.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <Panel className="p-5">
                  <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <div className="text-xs uppercase tracking-[.25em]">Group: EMBRACE-09</div>
                      <div className="mt-1 text-[10px] text-white/35">Leader: Nicholas · Private session</div>
                    </div>
                    <Users size={18} className="text-white/40" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {players.map((player) => (
                      <div key={player.id} className="border border-white/10 bg-white/[.03] p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center border border-white/15 bg-black/30">
                              {player.role === "Executioner" ? <Skull size={17} /> : <Users size={17} />}
                            </div>
                            <div>
                              <div className="text-sm">{player.name}</div>
                              <div className="text-[10px] uppercase tracking-[.2em] text-cyan-200">{player.role}</div>
                            </div>
                          </div>
                          <span className={`text-[9px] uppercase ${player.ready ? "text-cyan-200" : "text-white/30"}`}>
                            {player.ready ? "Ready" : "Waiting"}
                          </span>
                        </div>
                        <div className="mt-4">
                          <Bar value={player.hp} max={player.maxHp} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={toggleReady} className="bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[.25em] text-black">
                      {players[0].ready ? "Unready" : "Ready"}
                    </button>
                    <button
                      disabled={!allReady}
                      onClick={() => setScreen("story")}
                      className="border border-white/20 px-5 py-3 text-[10px] uppercase tracking-[.25em] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Start session <ChevronRight className="ml-2 inline" size={14} />
                    </button>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="mb-5 text-[10px] uppercase tracking-[.3em] text-white/35">Your role</div>
                  <div className="mb-4 grid h-32 place-items-center border border-red-400/20 bg-red-950/20">
                    <Skull size={40} className="text-red-300/70" />
                  </div>
                  <h2 className="text-2xl font-light">The {selectedRole}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">{roleDescriptions[selectedRole]}</p>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as Role)}
                    className="mt-5 w-full border border-white/15 bg-black p-3 text-xs uppercase tracking-[.15em]"
                  >
                    {Object.keys(roleDescriptions).map((role) => <option key={role}>{role}</option>)}
                  </select>
                </Panel>
              </div>
            </div>
          )}

          {screen === "story" && (
            <div className="mx-auto max-w-6xl p-5 md:p-10">
              <div className="mb-10">
                <div className="text-[10px] uppercase tracking-[.4em] text-cyan-200">Story archive</div>
                <h1 className="mt-3 text-4xl font-light md:text-6xl">The First Embrace</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
                  The signal appeared three nights ago. Nobody remembers sending it.
                  Choose a chapter, then discover which version of the story survives.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {["The First Embrace", "The Hollow", "The Last Transmission"].map((title, index) => (
                  <button
                    key={title}
                    onClick={() => setScreen("scene")}
                    className="group border border-white/10 bg-white/[.03] p-5 text-left transition hover:border-cyan-200/50"
                  >
                    <div className="mb-12 text-[10px] tracking-[.3em] text-white/30">CHAPTER 0{index + 1}</div>
                    <h2 className="text-2xl font-light">{title}</h2>
                    <p className="mt-3 text-sm leading-6 text-white/45">
                      {index === 0 ? "The first signal has been received." : "Locked until the previous path is resolved."}
                    </p>
                    <div className="mt-8 text-[10px] uppercase tracking-[.25em] text-cyan-200 group-hover:translate-x-1 transition">
                      Open chapter <ChevronRight className="inline" size={13} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "scene" && (
            <div className="min-h-full p-5 md:p-10" style={background}>
              <div className="mx-auto max-w-6xl">
                <div className="max-w-2xl pt-8 md:pt-20">
                  <div className="text-[10px] uppercase tracking-[.4em] text-cyan-200">Scene select · Chapter 01</div>
                  <h1 className="mt-4 text-5xl font-light md:text-7xl">{selectedScene.title}</h1>
                  <p className="mt-5 text-sm leading-7 text-white/60">{selectedScene.description}</p>
                  <div className="mt-8 grid gap-3 text-xs text-white/60 sm:grid-cols-2">
                    <div className="border border-white/10 bg-black/30 p-4"><Map className="mb-2" size={16} />{selectedScene.location}</div>
                    <div className="border border-white/10 bg-black/30 p-4"><Activity className="mb-2" size={16} />Threat: {selectedScene.threat}</div>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {scenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => setSelectedScene(scene)}
                        className={`border px-4 py-3 text-[10px] uppercase tracking-[.2em] ${selectedScene.id === scene.id ? "border-cyan-200 bg-cyan-200 text-black" : "border-white/15 text-white/60"}`}
                      >
                        {scene.title}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setScreen("explore")} className="mt-8 bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-[.3em] text-black">
                    Enter scene <ChevronRight className="ml-2 inline" size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {screen === "explore" && (
            <div className="mx-auto max-w-6xl p-5 md:p-10">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[.4em] text-cyan-200">Live exploration</div>
                  <h1 className="mt-3 text-4xl font-light">{selectedScene.title}</h1>
                </div>
                <div className="border border-red-400/30 bg-red-950/20 px-4 py-3 text-[10px] uppercase tracking-[.2em] text-red-200">
                  <Radio className="mr-2 inline" size={13} /> Signal unstable
                </div>
              </div>

              <Panel className="relative min-h-[280px] overflow-hidden p-6 md:p-10" style={background}>
                <div className="relative max-w-2xl">
                  <div className="text-[10px] uppercase tracking-[.35em] text-white/40">Environmental event</div>
                  <p className="mt-5 text-2xl font-light leading-relaxed md:text-4xl">
                    “The snow has covered the road. Something has been following your group for the last twenty minutes.”
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-xs text-cyan-200"><Moon size={14} /> {selectedScene.environment}</div>
                </div>
              </Panel>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {choices.map((choice) => (
                  <button key={choice.id} onClick={() => choosePath(choice)} className="border border-white/10 bg-white/[.03] p-5 text-left transition hover:border-cyan-200/50">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <div className="text-lg">{choice.title}</div>
                        <p className="mt-2 text-sm leading-6 text-white/45">{choice.description}</p>
                      </div>
                      <ChevronRight className="shrink-0 text-white/30" size={18} />
                    </div>
                  </button>
                ))}
              </div>

              {encounter && (
                <Panel className="mt-5 border-red-400/30 p-5">
                  <div className="flex items-center gap-3 text-red-200"><Skull size={18} /> UNKNOWN ENCOUNTER</div>
                  <p className="mt-3 text-white/70">{encounter.consequence}</p>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => setScreen("battle")} className="bg-red-500 px-4 py-3 text-[10px] font-bold uppercase tracking-[.2em] text-black">Engage</button>
                    <button onClick={() => setEncounter(null)} className="border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[.2em]">Retreat</button>
                  </div>
                </Panel>
              )}
            </div>
          )}

          {screen === "battle" && (
            <div className="mx-auto max-w-7xl p-5 md:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[.4em] text-red-300">Final encounter · Phase {bossPhase}</div>
                  <h1 className="mt-2 text-3xl font-light">{selectedScene.boss}</h1>
                </div>
                <div className="text-right text-[10px] uppercase tracking-[.2em] text-white/40">{objective}</div>
              </div>

              <Panel className="relative overflow-hidden p-5 md:p-8" style={background}>
                <div className="relative">
                  <div className="mx-auto max-w-2xl text-center">
                    <div className="mb-4 text-[10px] uppercase tracking-[.4em] text-red-300">Threat level: catastrophic</div>
                    <Skull className="mx-auto mb-4 text-red-300/70" size={56} />
                    <h2 className="text-4xl font-light md:text-6xl">{selectedScene.boss}</h2>
                    <div className="mx-auto mt-6 max-w-lg"><Bar value={enemyHp} max={5000} danger /></div>
                    <div className="mt-2 text-xs text-red-200">{enemyHp.toLocaleString()} / 5,000 HP</div>
                  </div>

                  <div className="mt-10 grid gap-5 lg:grid-cols-[250px_1fr_250px]">
                    <Panel className="p-4">
                      <div className="mb-4 text-[10px] uppercase tracking-[.25em] text-white/35">Party</div>
                      {players.map((player) => (
                        <div key={player.id} className="mb-4">
                          <div className="mb-1 flex justify-between text-xs"><span>{player.name}</span><span className="text-white/35">{player.hp}</span></div>
                          <Bar value={player.id === "p1" ? currentHp : player.hp} max={player.maxHp} danger={player.id === "p1"} />
                          <div className="mt-1 text-[9px] uppercase tracking-[.15em] text-cyan-200">{player.role}</div>
                        </div>
                      ))}
                    </Panel>

                    <div className="flex min-h-[220px] flex-col justify-end">
                      <div className="mb-5 text-center text-sm text-white/50">
                        {bossPhase === 1 ? "The entity is watching your movements." : "The storm has erased the battlefield."}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["Heavy Strike", 180, 12, Swords],
                          ["Execute", 350, 25, Skull],
                          ["Dodge", 0, 8, Shield],
                          ["Blood Oath", 500, 40, Flame],
                        ].map(([name, damage, cost, Icon]) => (
                          <button
                            key={String(name)}
                            onClick={() => Number(damage) ? attack(String(name), Number(damage), Number(cost)) : takeDamage()}
                            className="border border-white/15 bg-black/40 p-4 text-left transition hover:border-red-300/60"
                          >
                            <Icon size={18} className="mb-5 text-red-200" />
                            <div className="text-xs">{String(name)}</div>
                            <div className="mt-1 text-[9px] uppercase text-white/35">{Number(cost)} energy</div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Zap size={15} className="text-cyan-200" />
                        <Bar value={energy} max={100} />
                        <span className="text-xs text-cyan-200">{energy}</span>
                      </div>
                    </div>

                    <Panel className="p-4">
                      <div className="mb-4 text-[10px] uppercase tracking-[.25em] text-white/35">Combat log</div>
                      <div className="space-y-3 text-[10px] leading-5 text-white/55">
                        {log.map((entry, index) => <div key={`${entry}-${index}`}><span className="text-red-300">[{String(index + 1).padStart(2, "0")}]</span> {entry}</div>)}
                      </div>
                    </Panel>
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 border border-cyan-200/20 bg-black/75 px-4 py-3 text-[10px] uppercase tracking-[.2em] text-cyan-200 backdrop-blur">
        <Radio size={13} /> {notice}
      </div>
    </main>
  );
}
