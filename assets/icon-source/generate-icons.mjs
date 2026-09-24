/**
 * Regenerates every app icon from one piece of geometry.
 *
 *   npm install --no-save sharp
 *   node assets/icon-source/generate-icons.mjs
 *
 * `--no-save` keeps sharp out of package.json and the lockfile: it is a build
 * tool for this one script, not something the app or CI needs.
 *
 * The mark is a crescent - one circle cut by another - with a small disc
 * resting between its horns. Everything below is derived from that: the
 * launcher icon, the three adaptive layers, the notification silhouette, both
 * splash images and the favicon. Editing the numbers here and re-running is
 * the only supported way to change them, so the shapes cannot drift apart.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const IMAGES = join(ROOT, 'assets', 'images');

/** The brand palette. Also written out in the README and in src/constants/theme.ts. */
const PALETTE = {
  light: '#EDE8FA', // lavender mist - the mark itself
  mid: '#C3B6E4', // supporting lavender - the disc
  main: '#8B7AC0', // muted lavender - the light end of the background
  deep: '#4A3D78', // deep plum-indigo - the dark end of the background
  splashDark: '#241C3D', // the dark-mode splash background
};

/** The design space every shape below is expressed in. */
const DESIGN = 1024;

/**
 * The mark's bounding box inside the design space.
 *
 * Measured from the geometry, not eyeballed: x1 is the lower horn, where the
 * two circles meet, and the crescent reaches further down than it does right.
 * Used to scale the mark up for the notification icon, which has to fill its
 * frame rather than sit in the middle of it.
 */
const MARK_BOX = { x0: 262, y0: 262, x1: 708.1, y1: 762 };

/** The crescent and its disc, in the design space, in whatever two colours. */
const mark = (shape, disc) => `
  <defs>
    <mask id="crescent">
      <rect width="${DESIGN}" height="${DESIGN}" fill="black"/>
      <circle cx="512" cy="512" r="250" fill="white"/>
      <circle cx="620" cy="460" r="225" fill="black"/>
    </mask>
  </defs>
  <circle cx="512" cy="512" r="250" fill="${shape}" mask="url(#crescent)"/>
  <circle cx="640" cy="430" r="60" fill="${disc}"/>`;

/** The soft two-stop diagonal the mark sits on. */
const backdrop = () => `
  <defs>
    <linearGradient id="backdrop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PALETTE.main}"/>
      <stop offset="1" stop-color="${PALETTE.deep}"/>
    </linearGradient>
  </defs>
  <rect width="${DESIGN}" height="${DESIGN}" fill="url(#backdrop)"/>`;

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}\n</svg>\n`;

/**
 * Places the design space inside a frame, scaled down by `inset`.
 *
 * Android's adaptive icon is a 108dp canvas of which only the middle 72dp is
 * ever shown, so the artwork goes in at 72/108 and the outer ring stays empty.
 * That is the padding, and it is why the foreground must not fill its square.
 */
const inset = (frame, fraction, body) => {
  const scale = (frame * fraction) / DESIGN;
  const offset = (frame - frame * fraction) / 2;
  return `\n  <g transform="translate(${offset} ${offset}) scale(${scale})">${body}\n  </g>`;
};

/**
 * Places the mark inside a frame scaled to fill `fraction` of it.
 *
 * Unlike `inset`, this works from the mark's own bounding box, so the shape
 * itself fills the frame instead of the empty design space around it. A
 * notification icon is 24dp of mostly-icon; the launcher icon is not.
 */
const fill = (frame, fraction, body) => {
  const w = MARK_BOX.x1 - MARK_BOX.x0;
  const h = MARK_BOX.y1 - MARK_BOX.y0;
  const scale = (frame * fraction) / Math.max(w, h);
  const tx = (frame - w * scale) / 2 - MARK_BOX.x0 * scale;
  const ty = (frame - h * scale) / 2 - MARK_BOX.y0 * scale;
  return `\n  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)})">${body}\n  </g>`;
};

/**
 * Android's adaptive icon: 108dp canvas, 72dp of it visible.
 * 432 is that canvas at xxxhdpi, which is the largest size prebuild asks for.
 */
const ADAPTIVE = 432;
const ADAPTIVE_WINDOW = 72 / 108;

/** The notification icon expo-notifications documents: 96x96, all white, transparent. */
const NOTIFICATION = 96;

const sources = {
  'icon.svg': svg(DESIGN, backdrop() + mark(PALETTE.light, PALETTE.mid)),
  'icon-mono.svg': svg(DESIGN, mark('#FFFFFF', '#FFFFFF')),
  'adaptive-background.svg': svg(ADAPTIVE, inset(ADAPTIVE, 1, backdrop())),
  'adaptive-foreground.svg': svg(
    ADAPTIVE,
    inset(ADAPTIVE, ADAPTIVE_WINDOW, mark(PALETTE.light, PALETTE.mid))
  ),
  'adaptive-monochrome.svg': svg(
    ADAPTIVE,
    inset(ADAPTIVE, ADAPTIVE_WINDOW, mark('#FFFFFF', '#FFFFFF'))
  ),
  'notification-icon.svg': svg(NOTIFICATION, fill(NOTIFICATION, 0.84, mark('#FFFFFF', '#FFFFFF'))),
  'splash-icon.svg': svg(DESIGN, mark(PALETTE.deep, PALETTE.main)),
  'splash-icon-dark.svg': svg(DESIGN, mark(PALETTE.light, PALETTE.mid)),
};

/** density 288 renders the SVG at 4x and sharp resizes down, which keeps the curves clean. */
const png = (source, size) =>
  sharp(Buffer.from(source), { density: 288 }).resize(size, size).png({ compressionLevel: 9 });

/**
 * The launcher icon and the favicon are full-bleed and opaque. iOS rejects an
 * app icon with an alpha channel, so those two are flattened rather than left
 * with a transparent-but-unused channel.
 */
const opaque = (pipeline) => pipeline.flatten({ background: PALETTE.deep });

const outputs = [
  ['icon.png', opaque(png(sources['icon.svg'], DESIGN))],
  ['favicon.png', opaque(png(sources['icon.svg'], 48))],
  ['android-icon-background.png', opaque(png(sources['adaptive-background.svg'], ADAPTIVE))],
  ['android-icon-foreground.png', png(sources['adaptive-foreground.svg'], ADAPTIVE)],
  ['android-icon-monochrome.png', png(sources['adaptive-monochrome.svg'], ADAPTIVE)],
  ['notification-icon.png', png(sources['notification-icon.svg'], NOTIFICATION)],
  ['splash-icon.png', png(sources['splash-icon.svg'], DESIGN)],
  ['splash-icon-dark.png', png(sources['splash-icon-dark.svg'], DESIGN)],
];

await mkdir(IMAGES, { recursive: true });

for (const [name, body] of Object.entries(sources)) {
  await writeFile(join(HERE, name), body, 'utf8');
  console.log('source  assets/icon-source/' + name);
}

for (const [name, pipeline] of outputs) {
  await pipeline.toFile(join(IMAGES, name));
  console.log('image   assets/images/' + name);
}
