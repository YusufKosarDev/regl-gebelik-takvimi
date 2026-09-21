import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DATA_CATEGORIES,
  DATA_INVENTORY,
  EXCLUDED_FROM_CLOUD_SYNC,
  isCloudSyncCandidate,
  isDataCategory,
  isExcludedFromCloudSync,
} from '../data-category';

const DOC = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', 'docs', 'data-privacy.md'),
  'utf8'
);

describe('what a sync may carry', () => {
  it('is the five things a person entered', () => {
    expect([...DATA_CATEGORIES]).toEqual([
      'cycle-settings',
      'period-records',
      'pregnancy-profile',
      'avatar-config',
      'notification-preferences',
    ]);
  });

  it('holds no derived or device-local category', () => {
    expect([...DATA_CATEGORIES]).not.toContain('widget-snapshot');
    expect([...DATA_CATEGORIES]).not.toContain('derived-cycle-data');
    expect([...DATA_CATEGORIES]).not.toContain('scheduled-notifications');
  });
});

describe('what stays on the device', () => {
  it('names each thing this device works out or keeps for itself', () => {
    expect([...EXCLUDED_FROM_CLOUD_SYNC]).toEqual([
      'widget-snapshot',
      'auth-session',
      'shared-preferences',
      'scheduled-notifications',
      'app-mode',
      'derived-cycle-data',
      'content-sources',
      'logs',
      'sync-state',
      'sync-device-id',
      'sync-preferences',
      'pending-account-deletion',
      'sync-last-synced-at',
      'sync-unresolved-conflict',
    ]);
  });

  it('names the sync’s own local copy, which is a second copy of the health data', () => {
    // `sync_state.base_payload` holds a whole payload. It is the one row in the
    // database that is a copy rather than a source, and a privacy inventory
    // that did not mention it would be hiding the thing it exists to disclose.
    expect([...EXCLUDED_FROM_CLOUD_SYNC]).toContain('sync-state');
  });

  it('overlaps with nothing that syncs', () => {
    for (const excluded of EXCLUDED_FROM_CLOUD_SYNC) {
      expect(isDataCategory(excluded)).toBe(false);
    }

    for (const category of DATA_CATEGORIES) {
      expect(isExcludedFromCloudSync(category)).toBe(false);
    }
  });
});

describe('isCloudSyncCandidate', () => {
  it.each(DATA_CATEGORIES)('says yes to %s', (category) => {
    expect(isCloudSyncCandidate(category)).toBe(true);
  });

  it.each(EXCLUDED_FROM_CLOUD_SYNC)('says no to %s', (excluded) => {
    expect(isCloudSyncCandidate(excluded)).toBe(false);
  });

  it('refuses to answer for something it has never heard of', () => {
    // Not "no": an unnamed category is a question nobody has asked yet, and
    // answering it either way is how something leaves the device by accident.
    expect(() => isCloudSyncCandidate('location-history')).toThrow(
      'isCloudSyncCandidate received an id it does not know: text.'
    );
  });

  it('names no value when it refuses', () => {
    const error = (() => {
      try {
        isCloudSyncCandidate('period-2026-09-17');
        return null;
      } catch (thrown) {
        return thrown as Error;
      }
    })();

    expect(error?.message).not.toMatch(/2026-09-17/);
  });
});

describe('the inventory', () => {
  it('has a line for every category, and only for categories', () => {
    expect(DATA_INVENTORY.map((entry) => entry.id).sort()).toEqual(
      [...DATA_CATEGORIES, ...EXCLUDED_FROM_CLOUD_SYNC].sort()
    );
  });

  it('agrees with itself about what may sync', () => {
    for (const entry of DATA_INVENTORY) {
      expect(entry.cloudSyncCandidate).toBe(isCloudSyncCandidate(entry.id));
    }
  });

  it('says everything is on the device, because it is', () => {
    expect(DATA_INVENTORY.every((entry) => entry.storedOnDevice)).toBe(true);
  });

  it('gives a reason for each line', () => {
    for (const entry of DATA_INVENTORY) {
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });
});

describe('the inventory and the document say the same thing', () => {
  it.each(DATA_INVENTORY)('$id has a row in docs/data-privacy.md', (entry) => {
    expect(DOC).toContain(`| \`${entry.id}\` |`);
    expect(DOC).toContain(entry.reason);
  });

  it('marks the device-only rows as such in the document', () => {
    for (const entry of DATA_INVENTORY.filter((row) => !row.cloudSyncCandidate)) {
      const row = DOC.split('\n').find((line) => line.startsWith(`| \`${entry.id}\` |`)) ?? '';

      expect(row).toContain('**hayır**');
    }
  });

  it('says out loud when health data is sent, and when it is not', () => {
    expect(DOC).toContain('Sağlık verisi yalnızca sen bir düğmeye bastığında gönderiliyor');
    // Both of them, named. A document that still said "Yedek oluştur" alone
    // would be wrong about a button that is on the same screen.
    expect(DOC).toContain('"Yedek oluştur" ve "Şimdi senkronize et"');
    expect(DOC).toContain('otomatik yedekleme, açılışta senkronizasyon');
    expect(DOC).toContain('Sağlık verisi cihazda');
    expect(DOC).toContain('Loglar ham sağlık verisi içermez');
  });

  it('says what the automatic sync switch does today, which is only to remember', () => {
    expect(DOC).toContain('yalnızca tercihini kaydediyor');
    expect(DOC).toContain('kendiliğinden çalışan');
  });

  it('says which services are used, and which are not', () => {
    expect(DOC).toContain('Firebase Auth ve Firestore var; başka Firebase ürünü yok');
    expect(DOC).toContain('Firebase config kaynak koda gömülü değil');
  });

  it('says where a backup goes and who may read it', () => {
    expect(DOC).toContain('users/{uid}/backups/current');
    expect(DOC).toContain('request.auth.uid == userId');
  });

  it('lists the five categories a backup carries, and says what it leaves out', () => {
    for (const category of DATA_CATEGORIES) {
      expect(DOC).toContain(`\`${category}\` — `);
    }

    expect(DOC).toContain('loglar, bildirim kuyruğu');
  });

  it('says which parts of a sync exist and which do not', () => {
    expect(DOC).toContain('Geri yükleme (restore) ve elle başlatılan senkronizasyon var');
    expect(DOC).toContain('çakışmaları çözme ekranı henüz yok');
    // The promise the conflict message on screen makes, written down here too.
    expect(DOC).toContain('iki taraftaki veriler olduğu gibi bırakılır');
  });
});
