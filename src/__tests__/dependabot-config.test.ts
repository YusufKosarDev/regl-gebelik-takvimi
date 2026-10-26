import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What `.github/dependabot.yml` promises, as assertions.
 *
 * ## Why a test for a config file
 *
 * The file says the three lists in it "have to stay the same set: the group
 * collects them, `everything-else` excludes them so they cannot arrive twice,
 * and `ignore` holds their majors". That is a rule about ten strings repeated
 * three times, which is exactly the kind of rule a comment cannot keep. Adding
 * a pattern to one list and not the others puts a package in both weekly PRs,
 * or in neither, and neither failure announces itself - the bot just quietly
 * does the wrong thing once a week.
 *
 * Nothing here checks that Dependabot accepts the file. GitHub is the only
 * thing that can say that, and it reports a bad config on its own page. These
 * hold the decisions the file was written to encode.
 *
 * ## Why it is read rather than parsed
 *
 * `js-yaml` and `yaml` are both in `node_modules`, and both are there because
 * something else pulls them in. Neither ships types, so using one means adding
 * it and its `@types` to `package.json` - two dependencies for the app, to
 * lint one config file, in a repository whose dependency policy is the subject
 * of the very file under test.
 *
 * So the three lists are read out of the text. The cost is that this knows how
 * the file is laid out, and `readPatterns` fails loudly with the key it was
 * looking for rather than returning an empty list that would make every
 * assertion below pass by having nothing in it.
 */

const CONFIG_PATH = join(__dirname, '../../.github/dependabot.yml');
const config = readFileSync(CONFIG_PATH, 'utf8');

/**
 * The quoted entries of one block-style YAML list, by the key above them.
 *
 * Reads from the key to the next line that is not a list item or blank, which
 * is where that list ends. Throws when the key is absent or the list is empty,
 * because both would otherwise look like a passing test.
 */
function readPatterns(key: string): readonly string[] {
  const lines = config.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);

  if (start === -1) {
    throw new Error(
      `dependabot.yml has no \`${key}:\` line. If the file was reformatted, this `
        + 'reader needs updating rather than the assertions below relaxing.'
    );
  }

  const collected: string[] = [];

  for (const line of lines.slice(start + 1)) {
    const match = /^\s*- '([^']+)'\s*$/.exec(line);

    if (match === null) {
      break;
    }

    collected.push(match[1]);
  }

  if (collected.length === 0) {
    throw new Error(`dependabot.yml has \`${key}:\` but no quoted entries under it.`);
  }

  return collected;
}

/** The `dependency-name` of every `ignore` rule, with the types it holds. */
function readIgnoreRules(): readonly { readonly name: string; readonly types: string }[] {
  const rules = [
    ...config.matchAll(
      /- dependency-name: '([^']+)'\s*\r?\n\s*update-types: \[([^\]]*)\]/g
    ),
  ].map((match) => ({ name: match[1], types: match[2].trim() }));

  if (rules.length === 0) {
    throw new Error('dependabot.yml has no `ignore` rules with `update-types`.');
  }

  return rules;
}

/** Sorted, so a list reordered is still the same set. */
const sorted = (values: readonly string[]): readonly string[] => [...values].sort();

const patterns = readPatterns('patterns');
const excluded = readPatterns('exclude-patterns');
const ignoreRules = readIgnoreRules();

describe('the reader found something to check', () => {
  it('read the managed set', () => {
    // Every assertion below loops over these. A loop over nothing passes by
    // having nothing in it.
    expect(patterns.length).toBeGreaterThan(5);
  });

  it('read the exclusions and the ignore rules', () => {
    expect(excluded.length).toBeGreaterThan(5);
    expect(ignoreRules.length).toBeGreaterThan(5);
  });

  it('read the managed set and not the `everything-else` wildcard', () => {
    // `everything-else` is `patterns: ['*']`, which would be a different
    // `patterns:` key. The first one in the file is the managed group's.
    expect(patterns).not.toContain('*');
  });
});

describe('the three lists are the same set', () => {
  /**
   * A package in the group and not in the other group's exclusions arrives in
   * both weekly PRs, which is two branches changing the same lockfile lines.
   */
  it('excludes from `everything-else` exactly what the group collects', () => {
    expect(sorted(excluded)).toEqual(sorted(patterns));
  });

  /**
   * And a package whose major is not ignored can still open an SDK migration
   * as a routine weekly update, which is what happened on 23 October 2026.
   */
  it('holds the major of exactly what the group collects', () => {
    expect(sorted(ignoreRules.map((rule) => rule.name))).toEqual(sorted(patterns));
  });
});

describe('what is ignored, and only that', () => {
  it('ignores majors and nothing else', () => {
    // Minors and patches inside the current SDK line are the updates this
    // group exists to deliver. Ignoring those would silence it entirely.
    for (const rule of ignoreRules) {
      expect([rule.name, rule.types]).toEqual([rule.name, "'version-update:semver-major'"]);
    }
  });

  it('covers the packages an SDK bump actually moves', () => {
    // The names from the 23 October PR that made this necessary: the SDK
    // itself, the React Native surface it pins, and the test runner whose
    // major `jest-expo` pins.
    const names = ignoreRules.map((rule) => rule.name);

    for (const pattern of ['expo*', 'react-native*', 'react', 'jest', 'jest-expo']) {
      expect([pattern, names.includes(pattern)]).toEqual([pattern, true]);
    }
  });
});
