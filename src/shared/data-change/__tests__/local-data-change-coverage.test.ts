import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { DATA_CATEGORIES } from '@/features/privacy/domain/data-category';

/**
 * A scan of the source, for a failure that behaviour cannot catch.
 *
 * Automatic sync is driven by one announcement, made by the repositories that
 * own the five things a sync carries. A mutation added next year in a
 * repository that forgets to make it would compile, pass its own tests, and
 * simply never reach the account — silently, permanently, and only for the
 * person whose data it was.
 *
 * So the rule is written down here instead: a repository that writes to a
 * table a sync carries must either announce it, or be on the list below with a
 * reason.
 */

const ROOT = join(__dirname, '..', '..', '..');

/** The five categories, as the tables that hold them. */
const SYNCED_TABLES: Readonly<Record<string, string>> = {
  cycle_settings: 'cycle-settings',
  period_records: 'period-records',
  pregnancy_profile: 'pregnancy-profile',
  avatar_config: 'avatar-config',
  notification_preferences: 'notification-preferences',
};

/**
 * Files that write to those tables and must not announce it.
 *
 * Each is a write that is not somebody editing their data: a restore and a
 * merge are the result of a sync, and a wipe deliberately leaves the account
 * alone. Both run inside `withLocalDataChangeSuppressed`, which is asserted
 * below rather than taken on trust.
 */
const SUPPRESSED_BY_DESIGN: readonly string[] = ['deletion/data/local-data-repository.ts'];

function filesUnder(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (entry === '__tests__') continue;

      found.push(...filesUnder(path));

      continue;
    }

    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      found.push(path);
    }
  }

  return found;
}

/** Every `data/` file under `src/features`, which is where writes belong. */
function repositorySources(): readonly { readonly id: string; readonly source: string }[] {
  const features = join(ROOT, 'features');

  return readdirSync(features)
    .map((feature) => join(features, feature, 'data'))
    .filter((directory) => {
      try {
        return statSync(directory).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap((directory) => filesUnder(directory))
    .map((path) => ({
      id: path.slice(features.length + 1).split(/[\\/]/).join('/'),
      source: readFileSync(path, 'utf8'),
    }));
}

/** Which of the five tables a file writes to. */
function mutatedSyncedTables(source: string): readonly string[] {
  return Object.keys(SYNCED_TABLES).filter((table) => {
    const mutation = new RegExp(
      `(INSERT\\s+INTO|REPLACE\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+${table}\\b`,
      'i'
    );

    return mutation.test(source);
  });
}

describe('every write a sync would carry is announced', () => {
  const repositories = repositorySources();

  it('finds the repositories at all, so an empty scan cannot pass', () => {
    expect(repositories.length).toBeGreaterThan(5);
  });

  it('covers each of the five categories with at least one announcing repository', () => {
    // Without this, deleting the notifier from a repository would only remove
    // the file from the scan rather than fail it.
    const announcedTables = new Set<string>();

    for (const { id, source } of repositories) {
      if (SUPPRESSED_BY_DESIGN.includes(id)) continue;
      if (!source.includes('notifyLocalDataChanged')) continue;

      for (const table of mutatedSyncedTables(source)) {
        announcedTables.add(SYNCED_TABLES[table]);
      }
    }

    expect([...announcedTables].sort()).toEqual([...DATA_CATEGORIES].sort());
  });

  it('leaves no repository writing a synced table without saying so', () => {
    const silent = repositories
      .filter(({ id }) => !SUPPRESSED_BY_DESIGN.includes(id))
      .filter(({ source }) => mutatedSyncedTables(source).length > 0)
      .filter(({ source }) => !source.includes('notifyLocalDataChanged()'))
      .map(({ id }) => id);

    expect(silent).toEqual([]);
  });

  it('holds the announcement to the write, not to the function being called', () => {
    // `notifyLocalDataChanged` is imported from one place. A local stub with
    // the same name would satisfy the scan above and do nothing.
    for (const { id, source } of repositories) {
      if (!source.includes('notifyLocalDataChanged')) continue;
      if (SUPPRESSED_BY_DESIGN.includes(id)) continue;

      expect(source).toContain("from '@/shared/data-change/local-data-change'");
    }
  });
});

describe('the writes that must stay quiet', () => {
  const repositories = repositorySources();

  it.each(SUPPRESSED_BY_DESIGN)('does not announce from %s', (id) => {
    const repository = repositories.find((candidate) => candidate.id === id);

    expect(repository).toBeDefined();
    expect(repository?.source).not.toContain('notifyLocalDataChanged');
  });

  it('runs the wipe inside a suppression', () => {
    const wipe = readFileSync(
      join(ROOT, 'features', 'deletion', 'data', 'local-data-repository.ts'),
      'utf8'
    );

    expect(wipe).toContain('withLocalDataChangeSuppressed');
  });

  it('runs the restore inside a suppression', () => {
    // A restore is what a sync produced. Announcing it would schedule another
    // sync of what was just received.
    const restore = readFileSync(
      join(ROOT, 'features', 'backup', 'application', 'restore-cloud-backup.ts'),
      'utf8'
    );

    expect(restore).toContain('withLocalDataChangeSuppressed');
  });
});
