import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import {
  resetLocalDbWriteLockForTests,
  withLocalDbWriteLock,
} from '../local-db-write-lock';

/**
 * Where the write lock may be taken, scanned out of the source.
 *
 * ## Why a scan and not a behaviour test
 *
 * The rule this holds cannot be checked by calling anything, and breaking it
 * does not throw. `withLocalDbWriteLock` is a promise chain, so a second
 * acquisition from inside the first waits on the first call's own unsettled
 * result: it never rejects, never times out, and the app simply stops with
 * whatever spinner the screen was showing. There is no error to assert on,
 * no timeout to catch, and nothing in a normal test run that goes red.
 *
 * The one place that can catch it is here, before it ships.
 *
 * ## The rule
 *
 * Every path that writes the local database takes the lock exactly once, at the
 * highest layer whose work inside it is nothing but local database work. The
 * corollary that makes "exactly once" achievable is:
 * **nothing under a `data/` folder takes it.**
 *
 * Both halves are scanned here, and for a while only the corollary was. A
 * missing lock and a nested one are the same silent hang, so a guard that
 * watched one direction left the other to be noticed by somebody holding a
 * frozen phone.
 *
 * Repositories are the leaves. A repository function cannot know whether its
 * caller already holds the turn — `restoreCloudBackup` calls nine of them from
 * inside its own span — so if one of them asked for the lock, every restore
 * would hang. The layer above owns the turn, always.
 *
 * ## Why the corollary is phrased as a folder and not a list
 *
 * Because a list would need maintaining and a folder does not. `data/` is
 * already the layer this codebase puts repositories in, and the question "may
 * this file take the lock?" has the same answer for every file in it.
 */

const SOURCE_ROOT = join(__dirname, '..', '..');

const LOCK_NAME = 'withLocalDbWriteLock';

function filesUnder(directory: string): readonly string[] {
  const entries = readdirSync(directory).map((entry) => join(directory, entry));

  return entries.flatMap((entry) =>
    statSync(entry).isDirectory() ? filesUnder(entry) : [entry]
  );
}

/**
 * Every `data/` module, as a path relative to `src/`.
 *
 * Tests excluded: a test may name the lock as much as it likes. Relative so a
 * failure reads as `features/cycle/data/cycle-repository.ts` rather than as
 * whatever the checkout happens to be called on the machine that ran it.
 */
function dataLayerFiles(): readonly string[] {
  return filesUnder(SOURCE_ROOT)
    .filter(
      (file) =>
        /[\\/]data[\\/]/.test(file) &&
        !file.includes('__tests__') &&
        (file.endsWith('.ts') || file.endsWith('.tsx'))
    )
    .map((file) => relative(SOURCE_ROOT, file).split(sep).join('/'));
}

/**
 * The local-database write functions a repository exports.
 *
 * Two things make one, and both are mechanical: the name begins with a write
 * verb, and the signature takes a `SQLiteDatabase`.
 *
 * The second half is what keeps the scan honest. `saveCloudBackup`,
 * `deleteCloudBackup` and `deleteAuthUser` are all repository functions whose
 * names begin with a write verb, and none of them touches SQLite — they write
 * to Firestore. Matching on the name alone flagged `create-cloud-backup.ts`,
 * which correctly takes no lock because it makes no local write. A guard whose
 * first finding is a false one gets an exception list, and an exception list is
 * how a guard stops being read.
 */
