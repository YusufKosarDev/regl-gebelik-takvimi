import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * No colour that might be `undefined` is spread into a style object.
 *
 * ## The defect this is the inventory for
 *
 * `StyleSheet.flatten` keeps a key whose value is `undefined`. Measured
 * directly: `flatten([{ color: 'red' }, { color: undefined }])` returns an
 * object where `'color' in result` is true and the red is gone. So a component
 * that lists a themed colour first and the caller's `style` last - which is
 * how `ThemedText` and `ThemedView` both let a caller override - does not fall
 * back to the theme when the caller's value is `undefined`. It is overwritten
 * with nothing, and React Native draws the platform default: black for text
 * and for `borderColor`, transparent for `backgroundColor`.
 *
 * That drew the calendar legend's predicted-period mark black on a dark page,
 * where it was invisible. Nothing saw it. The element was present, the
 * accessibility label was right, and the colour was a real value by the time
 * it reached the renderer - the wrong one. It took a dark-mode screenshot
 * measured pixel by pixel.
 *
 * ## Why a scan and not a behavioural test
 *
 * Both components now refuse an undefined colour, so an occurrence of this
 * shape is no longer a bug on its own - `themed-text.tsx` and
 * `themed-view.tsx` have the fallbacks and their own tests. This exists to
 * keep the claim "the class has no instances" true on every run rather than on
 * the day somebody last looked, and to catch the shape reaching a plain
 * `View`, `Pressable` or `TextInput`, which have no such fallback and never
 * will.
 *
 * It reads the source because there is nothing to call: the shape is a fact
 * about how a value was computed, not about what any screen does.
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

    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) found.push(path);
  }

  return found;
}

const COLOUR_KEY =
  /(backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|color|tintColor|shadowColor|textDecorationColor|placeholderTextColor)\s*:\s*([^,}\n]+)/g;

/** Every function anywhere whose declared return type admits `undefined`. */
function functionsThatMayReturnUndefined(sources: readonly string[]): ReadonlySet<string> {
  const names = new Set<string>();

  for (const source of sources) {
    const declarations = /function\s+(\w+)\s*\([\s\S]{0,400}?\)\s*:\s*([^{\n]+)\{/g;
    let match: RegExpExecArray | null;

    while ((match = declarations.exec(source)) !== null) {
      if (/undefined/.test(match[2])) names.add(match[1]);
    }
  }

  return names;
}

/**
 * Locals and optional props in one file that may hold `undefined`.
 *
 * The third rule is the one that was missing. Assigning a risky call to a
 * local with no type annotation hid it from this scan entirely:
 *
 *     const markColour = swatchMarkerColour(item.style, phases);
 *     <ThemedText style={[styles.marker, { color: markColour }]} />
 *
 * which is the legend's own shape, one refactor away from the version that
 * shipped. Found by reintroducing the defect and watching this test stay
 * green - which is the whole reason a scanner gets its own mutation.
 */
function valuesThatMayBeUndefined(
  source: string,
  risky: ReadonlySet<string>
): ReadonlySet<string> {
  const names = new Set<string>();
  let match: RegExpExecArray | null;

  const annotated = /(?:const|let)\s+(\w+)\s*:\s*([^=\n]*)=/g;
  while ((match = annotated.exec(source)) !== null) {
    if (/undefined/.test(match[2])) names.add(match[1]);
  }

  const optionalProps = /readonly\s+(\w+)\?\s*:/g;
  while ((match = optionalProps.exec(source)) !== null) names.add(match[1]);

  const inferred = /(?:const|let)\s+(\w+)\s*=\s*(\w+)\s*\(/g;
  while ((match = inferred.exec(source)) !== null) {
    if (risky.has(match[2])) names.add(match[1]);
  }

  return names;
}

type Occurrence = { readonly where: string; readonly key: string; readonly why: string };

function scan(files: readonly string[]): readonly Occurrence[] {
  const sources = files.map((file) => readFileSync(file, 'utf8'));
  const risky = functionsThatMayReturnUndefined(sources);
  const found: Occurrence[] = [];

  files.forEach((file, index) => {
    const source = sources[index];
    const locals = valuesThatMayBeUndefined(source, risky);
    let match: RegExpExecArray | null;

    COLOUR_KEY.lastIndex = 0;

    while ((match = COLOUR_KEY.exec(source)) !== null) {
      const [, key, raw] = match;
      const value = raw.trim();

      // `??` is the fallback this whole class is about having.
      if (/\?\?/.test(value)) continue;
      if (/^['"`]/.test(value)) continue;

      // A value narrowed before it is used is not the defect. The calendar
      // cell draws its band inside `band !== undefined && (...)`, so the
      // undefined never reaches a style - TypeScript narrows it to `string`
      // there, and the shape is a correct one rather than a tolerated one.
      //
      // The guard has to be next to the use, not anywhere in the file. Looked
      // for file-wide first, and the legend defeated it immediately: one
      // guarded use of `markColour` excused an unguarded one ten lines away.
      // Three lines is enough for `{x !== undefined && (` wrapping a JSX line.
      const guarded = /^(\w+)$/.exec(value);

      if (guarded !== null) {
        const upTo = source.slice(0, match.index).split('\n');
        const window = upTo.slice(Math.max(0, upTo.length - 3)).join('\n');
        const narrowing = new RegExp(
          `${guarded[1]}\\s*(!==\\s*undefined|!=\\s*null|!==\\s*null|===\\s*null\\s*\\?)`
        );

        if (narrowing.test(window)) continue;
      }

      const call = /^(\w+)\s*\(/.exec(value);
      const identifier = /^(\w+)$/.exec(value);

      const why =
        call !== null && risky.has(call[1])
          ? `${call[1]}() may return undefined`
          : identifier !== null && locals.has(identifier[1])
            ? `${identifier[1]} is declared possibly undefined`
            : /\?\./.test(value)
              ? 'optional chaining with no fallback'
              : null;

      if (why === null) continue;

      const line = source.slice(0, match.index).split('\n').length;

      found.push({ where: `${file.slice(ROOT.length + 1)}:${line}`, key, why });
    }
  });

  return found;
}

describe('colours that might be nothing', () => {
  it('finds the shape when it is there, or it is not an inventory', () => {
    // The pre-fix legend, as it shipped. Without this the suite below could
    // pass by reading nothing and nobody would know.
    const asItShipped = `
      function swatchMarkerColour(style: string, phases: Phases): string | undefined {
        if (style === 'filled') return phases.menstrualAccent;
        return undefined;
      }
      const row = <ThemedText style={[styles.marker, { color: swatchMarkerColour(item.style, phases) }]} />;
    `;

    const sources = [asItShipped];
    const risky = functionsThatMayReturnUndefined(sources);

    expect(risky.has('swatchMarkerColour')).toBe(true);
  });

  it('has none anywhere in the app', () => {
    const occurrences = scan(filesUnder(join(ROOT, 'src')));

    expect(occurrences.map((one) => `${one.where} ${one.key}: ${one.why}`)).toEqual([]);
  });

  it('is reading a real part of the app rather than an empty list', () => {
    // A scan that quietly stops finding files passes forever.
    expect(filesUnder(join(ROOT, 'src')).length).toBeGreaterThan(200);
  });
});
