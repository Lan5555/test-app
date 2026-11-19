import type { Warrior } from "./warriorSelection";
import type { AdventureQuest } from "../types/game";

export const ADVENTURE_TITLE = "The Buried Lantern";

export type Point = { x: number; y: number };
const runeNames = { moon: "Moon", wave: "Wave", bell: "Bell", flame: "Flame" };
type Rune = keyof typeof runeNames;
export { runeNames };

export interface ExplorerNpc {
  name: string;
  fighter: Warrior;
  at: Point;
  dialogue: string;
  followUp?: string;
  personal: { question: string; answer: string };
  indoors?: boolean;
}

export interface AdventureHome {
  name: string;
  image: string;
  door: Point;
  spawn: Point;
  exit: Point;
}

interface Chapter {
  location: string;
  image: string;
  title: string;
  story: string;
  objective: string;
  gate: Point;
  npc: ExplorerNpc;
  residents?: ExplorerNpc[];
  home?: AdventureHome;
  task: { kind: "collect"; items: { id: string; name: string; at: Point; indoors?: boolean; chest?: boolean }[] }
    | { kind: "rune"; at: Point; name: string; runes: Rune[] };
}

const chapters: readonly Chapter[] = [
  {
    location: "Ashglass Village",
    image: "ashglass-village",
    title: "A light beneath the ford",
    story: "The ferryman left one lantern burning when the village vanished. Its flame leans toward the ruins, where an iron sentry still guards the road.",
    objective: "Take the oil from Ivo’s chest and find flint near the bridge.",
    gate: { x: 80, y: 60 },
    home: { name: "Ferryman’s house", image: "ferryman-home", door: { x: 24, y: 58 }, spawn: { x: 23, y: 81 }, exit: { x: 12, y: 85 } },
    npc: { name: "Ferryman Ivo", fighter: "warden", at: { x: 36, y: 65 }, indoors: true, dialogue: "The sentry only yields to a lit lantern. Take the oil from my chest, then look for a flint near the bridge.",
      personal: { question: "Why keep running the ferry?", answer: "The last boat went out with my sister aboard. I still light the landing when the water is calm. If she finds her way back, I want her to know where to dock." },
    },
    residents: [
      { name: "Mira the trader", fighter: "maiden", at: { x: 37, y: 62 }, dialogue: "Ivo is in the house by my stall. He still keeps a lantern ready for the last ferry.",
        personal: { question: "What did you sell before the fog?", answer: "Pears, mostly. My father taught me to stack the bruised ones on top so I could give them to the children walking home." },
      },
      { name: "Bram the watchman", fighter: "knight", at: { x: 56, y: 88 }, dialogue: "The bridge is still sound. The trouble is what waits on it.",
        personal: { question: "Who taught you to keep watch?", answer: "My mother. She said the job was mostly remembering who was still on the other side of the bridge when it got dark." },
      },
      { name: "Lena the potter", fighter: "monk", at: { x: 27, y: 87 }, dialogue: "I left a new lamp in every window the night the fog rolled in.", followUp: "When dawn comes back, I want this to be the first village it sees.",
        personal: { question: "How did you learn pottery?", answer: "My first bowl slumped before it dried. Gran put it by the door for her keys and told everyone I’d shaped it that way on purpose." },
      },
      { name: "Nell the ferrymate", fighter: "duelist", at: { x: 54, y: 85 }, indoors: true, dialogue: "Ivo still sets out a second cup before every crossing.", followUp: "Says it’s for whoever the river brings home next.",
        personal: { question: "What do you miss about the ferry?", answer: "The arguments. Ivo and I used to bet on which passenger would complain about the fare. We always paid with the same copper coin." },
      },
    ],
    task: { kind: "collect", items: [
      { id: "oil", name: "Lantern oil", at: { x: 65, y: 72 }, indoors: true, chest: true },
      { id: "flint", name: "Flint", at: { x: 64, y: 58 } },
    ] },
  },
  {
    location: "Echo Caves",
    image: "echo-caves",
    title: "The ferryman’s witness",
    story: "A voice rises from the wet stone. The wisp was there the night the village disappeared. A cave keeper knows how to open the old channel.",
    objective: "Light the Echo altar’s runes in the order the Echo Keeper gave you.",
    gate: { x: 71, y: 66 },
    npc: { name: "Echo Keeper", fighter: "arcanist", at: { x: 29, y: 74 }, dialogue: "The moon watches the water. The water carries the sound of the bell. Touch the carved signs in that order.",
      personal: { question: "Why did you stay in the caves?", answer: "I came looking for my brother’s voice. I found a dozen others first. Someone ought to remember their names before the stone wears them down." },
    },
    residents: [
      { name: "Tarin the miner", fighter: "monk", at: { x: 47, y: 87 }, dialogue: "Listen when the cave falls quiet. Every wrong sign sends an echo back to the entrance.",
        personal: { question: "What kept you mining?", answer: "I used to send the pretty stones home to my daughter. She thought I worked under a sky full of little stars." },
      },
      { name: "Dara the surveyor", fighter: "duelist", at: { x: 20, y: 55 }, dialogue: "I marked the safe tunnels with chalk. Then something drew a door where there was only rock.", followUp: "That’s when I stopped trusting my maps.",
        personal: { question: "What would you rather be mapping?", answer: "A coastline. A coast tells you where the land ends. Down here, the rock keeps offering me one more passage." },
      },
      { name: "Siv the lamp keeper", fighter: "warden", at: { x: 73, y: 88 }, dialogue: "The old channel opens from the altar. Bring your light close and watch the carvings.",
        personal: { question: "Who lit the first lamp?", answer: "My aunt walked every tunnel at shift change. If she saw even one dark lamp, she went back with fresh oil herself. I carry her snuffer." },
      },
    ],
    task: { kind: "rune", name: "Echo altar", at: { x: 52, y: 62 }, runes: ["bell", "wave", "moon"] },
  },
  {
    location: "Emberwood Depths",
    image: "emberwood-depths",
    title: "Tracks in the cinders",
    story: "The wisp named the Crownless King. Your lantern lights a trail of frozen tracks beneath the pines, where a creature circles the only way through.",
    objective: "Find the pawprint, frosted fur, and rime shard.",
    gate: { x: 81, y: 67 },
    npc: { name: "Scout Nera", fighter: "duelist", at: { x: 27, y: 66 }, dialogue: "Three signs mark its hunting ground. Find the pawprint, the fur caught on a branch, and the ice it left behind.",
      personal: { question: "Who taught you to track?", answer: "My brother. He could tell how fast a hare was running by the gap between its prints. I still catch myself saving the best tracks to show him." },
    },
    residents: [
      { name: "Tess the herbalist", fighter: "monk", at: { x: 22, y: 87 }, dialogue: "The pines drop needles all winter. The one with white bark hasn’t shed a single branch since the frost came.", followUp: "If you hear leaves moving over there, keep your eyes on the ground.",
        personal: { question: "What do you grow at home?", answer: "Mint by the steps. It spreads under the stones every spring, no matter how thoroughly I pull it out. I’ve grown fond of losing that argument." },
      },
      { name: "Ren the forester", fighter: "knight", at: { x: 50, y: 72 }, dialogue: "Look for a tuft of pale fur on the low branches. The stalker takes the same way through every time.",
        personal: { question: "Do you have a favorite tree?", answer: "A crooked pine I planted with Nera when she was little. Every year she says she’ll come back and measure it. Every year I tell her she’d better bring a longer tape." },
      },
    ],
    task: { kind: "collect", items: [
      { id: "print", name: "Pawprint", at: { x: 41, y: 81 } },
      { id: "fur", name: "Frosted fur", at: { x: 55, y: 58 } },
      { id: "ice", name: "Rime shard", at: { x: 67, y: 79 } },
    ] },
  },
  {
    location: "Bellward Hamlet",
    image: "bellward-hamlet",
    title: "The bell without a tongue",
    story: "The bell above Bellward Hamlet rings without moving. Its maker is still in the foundry, waiting for someone to silence it.",
    objective: "Follow Mara’s rune sequence at the shrine outside the workshop.",
    gate: { x: 73, y: 56 },
    home: { name: "Bellwright’s workshop", image: "bellwright-workshop", door: { x: 34, y: 58 }, spawn: { x: 24, y: 81 }, exit: { x: 12, y: 85 } },
    npc: { name: "Bellwright Mara", fighter: "knight", at: { x: 53, y: 60 }, indoors: true, dialogue: "First the flame casts the bell. Then the bell rings beneath the moon. Rekindle those three signs at the shrine outside.",
      personal: { question: "What was the first bell you made?", answer: "A handbell for my father. It came out a little flat. He rang it for dinner every night, even after I offered to make him a better one." },
    },
    residents: [
      { name: "Oren the apprentice", fighter: "monk", at: { x: 39, y: 76 }, indoors: true, dialogue: "The old shrine is outside the workshop. Mara used to send me there when I rang the bells out of order.",
        personal: { question: "Why become a bellwright?", answer: "I liked the sound of the workshop from the street. After a month of hovering at the window, Mara handed me a broom and said I might as well come in." },
      },
      { name: "Sister Vale", fighter: "maiden", at: { x: 73, y: 85 }, dialogue: "No one rings the tower bell anymore. We still set a place for those who used to answer it.",
        personal: { question: "Who do you keep a place for?", answer: "My old choir. I still lay out their songbooks in the order they stood. There’s one with a pressed violet where we always lost our place." },
      },
      { name: "Hale the charcoal seller", fighter: "knight", at: { x: 26, y: 83 }, dialogue: "Mara’s forge hasn’t gone cold in twenty years.", followUp: "If you need her, follow the sound of the hammer.",
        personal: { question: "What did you do before this?", answer: "I cut wood for the old baker. She paid half in bread. I thought it was a poor deal until I tried making my own loaf." },
      },
    ],
    task: { kind: "rune", name: "Bellwright’s shrine", at: { x: 56, y: 81 }, runes: ["moon", "flame", "bell"] },
  },
  {
    location: "Glasswind Dunes",
    image: "glasswind-dunes",
    title: "What the lantern holds",
    story: "Beyond the dunes, the Matriarch guards the stair to Crownfall. A caravan archivist may know why the lantern burns without oil.",
    objective: "Recover the silver frame from the lodge chest and the lens from the ruins.",
    gate: { x: 78, y: 64 },
    home: { name: "Wayfarer’s lodge", image: "wayfarers-lodge", door: { x: 24, y: 61 }, spawn: { x: 22, y: 81 }, exit: { x: 12, y: 85 } },
    npc: { name: "Archivist Sela", fighter: "maiden", at: { x: 46, y: 64 }, indoors: true, dialogue: "I saved your lantern’s silver frame in the lodge chest. The glass lens is still buried near the ruins outside.",
      personal: { question: "What do you keep in the archive?", answer: "Mostly ordinary things. A recipe folded inside a wedding notice. A child’s drawing of a camel. I try to save what nobody else thinks to write down." },
    },
    residents: [
      { name: "Nadi the guide", fighter: "duelist", at: { x: 38, y: 78 }, dialogue: "The wind uncovers pieces of blue glass near the ruins. Look before the dunes shift again.",
        personal: { question: "How did you learn to cross the dunes?", answer: "My grandmother made me name one landmark behind us for every one ahead. She said anyone could lead people out. A guide brings them back." },
      },
      { name: "Amara the caravan cook", fighter: "monk", at: { x: 32, y: 62 }, indoors: true, dialogue: "There’s water in the clay jar and a blanket by the door.", followUp: "The dunes turn cold as soon as the sunlight goes.",
        personal: { question: "What do you cook for yourself?", answer: "Rice with cardamom. I make a small pot after everyone goes to bed, the way my father did when he wanted the kitchen to himself." },
      },
      { name: "Samir the courier", fighter: "knight", at: { x: 52, y: 57 }, dialogue: "The road into Crownfall used to have mileposts. Now the ruins lean toward the stair as if they’re pointing you somewhere.",
        personal: { question: "What’s the letter you remember most?", answer: "One with a button sewn through the corner. It was from a woman who wanted her son to recognize the coat she’d mended for his journey home." },
      },
    ],
    task: { kind: "collect", items: [
      { id: "silver", name: "Silver frame", at: { x: 69, y: 73 }, indoors: true, chest: true },
      { id: "glass", name: "Lantern lens", at: { x: 65, y: 81 } },
    ] },
  },
  {
    location: "Crownfall Citadel",
    image: "crownfall-citadel",
    title: "The king below the dawn",
    story: "The Crownless King waits beyond the broken gate. Carry the lantern to him. If his reign ends, the Highlands will see morning again.",
    objective: "Use the Bound Usher’s rune sequence to open the Crownfall seal.",
    gate: { x: 84, y: 56 },
    npc: { name: "The Bound Usher", fighter: "monk", at: { x: 31, y: 64 }, dialogue: "Ring the bell for the dead. Then call the moon to bear witness. Only then may you light the flame before the king.",
      personal: { question: "What brought you to the citadel?", answer: "I was hired to show visitors to their seats. After the last audience, I waited for someone to tell me I could go home. I’m still waiting." },
    },
    residents: [
      { name: "Iria the oathkeeper", fighter: "warden", at: { x: 22, y: 84 }, dialogue: "The king ordered me to keep watch until sunrise. I’ve stood at this gate for a hundred years.", followUp: "If you hear the dawn bell, come find me. I’d like to turn around when it rings.",
        personal: { question: "What will you do after sunrise?", answer: "Sleep with the shutters open. Then I’ll walk down to the river and see if the ferryman still knows the way across." },
      },
      { name: "Aurel the scribe", fighter: "arcanist", at: { x: 47, y: 56 }, dialogue: "The royal ledger ends halfway through a sentence. It says the lantern was carried beneath the ford, and then the ink runs out.",
        personal: { question: "What did you write for yourself?", answer: "Little plays in the margins. The cooks would read them aloud after supper and argue about who should play the king." },
      },
    ],
    task: { kind: "rune", name: "Crownfall seal", at: { x: 59, y: 74 }, runes: ["flame", "moon", "bell"] },
  },
] as const;

