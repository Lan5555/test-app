'use client'
import React, { useState, useEffect, useCallback, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Skull, Radio, Footprints, Users, User,
  ShieldAlert, Heart, Swords, ShieldHalf, Wind, Volume2, VolumeX,
  Music, Lock, LockOpen, CheckCircle2, XCircle,
  BookOpen, DoorOpen, Tent, MapPin, Activity, Sparkles,
  Play, X, Compass, ScrollText, Ghost
} from "lucide-react";

/* ============================================================================
   EMBRACE — a story-driven survival horror RPG interface
   Single-file interactive prototype. All multiplayer / real-time behaviour
   is simulated locally with React state so a real backend (Socket.IO /
   Firebase / WebSockets) could be swapped in behind the same action
   handlers (see the `dispatchAction` functions throughout).
   ========================================================================= */

/* ---------------------------------- types ---------------------------------- */

type DangerLevel = "none" | "low" | "medium" | "high";
type Screen =
  | "menu" | "lobby" | "storySelect" | "briefing" | "roleSelect"
  | "exploration" | "prep" | "battle" | "victory";
type MusicStateKey = "exploration" | "danger" | "combat" | "boss" | "story" | "victory";
type Flags = Record<string, boolean>;

interface Ability {
  id: string;
  name: string;
  cost: number;
  cooldown: number;
  dmg: [number, number];
  heal?: [number, number];
  desc: string;
}

interface Role {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  hp: number;
  energy: number;
  color: string;
  description: string;
  abilities: Ability[];
}

interface PartyMember {
  id: string;
  name: string;
  role: string;
  status: string;
  connected: boolean;
  leader: boolean;
  hp: number;
}

interface Scene {
  id: string;
  name: string;
  weather: string;
  time: string;
  tags: string[];
  gradient: string;
  intro: string;
  finalBoss: string;
}

interface ExplorationAction {
  id: string;
  label: string;
  icon: LucideIcon;
  flag: string;
  danger: DangerLevel;
}

interface EncounterOption {
  id: string;
  label: string;
  result: string;
  flag: string;
  hp: number;
  combat?: boolean;
}

interface Encounter {
  type: string;
  title: string;
  body: string;
  options: EncounterOption[];
}

interface BossPhase {
  name: string;
  desc: string;
  threshold: number;
}

interface Boss {
  id: string;
  name: string;
  title: string;
  environment: string;
  recommendedRoles: string;
  hp: number;
  objective: string;
  phases: BossPhase[];
}

interface LogEntry {
  id: string;
  text: string;
}

interface CombatLogEntry {
  id: string;
  text: string;
  color?: string;
}

interface Floater {
  id: string;
  text: string;
  color: string;
  x: number;
}

interface Decision {
  id: string;
  label: string;
  ok: boolean;
}

interface DecisionResultData {
  headline: string;
  body: string;
  hp: number;
}

interface ActiveEncounter {
  id: string;
  flagBase: string;
}

interface MusicStateInfo {
  label: string;
  tone: string;
  color: string;
}

/* ---------------------------------- fonts --------------------------------- */

