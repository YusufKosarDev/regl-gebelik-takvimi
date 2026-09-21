import type { SyncConflictSideSummary } from '../../application/build-conflict-preview';
import type { ResolveSyncConflictFailure } from '../../application/resolve-sync-conflict';
import * as labels from '../conflict-labels';

const {
  CONFLICT_ABSENT,
  CONFLICT_BODY_NO_BASE,
  CONFLICT_BODY_UNRESOLVED,
  CONFLICT_CANCEL_LABEL,
  CONFLICT_DEVICE_OTHER,
  CONFLICT_DEVICE_THIS,
  CONFLICT_KEEP_LOCAL_LABEL,
  CONFLICT_KEEP_LOCAL_WARNING,
  CONFLICT_KEEP_REMOTE_LABEL,
  CONFLICT_KEEP_REMOTE_WARNING,
  CONFLICT_PRESENT,
  CONFLICT_UNKNOWN,
  conflictDeviceLabel,
  conflictFailureMessage,
  conflictLastChangeLabel,
  conflictPresenceLabel,
  conflictRecordCountLabel,
} = labels;

const side = (periodRecordCount: number): SyncConflictSideSummary => ({
  periodRecordCount,
  hasPregnancy: false,
  hasAvatar: false,
  hasCycleSettings: true,
});

describe('what the screen says will happen', () => {
  it('names what is destroyed, not only what is kept', () => {
    // "Buluttakini kullan" sounds additive and is not.
    expect(CONFLICT_KEEP_LOCAL_WARNING).toContain('değiştirilecek');
    expect(CONFLICT_KEEP_REMOTE_WARNING).toContain('değiştirilecek');
    expect(CONFLICT_KEEP_LOCAL_WARNING).toContain('geri alınamaz');
    expect(CONFLICT_KEEP_REMOTE_WARNING).toContain('geri alınamaz');
  });

  it('points each warning at the side that loses', () => {
    expect(CONFLICT_KEEP_LOCAL_WARNING).toMatch(/^Buluttaki/);
    expect(CONFLICT_KEEP_REMOTE_WARNING).toMatch(/^Bu cihazdaki/);
  });

  it('tells somebody the unchosen side is lost before they choose', () => {
    expect(CONFLICT_BODY_UNRESOLVED).toContain('silinecek');
  });

  it('says why there is nothing to compare against on a first sync', () => {
    expect(CONFLICT_BODY_NO_BASE).toContain('hiç senkronize edilmemiş');
  });

  it('never promises a merge', () => {
    // There is no per-record choice here, and copy hinting at one would be
    // promising something the app does not do.
    for (const text of [
      CONFLICT_BODY_UNRESOLVED,
      CONFLICT_BODY_NO_BASE,
      CONFLICT_KEEP_LOCAL_WARNING,
      CONFLICT_KEEP_REMOTE_WARNING,
    ]) {
      expect(text).not.toMatch(/birleştir|birleşt/i);
    }
  });

  it('offers a way out that changes nothing', () => {
    expect(CONFLICT_CANCEL_LABEL).toBe('Vazgeç');
  });

  it('leaves nothing blank for a screen to render as a gap', () => {
    for (const [name, value] of Object.entries(labels)) {
      if (typeof value !== 'string') continue;

      expect([name, value.trim().length > 0]).toEqual([name, true]);
    }
  });

  it('keeps the screen out of the developer console', () => {
    // Every string here is shown to somebody. A leftover placeholder or an
    // English sentence would be visible in the app, not in a log.
    for (const [name, value] of Object.entries(labels)) {
      if (typeof value !== 'string') continue;

      expect([name, /\b(TODO|FIXME|undefined|null)\b/.test(value)]).toEqual([name, false]);
    }
  });
});

describe('the two choices', () => {
  it('names them as the person was promised', () => {
    expect(CONFLICT_KEEP_LOCAL_LABEL).toBe('Bu cihazdakini kullan');
    expect(CONFLICT_KEEP_REMOTE_LABEL).toBe('Buluttakini kullan');
  });
});

describe('the comparison rows', () => {
  it('gives a count and nothing about which days', () => {
    expect(conflictRecordCountLabel(side(3))).toBe('3 kayıt');
    expect(conflictRecordCountLabel(side(0))).toBe('0 kayıt');
  });

  it('says only whether something is there', () => {
    expect(conflictPresenceLabel(true)).toBe(CONFLICT_PRESENT);
    expect(conflictPresenceLabel(false)).toBe(CONFLICT_ABSENT);
  });

  it('says this phone or another one, and nothing more specific', () => {
    // The stored id is a random per-install string with no name in it.
    expect(conflictDeviceLabel(true)).toBe(CONFLICT_DEVICE_THIS);
    expect(conflictDeviceLabel(false)).toBe(CONFLICT_DEVICE_OTHER);
  });
});

describe('when the cloud side was last written', () => {
  it('shows a date and a time', () => {
    const when = new Date(2026, 8, 20, 8, 5);

    expect(conflictLastChangeLabel(when.toISOString())).toBe('20.09.2026 08:05');
  });

  it('pads single digits so the column does not jump', () => {
    const when = new Date(2026, 0, 2, 3, 4);

    expect(conflictLastChangeLabel(when.toISOString())).toBe('02.01.2026 03:04');
  });

  it('says it does not know rather than guessing', () => {
    expect(conflictLastChangeLabel(null)).toBe(CONFLICT_UNKNOWN);
    expect(conflictLastChangeLabel('dün')).toBe(CONFLICT_UNKNOWN);
  });
});

describe('when a resolution fails', () => {
  it('says nothing was changed, whatever went wrong', () => {
    const reasons: readonly ResolveSyncConflictFailure[] = [
      'network-failed',
      'local-failed',
      'unknown',
    ];

    for (const reason of reasons) {
      expect(conflictFailureMessage(reason)).toContain('Hiçbir veri değiştirilmedi');
    }
  });

  it('treats a moved revision as something to decide again, not a fault', () => {
    expect(conflictFailureMessage('revision-moved')).toContain('tekrar yap');
    expect(conflictFailureMessage('revision-moved')).not.toContain('Hiçbir veri değiştirilmedi');
  });

  it('falls back to the general message for a reason it does not know', () => {
    expect(conflictFailureMessage('something-new')).toBe(conflictFailureMessage('unknown'));
  });

  it('never repeats what the failure said for itself', () => {
    // A Firestore message can name a path, and a path here names an account.
    for (const reason of ['revision-moved', 'network-failed', 'local-failed', 'unknown']) {
      expect(conflictFailureMessage(reason)).not.toMatch(/uid|users\/|firestore/i);
    }
  });
});
