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

});

describe('what is ignored, and only that', () => {
  /**
   * A patch inside the current SDK line is the update this group exists to
   * deliver. Ignoring one would leave the group opening empty PRs.
   */
  it('never ignores a patch', () => {
    for (const rule of ignoreRules) {
      expect([rule.name, rule.types.includes('semver-patch')]).toEqual([rule.name, false]);
    }
  });

  it('always ignores the major, whatever else a rule holds', () => {
    for (const rule of ignoreRules) {
      expect([rule.name, rule.types.includes('semver-major')]).toEqual([rule.name, true]);
    }
  });

  it('covers the packages an SDK bump actually moves', () => {
    // The names from the 23 October PR that made this necessary: the SDK
    // itself, the React Native surface it pins, and the test runner whose
    // major `jest-expo` pins. Checked by coverage rather than by literal
    // pattern, because which wildcard reaches a package is this file's
    // business and not something to restate here.
    for (const name of ['expo', 'expo-print', 'react-native', 'react', 'jest', 'jest-expo']) {
      const covered = ignoreRules.some((rule) => covers(rule.name, name));

      expect([name, covered]).toEqual([name, true]);
    }
  });

  /**
   * One rule per package, so no dependency is matched by two.
   *
   * The `react-native*` wildcard used to cover `react-native` and
   * `react-native-screens` with one rule, and those two need different
   * answers now - the first is pre-1.0 and the second is not. Splitting it
   * into names is only safe if nothing else overlaps.
   */
  it('matches each managed package with exactly one rule', () => {
    const managed = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }).filter((name) => patterns.some((pattern) => covers(pattern, name)));

    expect(managed.length).toBeGreaterThan(10);

    for (const name of managed) {
      const matching = ignoreRules.filter((rule) => covers(rule.name, name));

      expect([name, matching.length]).toEqual([name, 1]);
    }
  });
});

/**
 * Pre-1.0 packages, where a minor is the breaking lane.
 *
 * ## The gap this closes, and how it was found
 *
 * The rule above holds majors back, and the first version of it was presented
 * as closing the hole that Expo SDK 58 came through. It did not. Dependabot
 * rebuilt the group the same afternoon and the new PR was "10 updates" instead
 * of "31" - the change worked - and it was still red, with the same twenty-odd
 * `tsc` errors, because it still carried:
 *
 *     - "react-native": "0.86.3"
 *     + "react-native": "0.88.0"
 *
 * Semver treats `0.x.y` as a line where `x` is the minor, so React Native's
 * breaking releases arrive as `version-update:semver-minor` and
 * `version-update:semver-major` never fires for them. The same is true of
 * every other dependency still below 1.0.
 *
 * ## Why this is computed rather than listed
 *
 * Three packages are below 1.0 in the managed set today. Writing those three
 * names into the config and stopping there would hold until one of them
 * reaches 1.0 - at which point its minors become ordinary minors and the extra
 * rule is harmless - or until a new pre-1.0 dependency is added, at which point
 * it quietly arrives on the breaking lane with nothing watching. So this reads
 * `package.json`, finds what is actually below 1.0, and checks the config
 * covers it.
 */

type PackageJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8')
) as PackageJson;

/**
 * Does a `dependency-name` pattern cover this package?
 *
 * Dependabot matches these as globs where a star stands for any run of
 * characters, and the patterns in use are plain: a bare name, a prefix, a
 * scope, or a scope and a prefix together. Walked rather than turned into a
 * regular expression, because a package name is full of characters a regular
 * expression cares about and this comparison is not the place to get escaping
 * wrong.
 */
function covers(pattern: string, name: string): boolean {
  const parts = pattern.split('*');

  if (parts.length === 1) {
    return pattern === name;
  }

  const [first, ...rest] = parts;
  const last = rest[rest.length - 1];

  if (!name.startsWith(first) || !name.endsWith(last)) {
    return false;
  }

  let at = first.length;

  for (const part of rest.slice(0, -1)) {
    const found = name.indexOf(part, at);

    if (found === -1) {
      return false;
    }

    at = found + part.length;
  }

  return name.length >= first.length + last.length;
}

/** Every dependency pinned below 1.0, from both dependency maps. */
const belowOne = Object.entries({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
})
  .filter(([, range]) => /^[~^]?0\./.test(range))
  .map(([name]) => name);

/** Those of them the managed group collects, which is where the rule applies. */
const managedBelowOne = belowOne.filter((name) =>
  patterns.some((pattern) => covers(pattern, name))
);

describe('the pre-1.0 packages are known', () => {
  it('finds some below 1.0 at all', () => {
    // If this ever reaches zero the assertions below stop asserting anything,
    // and the ignore rules should be revisited rather than left as decoration.
    expect(belowOne.length).toBeGreaterThan(0);
  });

  it('finds the React Native line among the managed ones', () => {
    // The package that made this necessary. `react-native` is 0.x and will be
    // for the foreseeable future.
    expect(managedBelowOne).toContain('react-native');
  });
});

describe('a minor is held wherever a minor is the breaking lane', () => {
  it.each(managedBelowOne)('holds the minor of %s', (name) => {
    const rule = ignoreRules.find((candidate) => covers(candidate.name, name));

    expect([name, rule?.types]).toEqual([
      name,
      "'version-update:semver-major', 'version-update:semver-minor'",
    ]);
  });

  /**
   * And nowhere else. A package at or above 1.0 has ordinary minors - a bug fix
   * and a new option - and holding those back would silence the group for the
   * sake of a rule that does not apply to it.
   */
  it('holds only the major of everything at or above 1.0', () => {
    const atLeastOne = Object.entries({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })
      .filter(([, range]) => !/^[~^]?0\./.test(range))
      .map(([name]) => name)
      .filter((name) => patterns.some((pattern) => covers(pattern, name)));

    expect(atLeastOne.length).toBeGreaterThan(3);

    for (const name of atLeastOne) {
      const rule = ignoreRules.find((candidate) => covers(candidate.name, name));

      expect([name, rule?.types]).toEqual([name, "'version-update:semver-major'"]);
    }
  });
});