function useEmbraceFonts(): void {
  useEffect(() => {
    const id = "embrace-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ---------------------------------- utils --------------------------------- */

let uidCounter = 0;
const uid = (p = "id"): string => `${p}_${(uidCounter++).toString(36)}_${Date.now().toString(36)}`;
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const rand = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];

/* ---------------------------------- data ----------------------------------- */

const ROLES: Role[] = [
  {
    id: "executioner",
    name: "THE EXECUTIONER",
    tagline: "Heavy Damage / Frontline",
    icon: Swords,
    hp: 140,
    energy: 100,
    color: "var(--crimson)",
    description:
      "Trained to end things quickly. The Executioner absorbs punishment so the rest of the group doesn't have to.",
    abilities: [
      { id: "execution", name: "Execution", cost: 40, cooldown: 8, dmg: [26, 38], desc: "A single devastating strike aimed at an exposed weak point." },
      { id: "cleave", name: "Cleave", cost: 25, cooldown: 5, dmg: [14, 20], desc: "A wide arc that catches everything nearby." },
      { id: "bloodoath", name: "Blood Oath", cost: 0, cooldown: 14, dmg: [0, 0], desc: "Trade a portion of your own HP for a burst of Energy." },
      { id: "finalsentence", name: "Final Sentence", cost: 90, cooldown: 30, dmg: [55, 75], desc: "Ultimate. A killing blow reserved for what refuses to die." },
    ],
  },
  {
    id: "scout",
    name: "THE SCOUT",
    tagline: "Reconnaissance / Mobility",
    icon: Footprints,
    hp: 95,
    energy: 120,
    color: "var(--cyan)",
    description: "Fast, quiet, and always three steps ahead of whatever is following the group.",
    abilities: [
      { id: "reconpulse", name: "Recon Pulse", cost: 20, cooldown: 6, dmg: [8, 12], desc: "Reveals hidden threats in the immediate area." },
      { id: "silentstep", name: "Silent Step", cost: 15, cooldown: 5, dmg: [0, 0], desc: "Become nearly undetectable for a short window." },
      { id: "marktarget", name: "Mark Target", cost: 25, cooldown: 9, dmg: [10, 16], desc: "Marks an enemy, increasing all damage it takes." },
      { id: "escaperoute", name: "Escape Route", cost: 90, cooldown: 30, dmg: [0, 0], desc: "Ultimate. Opens a guaranteed path out for the whole party." },
    ],
  },
  {
    id: "medic",
    name: "THE MEDIC",
    tagline: "Support / Recovery",
    icon: Heart,
    hp: 105,
    energy: 110,
    color: "#8fd694",
    description: "Keeps the group breathing. Not always able to keep them whole.",
    abilities: [
      { id: "emergencytreatment", name: "Emergency Treatment", cost: 30, cooldown: 6, dmg: [0, 0], heal: [18, 26], desc: "Restores HP to a wounded ally." },
      { id: "purge", name: "Purge", cost: 20, cooldown: 8, dmg: [0, 0], desc: "Removes a harmful status effect." },
      { id: "revive", name: "Revive", cost: 60, cooldown: 24, dmg: [0, 0], desc: "Brings a downed ally back into the fight." },
      { id: "stabilize", name: "Stabilize", cost: 90, cooldown: 30, dmg: [0, 0], heal: [40, 55], desc: "Ultimate. A full-party surge of recovery." },
    ],
  },
  {
    id: "analyst",
    name: "THE ANALYST",
    tagline: "Intelligence / Control",
    icon: Activity,
    hp: 90,
    energy: 130,
    color: "#c9a3e8",
    description: "Sees the pattern behind the horror. That doesn't make it any less horrifying.",
    abilities: [
      { id: "scan", name: "Scan", cost: 15, cooldown: 5, dmg: [4, 8], desc: "Exposes enemy weaknesses for the whole party." },
      { id: "weaknessanalysis", name: "Weakness Analysis", cost: 30, cooldown: 10, dmg: [12, 18], desc: "Exploits a scanned weakness for bonus damage." },
      { id: "systemoverride", name: "System Override", cost: 35, cooldown: 12, dmg: [0, 0], desc: "Disrupts an enemy's next action entirely." },
      { id: "probabilityshift", name: "Probability Shift", cost: 90, cooldown: 30, dmg: [30, 50], desc: "Ultimate. Rewrites the odds of the encounter, briefly." },
    ],
  },
  {
    id: "chronicler",
    name: "THE CHRONICLER",
    tagline: "Story / Information / Special",
    icon: BookOpen,
    hp: 85,
    energy: 100,
    color: "#e8b64f",
    description: "Records what happens so that, later, someone can ask why.",
    abilities: [
      { id: "record", name: "Record", cost: 10, cooldown: 4, dmg: [6, 10], desc: "Documents the enemy, weakening its resolve." },
      { id: "reveal", name: "Reveal", cost: 25, cooldown: 8, dmg: [0, 0], desc: "Uncovers hidden story information mid-encounter." },
      { id: "echo", name: "Echo", cost: 30, cooldown: 10, dmg: [16, 24], desc: "Replays a prior action's effect." },
      { id: "rewrite", name: "Rewrite", cost: 90, cooldown: 30, dmg: [0, 0], heal: [20, 20], desc: "Ultimate. Briefly rewrites a moment of the encounter." },
    ],
  },
];

const PARTY_TEMPLATE: Omit<PartyMember, "hp">[] = [
  { id: "p2", name: "PLAYER 02", role: "scout", status: "Searching the forest", connected: true, leader: false },
  { id: "p3", name: "PLAYER 03", role: "medic", status: "Waiting near the river", connected: true, leader: false },
  { id: "p4", name: "PLAYER 04", role: "analyst", status: "Analyzing the radio signal", connected: true, leader: false },
];

const SCENES: Record<string, Scene> = {
  frozenValley: {
    id: "frozenValley",
    name: "THE FROZEN VALLEY",
    weather: "Snowstorm, easing",
    time: "Dusk",
    tags: ["Snow-covered mountains", "Frozen river", "Abandoned cabin", "Dense pine forest", "Heavy fog"],
    gradient: "linear-gradient(180deg, #0d1620 0%, #0a0f14 55%, #070708 100%)",
    intro:
      "The snow has covered the road. Something has been following your group for the last twenty minutes. Nobody has said so out loud.",
    finalBoss: "winterWarden",
  },
  abandonedFacility: {
    id: "abandonedFacility",
    name: "THE ABANDONED FACILITY",
    weather: "None — recycled air",
    time: "Unknown",
    tags: ["Dark corridors", "Flickering lights", "Broken laboratories", "Security cameras", "Emergency alarms"],
    gradient: "linear-gradient(180deg, #12130f 0%, #0b0c0a 55%, #060605 100%)",
    intro:
      "The research station's outer door was already open. Whoever left it that way did not close it behind them.",
    finalBoss: "architect",
  },
  hiddenCave: {
    id: "hiddenCave",
    name: "THE HIDDEN CAVE",
    weather: "Still",
    time: "No light reaches here",
    tags: ["Wet stone", "Old bones", "Distant dripping", "A warmth that shouldn't exist this deep"],
    gradient: "linear-gradient(180deg, #150e12 0%, #0c0809 55%, #060505 100%)",
    intro: "The footprints end here. Something large enough to make them is still deciding what to do about you.",
    finalBoss: "embraced",
  },
  collapsedVillage: {
    id: "collapsedVillage",
    name: "THE COLLAPSED VILLAGE",
    weather: "Ash falling like snow",
    time: "Perpetual dusk",
    tags: ["Abandoned houses", "Burning remains", "Foggy streets", "A church with no bell"],
    gradient: "linear-gradient(180deg, #1a0f0d 0%, #0e0908 55%, #070605 100%)",
    intro: "The survivor said this village burned two winters ago. The smoke says otherwise.",
    finalBoss: "lastWitness",
  },
};

const EXPLORATION_ACTIONS: Record<string, ExplorationAction[]> = {
  frozenValley: [
    { id: "followSignal", label: "FOLLOW THE SIGNAL", icon: Radio, flag: "followedSignal", danger: "medium" },
    { id: "followFootprints", label: "FOLLOW THE FOOTPRINTS", icon: Footprints, flag: "followedFootprints", danger: "high" },
    { id: "investigateCabin", label: "INVESTIGATE THE CABIN", icon: Tent, flag: "investigatedCabin", danger: "low" },
    { id: "searchForest", label: "SEARCH THE FOREST", icon: Compass, flag: "searchedForest", danger: "medium" },
    { id: "returnCamp", label: "RETURN TO CAMP", icon: DoorOpen, flag: "returnedToCamp", danger: "none" },
  ],
};

const ENCOUNTER_LIBRARY: Record<string, Encounter> = {
  followSignal: {
    type: "MYSTERY ENCOUNTER",
    title: "A voice is coming from your own radio.",
    body:
      "The transmission from the research station cuts out. Static replaces it. Then, unmistakably, your own voice answers a question none of you asked.",
    options: [
      { id: "respond", label: "Respond", result: "The static resolves into coordinates. A path north has opened.", flag: "signalRespond", hp: -6 },
      { id: "ignore", label: "Ignore", result: "The voice keeps talking without you. It sounds disappointed.", flag: "signalIgnore", hp: 0 },
      { id: "trace", label: "Trace the signal", result: "The Analyst isolates the source: the research station, three kilometers north.", flag: "signalTrace", hp: 0 },
      { id: "destroy", label: "Destroy the radio", result: "The radio goes dark. So does something in the trees, briefly, as if it noticed.", flag: "signalDestroy", hp: -10 },
    ],
  },
  followFootprints: {
    type: "ENVIRONMENTAL ENCOUNTER",
    title: "The footprints are too large to be human.",
    body:
      "They press four centimeters into packed snow and are spaced like something that does not walk so much as decide where it will be next.",
    options: [
      { id: "track", label: "Track them carefully", result: "The trail leads to a fissure in the rock — a cave mouth, breathing warm air.", flag: "trackedFootprints", hp: 0 },
      { id: "callout", label: "Call out", result: "Nothing answers. The footprints, when you look again, are closer.", flag: "calledOut", hp: -12 },
      { id: "abandon", label: "Abandon the trail", result: "You turn back. Something exhales, somewhere behind you, unseen.", flag: "abandonedTrail", hp: -4 },
    ],
  },
  investigateCabin: {
    type: "STORY ENCOUNTER",
    title: "A wounded survivor is calling from the cabin.",
    body:
      "Through the frosted window, a shape moves against the far wall. The voice is hoarse, human, and afraid — or doing an excellent impression of it.",
    options: [
      { id: "help", label: "Help the survivor", result: "She's real, and terrified, and knows what's in the valley. Trust: +1.", flag: "rescuedSurvivor", hp: 0 },
      { id: "question", label: "Question the survivor", result: "Her answers don't line up. She knows that. She keeps talking anyway.", flag: "questionedSurvivor", hp: 0 },
      { id: "leave", label: "Leave them", result: "The group walks on. The calling doesn't stop. It gets more specific.", flag: "leftSurvivor", hp: -8 },
      { id: "searchFirst", label: "Search the cabin first", result: "A logbook, torn out on the last page. Someone left in a hurry, or didn't leave at all.", flag: "searchedCabin", hp: 0 },
    ],
  },
  searchForest: {
    type: "ENEMY ENCOUNTER",
    title: "The trees ahead are moving.",
    body: "Not with the wind. Against it.",
    options: [
      { id: "fight", label: "Fight", result: "You drive it off, but not before it gets a good look at each of you.", flag: "fightForest", hp: -16, combat: true },
      { id: "hide", label: "Hide", result: "It passes within arm's reach. Nobody breathes until it's gone.", flag: "hideForest", hp: 0 },
      { id: "run", label: "Run", result: "You put distance between you and it, but you're no longer sure which direction camp is.", flag: "runForest", hp: -6 },
      { id: "observe", label: "Observe", result: "The Analyst catalogs a weakness before it notices you watching.", flag: "observeForest", hp: -4 },
    ],
  },
  returnCamp: {
    type: "STORY ENCOUNTER",
    title: "The camp radio has a new message waiting.",
    body: "It arrived while you were gone. Nobody sent it.",
    options: [
      { id: "restHp", label: "Rest and recover", result: "The party recovers strength. Somewhere, the storm gets a little worse.", flag: "restedCamp", hp: 20 },
      { id: "listen", label: "Listen to the message", result: "The Chronicler's voice, reading back a decision you haven't made yet.", flag: "listenedMessage", hp: 0 },
    ],
  },
};

const BOSSES: Record<string, Boss> = {
  winterWarden: {
    id: "winterWarden",
    name: "THE WINTER WARDEN",
    title: "You followed the signal into the valley. Now the mountain has answered.",
    environment: "The Frozen Valley — summit clearing",
    recommendedRoles: "Frontline + Support",
    hp: 640,
    objective: "SURVIVE THE WARDEN'S LAST EMBRACE.",
    phases: [
      { name: "THE SILENCE", desc: "The boss observes the group.", threshold: 1.0 },
      { name: "THE STORM", desc: "The environment changes. Snowstorm intensifies.", threshold: 0.6 },
      { name: "THE EMBRACE", desc: "The boss begins using its final ability.", threshold: 0.25 },
    ],
  },
  architect: {
    id: "architect",
    name: "THE ARCHITECT",
    title: "You entered the research station. It has been expecting a visitor.",
    environment: "Abandoned Facility — central chamber",
    recommendedRoles: "Control + Ranged",
    hp: 700,
    objective: "SHUT DOWN WHAT THE ARCHITECT STARTED.",
    phases: [
      { name: "OBSERVATION", desc: "The Architect studies your patterns.", threshold: 1.0 },
      { name: "REPLICATION", desc: "It begins copying your party's abilities.", threshold: 0.55 },
      { name: "CASCADE FAILURE", desc: "The facility itself turns against you.", threshold: 0.2 },
    ],
  },
  embraced: {
    id: "embraced",
    name: "THE EMBRACED",
    title: "You found the hidden cave. Something has been waiting there far longer than you.",
    environment: "The Hidden Cave — the warm dark",
    recommendedRoles: "Frontline + Control",
    hp: 680,
    objective: "DO NOT LET IT FINISH THE EMBRACE.",
    phases: [
      { name: "RECOGNITION", desc: "It knows you're there. It isn't afraid.", threshold: 1.0 },
      { name: "UNFOLDING", desc: "It stops pretending to be one shape.", threshold: 0.5 },
      { name: "THE EMBRACE", desc: "It stops giving you room to run.", threshold: 0.2 },
    ],
  },
  lastWitness: {
    id: "lastWitness",
    name: "THE LAST WITNESS",
    title: "You rescued the survivor. She wasn't the last one out of the village — she was the last one to see it happen.",
    environment: "The Collapsed Village — the church with no bell",
    recommendedRoles: "Support + Intelligence",
    hp: 610,
    objective: "LEARN WHAT SHE SAW, AND SURVIVE KNOWING IT.",
    phases: [
      { name: "TESTIMONY", desc: "It shows you the village burning, from the inside.", threshold: 1.0 },
      { name: "CONTRADICTION", desc: "Its story and yours stop matching.", threshold: 0.5 },
      { name: "THE LAST WORD", desc: "It decides how this account ends.", threshold: 0.2 },
    ],
  },
};

const CHRONICLER_LINES: { intro: string; midGame: string[]; bossUnlock: string; victory: string } = {
  intro: "You chose to enter the valley. You did not choose what was waiting there.",
  midGame: [
    "Every path removes another. That is not a flaw in the system. That is the system.",
    "I have recorded this decision. I am not certain, yet, whether it was yours to make.",
    "The group believes it is being followed. The group is correct.",
  ],
  bossUnlock: "The objective is complete. What comes next was decided several choices ago.",
  victory: "You survived. I have recorded that, too — though I suspect it will need revising.",
};

const MUSIC_STATES: Record<MusicStateKey, MusicStateInfo> = {
  exploration: { label: "THE FROZEN VALLEY — AMBIENT THEME", tone: "Cold wind, distant sounds, slow mysterious tones", color: "var(--cyan)" },
  danger: { label: "THREAT DETECTED — MUSIC INTENSITY INCREASING", tone: "Low-frequency tension, subtle heartbeat", color: "#d9a441" },
  combat: { label: "ENGAGEMENT — COMBAT THEME", tone: "Heavy percussion, aggressive design", color: "var(--crimson)" },
  boss: { label: "FINAL BATTLE — BOSS THEME", tone: "Dramatic, intense transitions", color: "var(--crimson-bright)" },
  story: { label: "STORY EVENT — QUIET THEME", tone: "Emotional piano, suspenseful soundscape", color: "#c9a3e8" },
  victory: { label: "RESOLUTION — VICTORY THEME", tone: "Short cinematic resolution", color: "#8fd694" },
};

/* ---------------------------------- styles ---------------------------------- */

const GlobalStyle = () => (
  <style>{`
    .embrace-root {
      --void: #08080a;
      --panel: #121216;
      --panel-raised: #1a1a20;
      --hairline: #2a2a30;
      --hairline-bright: #3a3a42;
      --ink: #e6e6ea;
      --ink-dim: #8c8c96;
      --ink-faint: #55555e;
      --crimson: #8f1f2c;
      --crimson-bright: #c9313f;
      --cyan: #4a9bb0;
      --cyan-dim: #2c5c68;
      --gold: #b8934a;
      font-family: "Cormorant Garamond", Georgia, serif;
      background: var(--void);
      color: var(--ink);
      position: relative;
      min-height: 100vh;
      overflow-x: hidden;
      isolation: isolate;
    }
    .embrace-root * { box-sizing: border-box; }
    .ef-display { font-family: "Cormorant SC", "Cormorant Garamond", Georgia, serif; letter-spacing: 0.04em; }
    .ef-mono { font-family: "JetBrains Mono", ui-monospace, monospace; }

    .embrace-root .grain {
      position: fixed; inset: 0; pointer-events: none; z-index: 60; opacity: 0.05; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .embrace-root .scanlines {
      position: fixed; inset: 0; pointer-events: none; z-index: 59; opacity: 0.035;
      background: repeating-linear-gradient(180deg, #fff 0px, transparent 1px, transparent 3px);
    }
    .embrace-root .vignette {
      position: fixed; inset: 0; pointer-events: none; z-index: 58;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%);
    }

    .ef-hairline { border: 1px solid var(--hairline); }
    .ef-panel { background: var(--panel); border: 1px solid var(--hairline); }
    .ef-panel-raised { background: var(--panel-raised); border: 1px solid var(--hairline-bright); }

    .ef-btn {
      font-family: "JetBrains Mono", monospace; font-size: 0.72rem; letter-spacing: 0.12em;
      text-transform: uppercase; background: transparent; border: 1px solid var(--hairline-bright);
      color: var(--ink-dim); padding: 0.85rem 1.1rem; cursor: pointer; text-align: left;
      transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
      position: relative; overflow: hidden;
    }
    .ef-btn:hover { color: var(--ink); border-color: var(--cyan); background: rgba(74,155,176,0.06); }
    .ef-btn:active { transform: translateY(1px); }
    .ef-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .ef-btn:disabled:hover { border-color: var(--hairline-bright); background: transparent; color: var(--ink-dim); }

    .ef-btn-primary {
      font-family: "JetBrains Mono", monospace; font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase;
      background: var(--crimson); border: 1px solid var(--crimson-bright); color: #f4e4e4;
      padding: 0.9rem 1.4rem; cursor: pointer; transition: background 160ms ease, box-shadow 160ms ease;
    }
    .ef-btn-primary:hover { background: var(--crimson-bright); box-shadow: 0 0 22px rgba(201,49,63,0.35); }
    .ef-btn-primary:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }

    .ef-danger-low { color: var(--ink-dim); }
    .ef-danger-medium { color: var(--gold); }
    .ef-danger-high { color: var(--crimson-bright); }

    .ef-hp-track { height: 6px; width: 100%; background: rgba(255,255,255,0.06); position: relative; overflow: hidden; }
    .ef-hp-fill { height: 100%; transition: width 420ms ease; }

    .ef-flicker { animation: efFlicker 6s infinite; }
    @keyframes efFlicker {
      0%, 92%, 100% { opacity: 1; }
      93% { opacity: 0.4; }
      94% { opacity: 1; }
      95% { opacity: 0.55; }
      96% { opacity: 1; }
    }

    .ef-fade-in { animation: efFadeIn 620ms ease both; }
    @keyframes efFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .ef-glitch-in { animation: efGlitchIn 520ms cubic-bezier(.2,.7,.2,1) both; }
    @keyframes efGlitchIn {
      0% { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(4px); }
      35% { opacity: 1; clip-path: inset(0 0 40% 0); }
      45% { clip-path: inset(0 30% 55% 0); }
      60% { clip-path: inset(0 0 15% 0); }
      100% { opacity: 1; clip-path: inset(0 0 0 0); transform: translateY(0); }
    }

    .ef-pulse-slow { animation: efPulseSlow 3.2s ease-in-out infinite; }
    @keyframes efPulseSlow { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }

    .ef-float-dmg { animation: efFloatDmg 900ms ease-out forwards; }
    @keyframes efFloatDmg { 0% { opacity: 0; transform: translateY(4px) scale(0.9); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(-38px) scale(1.05); } }

    .ef-fog { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    .ef-fog span {
      position: absolute; bottom: -20%; width: 60%; height: 140%; border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 70%);
      filter: blur(18px); animation: efDrift 26s linear infinite;
    }
    @keyframes efDrift { from { transform: translateX(-10%); } to { transform: translateX(30%); } }

    .ef-transition-wipe { animation: efWipe 900ms cubic-bezier(.65,0,.35,1) forwards; }
    @keyframes efWipe { 0% { transform: scaleY(0); } 45% { transform: scaleY(1); } 100% { transform: scaleY(1); opacity: 0; } }

    .ef-scroll::-webkit-scrollbar { width: 6px; }
    .ef-scroll::-webkit-scrollbar-thumb { background: var(--hairline-bright); }
    .ef-scroll::-webkit-scrollbar-track { background: transparent; }

    .ef-chip { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.2rem 0.5rem; border: 1px solid var(--hairline-bright); color: var(--ink-dim); }
  `}</style>
);

/* ------------------------------ shared pieces ------------------------------- */

interface HPBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
}

function HPBar({ value, max, color = "var(--crimson-bright)", height = 6 }: HPBarProps) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div className="ef-hp-track" style={{ height }}>
      <div className="ef-hp-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function FogLayer() {
  return (
    <div className="ef-fog">
      <span style={{ left: "-10%", animationDuration: "34s", opacity: 0.5 }} />
      <span style={{ left: "20%", animationDuration: "48s", animationDelay: "-8s", opacity: 0.35 }} />
      <span style={{ left: "50%", animationDuration: "40s", animationDelay: "-20s", opacity: 0.4 }} />
    </div>
  );
}

