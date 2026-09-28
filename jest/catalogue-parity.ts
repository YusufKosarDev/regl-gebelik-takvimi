import type { Messages } from '@/i18n';

/**
 * The checks every catalogue pair gets, written once.
 *
 * Seventeen features are converting to `Messages<T>` pairs, and each of them
 * needs the same four questions asked. Seventeen copies would be seventeen
 * chances for one to be written slightly weaker than the others - and the
 * weakest one is the one that lets a Turkish string reach an English reader.
 *
 * ## What the compiler already does, and why these run anyway
 *
 * The English half is annotated with the Turkish half's inferred type, so a
 * missing, extra or misspelled key is a compile error where the pair is
 * declared. The key-parity assertion below states that as intent rather than
 * leaving it to the type: if somebody later loosens the English side to a
 * `Record<string, string>`, the compiler stops caring and this does not.
 *
 * The rest are things types cannot see:
 *
 *   - a value copied from the other language and never translated;
 *   - a Turkish word left inside an English string;
 *   - a Turkish word inside a *function body*, which no signature mentions.
 *
 * ## Functions are checked by calling them
 *
 * A caller passes the arguments, because only the caller knows what they mean.
 * `plural`-style messages want 0, 1 and 2 at least; a message that interpolates
 * a name wants a name with no Turkish in it, or the check would report the
 * argument rather than the catalogue.
 */

/** A message that takes arguments, and argument sets to call it with. */
export type FunctionCase = readonly [name: string, ...argumentSets: readonly unknown[][]];

const TURKISH_LETTERS = /[ğüşıöçĞÜŞİÖÇ]/;

type AnyCatalogue = Record<string, unknown>;

/** Every string a value holds, whether it is one string or a list of them. */
function stringsIn(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');

  return [];
}

/**
 * Runs the whole set against one pair.
 *
 * Called from inside a `describe` in the feature's own test file, so a failure
 * names the feature rather than a shared helper.
 */
export function describeCatalogueParity<T>(
  catalogue: Messages<T>,
  options: {
    readonly functions?: readonly FunctionCase[];
    /**
     * Keys whose two languages are meant to be identical.
     *
     * A product name, a number, an acronym that is a proper noun in both. Each
     * one is listed rather than the check being weakened, so that the reason a
     * value was not translated is written down next to it.
     */
    readonly identical?: readonly string[];
  } = {}
): void {
  const tr = catalogue.tr as AnyCatalogue;
  const en = catalogue.en as AnyCatalogue;
  const functions = options.functions ?? [];
  const identical = new Set(options.identical ?? []);

  it('has the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('has each key as the same kind of thing in both languages', () => {
    for (const key of Object.keys(tr)) {
      expect([key, typeof en[key]]).toEqual([key, typeof tr[key]]);
      expect([key, Array.isArray(en[key])]).toEqual([key, Array.isArray(tr[key])]);
    }
  });

  it('has no list that changed length between the languages', () => {
    // A dropped bullet is a claim that stopped being made. The disclaimer's
    // three points are the reason this is checked at all.
    for (const key of Object.keys(tr)) {
      if (!Array.isArray(tr[key])) continue;

      expect([key, (en[key] as unknown[]).length]).toEqual([key, (tr[key] as unknown[]).length]);
    }
  });

  it('has no Turkish letter in any English value', () => {
    for (const [key, value] of Object.entries(en)) {
      for (const text of stringsIn(value)) {
        expect([key, text]).toEqual([key, expect.not.stringMatching(TURKISH_LETTERS)]);
      }
    }
  });

  it('has every listed identical key actually identical', () => {
    // The exceptions are a claim too. One that stops being true - because the
    // English was translated after all - should be removed rather than left
    // sitting there excusing a check that no longer needs excusing.
    for (const key of identical) {
      expect([key, stringsIn(en[key])]).toEqual([key, stringsIn(tr[key])]);
    }
  });

  it('has no English value identical to its Turkish counterpart', () => {
    // The copy-paste detector. A value that is genuinely the same in both - a
    // product name, a number - belongs in the exceptions a feature passes, not
    // in a weaker version of this check.
    for (const key of Object.keys(tr)) {
      if (identical.has(key)) continue;

      const turkish = stringsIn(tr[key]);
      const english = stringsIn(en[key]);

      if (turkish.length === 0) continue;

      expect([key, english]).not.toEqual([key, turkish]);
    }
  });

  if (functions.length > 0) {
    it('has no Turkish in anything an English function returns', () => {
      for (const [name, ...argumentSets] of functions) {
        const fn = en[name];

        expect([name, typeof fn]).toEqual([name, 'function']);

        for (const args of argumentSets) {
          const returned = (fn as (...a: unknown[]) => unknown)(...args);

          for (const text of stringsIn(returned)) {
            expect([name, args, text]).toEqual([
              name,
              args,
              expect.not.stringMatching(TURKISH_LETTERS),
            ]);
          }
        }
      }
    });

    it('calls every function the catalogue has', () => {
      // So that adding a message that takes arguments without listing it here
      // fails, rather than quietly going unchecked - which is exactly where
      // Turkish hides from the type system.
      const declared = new Set(functions.map(([name]) => name));
      const actual = Object.keys(tr).filter((key) => typeof tr[key] === 'function');

      expect(actual.sort()).toEqual([...declared].sort());
    });
  }
}
