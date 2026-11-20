import { writeFile } from "node:fs/promises";

const rate = 24_000;
const cues = {
  steel: { duration: 0.36, partials: [[178, .24, 24], [628, .24, 16], [1234, .14, 12], [2771, .12, 19]], noise: .42 },
  chime: { duration: 0.52, partials: [[460, .20, 14], [935, .24, 8], [1406, .17, 9], [2527, .12, 11]], noise: .22 },
  crescent: { duration: .40, partials: [[210, .23, 17], [763, .24, 12], [1950, .18, 13]], noise: .42, glide: .27 },
  bellstaff: { duration: .58, partials: [[95, .30, 14], [249, .25, 7], [431, .15, 11], [794, .12, 9]], noise: .28 },
  "astral-severance": { duration: .58, partials: [[160, .20, 12], [804, .29, 12], [1469, .21, 8]], noise: .34, glide: .38 },
  "crimson-waltz": { duration: .50, partials: [[280, .23, 12], [774, .27, 16], [2280, .14, 15]], noise: .42, echo: .081, glide: -.15 },
  "moonveil-reflection": { duration: .64, partials: [[384, .22, 7], [721, .21, 8], [1413, .19, 9]], noise: .18, echo: .15 },
  "the-unwritten-end": { duration: .54, partials: [[85, .30, 9], [412, .20, 13], [1571, .19, 11]], noise: .37, glide: .42 },
  "chronos-elegy": { duration: .72, partials: [[141, .24, 6], [527, .25, 8], [1019, .16, 12]], noise: .16, echo: .19 },
  "funeral-of-stars": { duration: .72, partials: [[67, .34, 7], [206, .22, 8], [590, .13, 10]], noise: .34, glide: .77, echo: .13 },
};

const requested = new Set(process.argv.slice(2));
for (const [name, { duration, partials, noise, glide = 0, echo }] of Object.entries(cues)) {
  if (requested.size && !requested.has(name)) continue;
  const length = Math.round(rate * duration);
  const wave = Buffer.alloc(44 + length * 2);
  wave.write("RIFF");
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(rate, 24);
  wave.writeUInt32LE(rate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(length * 2, 40);
  let seed = 917;
  let previous = 0;
  for (let sample = 0; sample < length; sample++) {
    const time = sample / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const random = seed / 2147483648 - 1;
    const transient = (random - previous) * noise * Math.exp(-time * 82);
    previous = random;
    const ring = partials.reduce((sum, [frequency, level, damping]) =>
      sum + Math.sin(2 * Math.PI * frequency * time * (1 - glide * time)) * level * Math.exp(-time * damping), 0);
    const envelope = Math.min(1, time * 1500, (duration - time) * 40);
    const echoSample = echo ? sample - Math.round(rate * echo) : -1;
    const repeat = echoSample >= 0 ? wave.readInt16LE(44 + echoSample * 2) / 32767 * .38 : 0;
    wave.writeInt16LE(Math.round(Math.tanh((ring + transient + repeat) * envelope) * 32767), 44 + sample * 2);
  }
  await writeFile(new URL(`../public/arenas/audio/strike-${name}.wav`, import.meta.url), wave);
}