interface SceneTransitionProps {
  label: string | null;
}

function SceneTransition({ label }: SceneTransitionProps) {
  if (!label) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, pointerEvents: "none" }}>
      <div
        className="ef-transition-wipe"
        style={{
          position: "absolute", inset: 0, background: "#000",
          transformOrigin: "bottom",
        }}
      />
      <div
        className="ef-mono ef-fade-in"
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          color: "var(--ink-dim)", fontSize: "0.75rem", letterSpacing: "0.3em", textTransform: "uppercase",
          animationDelay: "300ms",
        }}
      >
        {label}
      </div>
    </div>
  );
}

interface ChroniclerOverlayProps {
  message: string | null;
  onDismiss: () => void;
}

function ChroniclerOverlay({ message, onDismiss }: ChroniclerOverlayProps) {
  if (!message) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,4,5,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={onDismiss}
    >
      <div className="ef-glitch-in" style={{ maxWidth: 560, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-mono" style={{ color: "var(--gold)", fontSize: "0.68rem", letterSpacing: "0.35em", marginBottom: "1.4rem" }}>
          THE CHRONICLER
        </div>
        <div className="ef-display" style={{ fontSize: "1.55rem", lineHeight: 1.5, fontStyle: "italic", color: "var(--ink)" }}>
          &ldquo;{message}&rdquo;
        </div>
        <button className="ef-btn" style={{ marginTop: "2rem", display: "inline-block" }} onClick={onDismiss}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}

interface MusicControllerProps {
  state: MusicStateKey;
  muted: boolean;
  onToggleMute: () => void;
  sfxOn: boolean;
  onToggleSfx: () => void;
  volume: number;
  onVolume: (v: number) => void;
}

function MusicController({ state, muted, onToggleMute, sfxOn, onToggleSfx, volume, onVolume }: MusicControllerProps) {
  const m = MUSIC_STATES[state] || MUSIC_STATES.exploration;
  return (
    <div
      className="ef-panel ef-mono"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        display: "flex", alignItems: "center", gap: "1rem", padding: "0.55rem 1rem",
        borderLeft: "none", borderRight: "none", borderBottom: "none",
        fontSize: "0.68rem", color: "var(--ink-dim)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
        <Music size={13} color={m.color} className={muted ? "" : "ef-pulse-slow"} />
        <span style={{ color: m.color, letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {muted ? "AUDIO MUTED" : m.label}
        </span>
        <span style={{ display: "none" }} className="sm:inline">{m.tone}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        <input
          type="range" min="0" max="100" value={volume} onChange={(e) => onVolume(Number(e.target.value))}
          style={{ width: 70, accentColor: "var(--cyan)" }}
        />
        <button onClick={onToggleSfx} title="Sound effects" style={{ background: "transparent", border: "none", cursor: "pointer", color: sfxOn ? "var(--ink-dim)" : "var(--crimson-bright)" }}>
          <Sparkles size={14} />
        </button>
        <button onClick={onToggleMute} title="Music" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-dim)" }}>
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>
    </div>
  );
}

interface RoleIconProps {
  roleId?: string;
  size?: number;
  color?: string;
}

function RoleIcon({ roleId, size = 14, color }: RoleIconProps) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return <User size={size} />;
  const Icon = role.icon;
  return <Icon size={size} color={color || role.color} />;
}

interface PartyPanelProps {
  party: PartyMember[];
  playerRole: Role | null;
  playerHp: number;
  playerHpMax: number;
  compact?: boolean;
}

function PartyPanel({ party, playerRole, playerHp, playerHpMax, compact }: PartyPanelProps) {
  return (
    <div className="ef-panel" style={{ padding: "0.9rem" }}>
      <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.18em", color: "var(--ink-faint)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <Users size={12} /> PARTY
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span className="ef-mono" style={{ fontSize: "0.7rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <RoleIcon roleId={playerRole?.id} size={13} /> NICHOLAS
              <span className="ef-chip" style={{ borderColor: "var(--cyan-dim)", color: "var(--cyan)", fontSize: "0.55rem" }}>YOU · LEADER</span>
            </span>
          </div>
          {!compact && <div className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>{playerRole?.tagline}</div>}
          <HPBar value={playerHp} max={playerHpMax} />
        </div>
        {party.map((p) => {
          const role = ROLES.find((r) => r.id === p.role);
          return (
            <div key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <span className="ef-mono" style={{ fontSize: "0.7rem", color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <RoleIcon roleId={p.role} size={13} /> {p.name}
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.connected ? "#6fbf73" : "var(--crimson-bright)", display: "inline-block" }} />
                </span>
              </div>
              {!compact && <div className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>{p.status}</div>}
              <HPBar value={p.hp} max={100} color="var(--cyan)" height={4} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  log: LogEntry[];
}

function ActivityFeed({ log }: ActivityFeedProps) {
  return (
    <div className="ef-panel ef-scroll" style={{ padding: "0.9rem", maxHeight: 160, overflowY: "auto" }}>
      <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.18em", color: "var(--ink-faint)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <Activity size={12} /> ACTIVITY
      </div>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: "0.4rem" }}>
        {log.slice(-8).reverse().map((l) => (
          <div key={l.id} className="ef-mono ef-fade-in" style={{ fontSize: "0.66rem", color: "var(--ink-dim)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--ink-faint)" }}>›</span> {l.text}
          </div>
        ))}
        {log.length === 0 && <div className="ef-mono" style={{ fontSize: "0.66rem", color: "var(--ink-faint)" }}>No activity yet.</div>}
      </div>
    </div>
  );
}

interface StoryProgressionPanelProps {
  open: boolean;
  onClose: () => void;
  chapter: string;
  decisions: Decision[];
  objective: string;
  unlockedScenes: string[];
  flags: Flags;
}

function StoryProgressionPanel({ open, onClose, chapter, decisions, objective, unlockedScenes, flags }: StoryProgressionPanelProps) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="ef-panel-raised ef-scroll" style={{ position: "relative", width: "min(420px, 92vw)", height: "100%", padding: "1.6rem", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.4rem" }}>
          <div>
            <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.2em", color: "var(--gold)" }}>STORY PROGRESSION</div>
            <div className="ef-display" style={{ fontSize: "1.3rem", marginTop: "0.3rem" }}>{chapter}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: "0.6rem" }}>
          CURRENT OBJECTIVE
        </div>
        <div className="ef-panel" style={{ padding: "0.9rem", marginBottom: "1.5rem", fontStyle: "italic" }}>
          &ldquo;{objective}&rdquo;
        </div>

        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: "0.6rem" }}>
          DECISIONS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {decisions.length === 0 && <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>No decisions made yet.</div>}
          {decisions.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
              {d.ok ? <CheckCircle2 size={14} color="#6fbf73" style={{ marginTop: 2, flexShrink: 0 }} /> : <XCircle size={14} color="var(--crimson-bright)" style={{ marginTop: 2, flexShrink: 0 }} />}
              <span className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-dim)", lineHeight: 1.5 }}>{d.label}</span>
            </div>
          ))}
        </div>

        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: "0.6rem" }}>
          PATHS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {Object.values(SCENES).map((s) => {
            const unlocked = unlockedScenes.includes(s.id);
            return (
              <div key={s.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center", opacity: unlocked ? 1 : 0.45 }}>
                {unlocked ? <LockOpen size={13} color="var(--cyan)" /> : <Lock size={13} color="var(--ink-faint)" />}
                <span className="ef-mono" style={{ fontSize: "0.68rem", color: unlocked ? "var(--ink)" : "var(--ink-faint)" }}>{s.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TopBarProps {
  onOpenProgress: () => void;
  screen: Screen;
  playerRole: Role | null;
}

function TopBar({ onOpenProgress, screen, playerRole }: TopBarProps) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.4rem" }}>
      <div className="ef-mono ef-flicker" style={{ fontSize: "0.72rem", letterSpacing: "0.3em", color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Ghost size={14} color="var(--crimson-bright)" /> EMBRACE
      </div>
      {!["menu", "lobby"].includes(screen) && (
        <button onClick={onOpenProgress} className="ef-btn" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.9rem" }}>
          <ScrollText size={13} /> RECORD
        </button>
      )}
    </div>
  );
}

/* ---------------------------------- screens ---------------------------------- */

interface MainMenuProps {
  onStart: () => void;
}

function MainMenu({ onStart }: MainMenuProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: "2rem" }}>
      <FogLayer />
      <div className="ef-fade-in" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="ef-mono ef-pulse-slow" style={{ fontSize: "0.68rem", letterSpacing: "0.5em", color: "var(--ink-faint)", marginBottom: "1.6rem" }}>
          THE WORLD IS WATCHING
        </div>
        <h1 className="ef-display" style={{ fontSize: "clamp(3.2rem, 11vw, 6.5rem)", fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 0.95 }}>
          EMBRACE
        </h1>
        <div className="ef-mono" style={{ fontSize: "0.72rem", letterSpacing: "0.2em", color: "var(--crimson-bright)", marginTop: "1.2rem" }}>
          YOUR CHOICES ARE BEING RECORDED
        </div>

        <div style={{ marginTop: "3.2rem", display: "flex", flexDirection: "column", gap: "0.7rem", width: "min(340px, 80vw)", marginLeft: "auto", marginRight: "auto" }}>
          <button className="ef-btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }} onClick={onStart}>
            <Play size={14} /> ENTER THE VALLEY
          </button>
          <button className="ef-btn" style={{ textAlign: "center" }} disabled>CONTINUE — NO RECORD FOUND</button>
          <button className="ef-btn" style={{ textAlign: "center" }} disabled>ARCHIVE</button>
        </div>
      </div>
      <div className="ef-mono" style={{ position: "absolute", bottom: "1.6rem", fontSize: "0.6rem", color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
        SESSION //{new Date().toISOString().slice(0, 19).replace("T", " ")}
      </div>
    </div>
  );
}

interface MultiplayerLobbyProps {
  party: PartyMember[];
  onContinue: () => void;
}

function MultiplayerLobby({ party, onContinue }: MultiplayerLobbyProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "6rem 1.4rem 5rem", maxWidth: 720, margin: "0 auto" }}>
      <div className="ef-fade-in">
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--gold)" }}>MULTIPLAYER LOBBY</div>
        <h2 className="ef-display" style={{ fontSize: "2rem", margin: "0.4rem 0 1.8rem" }}>The group is assembling.</h2>

        <div className="ef-panel" style={{ padding: "1.1rem", marginBottom: "0.7rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="ef-mono" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <User size={14} color="var(--cyan)" /> NICHOLAS
          </span>
          <span className="ef-chip" style={{ borderColor: "var(--cyan-dim)", color: "var(--cyan)" }}>YOU · LEADER</span>
        </div>
        {party.map((p) => (
          <div key={p.id} className="ef-panel" style={{ padding: "1.1rem", marginBottom: "0.7rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="ef-mono" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <User size={14} color="var(--ink-dim)" /> {p.name}
            </span>
            <span className="ef-mono" style={{ fontSize: "0.62rem", color: "#6fbf73", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6fbf73", display: "inline-block" }} /> CONNECTED
            </span>
          </div>
        ))}

        <div style={{ marginTop: "2rem" }}>
          <button className="ef-btn-primary" style={{ width: "100%" }} onClick={onContinue}>PROCEED TO STORY SELECT</button>
        </div>
      </div>
    </div>
  );
}

interface StorySelectProps {
  onContinue: () => void;
}

function StorySelect({ onContinue }: StorySelectProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "6rem 1.4rem 5rem", maxWidth: 720, margin: "0 auto" }}>
      <div className="ef-fade-in">
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--gold)" }}>STORY SELECT</div>
        <h2 className="ef-display" style={{ fontSize: "2rem", margin: "0.4rem 0 0.6rem" }}>CHAPTER 01 — THE FIRST EMBRACE</h2>
        <p className="ef-display" style={{ color: "var(--ink-dim)", fontStyle: "italic", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "2rem" }}>
          A transmission was picked up along the northern ridge. Four groups have gone in before yours. None have come back with the same story twice.
        </p>
        <div className="ef-panel" style={{ padding: "1.3rem", marginBottom: "2rem" }}>
          <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: "0.5rem" }}>WHAT'S KNOWN</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-dim)", fontSize: "0.85rem", lineHeight: 1.9 }}>
            <li>Every decision your group makes changes what's waiting at the end.</li>
            <li>There is no single correct path through the valley.</li>
            <li>Something is already aware that you're coming.</li>
          </ul>
        </div>
        <button className="ef-btn-primary" style={{ width: "100%" }} onClick={onContinue}>BEGIN CHAPTER 01</button>
      </div>
    </div>
  );
}

interface SceneBriefingProps {
  scene: Scene;
  onContinue: () => void;
}

function SceneBriefing({ scene, onContinue }: SceneBriefingProps) {
  return (
    <div style={{ minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: scene.gradient }} />
      <FogLayer />
      <div className="ef-fade-in" style={{ position: "relative", zIndex: 1, padding: "2rem 1.4rem 6rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--crimson-bright)", marginBottom: "0.6rem" }}>SCENE BRIEFING</div>
        <h2 className="ef-display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)", margin: "0 0 1rem" }}>{scene.name}</h2>
        <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", fontSize: "1.1rem", lineHeight: 1.7, marginBottom: "1.6rem" }}>
          {scene.intro}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.8rem" }}>
          {scene.tags.map((t) => <span key={t} className="ef-chip">{t}</span>)}
        </div>
        <div style={{ display: "flex", gap: "1.4rem", marginBottom: "2rem" }}>
          <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>WEATHER<br /><span style={{ color: "var(--ink-dim)" }}>{scene.weather}</span></div>
          <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>TIME<br /><span style={{ color: "var(--ink-dim)" }}>{scene.time}</span></div>
        </div>
        <button className="ef-btn-primary" style={{ width: "100%" }} onClick={onContinue}>SELECT ROLE</button>
      </div>
    </div>
  );
}

