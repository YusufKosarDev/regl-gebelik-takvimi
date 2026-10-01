import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import type { CloudSyncOutcome } from '../../application/run-cloud-sync';
import {
  lastSyncMessageIn,
  syncConflictCountMessageIn,
  syncFailureMessageIn,
  syncMessages,
  syncOutcomeMessageIn,
} from '../sync-messages';

/**
 * What a sync says it did, in both languages.
 *
 * Its own file rather than a block inside `sync-messages.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 *
 * Every assertion here is about the same thing: a sync moves somebody's period
 * history between a phone and an account, and a message that claimed something
 * happened when it did not would be the app telling them their data is
 * somewhere it is not.
 */

const FAILURES = [
  'signed-out',
  'not-configured',
  'invalid-credentials',
  'network-failed',
  'unreadable-backup',
  'local-failed',
  'app-out-of-date',
  'deletion-pending',
  'unknown',
] as const;

describe('parity', () => {
  describeCatalogueParity(syncMessages, {
    functions: [
      ['conflictCount', [1], [3]],
      ['lastSyncToday', ['14:05']],
      ['lastSyncOn', ['17/09/2026']],
    ],
  });
});

describe('every failure has a sentence', () => {
  it.each(FAILURES)('%s is answered in both languages', (failure) => {
    for (const catalogue of [syncMessages.tr, syncMessages.en]) {
      expect(syncFailureMessageIn(catalogue, failure).trim()).not.toBe('');
    }
  });

  it('says nothing was changed for every failure that changed nothing', () => {
    // The four that reach a half-written state say so themselves; these are the
    // ones where the honest thing is that the data is untouched.
    for (const failure of ['unreadable-backup', 'local-failed', 'unknown'] as const) {
      expect(syncFailureMessageIn(syncMessages.en, failure)).toMatch(/nothing was changed/i);
    }
  });

  it('tells an out-of-date app what was protected rather than just to update', () => {
    // "Update" on its own reads as nagging rather than as the thing standing
    // between somebody and losing what they wrote on another phone.
    const message = syncFailureMessageIn(syncMessages.en, 'app-out-of-date');

    expect(message).toMatch(/nothing would be overwritten/i);
    expect(message).toMatch(/update the app/i);
  });
});

describe('every outcome names what happened to the data', () => {
  const outcome = (kind: string, extra: Record<string, unknown> = {}) =>
    ({ kind, ...extra }) as unknown as CloudSyncOutcome;

  it('distinguishes sent, brought and merged', () => {
    const sent = syncOutcomeMessageIn(syncMessages.en, outcome('pushed', { revision: 1 }));
    const brought = syncOutcomeMessageIn(syncMessages.en, outcome('pulled', { revision: 1 }));
    const merged = syncOutcomeMessageIn(syncMessages.en, outcome('merged', { revision: 1 }));

    expect(new Set([sent, brought, merged]).size).toBe(3);
    expect(sent).toMatch(/sent to your account/i);
    expect(brought).toMatch(/brought to this phone/i);
  });

  it('says a conflict changed nothing, in both of its two shapes', () => {
    for (const reason of ['no-base', 'unresolved'] as const) {
      const message = syncOutcomeMessageIn(
        syncMessages.en,
        outcome('conflict', { reason, conflicts: [] })
      );

      expect(message).toMatch(/nothing was changed/i);
      expect(message).toMatch(/resolve the conflict/i);
    }
  });

  it('keeps the two conflict shapes apart', () => {
    // One has no agreed starting point to measure against; the other has a
    // record changed differently on each side. They are different problems.
    const noBase = syncOutcomeMessageIn(
      syncMessages.en,
      outcome('conflict', { reason: 'no-base', conflicts: [] })
    );
    const unresolved = syncOutcomeMessageIn(
      syncMessages.en,
      outcome('conflict', { reason: 'unresolved', conflicts: [] })
    );

    expect(noBase).not.toBe(unresolved);
    expect(noBase).toMatch(/never synced/i);
  });

  it('does not make a lost race read as a fault', () => {
    const message = syncOutcomeMessageIn(
      syncMessages.en,
      outcome('retry-required', { actualRevision: 3 })
    );

    expect(message).toMatch(/try again/i);
    expect(message).toMatch(/nothing was changed/i);
  });
});

describe('counting conflicts', () => {
  it('gives a count and never a record', () => {
    // This is a screen somebody may be holding in front of another person.
    const message = syncConflictCountMessageIn(
      syncMessages.en,
      { kind: 'conflict', reason: 'unresolved', conflicts: [{}, {}, {}] } as unknown as CloudSyncOutcome
    );

    expect(message).toBe('3 conflicts are waiting to be resolved.');
  });

  it('pluralises in English', () => {
    expect(syncMessages.en.conflictCount(1)).toMatch(/^1 conflict is/);
  });

  it('says nothing when there is nothing to count', () => {
    expect(
      syncConflictCountMessageIn(syncMessages.en, { kind: 'noop', revision: 1 })
    ).toBeNull();
  });
});

describe('when the last sync was', () => {
  const at = (iso: string) => new Date(iso).toISOString();

  it('gives today a clock and nothing older one', () => {
    // "Today" alone cannot tell a sync five minutes ago from one this morning.
    // A precise timestamp for every sync going back weeks is a record of when
    // somebody opens a period tracker, and nothing here needs one.
    const now = new Date('2026-09-17T18:00:00');

    expect(lastSyncMessageIn(syncMessages.en, 'en', at('2026-09-17T14:05:00'), now)).toMatch(
      /today at \d\d:\d\d/
    );
    expect(lastSyncMessageIn(syncMessages.en, 'en', at('2026-09-10T14:05:00'), now)).not.toMatch(
      /\d\d:\d\d/
    );
  });

  it('names yesterday rather than dating it', () => {
    const now = new Date('2026-09-17T18:00:00');

    expect(lastSyncMessageIn(syncMessages.en, 'en', at('2026-09-16T09:00:00'), now)).toBe(
      syncMessages.en.lastSyncYesterday
    );
  });

  it('separates an older date the way the language does', () => {
    const now = new Date('2026-09-17T18:00:00');

    expect(lastSyncMessageIn(syncMessages.en, 'en', at('2026-09-10T09:00:00'), now)).toContain(
      '10/09/2026'
    );
    expect(lastSyncMessageIn(syncMessages.tr, 'tr', at('2026-09-10T09:00:00'), now)).toContain(
      '10.09.2026'
    );
  });

  it('says it has never synced rather than inventing a date', () => {
    for (const catalogue of [syncMessages.tr, syncMessages.en]) {
      expect(lastSyncMessageIn(catalogue, 'en', null)).toBe(catalogue.syncNeverMessage);
      expect(lastSyncMessageIn(catalogue, 'en', 'not a date')).toBe(catalogue.syncNeverMessage);
    }
  });
});

describe('what automatic sync promises', () => {
  it('still says nothing is sent while the app is closed', () => {
    // "Automatic" on a health app reasonably reads as "uploads whenever it
    // likes, including while I am asleep", and that is what this does not do.
    expect(syncMessages.en.automaticSyncNote).toMatch(/nothing is sent while the app is closed/i);
  });

  it('gives an automatic failure one sentence rather than a diagnosis', () => {
    // Nobody asked for that sync at that moment, and a different diagnosis
    // every few minutes for a problem they did not set out to have is noise.
    expect(syncMessages.en.automaticSyncFailedMessage).toMatch(/nothing was changed/i);
  });
});
