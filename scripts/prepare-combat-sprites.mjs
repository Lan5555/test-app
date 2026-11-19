import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const assetDirectory = new URL("public/sprite/combat/", root);
const animations = [
  "idle",
  "run",
  "attack1",
  "attack2",
  "attack3",
  "hurt",
  "death",
  "cast",
  "heal",
  "jump",
];
const originalCell = { width: 216, height: 162, pivotX: 89, pivotY: 143 };
const resolution = 1.5;
const cell = {
  width: originalCell.width * resolution,
  height: originalCell.height * resolution,
  pivotX: Math.round(originalCell.pivotX * resolution),
  pivotY: Math.round(originalCell.pivotY * resolution),
};
const maxColumns = 13;
const authoredFrameCount = 6;

// The source paintings use uneven spacing and different frame counts. These
// are the approximate seams between frames and the foot baseline for each row.
const sheets = {
  knight: {
    file: "Knight.png",
    rows: [0, 129, 230, 330, 435, 535, 630, 724],
    ground: [124, 221, 320, 428, 527, 624, 715],
    cuts: [
      [0, 143, 305, 465, 625, 785, 948, 1115],
      [0, 141, 296, 462, 623, 781, 945, 1110],
      [0, 151, 321, 484, 651, 817, 978, 1123],
      [0, 150, 327, 482, 663, 820, 979, 1128],
      [0, 148, 310, 473, 637, 805, 971, 1132, 1292, 1458, 1625, 1764, 1912],
      [0, 146, 303, 461, 612],
      [0, 151, 312, 456, 620, 782, 943, 1106, 1273, 1447, 1650],
    ],
    pivots: [
      [63, 222, 383, 545, 705, 866, 1026],
      [62, 218, 370, 532, 694, 855, 1017],
      [62, 218, 376, 547, 711, 875, 1042],
      [66, 227, 383, 549, 714, 884, 1042],
      [64, 221, 385, 548, 705, 870, 1030, 1193, 1352, 1516, 1673, 1835],
      [66, 223, 382, 540],
      [65, 222, 380, 539, 700, 857, 1021, 1184, 1350, 1528],
    ],
  },
  maiden: {
    file: "Maiden.png",
    rows: [0, 117, 220, 319, 418, 519, 618, 724],
    ground: [110, 212, 311, 410, 510, 609, 715],
    cuts: [
      [0, 126, 264, 401, 533, 669, 805, 941, 1078],
      [0, 127, 265, 400, 534, 668, 804, 937, 1077],
      [0, 130, 259, 399, 534, 668, 804, 942, 1080],
      [0, 127, 263, 402, 535, 669, 805, 942, 1080],
      [
        0, 122, 263, 397, 530, 665, 806, 951, 1096, 1237, 1381, 1525, 1661,
        1804,
      ],
      [0, 127, 265, 402, 542],
      [0, 129, 260, 391, 522, 654, 787, 920, 1055, 1197, 1336, 1494],
    ],
    pivots: [
      [55, 189, 324, 461, 594, 733, 868, 1002],
      [56, 191, 325, 460, 596, 732, 867, 1002],
      [55, 191, 322, 458, 594, 729, 865, 1002],
      [54, 189, 322, 463, 590, 733, 865, 1002],
      [55, 189, 320, 452, 586, 717, 857, 1006, 1145, 1285, 1430, 1573, 1712],
      [54, 189, 324, 461],
      [56, 183, 315, 446, 580, 712, 845, 976, 1109, 1251, 1384],
    ],
  },
};

// Look for a low-alpha seam near each measured boundary so diagonally spaced
// poses can keep their antialiasing without picking up the next frame.
function findSeam(length, boundary, radius, alpha) {
  const span = 2 * radius + 1;
  const trail = new Uint8Array(length * span);
  let previous = new Float64Array(span);
  for (let along = 0; along < length; along++) {
    const next = new Float64Array(span);
    for (let offset = 0; offset < span; offset++) {
      let best = offset;
      for (
        let candidate = Math.max(0, offset - 2);
        candidate <= Math.min(span - 1, offset + 2);
        candidate++
      ) {
        if (
          previous[candidate] + Math.abs(candidate - offset) * 4 <
          previous[best] + Math.abs(best - offset) * 4
        )
          best = candidate;
      }
      const distance = offset - radius;
      const coverage = alpha(along, boundary + distance) / 255;
      next[offset] =
        previous[best] +
        Math.abs(best - offset) * 4 +
        coverage ** 2 * 95 +
        distance ** 2 * 0.33;
      trail[along * span + offset] = best;
    }
    previous = next;
  }

  let offset = previous.indexOf(Math.min(...previous));
  const seam = new Int16Array(length);
  for (let along = length - 1; along >= 0; along--) {
    seam[along] = boundary + offset - radius;
    offset = trail[along * span + offset];
  }
  return seam;
}

