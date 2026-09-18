import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';

/**
 * A scan of the source rather than of behaviour.
 *
 * The rules this file guards cannot be checked by calling anything: a
 * `console.log` added to a screen next year would leak a period record without
 * failing a single test of what that screen does. So the source is read.
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

function appSources(): string[] {
  return filesUnder(join(ROOT, 'src'), ['.ts', '.tsx']).filter(
    (path) => !path.includes('__tests__') && !path.includes(join('shared', 'logging'))
  );
}

function nativeSources(): string[] {
  return filesUnder(join(ROOT, 'modules'), ['.kt', '.java']).filter(
    (path) => !path.includes(join('src', 'test'))
  );
}

/** A call, not the word: the comments in these files talk about the console. */
const CONSOLE_CALL = /\bconsole\s*\.\s*(log|debug|info|warn|error|trace|table|dir)\s*\(/;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function relative(path: string): string {
  return path.slice(ROOT.length + 1).split(sep).join('/');
}

describe('the app writes to the console in one place', () => {
  it('finds sources to check, so a broken scan cannot pass quietly', () => {
    expect(appSources().length).toBeGreaterThan(50);
    expect(nativeSources().length).toBeGreaterThan(3);
  });

  it('calls no console method outside the logger', () => {
    const offenders = appSources().filter((path) => CONSOLE_CALL.test(read(path)));

    expect(offenders.map(relative)).toEqual([]);
  });

  it('leaves the logger as the only caller of console', () => {
    const logger = read(join(ROOT, 'src', 'shared', 'logging', 'logger.ts'));

    expect(logger.match(new RegExp(CONSOLE_CALL, 'g'))).toHaveLength(1);
  });
});

describe('the native side writes nothing to logcat', () => {
  it.each([
    ['android.util.Log', /\bLog\s*\.\s*[dvewi]\b/],
    ['println', /\bprintln\s*\(/],
    ['printStackTrace', /\bprintStackTrace\s*\(/],
    ['a Toast', /\bToast\s*\./],
  ])('uses no %s', (_label, pattern) => {
    const offenders = nativeSources().filter((path) => pattern.test(read(path)));

    expect(offenders.map(relative)).toEqual([]);
  });

  it('keeps the stored snapshot out of its exception messages', () => {
    const offenders = nativeSources().filter((path) => {
      const source = read(path);

      // A message built with the snapshot or the preferences value in it.
      return /CodedException\([^)]*\$(json|snapshot|value|stored)/.test(source);
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe('health data reaches no service', () => {
  it.each([
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /\bnew WebSocket\b/],
    // Imported or required, not merely mentioned: the privacy boundary has to
    // be able to say the word "Firebase" in a comment to explain what it keeps
    // out.
    [
      'an analytics or crash reporter',
      /(from|require\()\s*['"][^'"]*(analytics|sentry|amplitude|posthog|bugsnag|crashlytics)/i,
    ],
  ])('makes no use of %s', (_label, pattern) => {
    const offenders = appSources().filter((path) => pattern.test(read(path)));

    expect(offenders.map(relative)).toEqual([]);
  });

  it('ships no networking or reporting dependency', () => {
    const manifest = JSON.parse(read(join(ROOT, 'package.json'))) as {
      dependencies: Record<string, string>;
    };

    const names = Object.keys(manifest.dependencies);

    expect(
      names.filter((name) =>
        /axios|sentry|analytics|amplitude|posthog|bugsnag|crashlytics/i.test(name)
      )
    ).toEqual([]);
  });

  describe('the one service this app talks to', () => {
    const FIREBASE_IMPORT = /(from|require\()\s*['"]firebase(\/[a-z-]+)?['"]/;

    /**
     * The file that sets the SDK up, and the declaration that says what the
     * React Native build of it exports. Neither calls anything.
     */
    const ALLOWED = [
      'src/features/auth/infrastructure/firebase.ts',
      'src/types/firebase-auth-react-native.d.ts',
    ];

    it('is Firebase, and only from where the boundary says', () => {
      const importers = appSources()
        .filter((path) => FIREBASE_IMPORT.test(read(path)))
        .map(relative)
        .filter((path) => !ALLOWED.includes(path));

      // The auth repository imports `firebase/auth` for its own calls; every
      // other file speaks this app's own types.
      expect(importers).toEqual(['src/features/auth/data/auth-repository.ts']);
    });

    it('is only ever auth: no Firestore, no storage, no messaging', () => {
      const offenders = appSources().filter((path) =>
        /(from|require\()\s*['"]firebase\/(firestore|database|storage|messaging|functions|analytics|remote-config|performance|app-check)/.test(
          read(path)
        )
      );

      expect(offenders.map(relative)).toEqual([]);
    });

    it('carries no health data to it: nothing imports the sync payload alongside it', () => {
      const importers = appSources().filter((path) => FIREBASE_IMPORT.test(read(path)));

      for (const path of importers) {
        expect(read(path)).not.toMatch(/CloudSyncPayload|cycle-repository|pregnancy-repository/);
      }
    });

    it('is configured from the environment rather than from the source', () => {
      const firebase = read(join(ROOT, 'src', 'features', 'auth', 'infrastructure', 'firebase.ts'));

      // A key in the source is a key that cannot be rotated without a release.
      expect(firebase).not.toMatch(/AIzaSy|\.firebaseapp\.com['"]|\.appspot\.com['"]/);
      expect(firebase).toMatch(/process\.env\.EXPO_PUBLIC_FIREBASE_API_KEY/);
    });
  });

  it('opens links only to the source addresses it displays', () => {
    const openers = appSources().filter((path) => /Linking\.openURL/.test(read(path)));

    // Every one of these passes a `source.url` from the app's own bundled
    // content, never a value read out of the database.
    for (const path of openers) {
      expect(read(path)).toMatch(/Linking\.openURL\(\s*(url|source\.url)\s*\)/);
    }
  });
});

describe('the screens show nothing that was meant for a developer', () => {
  function screens(): string[] {
    return appSources().filter((path) => path.endsWith('.tsx'));
  }

  it.each([
    ['a leftover probe', /SMOKE-PROBE|DEBUG_|__probe|TODO:|FIXME/],
    ['a thrown error rendered as text', /\{\s*(error|thrown)\s*\}|error\.message|String\(error\)/],
    ['a stringified object rendered as text', /\{\s*JSON\.stringify\(/],
  ])('renders no %s', (_label, pattern) => {
    const offenders = screens().filter((path) => pattern.test(read(path)));

    expect(offenders.map(relative)).toEqual([]);
  });

  it('keeps the database rows out of the screens, which read use cases instead', () => {
    // A screen that pulled a column name out of a row would be rendering the
    // database rather than what a use case made of it.
    const offenders = screens().filter((path) =>
      /\b(start_date|end_date|is_ongoing|due_date_source|skin_tone_id|snapshot_v1)\b/.test(
        read(path)
      )
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});
