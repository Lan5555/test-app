import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const output = fileURLToPath(new URL("public/sprite/combat/", root));
const cell = { width: 384, height: 288, pivotY: 256 };
const columns = 6;
const rows = 11;
const groundedRows = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);

async function visibleBottom(tile) {
  const { data, info } = await sharp(tile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) return y;
    }
  }
  return cell.pivotY;
}

const requestedIds = new Set(process.argv.slice(2));
const files = (await readdir(output)).filter((file) => {
  if (
    !file.endsWith("-hd.webp") ||
    file.includes("preview") ||
    file.includes("idle")
  )
    return false;
  return (
    requestedIds.size === 0 || requestedIds.has(file.replace(/-hd\.webp$/, ""))
  );
});

for (const file of files) {
  const atlasPath = path.join(output, file);
  const atlas = await sharp(atlasPath).png().toBuffer();
  const layers = await Promise.all(
    Array.from({ length: rows * columns }, async (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const left = column * cell.width;
      const top = row * cell.height;
      const tile = await sharp(atlas)
        .extract({ left, top, width: cell.width, height: cell.height })
        .png()
        .toBuffer();
      const offset = groundedRows.has(row)
        ? Math.max(0, cell.pivotY - (await visibleBottom(tile)))
        : 0;
      const grounded = offset
        ? await sharp({
            create: {
              width: cell.width,
              height: cell.height,
              channels: 4,
              background: "#0000",
            },
          })
            .composite([{ input: tile, left: 0, top: offset }])
            .png()
            .toBuffer()
        : tile;
      return { input: grounded, left, top };
    }),
  );
  const normalized = await sharp({
    create: {
      width: cell.width * columns,
      height: cell.height * rows,
      channels: 4,
      background: "#0000",
    },
  })
    .composite(layers)
    .webp({ quality: 91, alphaQuality: 100, effort: 5 })
    .toBuffer();
  const id = file.replace(/-hd\.webp$/, "");
  await Promise.all([
    sharp(normalized).toFile(atlasPath),
    sharp(normalized)
      .extract({ left: 0, top: 0, width: cell.width, height: cell.height })
      .webp({ quality: 93 })
      .toFile(path.join(output, `${id}-hd-preview.webp`)),
    sharp(normalized)
      .extract({
        left: 0,
        top: 0,
        width: cell.width * columns,
        height: cell.height,
      })
      .webp({ quality: 93 })
      .toFile(path.join(output, `${id}-hd-idle.webp`)),
  ]);
  console.log(`Grounded ${id}.`);
}
