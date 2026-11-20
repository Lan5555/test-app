import { fileURLToPath } from "node:url";
import sharp from "sharp";

const [vesperSource, morcantSource] = process.argv.slice(2);
if (!vesperSource || !morcantSource) {
  throw new Error("Usage: node scripts/prepare-signature-fighter-sprites.mjs <Vesper sheet> <Morcant sheet>");
}

const width = 324;
const height = 243;
const columns = 4;
const rowCount = 10;
const destination = new URL("../public/sprite/combat/", import.meta.url);

async function prepare(id, source) {
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${id} sprite source has no transparency.`);

  const poses = await Promise.all(Array.from({ length: 16 }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.round(metadata.width * column / columns);
    const top = Math.round(metadata.height * row / columns);
    return sharp(source).extract({
      left, top,
      width: Math.round(metadata.width * (column + 1) / columns) - left,
      height: Math.round(metadata.height * (row + 1) / columns) - top,
    }).resize({ width: 208, height: 206, fit: "inside" }).png().toBuffer();
  }));

  async function tile(index, angle = 0) {
    const rotation = angle
      ? await sharp(poses[index]).rotate(angle, { background: "#0000" }).png().toBuffer()
      : poses[index];
    const { data, info } = await sharp(rotation).resize({ width: 276, height: 210, fit: "inside", withoutEnlargement: true })
      .png().toBuffer({ resolveWithObject: true });
    return sharp({ create: { width, height, channels: 4, background: "#0000" } })
      .composite([{ input: data, left: Math.round(140 - info.width / 2), top: 217 - info.height }]).png().toBuffer();
  }

  const rows = [
    [[0], [1], [1], [0]],
    [[2], [3], [2], [3]],
    [[0], [4], [5], [0]],
    [[4], [5], [6], [7]],
    [[8], [9], [10], [11]],
    [[0], [0, -10], [0, -6], [0]],
    [[0], [0, -24], [0, -58], [0, -87]],
    [[12], [13], [14], [15]],
    [[0], [1], [1], [0]],
    [[0], [4, 10], [6], [1]],
  ];
  const layers = await Promise.all(rows.flatMap((row, rowIndex) => row.map(async ([index, rotation], column) => ({
    input: await tile(index, rotation), left: column * width, top: rowIndex * height,
  }))));
  const atlas = await sharp({ create: { width: columns * width, height: rowCount * height, channels: 4, background: "#0000" } })
    .composite(layers).webp({ quality: 91, alphaQuality: 100 }).toBuffer();
  await Promise.all([
    sharp(atlas).toFile(fileURLToPath(new URL(`${id}.webp`, destination))),
    sharp(atlas).extract({ left: 0, top: 0, width, height }).webp({ quality: 93 })
      .toFile(fileURLToPath(new URL(`${id}-preview.webp`, destination))),
    sharp(atlas).extract({ left: 0, top: 0, width: columns * width, height }).webp({ quality: 93 })
      .toFile(fileURLToPath(new URL(`${id}-idle.webp`, destination))),
  ]);
}

await prepare("lady-ley", vesperSource);
await prepare("grave-chorister", morcantSource);