const combatRows = ["idle", "attack1", "attack2", "cast", "heal"];
const acrobaticRows = ["idle", "attack1", "attack2", "jump", "cast", "heal"];
const renderedSheets = {
  knight: {
    file: "Knight-Combat-6.png",
    rows: [...combatRows, "hurt"],
    scale: 0.74,
    ground: [189, 395, 606, 814, 1023, 1233],
  },
  maiden: {
    file: "Maiden-Combat-6.png",
    rows: [...combatRows, "hurt"],
    scale: 0.72,
    ground: [195, 387, 602, 813, 1027, 1232],
  },
  warden: {
    file: "Warden-Combat-6.png",
    rows: [...combatRows, "attack3"],
    scale: 0.74,
    ground: [200, 407, 617, 825, 1034, 1240],
  },
  duelist: {
    file: "Duelist-Combat-6.png",
    rows: [...combatRows, "attack3"],
    scale: 0.79,
    ground: [185, 382, 590, 797, 1003, 1206],
  },
  arcanist: {
    file: "Arcanist-Combat.png",
    rows: acrobaticRows,
    scale: 0.61,
    ground: [190, 386, 609, 821, 1024, 1237],
    bands: [0, 209, 414, 617, 838, 1039, 1254],
  },
  monk: {
    file: "Monk-Combat.png",
    rows: acrobaticRows,
    scale: 0.57,
    ground: [200, 404, 612, 822, 1027, 1242],
    bands: [0, 211, 417, 623, 832, 1041, 1254],
  },
};

const reactionRows = ["run", "hurt", "death"];
const aerialBands = [0, 253, 499, 762, 1024];
const aerialSheets = Object.fromEntries(
  [
    ["knight", 0.54, 237],
    ["maiden", 0.59, 492],
    ["warden", 0.53, 754],
    ["duelist", 0.55, 1004],
  ].map(([name, scale, ground], row) => [
    name,
    {
      file: "Aerial-Attacks.png",
      width: 1536,
      height: 1024,
      scale,
      ground: [ground],
      bands: aerialBands.slice(row, row + 2),
    },
  ]),
);
const reactionSheets = {
  warden: {
    file: "Warden-Duelist-Reactions-6.png",
    scale: 0.72,
    ground: [194, 405, 620],
    bands: [0, 209, 418, 627],
  },
  duelist: {
    file: "Warden-Duelist-Reactions-6.png",
    scale: 0.77,
    ground: [819, 1022, 1233],
    bands: [627, 836, 1045, 1254],
  },
  monk: {
    file: "Monk-Arcanist-Reactions-6.png",
    scale: 0.66,
    ground: [201, 417, 623],
    bands: [0, 209, 419, 627],
  },
  arcanist: {
    file: "Monk-Arcanist-Reactions-6.png",
    scale: 0.72,
    ground: [820, 1021, 1228],
    bands: [627, 836, 1045, 1254],
  },
};

const enemySheets = {
  "echo-beast": {
    file: "Enemy-Echo-Beast.png",
    scale: 0.79,
    ground: [189, 387, 605, 814, 1022, 1233],
  },
  "gate-warden": {
    file: "Enemy-Gate-Warden.png",
    scale: 0.68,
    bands: [0, 209, 410, 627, 836, 1045, 1254],
    ground: [197, 402, 618, 826, 1031, 1247],
  },
  "hollow-specter": {
    file: "Enemy-Hollow-Specter.png",
    scale: 0.69,
    bands: [0, 209, 415, 627, 836, 1045, 1254],
    ground: [201, 404, 620, 828, 1031, 1244],
  },
};

const enemyRows = [
  ["idle", 0],
  ["run", 1],
  ["attack1", 2],
  ["attack2", 2],
  ["attack3", 2],
  ["hurt", 3],
  ["death", 4],
  ["cast", 5],
  ["heal", 5],
  ["jump", 2],
];

const featuredPalettes = {
  "ember-duelist": { base: "duelist", tint: [1, 0.35, 0.19] },
  "eclipse-arcanist": { base: "arcanist", tint: [0.67, 0.29, 1] },
};