interface RoleSelectProps {
  onSelect: (role: Role) => void;
}

function RoleSelect({ onSelect }: RoleSelectProps) {
  const [hovered, setHovered] = useState<string>(ROLES[0].id);
  const role = ROLES.find((r) => r.id === hovered) ?? ROLES[0];
  return (
    <div style={{ minHeight: "100vh", padding: "6rem 1.4rem 5rem", maxWidth: 920, margin: "0 auto" }}>
      <div className="ef-fade-in">
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--gold)" }}>ROLE SELECT</div>
        <h2 className="ef-display" style={{ fontSize: "2rem", margin: "0.4rem 0 1.8rem" }}>Choose how you survive.</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem", marginBottom: "1.6rem" }}>
          {ROLES.map((r) => {
            const Icon = r.icon;
            const active = hovered === r.id;
            return (
              <button
                key={r.id}
                className="ef-btn"
                onMouseEnter={() => setHovered(r.id)}
                onClick={() => setHovered(r.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.6rem", padding: "1rem",
                  borderColor: active ? r.color : "var(--hairline-bright)", color: active ? "var(--ink)" : "var(--ink-dim)",
                }}
              >
                <Icon size={18} color={active ? r.color : "var(--ink-faint)"} />
                <span style={{ fontSize: "0.68rem" }}>{r.name}</span>
              </button>
            );
          })}
        </div>

        <div className="ef-panel" style={{ padding: "1.4rem", marginBottom: "1.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem" }}>
            <div>
              <div className="ef-display" style={{ fontSize: "1.4rem", color: role.color }}>{role.name}</div>
              <div className="ef-mono" style={{ fontSize: "0.65rem", color: "var(--ink-faint)", marginTop: "0.2rem" }}>{role.tagline}</div>
            </div>
            <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-dim)", textAlign: "right" }}>
              HP {role.hp}<br />ENERGY {role.energy}
            </div>
          </div>
          <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.95rem", marginBottom: "1rem" }}>{role.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "0.6rem" }}>
            {role.abilities.map((a) => (
              <div key={a.id} className="ef-hairline" style={{ padding: "0.7rem" }}>
                <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink)", marginBottom: "0.25rem" }}>{a.name}</div>
                <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", lineHeight: 1.5 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="ef-btn-primary" style={{ width: "100%" }} onClick={() => onSelect(role)}>CONFIRM — {role.name}</button>
      </div>
    </div>
  );
}

