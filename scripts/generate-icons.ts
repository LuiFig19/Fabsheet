/**
 * Render /public/icon-source.svg into the PNG fleet browsers and OSes expect:
 *
 *  - apple-touch-icon.png (180x180): iOS / iPadOS home-screen icon. iOS does
 *    NOT accept SVG here, which is why the standalone-PWA icon used to be the
 *    bare "FS" tile.
 *  - icon-32.png / icon-192.png / icon-512.png: favicon + PWA manifest icons.
 *  - icon-maskable-512.png: Android adaptive icon; the SVG is scaled to 80%
 *    of the canvas and centered so the system can crop into a circle / squircle
 *    without clipping the monogram.
 *  - favicon.ico is left to the static favicon route in Next; browsers use the
 *    PNGs declared in <link rel="icon"> in layout.tsx.
 *
 * Run with: pnpm gen:icons (or `tsx scripts/generate-icons.ts`). Commit the
 * resulting PNGs so Vercel serves them as static files — no build-time work.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC = path.join(process.cwd(), "public");
const SRC = path.join(PUBLIC, "icon-source.svg");
const BG = "#0A1929"; // matches manifest theme_color; safe behind any letterboxing

type Target = {
  name: string;
  size: number;
  /** When set (0..1), shrink the SVG to this fraction of the canvas and center
   *  it on the BG. Used for the Android maskable variant. */
  safeFraction?: number;
};

const targets: Target[] = [
  { name: "icon-32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, safeFraction: 0.8 },
];

async function main() {
  const svg = await fs.readFile(SRC);

  for (const t of targets) {
    const out = path.join(PUBLIC, t.name);

    if (t.safeFraction) {
      const inner = Math.round(t.size * t.safeFraction);
      const innerPng = await sharp(svg).resize(inner, inner).png().toBuffer();
      const offset = Math.round((t.size - inner) / 2);
      await sharp({
        create: {
          width: t.size,
          height: t.size,
          channels: 4,
          background: BG,
        },
      })
        .composite([{ input: innerPng, top: offset, left: offset }])
        .png({ compressionLevel: 9 })
        .toFile(out);
    } else {
      await sharp(svg).resize(t.size, t.size).png({ compressionLevel: 9 }).toFile(out);
    }

    const stat = await fs.stat(out);
    console.log(`${t.name.padEnd(28)} ${String(t.size).padStart(4)}px  ${Math.round(stat.size / 1024)}KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
