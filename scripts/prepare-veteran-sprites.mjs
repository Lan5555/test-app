import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const output = new URL("public/sprite/combat/", root);
const registry = new URL("src/app/pages/embrace-game/data/veteran-sprites.json", root);
const ids = new Set(["knight", "maiden", "warden", "duelist", "monk", "arcanist", "ember-duelist", "eclipse-arcanist"]);
const columns = 6;
const cell = { width: 384, height: 288, pivotX: 162, pivotY: 256 };
const rows = ["idle", "run", "attack1", "attack2", "attack3", "hurt", "death", "cast", "heal", "jump", "flip"];

async function removeTileBleed(sprite) {
  const { data, info: { width, height } } = await sharp(sprite).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 20) continue;
    const pixels = [start];
    seen[start] = 1;
    let edge = false;
    for (let index = 0; index < pixels.length; index++) {
      const pixel = pixels[index];
      const column = pixel % width;
      edge ||= column <= 1 || column >= width - 2;
      const neighbors = [column > 0 ? pixel - 1 : -1, column + 1 < width ? pixel + 1 : -1, pixel - width, pixel + width];
      for (const next of neighbors) {
        if (next < 0 || next >= seen.length || seen[next] || data[next * 4 + 3] < 20) continue;
        seen[next] = 1;
        pixels.push(next);
      }
    }
    if (edge && pixels.length < width * height * .02) {
      for (const pixel of pixels) data[pixel * 4 + 3] = 0;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function split(source, columnCount) {
  const { width, height, hasAlpha } = await sharp(source).metadata();
  if (!hasAlpha) throw new Error("The source sheet must have an alpha channel.");
  return Promise.all(Array.from({ length: columnCount * 4 }, async (_, index) => {
    const x = index % columnCount;
    const y = Math.floor(index / columnCount);
    const left = Math.round(x * width / columnCount);
    const top = Math.round(y * height / 4);
    const sprite = await sharp(source).extract({
      left, top, width: Math.round((x + 1) * width / columnCount) - left,
      height: Math.round((y + 1) * height / 4) - top,
    }).png().toBuffer();
    const alpha = (await sharp(sprite).stats()).channels[3];
    if (!alpha || alpha.mean < 8 || alpha.mean > 180 || alpha.max < 200) {
      throw new Error(`Invalid transparent pose at column ${x + 1}, row ${y + 1}.`);
    }
    return removeTileBleed(sprite);
  }));
}

async function pack(id, motionSource, attackSource) {
  const [motion, attacks] = await Promise.all([split(motionSource, 6), attackSource === "-" ? undefined : split(attackSource, 4)]);
  const tile = async (input, angle = 0) => {
    const oriented = angle ? await sharp(input).rotate(angle, { background: "#0000" }).png().toBuffer() : input;
    const { data, info } = await sharp(oriented).resize({ width: 315, height: 250, fit: "inside" })
      .png().toBuffer({ resolveWithObject: true });
    return sharp({ create: { width: cell.width, height: cell.height, channels: 4, background: "#0000" } })
      .composite([{ input: data, left: cell.pivotX - Math.floor(info.width / 2), top: cell.pivotY - info.height }])
      .png().toBuffer();
  };
  const melee = motion.slice(6, 12);
  const sequence = (start, tilt) => attacks
    ? [motion[0], ...attacks.slice(start, start + 4), motion[1]]
    : melee.map((input, index) => ({ input, angle: tilt * [0, .6, 1, .65, .25, 0][index] }));
  const clips = {
    idle: [motion[0], { input: motion[0], angle: -1 }, motion[1], { input: motion[1], angle: 1 }, { input: motion[1], angle: -.5 }, { input: motion[0], angle: .5 }],
    run: [...motion.slice(2, 6), { input: motion[4], angle: 2 }, { input: motion[5], angle: -2 }],
    attack1: melee,
    attack2: sequence(4, 10),
    attack3: sequence(8, -10),
    hurt: [0, -12, -8, -5, -2, 1].map((angle) => ({ input: motion[0], angle })),
    death: [0, -15, -33, -52, -71, -88].map((angle) => ({ input: motion[0], angle })),
    cast: sequence(12, 3),
    heal: [0, -2, -1, 1, 2, 0].map((angle, index) => ({ input: motion[index % 2], angle })),
    jump: motion.slice(12, 18),
    flip: motion.slice(18, 24),
  };
  const layers = await Promise.all(rows.flatMap((row, rowIndex) => clips[row].map(async (pose, column) => ({
    input: await tile(pose.input ?? pose, pose.angle), left: column * cell.width, top: rowIndex * cell.height,
  }))));
  const atlas = await sharp({ create: { width: columns * cell.width, height: rows.length * cell.height, channels: 4, background: "#0000" } })
    .composite(layers).webp({ quality: 91, alphaQuality: 100, effort: 5 }).toBuffer();
  await Promise.all([
    writeFile(new URL(`${id}-hd.webp`, output), atlas),
    sharp(atlas).extract({ left: 0, top: 0, width: cell.width, height: cell.height }).webp({ quality: 93 })
      .toFile(fileURLToPath(new URL(`${id}-hd-preview.webp`, output))),
    sharp(atlas).extract({ left: 0, top: 0, width: clips.idle.length * cell.width, height: cell.height }).webp({ quality: 93 })
      .toFile(fileURLToPath(new URL(`${id}-hd-idle.webp`, output))),
  ]);
  return Object.fromEntries(rows.map((row) => [row, clips[row].length]));
}

const argumentsList = process.argv.slice(2);
if (!argumentsList.length || argumentsList.length % 3) throw new Error("Pass groups of fighter ID, motion PNG, and attack PNG.");
const registryData = JSON.parse(await readFile(registry, "utf8"));
for (let index = 0; index < argumentsList.length; index += 3) {
  const [id, motion, attacks] = argumentsList.slice(index, index + 3);
  if (!ids.has(id)) throw new Error(`Unknown veteran: ${id}`);
  registryData.frames[id] = await pack(id, motion, attacks);
  await writeFile(registry, `${JSON.stringify(registryData, null, 2)}\n`);
  console.log(`Packed ${id}.`);
}
