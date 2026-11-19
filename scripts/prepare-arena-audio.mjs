import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const output = new URL("../public/arenas/audio/", import.meta.url);
mkdirSync(output, { recursive: true });
const enemyOutput = new URL("../public/encounters/audio/", import.meta.url);
const adventureOutput = new URL("../public/adventure/audio/", import.meta.url);

const sampleRate = 24_000;
const summonsOnly = process.argv.includes("--summons-only");
const encountersOnly = process.argv.includes("--encounters-only");
const adventureOnly = process.argv.includes("--adventure-only");
const cycle = 2 * Math.PI;
const sine = (frequency, seconds) => Math.sin(cycle * frequency * seconds);
const hz = (note) => 440 * 2 ** ((note - 69) / 12);
const fade = (time, length, attack = 0.02, release = 0.15) =>
  Math.min(1, time / attack, (length - time) / release);

function sound(name, seconds, sample, directory = output) {
  if (summonsOnly && !name.startsWith("summon-")) return;
  if (encountersOnly && directory !== enemyOutput) return;
  if (adventureOnly && directory !== adventureOutput) return;
  const count = Math.floor(sampleRate * seconds);
  const wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(count * 2, 40);

  let seed = 7919;
  for (let index = 0; index < count; index++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    const time = index / sampleRate;
    const mix = sample(time, noise) * fade(time, seconds, 0.005, 0.022);
    wav.writeInt16LE(Math.round(32767 * Math.tanh(mix)), 44 + index * 2);
  }
  writeFileSync(fileURLToPath(new URL(`${name}.wav`, directory)), wav);
}

function bell(note, time, length, brightness = 0.25) {
  if (time < 0 || time >= length) return 0;
  const pitch = hz(note);
  return (
    (sine(pitch, time) +
      brightness * sine(pitch * 2.42, time) * Math.exp(-time * 8)) *
    Math.exp(-time * 2.5) *
    fade(time, length, 0.014, 0.25)
  );
}

const themes = [
  {
    name: "moonlit-observatory",
    bpm: 100,
    chords: [
      [50, 57, 65],
      [46, 57, 65],
      [53, 60, 69],
      [48, 55, 64],
    ],
    phrase: [2, 1, 2, 0, 2, 1, 0, 1],
    brightness: 0.34,
    pulse: 0.22,
  },
  {
    name: "ember-citadel",
    bpm: 120,
    chords: [
      [45, 52, 60],
      [41, 53, 60],
      [43, 55, 62],
      [40, 52, 59],
    ],
    phrase: [0, 1, 2, 1, 0, 1, 2, 2],
    brightness: 0.18,
    pulse: 0.83,
  },
  {
    name: "verdant-sanctum",
    bpm: 105,
    chords: [
      [48, 55, 64],
      [45, 52, 60],
      [41, 53, 64],
      [43, 55, 62],
    ],
    phrase: [1, 2, 0, 2, 1, 0, 1, 2],
    brightness: 0.5,
    pulse: 0.14,
  },
];

for (const theme of themes) {
  const beat = 60 / theme.bpm;
  const bar = beat * 4;
  const length = bar * 8;
  sound(theme.name, length, (time, noise) => {
    const measure = Math.floor(time / bar);
    const chord = theme.chords[measure % theme.chords.length];
    const withinBar = time % bar;
    const withinBeat = time % beat;
    const pad =
      chord.reduce((mix, note, voice) => {
        const pitch = hz(note);
        return (
          mix +
          sine(pitch, time) * 0.038 +
          sine(pitch * 2.002, time) *
            (0.014 + sine(0.4 + voice * 0.12, time) * 0.007)
        );
      }, 0) * fade(withinBar, bar, 0.2, 0.3);
    const bass =
      sine(hz(chord[0] - 12), withinBeat) *
      Math.exp(-withinBeat * 3.6) *
      fade(withinBeat, beat, 0.025, 0.07);
    const stepLength = beat / 2;
    const step = Math.floor(withinBar / stepLength);
    const melody = [0, 1, 2].reduce((mix, echo) => {
      const position = step - echo;
      if (position < 0) return mix;
      const note =
        chord[theme.phrase[position % 8]] +
        (measure >= 4 && position % 4 === 1 ? 24 : 12);
      return (
        mix +
        bell(
          note,
          withinBar - position * stepLength,
          beat * 1.35,
          theme.brightness,
        ) *
          [0.13, 0.074, 0.033][echo]
      );
    }, 0);
    const kick =
      Math.sin(
        cycle * (40 * withinBeat + 2 * (1 - Math.exp(-withinBeat * 13))),
      ) *
      Math.exp(-withinBeat * 13) *
      fade(withinBeat, beat, 0.009, 0.04);
    const shaker = noise * Math.exp(-(time % stepLength) * 27) * 0.012;
    return pad + melody + bass * 0.11 + kick * theme.pulse * 0.18 + shaker;
  });
}