async function makeRenderedFrames(
  {
    file,
    scale,
    ground,
    bands = [0, 209, 418, 627, 836, 1045, 1254],
    width = 1254,
    height = 1254,
  },
  rowMap,
) {
  scale *= resolution;
  const source = fileURLToPath(new URL(`public/sprite/${file}`, root));
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== width ||
    info.height !== height ||
    rowMap.some(([, row]) => !Number.isFinite(ground[row]))
  ) {
    throw new Error(
      "Update the rendered frame map for the new source dimensions.",
    );
  }

  // The rendered PNGs have faint alpha noise in otherwise empty gutters.
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 9) data[index] = 0;
  }

  return Promise.all(
    rowMap.flatMap(([animation, row]) => {
      const top = Math.max(
        bands[row],
        ground[row] - Math.floor(cell.pivotY / scale),
      );
      const bottom = Math.min(
        bands[row + 1],
        ground[row] + Math.floor((cell.height - cell.pivotY) / scale),
      );
      const resizedHeight = Math.round((bottom - top) * scale);
      const outputY =
        animations.indexOf(animation) * cell.height +
        cell.pivotY -
        Math.round((ground[row] - top) * scale);
      return Array.from({ length: authoredFrameCount }, async (_, column) => {
        const left = Math.round((column * width) / authoredFrameCount);
        const right = Math.round(((column + 1) * width) / authoredFrameCount);
        const cropWidth = right - left;
        return {
          input: await sharp(data, { raw: info })
            .extract({
              left,
              top,
              width: cropWidth,
              height: bottom - top,
            })
            .resize({
              width: Math.round(cropWidth * scale),
              height: resizedHeight,
              fit: "fill",
            })
            .sharpen({ sigma: 0.75, m1: 0, m2: 1.35 })
            .png()
            .toBuffer(),
          left:
            column * cell.width +
            cell.pivotX -
            Math.round((cropWidth * scale) / 2),
          top: outputY,
        };
      });
    }),
  );
}

async function makeLegacyFrames(
  { file, rows, ground, cuts, pivots },
  overrides,
) {
  const input = fileURLToPath(new URL(`public/sprite/${file}`, root));
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (rows.at(-1) !== height || cuts.some((row) => row.at(-1) > width)) {
    throw new Error(
      `${file} dimensions changed. Update the sprite boundaries before converting.`,
    );
  }
  const alpha = (x, y) => data[(y * width + x) * 4 + 3] ?? 0;
  const horizontal = rows.map((y, index) =>
    index === 0 || index === rows.length - 1
      ? new Int16Array(width).fill(y)
      : findSeam(width, y, 8, alpha),
  );
  const layers = [];

  for (const [row, seams] of cuts.entries()) {
    if (overrides.includes(animations[row])) continue;
    if (
      seams.length !== pivots[row].length + 1 ||
      pivots[row].length > maxColumns
    ) {
      throw new Error(
        `${file} has an invalid frame map for ${animations[row]}`,
      );
    }
    const top = Math.max(0, rows[row] - 8);
    const bottom = Math.min(height, rows[row + 1] + 8);
    const vertical = seams.map((x, index) =>
      index === 0 || index === seams.length - 1
        ? new Int16Array(bottom - top).fill(x)
        : findSeam(bottom - top, x, 10, (dy, px) => alpha(px, top + dy)),
    );

    for (const [index, pivot] of pivots[row].entries()) {
      const frame = Buffer.alloc(originalCell.width * originalCell.height * 4);
      for (let y = top; y < bottom; y++) {
        const dy = y - ground[row] + originalCell.pivotY;
        if (dy < 0 || dy >= originalCell.height) continue;
        for (
          let x = vertical[index][y - top];
          x < vertical[index + 1][y - top];
          x++
        ) {
          const dx = x - pivot + originalCell.pivotX;
          if (
            dx < 0 ||
            dx >= originalCell.width ||
            y < horizontal[row][x] ||
            y >= horizontal[row + 1][x] ||
            alpha(x, y) < 16
          )
            continue;
          const source = (y * width + x) * 4;
          const dest = (dy * originalCell.width + dx) * 4;
          data.copy(frame, dest, source, source + 4);
        }
      }
      layers.push({
        input: await sharp(frame, { raw: { width: originalCell.width, height: originalCell.height, channels: 4 } })
          .resize(cell.width, cell.height)
          .sharpen({ sigma: 0.9, m1: 0, m2: 1.55 })
          .png()
          .toBuffer(),
        left: index * cell.width,
        top: row * cell.height,
      });
    }
  }
  return layers;
}