/* ------------------------------ exploration / encounters ------------------------------ */

interface ExplorationScreenProps {
  scene: Scene;
  story: string;
  onAction: (action: ExplorationAction) => void;
  onOpenProgress?: () => void;
  party: PartyMember[];
  playerRole: Role;
  playerHp: number;
  playerHpMax: number;
  log: LogEntry[];
}

function ExplorationScreen({ scene, story, onAction, party, playerRole, playerHp, playerHpMax, log }: ExplorationScreenProps) {
  const actions = EXPLORATION_ACTIONS[scene.id] || EXPLORATION_ACTIONS.frozenValley;
  return (
    <div style={{ minHeight: "100vh", position: "relative", paddingTop: "4.6rem", paddingBottom: "4rem" }}>
      <div style={{ position: "absolute", inset: 0, background: scene.gradient, zIndex: -1 }} />
      <FogLayer />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.4rem", display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: "1.6rem" }}>
        <div className="ef-fade-in">
          <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "var(--crimson-bright)", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <MapPin size={12} /> {scene.name} · {scene.weather}
          </div>
          <p className="ef-display" style={{ fontStyle: "italic", fontSize: "1.25rem", lineHeight: 1.75, color: "var(--ink)", marginBottom: "2rem", maxWidth: 620 }}>
            {story}
          </p>

          <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "var(--ink-faint)", marginBottom: "0.7rem" }}>
            AVAILABLE ACTIONS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: "0.6rem" }}>
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.id} className="ef-btn" style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "1rem" }} onClick={() => onAction(a)}>
                  <Icon size={16} className={`ef-danger-${a.danger === "none" ? "low" : a.danger}`} />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <PartyPanel party={party} playerRole={playerRole} playerHp={playerHp} playerHpMax={playerHpMax} compact />
          <ActivityFeed log={log} />
        </div>
      </div>
    </div>
  );
}

interface EncounterCardProps {
  encounter: ActiveEncounter | null;
  onChoose: (opt: EncounterOption) => void;
}

