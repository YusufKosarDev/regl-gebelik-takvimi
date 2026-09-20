import type { CloudSyncFailure, CloudSyncOutcome } from '../../application/run-cloud-sync';
import type { CloudSyncConflict } from '../../domain/merge-cloud-sync-payload';
import {
  AUTOMATIC_SYNC_LABEL,
  AUTOMATIC_SYNC_NOTE,
  BACKUP_DISABLED_BY_SYNC_MESSAGE,
  SYNC_BUSY_LABEL,
  SYNC_BUTTON_LABEL,
  didSyncChangeThisPhone,
  syncConflictCountMessage,
  syncFailureMessage,
  syncOutcomeMessage,
} from '../sync-messages';

const FAILURES: readonly CloudSyncFailure[] = [
  'signed-out',
  'not-configured',
  'invalid-credentials',
  'network-failed',
  'unreadable-backup',
  'local-failed',
  'unknown',
];

function conflict(path: string): CloudSyncConflict {
  return {
    path,
    reason: 'changed-on-both-sides',
    base: { present: true, value: 28 },
    local: { present: true, value: 30 },
    remote: { present: true, value: 32 },
  };
}

const OUTCOMES: readonly CloudSyncOutcome[] = [
  { kind: 'noop', revision: 4 },
  { kind: 'pushed', revision: 5 },
  { kind: 'pulled', revision: 5 },
  { kind: 'merged', revision: 6 },
  { kind: 'conflict', reason: 'unresolved', conflicts: [conflict('cycleSettings')] },
  { kind: 'conflict', reason: 'no-base', conflicts: [] },
  { kind: 'retry-required', actualRevision: 7 },
  ...FAILURES.map((failure): CloudSyncOutcome => ({ kind: 'error', failure })),
];