sound(
  "fighter-select",
  0.32,
  (time) => bell(76, time, 0.28) * 0.36 + bell(83, time - 0.05, 0.24) * 0.29,
);

sound("arena-impact", 0.33, (time, noise) => {
  const sweep = Math.sin(cycle * (37 * time + 3 * (1 - Math.exp(-time * 23))));
  return (
    sweep * Math.exp(-time * 21) * 0.68 + noise * Math.exp(-time * 43) * 0.32
  );
});

sound("arena-break", 0.68, (time, noise) =>
  [0, 0.021, 0.048, 0.078].reduce((mix, start, index) => {
    const local = time - start;
    if (local < 0) return mix;
    return (
      mix +
      bell(92 + index * 3, local, 0.56, 0.8) *
        Math.exp(-local * (3 + index)) *
        0.12 +
      noise * Math.exp(-local * 58) * 0.12
    );
  }, 0),
);

sound("summon-portal", 0.85, (time, noise) => {
  const rise = Math.sin(Math.PI * time / 0.85);
  const sweep = Math.sin(cycle * (86 * time + 150 * time * time));
  return rise * (sweep * 0.26 + noise * 0.1) +
    bell(71, time - 0.24, 0.6) * 0.28 +
    bell(78, time - 0.32, 0.5) * 0.19;
});

sound("summon-strike", 0.42, (time, noise) => {
  const wind = Math.sin(Math.PI * Math.min(1, time / 0.32));
  const sweep = Math.sin(cycle * (270 * time - 205 * time * time));
  return wind * (sweep * 0.22 + noise * 0.29) +
    bell(58, time - 0.27, 0.15, 0.55) * 0.22;
});

sound("summon-charge", 0.55, (time, noise) =>
  Math.sin(Math.PI * time / 0.55) *
  (Math.sin(cycle * (60 * time + 120 * time * time)) * 0.38 + noise * 0.1),
);

sound("summon-burst", 0.42, (time, noise) => {
  const latch = Math.exp(-time * 34) * (sine(115, time) * 0.55 + noise * 0.29);
  const bloom = bell(65, time - 0.045, 0.36, 0.55) * 0.37;
  return latch + bloom;
});

sound("summon-reveal", 0.68, (time) =>
  bell(72, time, 0.58) * 0.35 + bell(79, time - 0.09, 0.57) * 0.3,
);

sound("summon-legendary", 1.08, (time) =>
  bell(55, time, 1) * 0.35 + bell(67, time, 1) * 0.22 +
  bell(74, time - 0.12, 0.89) * 0.32 + bell(86, time - 0.23, 0.82) * 0.23,
);

if (!summonsOnly && !adventureOnly) {
  mkdirSync(enemyOutput, { recursive: true });
  const enemies = [
    { id: "ironbound-sentry", root: 92, resonance: 3.1, glide: -40, grit: 0.42 },
    { id: "mourning-wisp", root: 288, resonance: 1.48, glide: 84, grit: 0.09 },
    { id: "rimefang-stalker", root: 115, resonance: 2.15, glide: -62, grit: 0.58 },
    { id: "bellkeeper", root: 136, resonance: 2.72, glide: -30, grit: 0.24 },
    { id: "ashen-matriarch", root: 230, resonance: 1.8, glide: -46, grit: 0.32 },
    { id: "crownless-king", root: 58, resonance: 2.51, glide: -18, grit: 0.46 },
    { id: "thorn-revenant", root: 108, resonance: 2.19, glide: -48, grit: 0.43 },
    { id: "saltglass-oracle", root: 294, resonance: 1.5, glide: 76, grit: 0.12 },
    { id: "graveshell-colossus", root: 67, resonance: 3.23, glide: -28, grit: 0.56 },
    { id: "mothveil-duchess", root: 233, resonance: 2.04, glide: 97, grit: 0.2 },
    { id: "cinder-jackal", root: 147, resonance: 2.39, glide: -75, grit: 0.58 },
    { id: "tidebound-executioner", root: 79, resonance: 1.87, glide: -33, grit: 0.53 },
  ];

  for (const { id, root, resonance, glide, grit } of enemies) {
    sound(`${id}-entrance`, 1.15, (time, noise) => {
      const phase = root * time + glide * time * time * 0.25;
      const body = Math.sin(cycle * phase + 0.45 * sine(5.6, time));
      const overtone = Math.sin(cycle * resonance * phase);
      const envelope = fade(time, 1.15, 0.12, 0.36);
      return (body * 0.36 + overtone * 0.21 + noise * grit * 0.14) * envelope;
    }, enemyOutput);
    sound(`${id}-attack`, 0.48, (time, noise) => {
      const phase = root * 1.6 * time + glide * time * time;
      const body = Math.sin(cycle * phase) + 0.6 * Math.sin(cycle * resonance * phase);
      const breath = Math.sin(Math.PI * Math.min(1, time / 0.44)) ** 2;
      const impact = time < 0.18 ? 0 : sine(64, time - 0.18) * Math.exp(-(time - 0.18) * 25);
      return (body * 0.26 + noise * grit * 0.32) * breath + impact * 0.32;
    }, enemyOutput);
  }
}