export function adventureChapter(index: number) {
  return chapters[index] ?? chapters[0];
}

export function adventureBackdrop(image: (typeof chapters)[number]["image"]) {
  return `/adventure/${image}.webp`;
}

export function adventureAmbience(image: string) {
  return `/adventure/audio/${image}.wav`;
}

export function adventureMusic(index: number) {
  return index === 0 || index === 2 || index === 4
    ? "/assets/music/Whispering%20Winds.mp3"
    : "/assets/music/Ethereal%20Horizons.mp3";
}

export type Direction = "up" | "down" | "left" | "right";

export const ADVENTURE_SPAWN = { x: 17, y: 81 };
const permittedArea = { left: 9, right: 91, back: 52, front: 91 };

export const directionForKey: Readonly<Partial<Record<string, Direction>>> = {
  arrowup: "up", w: "up",
  arrowdown: "down", s: "down",
  arrowleft: "left", a: "left",
  arrowright: "right", d: "right",
};

export function adventureStep(from: Point, directions: ReadonlySet<Direction>, seconds: number): Point {
  const dx = Number(directions.has("right")) - Number(directions.has("left"));
  const dy = Number(directions.has("down")) - Number(directions.has("up"));
  const stride = Math.min(seconds, 0.05) / (Math.hypot(dx, dy) || 1);
  return {
    x: Math.max(permittedArea.left, Math.min(permittedArea.right, from.x + dx * 32 * stride)),
    y: Math.max(permittedArea.back, Math.min(permittedArea.front, from.y + dy * 25 * stride)),
  };
}

