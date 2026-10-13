import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';

/**
 * The sentence this guards: "Uygulama kapalıyken hiçbir şey gönderilmez."
 *
 * ## Why a scan and not an assertion about behaviour
 *
 * The claim is about what the app does *not* do, and nothing can be called to
 * prove an absence. Four tests pin the sentence word for word in two
 * languages, and every one of them would stay green on the day somebody adds a
 * background task - the copy would still say it, and it would no longer be
 * true.
 *
 * So this reads the source and the manifest of dependencies instead. It fails
 * when a way to run code while the app is closed appears, which is the only
 * thing that can make the sentence false.
 *
 * ## What is allowed, and why it does not count
 *
 * Two things already run with the app closed and neither sends anything:
 *
 *   - Scheduled local notifications. `expo-notifications` hands the operating
 *     system a date and a string; nothing of the app runs when it fires.
 *   - The home screen widget. Android redraws it from a snapshot already
 *     written to disk - `widget-snapshot-bridge` - and it talks to nothing.
 *
 * ## What it does not cover
 *
 * Native code added to `android/`, which is generated and not in the
 * repository. A `Service`, a `WorkManager` job or a push receiver added there
 * would not be seen here. `modules/` is covered, because that is where this
 * app's own native code lives.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');

function filesUnder(directory: string, extensions: readonly string[]): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === 'build' || entry === '.cxx') continue;
      found.push(...filesUnder(path, extensions));
      continue;
    }

    if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(path);
    }
  }

  return found;
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function relative(path: string): string {
  return path.slice(ROOT.length + 1).split(sep).join('/');
}

/**
 * Packages that exist to run code when the app is not in front of somebody.
 *
 * Named rather than pattern-matched: a dependency arrives deliberately, and a
 * list somebody has to edit is a list somebody has to think about. Adding one
 * of these is a decision about the sentence, not a detail of an upgrade.
 */
const BACKGROUND_PACKAGES = [
  'expo-background-fetch',
  'expo-background-task',
  'expo-task-manager',
  'react-native-background-fetch',
  'react-native-background-timer',
  'react-native-background-actions',
  'react-native-background-upload',
  '@react-native-firebase/messaging',
  'react-native-push-notification',
  '@notifee/react-native',
  'react-native-workmanager',
];

/**
 * The APIs those packages are reached through.
 *
 * No timer rule. A first version flagged `setInterval` and caught the lock
 * screen's countdown, which runs while somebody is looking at it and stops with
 * the app - JavaScript timers do not survive the process being backgrounded, so
 * a timer is not a way to run while closed. The rule was wrong rather than the
 * code, and an assertion that flags correct code teaches the next person the
 * wrong rule.
 */
const BACKGROUND_APIS: readonly (readonly [string, RegExp])[] = [
  ['TaskManager.defineTask', /TaskManager\s*\.\s*defineTask/],
  ['BackgroundFetch.registerTaskAsync', /BackgroundFetch\s*\.\s*registerTaskAsync/],
  ['BackgroundTask.registerTaskAsync', /BackgroundTask\s*\.\s*registerTaskAsync/],
  ['registerHeadlessTask', /registerHeadlessTask/],
  ['setBackgroundMessageHandler', /setBackgroundMessageHandler/],
];

/** Android ways of running without a screen, in this app's own native code. */
const NATIVE_BACKGROUND: readonly (readonly [string, RegExp])[] = [
  ['WorkManager', /\bWorkManager\b/],
  ['JobScheduler', /\bJobScheduler\b/],
  ['JobIntentService', /\bJobIntentService\b/],
  ['a started Service', /class\s+\w+\s*:\s*\w*Service\b/],
  ['AlarmManager', /\bAlarmManager\b/],
];

function appSources(): string[] {
  return filesUnder(join(ROOT, 'src'), ['.ts', '.tsx']).filter(
    (path) => !path.includes('__tests__')
  );
}

function nativeSources(): string[] {
  return filesUnder(join(ROOT, 'modules'), ['.kt', '.java']).filter(
    (path) => !path.includes(join('src', 'test'))
  );
}

describe('nothing in this app can run while it is closed', () => {
  it('finds sources to check, so a broken scan cannot pass quietly', () => {
    expect(appSources().length).toBeGreaterThan(50);
    expect(nativeSources().length).toBeGreaterThan(3);
  });

  it('depends on no package whose purpose is background execution', () => {
    const manifest = JSON.parse(read(join(ROOT, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const installed = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];

    expect(installed.filter((name) => BACKGROUND_PACKAGES.includes(name))).toEqual([]);
  });

  it('registers no background task', () => {
    const offenders: string[] = [];

    for (const path of appSources()) {
      const contents = read(path);

      for (const [described, pattern] of BACKGROUND_APIS) {
        if (pattern.test(contents)) offenders.push(`${relative(path)}: ${described}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('runs nothing from its own native code without a screen', () => {
    const offenders: string[] = [];

    for (const path of nativeSources()) {
      const contents = read(path);

      for (const [described, pattern] of NATIVE_BACKGROUND) {
        if (pattern.test(contents)) offenders.push(`${relative(path)}: ${described}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