if (!summonsOnly && !encountersOnly) {
  mkdirSync(adventureOutput, { recursive: true });

  function ambience(name, wind, filter, swell, detail) {
    let air = 0;
    sound(name, 10, (time, noise) => {
      air += (noise - air) * filter;
      return air * wind * (0.68 + 0.32 * sine(swell, time)) + detail(time, noise, air);
    }, adventureOutput);
  }

  function trill(time, start, pitch) {
    const elapsed = time - start;
    if (elapsed < 0 || elapsed > 0.17) return 0;
    return sine(pitch + elapsed * 2800, elapsed) * Math.sin(Math.PI * elapsed / 0.17) ** 2;
  }

  function crackle(time, noise) {
    const interval = (time + 0.026 * sine(3.11, time)) % 0.21;
    return noise * Math.exp(-interval * 210) * (0.12 + 0.1 * sine(2.3, time));
  }

  ambience("ashglass-village", 1.05, 0.04, 0.4, (time) =>
    bell(64, time - 2.7, 1.4) * 0.13 + bell(64, time - 6.1, 1.4) * 0.09 +
    trill(time, 1.3, 880) * 0.07 + trill(time, 8.2, 1050) * 0.08);

  ambience("echo-caves", 0.52, 0.015, 0.2, (time) =>
    sine(53, time) * 0.025);

  ambience("emberwood-depths", 1.25, 0.019, 0.6, (time) =>
    [0.84, 1.1, 3.15, 6.92, 7.19, 9].reduce((mix, start, index) =>
      mix + trill(time, start, 1130 + index * 112) * 0.16, 0));

  ambience("bellward-hamlet", 0.72, 0.022, 0.3, (time) =>
    bell(55, time - 1, 2.2, 0.55) * 0.23 + bell(50, time - 4.6, 2.2, 0.6) * 0.29 +
    bell(55, time - 8, 2, 0.55) * 0.18);

  ambience("glasswind-dunes", 1.22, 0.055, 0.2, (time, noise, air) =>
    (noise - air) * 0.055 * (0.5 + 0.5 * sine(0.3, time)) +
    sine(148, time) * (0.027 + 0.018 * sine(0.4, time)));

  ambience("crownfall-citadel", 0.88, 0.022, 0.3, (time) =>
    (sine(55, time) + sine(82, time) * 0.8) * (0.06 + 0.032 * sine(0.2, time)) +
    bell(47, time - 5, 2.3, 0.6) * 0.24);

  ambience("ferryman-home", 0.48, 0.03, 0.7, crackle);

  ambience("bellwright-workshop", 0.75, 0.031, 0.5, (time, noise) =>
    crackle(time, noise) + [1.4, 1.94, 4.1, 6.8, 7.58, 9.2].reduce((mix, start) =>
      mix + bell(75, time - start, 0.6, 0.92) * 0.24, 0));

  ambience("wayfarers-lodge", 0.82, 0.014, 0.4, (time, noise) =>
    crackle(time, noise) * 0.45 + bell(82, time - 1.1, 1.2) * 0.12 +
    bell(87, time - 7.2, 1.2) * 0.11);

  sound("door", 0.55, (time, noise) => {
    const latch = (noise * 0.47 + sine(105, time) * 0.36) * Math.exp(-time * 45);
    const creak = time - 0.04;
    return latch + (creak > 0
      ? sine(154 + 135 * creak, creak) * sine(13, creak) * Math.exp(-creak * 8) * 0.32
      : 0);
  }, adventureOutput);

  sound("chest", 0.82, (time, noise) =>
    (sine(124, time) * 0.42 + noise * 0.3) * Math.exp(-time * 45) +
    bell(73, time - 0.06, 0.52) * 0.36 + bell(80, time - 0.14, 0.6) * 0.31 +
    bell(85, time - 0.23, 0.59) * 0.27, adventureOutput);
}
