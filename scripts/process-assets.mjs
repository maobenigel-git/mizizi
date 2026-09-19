// Removes flat backgrounds from the artwork in assets-src/ and writes
// transparent, trimmed PNGs to public/assets/, where the app picks them up.
//   npm run assets
//
// Handles white, light-grey and baked-in "checkerboard" backgrounds. A pixel is
// background-like when it is unsaturated and at least as bright as the image's
// own border. Background-like regions are removed when they touch the image
// edge or are large (gaps between an arm and the body); small enclosed ones
// (eyes, teeth, beads) are kept.
import { mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = fileURLToPath(new URL("../assets-src/", import.meta.url));
const OUT = fileURLToPath(new URL("../public/assets/", import.meta.url));
/** Files copied as-is (photographic backgrounds have nothing to cut out). */
const KEEP_BACKGROUND = ["bghome"];

const MAX_SATURATION = 16;
const ENCLOSED_MIN_AREA = 0.0006; // share of the image; above this an enclosed region is a gap, not a detail

async function cutOut(name) {
  const { data, info } = await sharp(SRC + name).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const min = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const sat = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - min(i);

  // Brightness floor: the darkest unsaturated pixel on the border, less a margin.
  let floor = 255;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (sat(y * w + x) <= MAX_SATURATION) floor = Math.min(floor, min(y * w + x));
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (sat(y * w + x) <= MAX_SATURATION) floor = Math.min(floor, min(y * w + x));
  floor -= 25;
  const bgLike = (i) => sat(i) <= MAX_SATURATION && min(i) >= floor;

  // Connected components over background-like pixels.
  const label = new Int32Array(n);
  const remove = new Uint8Array(n);
  const stack = [];
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (label[start] || !bgLike(start)) continue;
    next++;
    const members = [];
    let touchesEdge = false;
    label[start] = next;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      members.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !label[j] && bgLike(j)) {
          label[j] = next;
          stack.push(j);
        }
      }
    }
    if (touchesEdge || members.length > n * ENCLOSED_MIN_AREA) for (const i of members) remove[i] = 1;
  }

  // Apply, then soften the fringe: kept pixels beside removed ones fade out by
  // how background-coloured they are, which gets rid of the pale halo.
  for (let i = 0; i < n; i++) if (remove[i]) data[i * 4 + 3] = 0;
  for (let i = 0; i < n; i++) {
    if (remove[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const beside = (x > 0 && remove[i - 1]) || (x < w - 1 && remove[i + 1]) || (y > 0 && remove[i - w]) || (y < h - 1 && remove[i + w]);
    if (beside && sat(i) <= MAX_SATURATION * 3 && min(i) > 110) {
      data[i * 4 + 3] = Math.round(255 * (1 - Math.min(1, (min(i) - 110) / Math.max(floor - 110, 1))));
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim().png({ compressionLevel: 9 }).toFile(OUT + name);
}

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
  const base = file.replace(/\.[^.]+$/, "");
  const target = `${base}.png`;
  if (KEEP_BACKGROUND.includes(base)) {
    await sharp(SRC + file).png().toFile(OUT + target);
    console.log(`${file} -> public/assets/${target} (copied)`);
    continue;
  }
  if (file !== target) throw new Error(`${file}: save cut-out artwork as PNG`);
  await cutOut(file);
  console.log(`${file} -> public/assets/${target} (background removed)`);
}