function localWriteFunctions(): readonly string[] {
  const names = new Set<string>();

  for (const file of dataLayerFiles()) {
    const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');

    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
      const name = match[1];

      if (!/^(save|write|clear|replace|delete|update|insert|set|remove|add)[A-Z]/.test(name)) {
        continue;
      }

      // The parameter list only, which is everything up to the body.
      const bodyAt = source.indexOf('{', match.index);
      const signature = source.slice(match.index, bodyAt === -1 ? source.length : bodyAt);

      if (signature.includes('SQLiteDatabase')) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

/** Every module outside `data/`, as a path relative to `src/`. */
function callerFiles(): readonly string[] {
  return filesUnder(SOURCE_ROOT)
    .filter(
      (file) =>
        !/[\\/]data[\\/]/.test(file) &&
        !file.includes('__tests__') &&
        (file.endsWith('.ts') || file.endsWith('.tsx'))
    )
    .map((file) => relative(SOURCE_ROOT, file).split(sep).join('/'));
}

/**
 * The names a module imports, from its `import { … }` lists.
 *
 * Imports rather than any mention of the name: a comment that discusses
 * `saveDailyEntry` is not a write, and a guard that cannot tell the difference
 * would be reporting prose.
 */
function importedNames(source: string): readonly string[] {
  return [...source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from/g)].flatMap((match) =>
    match[1]
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
      .filter((name) => name.length > 0)
  );
}

/**
 * What this half catches, and what it does not.
 *
 * It catches the regression it exists for: a module that imports a local write
 * and never takes the lock — a new write path, or a lock deleted out of an old
 * one. That is the shape the review found missing, and the shape that hangs the
 * app with no error to assert on.
 *
 * It does not catch a module that locks one of its writes and not another: the
 * grain is the file, because a module's mention of the lock is all a text scan
 * can see. That is the same grain the corollary below works at, where a `data/`
 * file may not mention the lock at all, and it is the honest limit of a scan.
 * Reading inside functions needs the AST; if this ever has to go that far, it
 * is a sign the layering stopped being obvious, which is its own problem.
 */
describe('every local write path takes the write lock', () => {
  it('finds the write functions to look for', () => {
    // A set that came back empty would make every case below pass by matching
    // nothing — the same quiet pass the folder rename would cause above.
    expect(localWriteFunctions().length).toBeGreaterThan(10);
  });

  it.each(callerFiles())('%s takes the lock if it writes', (file) => {
    const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');
    const writes = importedNames(source).filter((name) =>
      localWriteFunctions().includes(name)
    );

    // Nothing to say about a module that makes no local write.
    if (writes.length === 0) {
      return;
    }

    expect([file, writes, source.includes(LOCK_NAME)]).toEqual([file, writes, true]);
  });
});

describe('the data layer never takes the write lock', () => {
  it('finds the repositories to scan', () => {
    // A scan that matched nothing would pass for the wrong reason, quietly, the
    // day someone renames the folder.
    expect(dataLayerFiles().length).toBeGreaterThan(5);
  });

  it.each(dataLayerFiles())('%s does not mention the lock', (file) => {
    expect(readFileSync(join(SOURCE_ROOT, file), 'utf8')).not.toContain(LOCK_NAME);
  });
});

describe('the lock itself', () => {
  beforeEach(() => {
    resetLocalDbWriteLockForTests();
  });

  it('holds the second caller until the first has finished', async () => {
    const order: string[] = [];

    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withLocalDbWriteLock(async () => {
      order.push('first-start');
      await firstHeld;
      order.push('first-end');
    });

    const second = withLocalDbWriteLock(async () => {
      order.push('second-start');
    });

    // Several turns, so "not yet" means the queue rather than a race.
    for (let turn = 0; turn < 8; turn += 1) {
      await Promise.resolve();
    }

    expect(order).toEqual(['first-start']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('runs the next caller even when the previous one failed', async () => {
    const failed = withLocalDbWriteLock(async () => {
      throw new Error('the domain said no');
    });

    await expect(failed).rejects.toThrow('the domain said no');

    await expect(withLocalDbWriteLock(async () => 'ran')).resolves.toBe('ran');
  });

  it('hands each caller its own result', async () => {
    const [a, b] = await Promise.all([
      withLocalDbWriteLock(async () => 'a'),
      withLocalDbWriteLock(async () => 'b'),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});