function EncounterCard({ encounter, onChoose }: EncounterCardProps) {
  if (!encounter) return null;
  const data = ENCOUNTER_LIBRARY[encounter.id];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(4,4,5,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.4rem" }}>
      <div className="ef-panel-raised ef-glitch-in" style={{ maxWidth: 560, width: "100%", padding: "1.8rem" }}>
        <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.2em", color: "var(--crimson-bright)", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldAlert size={13} /> {data.type}
        </div>
        <h3 className="ef-display" style={{ fontSize: "1.5rem", margin: "0 0 0.8rem" }}>{data.title}</h3>
        <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", lineHeight: 1.7, marginBottom: "1.6rem" }}>{data.body}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {data.options.map((opt) => (
            <button key={opt.id} className="ef-btn" onClick={() => onChoose(opt)}>{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DecisionResultProps {
  result: DecisionResultData | null;
  onContinue: () => void;
}

function DecisionResult({ result, onContinue }: DecisionResultProps) {
  if (!result) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(4,4,5,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.4rem" }}>
      <div className="ef-panel-raised ef-glitch-in" style={{ maxWidth: 540, width: "100%", padding: "1.8rem", textAlign: "center" }}>
        <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.2em", color: "var(--gold)", marginBottom: "1rem" }}>DECISION RESULT</div>
        <div className="ef-display" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase" }}>{result.headline}</div>
        <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", lineHeight: 1.7, marginBottom: "1.4rem" }}>&ldquo;{result.body}&rdquo;</p>
        {result.hp !== 0 && (
          <div className="ef-mono" style={{ fontSize: "0.7rem", color: result.hp < 0 ? "var(--crimson-bright)" : "#6fbf73", marginBottom: "1.2rem" }}>
            {result.hp < 0 ? `PARTY HP ${result.hp}` : `PARTY HP +${result.hp}`}
          </div>
        )}
        <button className="ef-btn-primary" style={{ width: "100%" }} onClick={onContinue}>CONTINUE</button>
      </div>
    </div>
  );
}

/* ------------------------------ final battle prep ------------------------------ */

interface FinalBattlePrepProps {
  boss: Boss;
  onEnter: () => void;
}

function FinalBattlePrep({ boss, onEnter }: FinalBattlePrepProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "6rem 1.4rem 5rem", maxWidth: 720, margin: "0 auto" }}>
      <div className="ef-fade-in">
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--crimson-bright)" }}>FINAL BATTLE PREPARATION</div>
        <h2 className="ef-display" style={{ fontSize: "clamp(2rem,6vw,3rem)", margin: "0.5rem 0 1rem" }}>{boss.name}</h2>
        <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", fontSize: "1.1rem", lineHeight: 1.75, marginBottom: "1.8rem" }}>
          {boss.title}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "0.8rem", marginBottom: "1.8rem" }}>
          <div className="ef-panel" style={{ padding: "0.9rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>ENVIRONMENT</div>
            <div className="ef-mono" style={{ fontSize: "0.72rem", color: "var(--ink)" }}>{boss.environment}</div>
          </div>
          <div className="ef-panel" style={{ padding: "0.9rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>RECOMMENDED ROLES</div>
            <div className="ef-mono" style={{ fontSize: "0.72rem", color: "var(--ink)" }}>{boss.recommendedRoles}</div>
          </div>
          <div className="ef-panel" style={{ padding: "0.9rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>BOSS HP</div>
            <div className="ef-mono" style={{ fontSize: "0.72rem", color: "var(--ink)" }}>{boss.hp}</div>
          </div>
          <div className="ef-panel" style={{ padding: "0.9rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.3rem" }}>PHASES</div>
            <div className="ef-mono" style={{ fontSize: "0.72rem", color: "var(--ink)" }}>{boss.phases.length}</div>
          </div>
        </div>

        <div className="ef-mono" style={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: "0.6rem" }}>KNOWN ABILITIES / PHASES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
          {boss.phases.map((p, i) => (
            <div key={p.name} className="ef-hairline" style={{ padding: "0.7rem", display: "flex", gap: "0.8rem", alignItems: "baseline" }}>
              <span className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--crimson-bright)" }}>P{i + 1}</span>
              <div>
                <div className="ef-mono" style={{ fontSize: "0.72rem", color: "var(--ink)" }}>{p.name}</div>
                <div className="ef-mono" style={{ fontSize: "0.64rem", color: "var(--ink-faint)" }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ef-panel" style={{ padding: "1rem", marginBottom: "1.8rem", borderColor: "var(--crimson)" }}>
          <div className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--crimson-bright)", marginBottom: "0.3rem" }}>FINAL OBJECTIVE</div>
          <div className="ef-mono" style={{ fontSize: "0.78rem", color: "var(--ink)" }}>{boss.objective}</div>
        </div>

        <button className="ef-btn-primary" style={{ width: "100%" }} onClick={onEnter}>ENTER FINAL BATTLE</button>
      </div>
    </div>
  );
}

/* ------------------------------ battle hud ------------------------------ */

interface CombatLogProps {
  entries: CombatLogEntry[];
}

function CombatLog({ entries }: CombatLogProps) {
  return (
    <div className="ef-panel ef-scroll" style={{ padding: "0.8rem", maxHeight: 130, overflowY: "auto" }}>
      <div className="ef-mono" style={{ fontSize: "0.6rem", letterSpacing: "0.16em", color: "var(--ink-faint)", marginBottom: "0.5rem" }}>COMBAT LOG</div>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: "0.3rem" }}>
        {entries.slice(-10).reverse().map((e) => (
          <div key={e.id} className="ef-mono ef-fade-in" style={{ fontSize: "0.64rem", color: e.color || "var(--ink-dim)", lineHeight: 1.5 }}>{e.text}</div>
        ))}
      </div>
    </div>
  );
}

interface SkillBarProps {
  role: Role;
  cooldowns: Record<string, number>;
  energy: number;
  onUse: (ability: Ability) => void;
  disabled?: boolean;
}

function SkillBar({ role, cooldowns, energy, onUse, disabled }: SkillBarProps) {
  return (
    <div className="ef-panel" style={{ padding: "0.8rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {role.abilities.map((a) => {
        const cd = cooldowns[a.id] || 0;
        const affordable = energy >= a.cost;
        const usable = cd <= 0 && affordable && !disabled;
        return (
          <button
            key={a.id}
            onClick={() => usable && onUse(a)}
            disabled={!usable}
            className="ef-btn"
            style={{ flex: "1 1 130px", position: "relative", minWidth: 120, opacity: usable ? 1 : 0.4 }}
            title={a.desc}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.66rem" }}>{a.name}</span>
              {cd > 0 && <span className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--crimson-bright)" }}>{cd}s</span>}
            </div>
            <div className="ef-mono" style={{ fontSize: "0.58rem", color: "var(--ink-faint)", marginTop: "0.2rem" }}>
              {a.cost > 0 ? `${a.cost} ENERGY` : "NO COST"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface BattleHUDProps {
  boss: Boss;
  role: Role;
  playerHp: number;
  playerHpMax: number;
  playerEnergy: number;
  playerEnergyMax: number;
  cooldowns: Record<string, number>;
  bossHp: number;
  phaseIndex: number;
  party: PartyMember[];
  combatLog: CombatLogEntry[];
  floaters: Floater[];
  onUseAbility: (ability: Ability) => void;
  onDodge: () => void;
  onBlock: () => void;
  timer: number;
}

function BattleHUD({
  boss, role, playerHp, playerHpMax, playerEnergy, playerEnergyMax, cooldowns,
  bossHp, phaseIndex, party, combatLog, floaters, onUseAbility, onDodge, onBlock, timer,
}: BattleHUDProps) {
  const phase = boss.phases[phaseIndex];
  const bossPct = clamp((bossHp / boss.hp) * 100, 0, 100);
  return (
    <div style={{ minHeight: "100vh", position: "relative", paddingTop: "4.6rem", paddingBottom: "10rem", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 20%, #240b0f 0%, #08080a 60%)", zIndex: -1 }} />
      <FogLayer />

      {/* top center: objective + timer */}
      <div style={{ position: "fixed", top: "4.4rem", left: "50%", transform: "translateX(-50%)", zIndex: 35, textAlign: "center" }}>
        <div className="ef-mono" style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: "var(--crimson-bright)" }}>{boss.objective}</div>
        <div className="ef-mono" style={{ fontSize: "0.68rem", color: "var(--ink-faint)", marginTop: "0.2rem" }}>{String(Math.floor(timer / 60)).padStart(2, "0")}:{String(timer % 60).padStart(2, "0")}</div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 1.2rem", display: "grid", gridTemplateColumns: "220px minmax(0,1fr) 240px", gap: "1rem" }}>
        {/* left: party */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <PartyPanel party={party} playerRole={role} playerHp={playerHp} playerHpMax={playerHpMax} compact />
          <div className="ef-panel" style={{ padding: "0.8rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.4rem" }}>ENERGY</div>
            <HPBar value={playerEnergy} max={playerEnergyMax} color="var(--cyan)" height={5} />
            <div className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--ink-dim)", marginTop: "0.3rem" }}>{playerEnergy} / {playerEnergyMax}</div>
          </div>
        </div>

        {/* center: arena */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, position: "relative" }}>
          <div className="ef-mono ef-pulse-slow" style={{ fontSize: "0.62rem", letterSpacing: "0.2em", color: "var(--gold)", marginBottom: "0.6rem" }}>
            PHASE {phaseIndex + 1} — {phase.name}
          </div>
          <div className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.95rem", textAlign: "center", maxWidth: 380, marginBottom: "1.4rem" }}>
            {phase.desc}
          </div>
          <div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Skull size={92} color="var(--crimson-bright)" strokeWidth={1} className="ef-pulse-slow" />
            {floaters.map((f) => (
              <div key={f.id} className="ef-mono ef-float-dmg" style={{ position: "absolute", top: "20%", left: `${f.x}%`, fontSize: "0.95rem", fontWeight: 700, color: f.color }}>
                {f.text}
              </div>
            ))}
          </div>
          <div style={{ width: "100%", maxWidth: 420, marginTop: "1.4rem" }}>
            <CombatLog entries={combatLog} />
          </div>
        </div>

        {/* right: boss */}
        <div>
          <div className="ef-panel" style={{ padding: "0.9rem" }}>
            <div className="ef-mono" style={{ fontSize: "0.62rem", color: "var(--crimson-bright)", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>{boss.name}</div>
            <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.5rem" }}>
              THREAT: {phaseIndex === 0 ? "OBSERVING" : phaseIndex === 1 ? "ESCALATING" : "CRITICAL"}
            </div>
            <HPBar value={bossHp} max={boss.hp} color="var(--crimson-bright)" height={8} />
            <div className="ef-mono" style={{ fontSize: "0.64rem", color: "var(--ink-dim)", marginTop: "0.3rem" }}>{Math.max(0, Math.round(bossHp))} / {boss.hp}</div>
            <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.6rem" }}>
              {boss.phases.map((p, i) => (
                <div key={p.name} style={{ flex: 1, height: 3, background: i <= phaseIndex ? "var(--crimson-bright)" : "var(--hairline-bright)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* bottom: skill bar */}
      <div style={{ position: "fixed", bottom: "2.6rem", left: "50%", transform: "translateX(-50%)", zIndex: 35, width: "min(760px, 94vw)" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <button className="ef-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "0 0 auto" }} onClick={onDodge}>
            <Wind size={13} /> DODGE
          </button>
          <button className="ef-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "0 0 auto" }} onClick={onBlock}>
            <ShieldHalf size={13} /> BLOCK
          </button>
        </div>
        <SkillBar role={role} cooldowns={cooldowns} energy={playerEnergy} onUse={onUseAbility} disabled={playerHp <= 0} />
      </div>
    </div>
  );
}

interface VictoryScreenProps {
  boss: Boss;
  decisions: Decision[];
  onReturnToMenu: () => void;
}

function VictoryScreen({ boss, decisions, onReturnToMenu }: VictoryScreenProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem", textAlign: "center" }}>
      <div className="ef-fade-in" style={{ maxWidth: 560 }}>
        <div className="ef-mono" style={{ fontSize: "0.64rem", letterSpacing: "0.3em", color: "#8fd694", marginBottom: "1rem" }}>OBJECTIVE COMPLETE</div>
        <h2 className="ef-display" style={{ fontSize: "clamp(2rem,6vw,3rem)", margin: "0 0 1rem" }}>{boss.name} — SILENCED</h2>
        <p className="ef-display" style={{ fontStyle: "italic", color: "var(--ink-dim)", lineHeight: 1.75, marginBottom: "1.6rem" }}>
          &ldquo;{CHRONICLER_LINES.victory}&rdquo;
        </p>
        <div className="ef-panel" style={{ padding: "1.1rem", textAlign: "left", marginBottom: "2rem" }}>
          <div className="ef-mono" style={{ fontSize: "0.6rem", color: "var(--ink-faint)", marginBottom: "0.6rem" }}>DECISIONS THAT LED HERE</div>
          {decisions.slice(-5).map((d) => (
            <div key={d.id} className="ef-mono" style={{ fontSize: "0.66rem", color: "var(--ink-dim)", marginBottom: "0.3rem" }}>› {d.label}</div>
          ))}
        </div>
        <button className="ef-btn-primary" onClick={onReturnToMenu}>RETURN TO MENU</button>
      </div>
    </div>
  );
}

/* ---------------------------------- app ---------------------------------- */

function determineBoss(flags: Flags): string {
  if (flags.followedSignal) return "architect";
  if (flags.followedFootprints) return "embraced";
  if (flags.rescuedSurvivor) return "lastWitness";
  return "winterWarden";
}

function determineNextScene(flags: Flags): string {
  if (flags.followedSignal) return "abandonedFacility";
  if (flags.followedFootprints) return "hiddenCave";
  if (flags.rescuedSurvivor) return "collapsedVillage";
  return "frozenValley";
}

export default function App() {
  useEmbraceFonts();

  const [screen, setScreen] = useState<Screen>("menu");
  const [transition, setTransition] = useState<string | null>(null);
  const [chronicler, setChronicler] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  const [party, setParty] = useState<PartyMember[]>(PARTY_TEMPLATE.map((p) => ({ ...p, hp: 100 })));
  const [playerRole, setPlayerRole] = useState<Role | null>(null);
  const [playerHp, setPlayerHp] = useState(100);

  const [flags, setFlags] = useState<Flags>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [unlockedScenes, setUnlockedScenes] = useState<string[]>(["frozenValley"]);
  const [currentSceneId, setCurrentSceneId] = useState("frozenValley");
  const [storyText, setStoryText] = useState(SCENES.frozenValley.intro);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [actionsTaken, setActionsTaken] = useState(0);
  const [activeEncounter, setActiveEncounter] = useState<ActiveEncounter | null>(null);
  const [decisionResult, setDecisionResult] = useState<DecisionResultData | null>(null);

  const [musicState, setMusicState] = useState<MusicStateKey>("exploration");
  const [muted, setMuted] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [volume, setVolume] = useState(55);

  const [boss, setBoss] = useState<Boss | null>(null);
  const OBJECTIVE_TARGET = 3;

  const pushLog = useCallback((text: string) => {
    setLog((l) => [...l, { id: uid("log"), text }]);
  }, []);

  const currentScene = SCENES[currentSceneId];

  const withTransition = useCallback((label: string, next: () => void) => {
    setTransition(label);
    setTimeout(() => {
      next();
      setTransition(null);
    }, 520);
  }, []);

  /* ---- navigation ---- */
  const startGame = () => withTransition("ENTERING THE LOBBY", () => setScreen("lobby"));
  const goStorySelect = () => withTransition("STORY SELECT", () => setScreen("storySelect"));
  const goBriefing = () => withTransition(currentScene.name, () => setScreen("briefing"));
  const goRoleSelect = () => withTransition("ROLE SELECT", () => setScreen("roleSelect"));

  const confirmRole = (role: Role) => {
    setPlayerRole(role);
    setPlayerHp(role.hp);
    withTransition("DEPLOYING", () => {
      setScreen("exploration");
      setMusicState("exploration");
      pushLog(`YOU DEPLOYED AS ${role.name}`);
      setChronicler(CHRONICLER_LINES.intro);
    });
  };

  /* ---- exploration ---- */
  const handleAction = (action: ExplorationAction) => {
    const data = ENCOUNTER_LIBRARY[action.id];
    if (!data) return;
    setMusicState(action.danger === "high" ? "danger" : action.danger === "medium" ? "story" : "exploration");
    setActiveEncounter({ id: action.id, flagBase: action.flag });
    pushLog(`YOU CHOSE TO ${action.label}`);

    // simulate a party member reacting
    const randomMate = pick(party);
    setParty((p) => p.map((m) => (m.id === randomMate.id ? { ...m, status: `Reacting to ${action.label.toLowerCase()}` } : m)));
  };

  const handleEncounterChoice = (opt: EncounterOption) => {
    setActiveEncounter(null);

    setFlags((f) => ({ ...f, [opt.flag]: true }));
    setDecisions((d) => [...d, { id: uid("dec"), label: opt.label, ok: opt.hp >= 0 }]);

    if (opt.hp) {
      setPlayerHp((hp) => clamp(hp + opt.hp, 0, playerRole ? playerRole.hp : 100));
      setParty((p) => p.map((m) => ({ ...m, hp: clamp(m.hp + opt.hp, 0, 100) })));
    }

    setDecisionResult({ headline: opt.label, body: opt.result, hp: opt.hp });
    pushLog(opt.result);
    setActionsTaken((n) => n + 1);

    // occasionally unlock a new scene path based on story flags
    const nextSceneId = determineNextScene({ ...flags, [opt.flag]: true });
    if (!unlockedScenes.includes(nextSceneId)) {
      setUnlockedScenes((u) => [...u, nextSceneId]);
    }
  };

  const dismissResult = () => {
    setDecisionResult(null);
    setStoryText(pick([
      "The group presses on. Whatever is out there hasn't lost interest.",
      "Nobody speaks for a while. The snow does the talking.",
      "The radio crackles once, and then goes quiet again.",
      "The path ahead splits again. It always does.",
    ]));
    setMusicState("exploration");

    if (actionsTaken + 1 >= OBJECTIVE_TARGET) {
      const bossId = determineBoss(flags);
      setBoss(BOSSES[bossId]);
      setChronicler(CHRONICLER_LINES.bossUnlock);
      withTransition("OBJECTIVE COMPLETE", () => setScreen("prep"));
    } else if (Math.random() < 0.4) {
      setChronicler(pick(CHRONICLER_LINES.midGame));
    }
  };

  const enterBattle = () => {
    if (!boss) return;
    withTransition(boss.name, () => {
      setScreen("battle");
      setMusicState("boss");
    });
  };

  /* ---- battle state ---- */
  const [bossHp, setBossHp] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playerEnergy, setPlayerEnergy] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [timer, setTimer] = useState(0);
  const battleActive = screen === "battle" && bossHp > 0 && playerHp > 0 && boss !== null && playerRole !== null;

  useEffect(() => {
    if (screen === "battle" && boss) {
      setBossHp(boss.hp);
      setPhaseIndex(0);
      setPlayerEnergy(playerRole ? playerRole.energy : 100);
      setCooldowns({});
      setCombatLog([{ id: uid("cl"), text: `${boss.name} HAS ENGAGED THE PARTY.`, color: "var(--crimson-bright)" }]);
      setTimer(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const addFloater = useCallback((text: string, color: string) => {
    const id = uid("fl");
    setFloaters((f) => [...f, { id, text, color, x: rand(30, 70) }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
  }, []);

  const logCombat = useCallback((text: string, color?: string) => {
    setCombatLog((l) => [...l, { id: uid("cl"), text, color }]);
  }, []);

  const useAbility = (ability: Ability) => {
    if (!battleActive || !boss || !playerRole) return;
    setPlayerEnergy((e) => e - ability.cost);
    setCooldowns((c) => ({ ...c, [ability.id]: ability.cooldown }));

    if (ability.dmg && ability.dmg[1] > 0) {
      const dmg = rand(ability.dmg[0], ability.dmg[1]);
      setBossHp((hp) => clamp(hp - dmg, 0, boss.hp));
      addFloater(`-${dmg}`, "var(--crimson-bright)");
      logCombat(`YOU USED ${ability.name} — ${dmg} DAMAGE.`, "var(--ink-dim)");
    } else if (ability.heal) {
      const heal = rand(ability.heal[0], ability.heal[1]);
      setPlayerHp((hp) => clamp(hp + heal, 0, playerRole.hp));
      addFloater(`+${heal}`, "#8fd694");
      logCombat(`YOU USED ${ability.name} — RESTORED ${heal} HP.`, "#8fd694");
    } else {
      logCombat(`YOU USED ${ability.name}.`, "var(--cyan)");
    }
  };

  const doDodge = () => battleActive && logCombat("YOU DODGED THE NEXT ATTACK.", "var(--cyan)");
  const doBlock = () => battleActive && logCombat("YOU BRACED FOR IMPACT.", "var(--cyan)");

  // combat tick
  useEffect(() => {
    if (!battleActive || !boss || !playerRole) return;
    const activeBoss = boss;
    const activeRole = playerRole;
    const t = setInterval(() => {
      setTimer((s) => s + 1);
      setPlayerEnergy((e) => clamp(e + 4, 0, activeRole.energy));
      setCooldowns((c) => {
        const next: Record<string, number> = {};
        Object.entries(c).forEach(([k, v]) => { if (v > 1) next[k] = v - 1; });
        return next;
      });

      // ally chip damage on boss
      if (Math.random() < 0.5) {
        const dmg = rand(6, 16);
        setBossHp((hp) => clamp(hp - dmg, 0, activeBoss.hp));
        const ally = pick(party);
        logCombat(`${ally.name} STRIKES — ${dmg} DAMAGE.`, "var(--ink-faint)");
      }

      // boss attacks
      if (Math.random() < 0.4) {
        const targetsParty = Math.random() < 0.5;
        const dmg = rand(4, 14);
        if (targetsParty) {
          const target = pick(party);
          setParty((p) => p.map((m) => (m.id === target.id ? { ...m, hp: clamp(m.hp - dmg, 0, 100) } : m)));
          logCombat(`${activeBoss.name} STRIKES ${target.name} — ${dmg} DAMAGE.`, "var(--crimson-bright)");
        } else {
          setPlayerHp((hp) => clamp(hp - dmg, 0, activeRole.hp));
          addFloater(`-${dmg}`, "var(--crimson-bright)");
          logCombat(`${activeBoss.name} STRIKES YOU — ${dmg} DAMAGE.`, "var(--crimson-bright)");
        }
      }
    }, 1500);
    return () => clearInterval(t);
  }, [battleActive, boss, party, playerRole, logCombat, addFloater]);

  // phase transitions
  useEffect(() => {
    if (!boss || screen !== "battle") return;
    const pct = bossHp / boss.hp;
    let newIndex = phaseIndex;
    boss.phases.forEach((p, i) => { if (pct <= p.threshold) newIndex = i; });
    if (newIndex !== phaseIndex) {
      setPhaseIndex(newIndex);
      logCombat(`PHASE TRANSITION — ${boss.phases[newIndex].name}`, "var(--gold)");
      setMusicState(newIndex === boss.phases.length - 1 ? "boss" : "danger");
      setChronicler(boss.phases[newIndex].desc);
    }
    if (bossHp <= 0) {
      setMusicState("victory");
      withTransition("VICTORY", () => setScreen("victory"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossHp]);

  const returnToMenu = () => {
    withTransition("RETURNING TO MENU", () => {
      setScreen("menu");
      setFlags({});
      setDecisions([]);
      setUnlockedScenes(["frozenValley"]);
      setCurrentSceneId("frozenValley");
      setStoryText(SCENES.frozenValley.intro);
      setLog([]);
      setActionsTaken(0);
      setPlayerRole(null);
      setBoss(null);
      setParty(PARTY_TEMPLATE.map((p) => ({ ...p, hp: 100 })));
    });
  };

  return (
    <div className="embrace-root">
      <GlobalStyle />
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />

      <TopBar onOpenProgress={() => setProgressOpen(true)} screen={screen} playerRole={playerRole} />

      {screen === "menu" && <MainMenu onStart={startGame} />}
      {screen === "lobby" && <MultiplayerLobby party={party} onContinue={goStorySelect} />}
      {screen === "storySelect" && <StorySelect onContinue={goBriefing} />}
      {screen === "briefing" && <SceneBriefing scene={currentScene} onContinue={goRoleSelect} />}
      {screen === "roleSelect" && <RoleSelect onSelect={confirmRole} />}
      {screen === "exploration" && playerRole && (
        <ExplorationScreen
          scene={currentScene}
          story={storyText}
          onAction={handleAction}
          party={party}
          playerRole={playerRole}
          playerHp={playerHp}
          playerHpMax={playerRole.hp}
          log={log}
        />
      )}
      {screen === "prep" && boss && <FinalBattlePrep boss={boss} onEnter={enterBattle} />}
      {screen === "battle" && boss && playerRole && (
        <BattleHUD
          boss={boss}
          role={playerRole}
          playerHp={playerHp}
          playerHpMax={playerRole.hp}
          playerEnergy={playerEnergy}
          playerEnergyMax={playerRole.energy}
          cooldowns={cooldowns}
          bossHp={bossHp}
          phaseIndex={phaseIndex}
          party={party}
          combatLog={combatLog}
          floaters={floaters}
          onUseAbility={useAbility}
          onDodge={doDodge}
          onBlock={doBlock}
          timer={timer}
        />
      )}
      {screen === "victory" && boss && <VictoryScreen boss={boss} decisions={decisions} onReturnToMenu={returnToMenu} />}

      <EncounterCard encounter={activeEncounter} onChoose={handleEncounterChoice} />
      <DecisionResult result={decisionResult} onContinue={dismissResult} />
      <ChroniclerOverlay message={chronicler} onDismiss={() => setChronicler(null)} />
      <StoryProgressionPanel
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        chapter="CHAPTER 01 — THE FIRST EMBRACE"
        decisions={decisions}
        objective={boss ? boss.objective : "Find the source of the transmission."}
        unlockedScenes={unlockedScenes}
        flags={flags}
      />

      {screen !== "menu" && (
        <MusicController
          state={musicState}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          sfxOn={sfxOn}
          onToggleSfx={() => setSfxOn((s) => !s)}
          volume={volume}
          onVolume={setVolume}
        />
      )}

      <SceneTransition label={transition} />
    </div>
  );
}