describe('every outcome says something', () => {
  it.each(OUTCOMES.map((outcome) => [outcome.kind, outcome] as const))(
    '%s gets a sentence of its own',
    (_kind, outcome) => {
      const message = syncOutcomeMessage(outcome);

      expect(message.length).toBeGreaterThan(10);
      expect(message.trim()).toBe(message);
    }
  );

  it('says something different for each thing that happened to the data', () => {
    const distinct = new Set([
      syncOutcomeMessage({ kind: 'noop', revision: 1 }),
      syncOutcomeMessage({ kind: 'pushed', revision: 1 }),
      syncOutcomeMessage({ kind: 'pulled', revision: 1 }),
      syncOutcomeMessage({ kind: 'merged', revision: 1 }),
    ]);

    expect(distinct.size).toBe(4);
  });

  it('is Turkish, with no code or identifier in it', () => {
    for (const outcome of OUTCOMES) {
      const message = syncOutcomeMessage(outcome);

      expect(message).not.toMatch(/[a-z]+-[a-z]+-[a-z]+|revision|uid|firestore|auth\//i);
    }
  });

  it('never names a revision number, which means nothing to anybody', () => {
    for (const outcome of OUTCOMES) {
      expect(syncOutcomeMessage(outcome)).not.toMatch(/\b\d+\b/);
    }
  });
});

describe('what each outcome promises about the data', () => {
  it('says the account received it when it was sent', () => {
    expect(syncOutcomeMessage({ kind: 'pushed', revision: 2 })).toContain('gönderildi');
  });

  it('says the phone received it when it was fetched', () => {
    expect(syncOutcomeMessage({ kind: 'pulled', revision: 2 })).toContain('alındı');
  });

  it('says the two were put together when they were', () => {
    expect(syncOutcomeMessage({ kind: 'merged', revision: 2 })).toContain('birleştirildi');
  });

  it('says everything is current when nothing had to move', () => {
    expect(syncOutcomeMessage({ kind: 'noop', revision: 2 })).toContain('güncel');
  });
});

describe('a conflict', () => {
  const unresolved: CloudSyncOutcome = {
    kind: 'conflict',
    reason: 'unresolved',
    conflicts: [conflict('cycleSettings'), conflict('periodRecords/a')],
  };

  const noBase: CloudSyncOutcome = { kind: 'conflict', reason: 'no-base', conflicts: [] };

  it.each([
    ['unresolved', unresolved],
    ['no-base', noBase],
  ])('tells somebody plainly that nothing changed (%s)', (_label, outcome) => {
    const message = syncOutcomeMessage(outcome);

    expect(message).toContain('Çakışma bulundu, çözülmedi');
    expect(message).toContain('hiçbir veri değiştirilmedi');
  });

  it('never reads as if the sync succeeded', () => {
    for (const outcome of [unresolved, noBase]) {
      expect(syncOutcomeMessage(outcome)).not.toMatch(/tamamlandı|güncel|gönderildi|alındı/);
    }
  });

  it('explains the two different reasons differently', () => {
    expect(syncOutcomeMessage(unresolved)).not.toBe(syncOutcomeMessage(noBase));
  });

  it('says what can be done instead when there is nothing to measure from', () => {
    const message = syncOutcomeMessage(noBase);

    expect(message).toContain('Yedeği geri yükle');
    expect(message).toContain('Yedek oluştur');
  });

  it('says the conflict screen does not exist yet rather than implying it does', () => {
    expect(syncOutcomeMessage(unresolved)).toContain('henüz');
  });

  it('counts the places, and names none of them', () => {
    const message = syncConflictCountMessage(unresolved);

    expect(message).toBe('Çözülmeyi bekleyen 2 çakışma var.');
    expect(message).not.toContain('cycleSettings');
    expect(message).not.toContain('periodRecords');
  });

  it('has no count to give when there is nothing to count', () => {
    expect(syncConflictCountMessage(noBase)).toBeNull();
  });

  it.each(OUTCOMES.filter((outcome) => outcome.kind !== 'conflict'))(
    'has no count for $kind',
    (outcome) => {
      expect(syncConflictCountMessage(outcome)).toBeNull();
    }
  );
});

describe('an account that moved while the sync was working', () => {
  const outcome: CloudSyncOutcome = { kind: 'retry-required', actualRevision: 9 };

  it('says to try again', () => {
    expect(syncOutcomeMessage(outcome)).toContain('Tekrar dene');
  });

  it('says nothing changed', () => {
    expect(syncOutcomeMessage(outcome)).toContain('hiçbir veri değiştirilmedi');
  });

  it('does not read as a failure of the person’s doing', () => {
    expect(syncOutcomeMessage(outcome)).toContain('başka bir cihazdan');
  });
});

describe('what a failure says', () => {
  it.each(FAILURES)('has its own sentence for %s', (failure) => {
    expect(syncFailureMessage(failure).length).toBeGreaterThan(10);
  });

  it('falls back to the plainest one for anything it has not been told about', () => {
    expect(syncFailureMessage('something-new')).toBe(syncFailureMessage('unknown'));
  });

  it('is what the outcome message uses', () => {
    for (const failure of FAILURES) {
      expect(syncOutcomeMessage({ kind: 'error', failure })).toBe(syncFailureMessage(failure));
    }
  });

  it('tells somebody to sign in when nobody is', () => {
    expect(syncFailureMessage('signed-out')).toContain('giriş');
  });

  it('separates a connection problem from a backup it cannot read', () => {
    expect(syncFailureMessage('network-failed')).not.toBe(syncFailureMessage('unreadable-backup'));
    expect(syncFailureMessage('unreadable-backup')).toContain('Hiçbir veri değiştirilmedi');
  });

  it('reassures about the data wherever nothing was written', () => {
    for (const failure of ['unreadable-backup', 'local-failed', 'unknown'] as const) {
      expect(syncFailureMessage(failure)).toContain('Hiçbir veri değiştirilmedi');
    }
  });
});

describe('whether the phone’s own data changed', () => {
  it.each([
    ['pulled', { kind: 'pulled', revision: 1 } as CloudSyncOutcome, true],
    ['merged', { kind: 'merged', revision: 1 } as CloudSyncOutcome, true],
    ['pushed', { kind: 'pushed', revision: 1 } as CloudSyncOutcome, false],
    ['noop', { kind: 'noop', revision: 1 } as CloudSyncOutcome, false],
    ['retry-required', { kind: 'retry-required', actualRevision: 1 } as CloudSyncOutcome, false],
    ['error', { kind: 'error', failure: 'unknown' } as CloudSyncOutcome, false],
    [
      'conflict',
      { kind: 'conflict', reason: 'unresolved', conflicts: [] } as CloudSyncOutcome,
      false,
    ],
  ])('says %s changed the phone: %p', (_label, outcome, expected) => {
    expect(didSyncChangeThisPhone(outcome)).toBe(expected);
  });
});

describe('what the screen calls things', () => {
  it('labels the switch', () => {
    expect(AUTOMATIC_SYNC_LABEL).toBe('Otomatik senkronizasyon');
  });

  it('says the switch only remembers the choice for now', () => {
    expect(AUTOMATIC_SYNC_NOTE).toContain('kaydedilir');
    expect(AUTOMATIC_SYNC_NOTE).toContain('henüz çalışmıyor');
    expect(AUTOMATIC_SYNC_NOTE).toContain('Şimdi senkronize et');
  });

  it('says why manual backup is unavailable, rather than leaving it greyed out', () => {
    expect(BACKUP_DISABLED_BY_SYNC_MESSAGE).toContain('Yedek oluştur');
    expect(BACKUP_DISABLED_BY_SYNC_MESSAGE).toContain('sürüm bilgisini');
    expect(BACKUP_DISABLED_BY_SYNC_MESSAGE).toContain('Kapatırsan');
  });

  it('names the button the same way it is announced', () => {
    expect(SYNC_BUTTON_LABEL).toBe('Şimdi senkronize et');
    expect(SYNC_BUSY_LABEL).toContain('Senkronize');
  });
});
