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
 * corollary this guards is the one that makes "exactly once" achievable:
 * **nothing under a `data/` folder takes it.**
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
