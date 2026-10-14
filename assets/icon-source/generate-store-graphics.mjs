/**
 * Regenerates the Play store graphics from the same geometry as the icons.
 *
 *   node assets/icon-source/generate-store-graphics.mjs
 *
 * The feature graphic is not a separate piece of design. It borrows the
 * crescent's ratios and the gradient from `generate-icons.mjs`, so a change to
 * the brand that misses the banner is exactly the drift that script's own
 * comment exists to prevent — "the shapes cannot drift apart" has to cover the
 * store page too, or the first thing somebody sees stops matching the icon they
 * end up with.
 *
 * ## What it writes
 *
 * - `feature-tr.png` and `feature-en.png` — 1024x500, 24-bit, no alpha, which
 *   is what Play's feature graphic field takes.
 * - `play-icon-512.png` — 512x512 **with** an alpha channel, which is what the
 *   app icon field takes. The shipped `icon.png` is 1024x1024 and 24-bit
 *   without one, so this is a re-render at the field's size and depth rather
 *   than a second drawing.
 *
 * Output goes to `assets/store/`, which is not bundled into the app.
 *
 * ## Why the text is drawn with ffmpeg rather than in the SVG
 *
 * Fraunces is a bundled font rather than a system one, and librsvg resolves
 * font families by name — the SVG would silently fall back to whatever serif
 * the machine has, which is the kind of difference nobody notices until the
 * banner is live. ffmpeg's `drawtext` takes a font file by path, so the words
 * come from `node_modules/@expo-google-fonts/fraunces` or they do not render at
 * all.
 */

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const IMAGES = join(ROOT, 'assets', 'images');
const OUT = join(ROOT, 'assets', 'store');

/**
 * The brand palette, copied from `generate-icons.mjs` rather than re-chosen.
 *
 * If these ever disagree, the icon and the banner disagree, which is the whole
 * thing this file exists to avoid. Change them there and here together.
 */
const PALETTE = {
  light: '#EDE8FA', // lavender mist — the mark, and the type
  mid: '#C3B6E4', // supporting lavender — the disc
  main: '#8B7AC0', // muted lavender — the light end of the background
  deep: '#4A3D78', // deep plum-indigo — the dark end
};

const W = 1024;
const H = 500;

/** Play's own geometry for the two fields. */
const FEATURE = { width: 1024, height: 500 };
const STORE_ICON = 512;

/**
 * The crescent, at a centre and radius, in the icon's own proportions.
 *
 * `generate-icons.mjs` draws it in a 1024 design space: a circle of r=250 at
 * (512,512), cut by one of r=225 at (620,460), with a disc of r=60 at
 * (660,440). Everything here is those numbers scaled by `r / 250`, so the mark
 * on the banner is the mark on the launcher rather than a lookalike.
 */
function crescent(cx, cy, r, id) {
  const k = r / 250;

  return `
    <mask id="${id}">
      <rect width="${W}" height="${H}" fill="black"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
      <circle cx="${cx + 108 * k}" cy="${cy - 52 * k}" r="${225 * k}" fill="black"/>
    </mask>
    <rect width="${W}" height="${H}" fill="${PALETTE.light}" mask="url(#${id})"/>
    <circle cx="${cx + 148 * k}" cy="${cy - 72 * k}" r="${60 * k}" fill="${PALETTE.mid}"/>
  `;
}

/**
 * The dotted arc the cycle screen draws beneath the day count.
 *
 * Flattened for the banner's proportions and faded at both ends, the way the
 * ring's unlit dots are. It is the app's most recognisable shape after the
 * mark, and it is the reason the banner reads as this app rather than as a
 * gradient with a moon on it.
 */
function arc() {
  const dots = [];
  const count = 46;
  const left = 70;
  const right = W - 70;
  const baseline = H - 74;
  const rise = 54;

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = left + (right - left) * t;
    const y = baseline - rise * Math.sin(Math.PI * t);
    const fade = 0.18 + 0.34 * Math.sin(Math.PI * t);

    dots.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" ` +
        `fill="${PALETTE.light}" opacity="${fade.toFixed(3)}"/>`
    );
  }

  return dots.join('\n    ');
}

/** The banner without words, which both languages share. */
const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PALETTE.main}"/>
      <stop offset="1" stop-color="${PALETTE.deep}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  ${arc()}

  ${crescent(812, 236, 128, 'mark')}
</svg>`;

/**
 * The claim each banner makes, as lines.
 *
 * One claim, in both languages: records stay on the phone. It is the short
 * description's claim and the thing that distinguishes this from the rest of
 * the category, and the feature graphic is the only slot above the fold — a
 * banner that says nothing wastes it.
 *
 * Broken into lines here rather than wrapped, because the break has to clear
 * the crescent and the two languages are different lengths. Three short lines
 * at 66px leave 189px of air in Turkish and 165px in English; the first attempt
 * at 78px on two lines ran the second line into the mark.
 */
const CLAIM = {
  tr: ['Kayıtların', 'telefonunda', 'kalır.'],
  en: ['Your records', 'stay on your', 'phone.'],
};

const TYPE = {
  size: 66,
  x: 96,
  firstY: 116,
  lineHeight: 84,
  file: join(ROOT, 'node_modules', '@expo-google-fonts', 'fraunces', '700Bold', 'Fraunces_700Bold.ttf'),
};

/** ffmpeg's filter syntax needs the drive colon escaped inside a quoted value. */
function fontPathForFilter(path) {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:');
}

async function main() {
  await mkdir(OUT, { recursive: true });

  await writeFile(join(OUT, 'feature-base.svg'), base, 'utf8');

  const basePng = join(OUT, 'feature-base.png');

  await sharp(Buffer.from(base)).png().toFile(basePng);

  const font = fontPathForFilter(TYPE.file);

  for (const [language, lines] of Object.entries(CLAIM)) {
    const filters = lines
      .map((line, index) =>
        [
          `drawtext=fontfile='${font}'`,
          `text='${line}'`,
          `fontcolor=0x${PALETTE.light.slice(1)}`,
          `fontsize=${TYPE.size}`,
          `x=${TYPE.x}`,
          `y=${TYPE.firstY + index * TYPE.lineHeight}`,
        ].join(':')
      )
      .join(',');

    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      basePng,
      '-vf',
      filters,
      // Play takes "JPEG, or 24-bit PNG with no alpha channel" here.
      '-pix_fmt',
      'rgb24',
      join(OUT, `feature-${language}.png`),
    ]);
  }

  // And the store icon: Play's field wants 512 with an alpha channel.
  await sharp(join(IMAGES, 'icon.png'))
    .resize(STORE_ICON, STORE_ICON, { kernel: 'lanczos3' })
    .ensureAlpha()
    .png()
    .toFile(join(OUT, 'play-icon-512.png'));

  console.log(`feature graphics ${FEATURE.width}x${FEATURE.height} and the ${STORE_ICON} icon written to assets/store/`);
}

await main();