async function makeAtlas(name) {
  const legacy = sheets[name];
  const layers = [];
  const counts = Object.fromEntries(
    animations.map((animation, index) => [
      animation,
      legacy?.pivots[index]?.length ?? 0,
    ]),
  );
  async function addRows(sheet, rows) {
    layers.push(...(await makeRenderedFrames(sheet, rows)));
    for (const [animation] of rows) counts[animation] = authoredFrameCount;
  }
  const rendered = renderedSheets[name];
  const aerial = aerialSheets[name];
  const rowMap = rendered.rows.map((animation, index) => [animation, index]);
  if (rendered.rows.includes("jump")) rowMap.push(["attack3", 2]);
  if (legacy) layers.push(...await makeLegacyFrames(legacy, rendered.rows));
  await addRows(rendered, rowMap);
  if (aerial) await addRows(aerial, [["jump", 0]]);
  if (!legacy) {
    await addRows(
      reactionSheets[name],
      reactionRows.map((animation, index) => [animation, index]),
    );
  }
  if (
    Object.values(counts).some(
      (count) => count < authoredFrameCount || count > maxColumns,
    )
  )
    throw new Error(
      `${name} has an animation row outside the supported frame range.`,
    );
  const columns = Math.max(...Object.values(counts));
  await writeAtlas(name, layers, columns);
  return { counts, columns };
}

async function writeAtlas(name, layers, columns, base) {
  const width = columns * cell.width;
  const height = cell.height * animations.length;
  const atlas = base ?? Buffer.alloc(width * height * 4);
  const url = new URL(`${name}.webp`, assetDirectory);
  const image = sharp(atlas, {
    raw: {
      width,
      height,
      channels: 4,
    },
  });
  if (layers.length) image.composite(layers);
  await image
    .webp({ nearLossless: true, quality: 95, alphaQuality: 100, effort: 4 })
    .toFile(fileURLToPath(url));
}

async function makeFeaturedAtlas(name, { base, tint }, columns) {
  const source = fileURLToPath(new URL(`${base}.webp`, assetDirectory));
  const { data, info } = await sharp(source)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== columns * cell.width ||
    info.height !== cell.height * animations.length ||
    info.channels !== 4
  ) {
    throw new Error(`${base} dimensions changed before recoloring.`);
  }
  const rowBytes = info.width * cell.height * info.channels;
  const healStart = animations.indexOf("heal") * rowBytes;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    // Feather the blue mask so fabric and attack trails change color while
    // skin, green healing effects, gold trim and neutrals keep their colors.
    const coolStrength = Math.min(
      1,
      Math.max(0, (Math.max(green, blue - 8) - red - 4) / 15),
    );
    const healing = index >= healStart && index < healStart + rowBytes;
    const blueBalance = Math.min(
      1,
      Math.max(0, (blue - green + (healing ? 6 : 30)) / 14),
    );
    const cool = coolStrength * blueBalance;
    if (cool === 0) continue;
    const light = Math.max(green, blue);
    const neutral = Math.min(red, green, blue);
    const saturation = light - neutral;
    for (let channel = 0; channel < 3; channel++) {
      const original = data[index + channel];
      data[index + channel] = Math.round(
        original + cool * (neutral + saturation * tint[channel] - original),
      );
    }
  }
  await writeAtlas(name, [], columns, data);
}

await mkdir(assetDirectory, { recursive: true });
const frames = {};
const fighterColumns = {};
for (const name of Object.keys(renderedSheets)) {
  const { counts, columns } = await makeAtlas(name);
  frames[name] = counts;
  fighterColumns[name] = columns;
}
const enemyColumns = authoredFrameCount;
const manifest = { cell, fighterColumns, enemyColumns, rows: animations, frames };
for (const [name, sheet] of Object.entries(enemySheets)) {
  await writeAtlas(`enemy-${name}`, await makeRenderedFrames(sheet, enemyRows), enemyColumns);
}
for (const [name, palette] of Object.entries(featuredPalettes)) {
  await makeFeaturedAtlas(name, palette, fighterColumns[palette.base]);
}
await Promise.all(
  [...Object.keys(frames), ...Object.keys(featuredPalettes)].flatMap((name) => {
    const idleFrames = frames[featuredPalettes[name]?.base ?? name].idle;
    return [["preview", 1], ["idle", idleFrames]].map(([suffix, count]) =>
      sharp(fileURLToPath(new URL(`${name}.webp`, assetDirectory)))
        .extract({
          left: 0,
          top: animations.indexOf("idle") * cell.height,
          width: cell.width * count,
          height: cell.height,
        })
        .webp({ lossless: true, effort: 6 })
        .toFile(fileURLToPath(new URL(`${name}-${suffix}.webp`, assetDirectory))),
    );
  }),
);
await writeFile(
  new URL("src/app/pages/embrace-game/data/combat-sprites.json", root),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
for (const [name, counts] of Object.entries(frames)) {
  console.log(
    `${name}: ${Object.values(counts).reduce((sum, count) => sum + count, 0)} frames`,
  );
}
