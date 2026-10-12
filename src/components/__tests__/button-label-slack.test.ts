import { readdirSync, readFileSync, statSync } from 'fs';
import { StyleSheet } from 'react-native';

import { ButtonLabel } from '../themed-text';
import { join } from 'path';

/**
 * Every button label is allowed to be wider than its own text.
 *
 * ## The defect, and why only a scan can hold it
 *
 * A label that is the only child of a `Pressable` with `alignItems: 'center'`
 * is a shrink-to-fit flex child, handed exactly its measured width and no
 * more. Measured on a device: the export button's text node was 324px wide,
 * the same string drawn as a heading was 323px of ink, and what the button
 * drew was 228px - `Verilerini dışa`, with " aktar" missing, broken at the
 * space, in a box one line tall.
 *
 * Both the measurement and the box were right. Only the pixels were wrong, so
 * there is nothing for an ordinary test to assert: the element tree is
 * correct, the accessibility label is the whole string, and `uiautomator`
 * reports the full text. The suite was green while the screen was truncated.
 *
 * It also depends on the system locale rather than the app's language setting
 * - `en-US` truncates, `tr-TR` does not, same build and string - so it is
 * invisible to anyone developing on a Turkish phone, which is where this app's
 * Turkish would be looked at.
 *
 * ## What is asserted
 *
 * Not the one string: the shape. The trigger is a measured width landing on
 * the wrong side of a locale-dependent threshold, so any label can cross it
 * when the copy, the font scale or the device font changes. What stops it is
 * `ButtonLabel`, which takes the label off the content-sized path and lets it
 * fill the button - and a label that is already filling its button has no
 * boundary left to cross.
 *
 * Scoped to the primary and secondary buttons, which are full-width controls
 * where filling the button changes nothing on screen. Chips, keypad keys,
 * calendar day cells and month steppers are deliberately content-sized and
 * are not in scope; stretching those would break the layouts they are in.
 */

const ROOT = join(__dirname, '..', '..', '..');

function filesUnder(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      found.push(...filesUnder(path));
      continue;
    }

    if (entry.endsWith('.tsx')) found.push(path);
  }

  return found;
}

/** The elements that mean a `Pressable` holds more than a single label. */
const OTHER_CHILDREN = /<(View|Icon|Image|Switch|TextInput|PinDots|PinPad|AvatarPreview)\b/;

type Site = { readonly file: string; readonly block: string };

/**
 * Every `Pressable` that draws one label on a primary or secondary button.
 *
 * A regex over the source rather than a parse. It is the same trade
 * `no-raw-logging.test.ts` makes: a crude reader of the whole app beats an
 * exact reader of nothing, and the failure mode is a site this misses rather
 * than one it invents.
 */
function buttonLabelSites(): readonly Site[] {
  const sites: Site[] = [];

  for (const file of filesUnder(join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');

    for (const block of source.match(/<Pressable\b[\s\S]*?<\/Pressable>/g) ?? []) {
      if (!/styles\.(primaryButton|secondaryButton)\b/.test(block)) continue;
      if ((block.match(/<ThemedText\b/g) ?? []).length !== 1) continue;
      if (OTHER_CHILDREN.test(block)) continue;

      sites.push({ file: file.slice(ROOT.length + 1), block });
    }
  }

  return sites;
}

describe('a button label is never sized to its own text', () => {
  it('finds the buttons it is supposed to be guarding', () => {
    // If a refactor renames the button styles this scan goes quiet and passes
    // for the wrong reason. The count is not pinned - only that it is still
    // reading a real part of the app.
    expect(buttonLabelSites().length).toBeGreaterThan(40);
  });

  it('gives every one of them the slack', () => {
    const missing = buttonLabelSites()
      .filter((site) => !/ButtonLabel/.test(site.block))
      .map((site) => site.file);

    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('the slack itself', () => {
  it('fills the button rather than hugging the words', () => {
    const flat = StyleSheet.flatten(ButtonLabel);

    // `stretch` is the half that removes the defect: it takes the label off
    // the content-sized path, so there is no exactly-its-own-width box left
    // for a layout pass to disagree about.
    expect(flat?.alignSelf).toBe('stretch');

    // And this is the half that keeps the screen looking the same, since the
    // Pressable's own `alignItems: 'center'` no longer has a narrow child to
    // centre.
    expect(flat?.textAlign).toBe('center');
  });

  it('does not shrink the words or cut them off to make them fit', () => {
    const flat = StyleSheet.flatten(ButtonLabel) as Record<string, unknown>;

    // The two fixes that were available and rejected. Both trade a rendering
    // fault for a legibility one, on the buttons that export and delete
    // somebody's health records. A label that needs two lines gets two lines.
    expect(flat?.numberOfLines).toBeUndefined();
    expect(flat?.adjustsFontSizeToFit).toBeUndefined();
    expect(flat?.fontSize).toBeUndefined();
  });
});