export function atAdventureGate(position: Point, gate: Point) {
  return Math.hypot(position.x - gate.x, position.y - gate.y) <= 7;
}

export function localAdventureTarget(chapter: Chapter, quest: AdventureQuest, position: Point, indoors = false) {
  if (chapter.home && atAdventureGate(position, indoors ? chapter.home.exit : chapter.home.door)) {
    return { kind: indoors ? "leave-house" as const : "enter-house" as const, name: chapter.home.name };
  }
  if (!quest.accepted && Boolean(chapter.npc.indoors) === indoors && atAdventureGate(position, chapter.npc.at)) {
    return { kind: "talk" as const, name: chapter.npc.name, npc: chapter.npc };
  }
  const task = chapter.task;
  if (quest.accepted && !quest.ready) {
    if (task.kind === "rune" && !indoors && atAdventureGate(position, task.at)) {
      return { kind: "rune" as const, name: task.name };
    }
    if (task.kind === "collect") {
      const item = task.items.find(({ id, at, indoors: inside }) =>
        Boolean(inside) === indoors && !quest.progress.includes(id) && atAdventureGate(position, at));
      if (item) return { kind: "collect" as const, name: item.name, id: item.id, chest: item.chest };
    }
  }
  const npcs = [chapter.npc, ...(chapter.residents ?? [])];
  const resident = npcs.find(({ at, indoors: inside }) => Boolean(inside) === indoors && atAdventureGate(position, at));
  return resident && { kind: "chat" as const, name: resident.name, npc: resident };
}
