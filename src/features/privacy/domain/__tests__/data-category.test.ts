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
  it('is the six things a person entered', () => {
    expect([...DATA_CATEGORIES]).toEqual([
      'cycle-settings',
      'period-records',
      'pregnancy-profile',
      'avatar-config',
      'notification-preferences',
      'daily-entries',
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
      // The app lock. A device decision like the theme and the sync switch: a
      // PIN set on one phone has no meaning on another, and a password hash
      // has no business in a document that is otherwise health data.
      'app-lock',
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

  it('says out loud where health data goes, and that it goes nowhere else', () => {
    expect(DOC).toContain('Sağlık verisi yalnızca senin kendi Firebase hesabına gidiyor');
    // Both of them, named. A document that still said "Yedek oluştur" alone
    // would be wrong about a button that is on the same screen.
    expect(DOC).toContain('"Yedek oluştur" ya da "Şimdi');
    expect(DOC).toContain('senkronize et" düğmesine basmak');
    expect(DOC).toContain('Sağlık verisi cihazda');
    expect(DOC).toContain('Loglar ham sağlık verisi içermez');
  });

  it('says the switch is off until somebody turns it on', () => {
    // The default is the whole claim: a policy built on this document says
    // nothing leaves the phone unless the person asked for it.
    expect(DOC).toContain('varsayılan olarak kapalı');
  });

  it('names every trigger that can send, so none can be added quietly', () => {
    for (const trigger of [
      'anahtarın açılması',
      'oturum açılması',
      'uygulamanın öne gelmesi',
      'bir kaydın değişmesi',
      'arka plana alınırken',
    ]) {
      expect(DOC).toContain(trigger);
    }
  });

  it('says nothing is sent while the app is closed', () => {
    expect(DOC).toContain('Uygulama kapalıyken hiçbir şey gönderilmez');
    expect(DOC).toContain('Arka plan görevi, periyodik iş');
    expect(DOC).toContain('ve zamanlanmış gönderim yok');
  });

  it('no longer describes the switch as remembering a preference and nothing more', () => {
    // It did exactly that until automatic sync shipped, and this test pinned
    // the old sentence rather than the behaviour — which is how the document
    // drifted without anything failing.
    expect(DOC).not.toContain('yalnızca tercihini kaydediyor');
    expect(DOC).not.toContain('senkronizasyon henüz yok');
  });

  it('says which services are used, and which are not', () => {
    expect(DOC).toContain('Firebase Auth ve Firestore var; başka Firebase ürünü yok');
    expect(DOC).toContain('Firebase config kaynak koda gömülü değil');
  });

  it('says where a backup goes and who may read it', () => {
    expect(DOC).toContain('users/{uid}/backups/current');
    expect(DOC).toContain('request.auth.uid == userId');
  });

  it('lists every category a backup carries, and says what it leaves out', () => {
    for (const category of DATA_CATEGORIES) {
      expect(DOC).toContain(`\`${category}\` — `);
    }

    expect(DOC).toContain('loglar, bildirim kuyruğu');
  });

  it('says which parts of a sync exist', () => {
    expect(DOC).toContain('senkronizasyon ve çakışmaları çözme ekranı var');
    // The promise the conflict message on screen makes, written down here too.
    expect(DOC).toContain('iki taraftaki veriler olduğu gibi bırakılır');
  });

  it('names every key a deletion clears, including the two the sync added', () => {
    for (const key of [
      'sync_state',
      'sync-preferences',
      'sync-device-id',
      'sync-last-synced-at',
      'sync-unresolved-conflict',
    ]) {
      expect(DOC).toContain(key);
    }
  });
});

/**
 * The lock is a device decision, like the theme and the sync switch.
 *
 * Three reasons, and the second is the one that would be hardest to undo: a
 * PIN set on one phone has no meaning on another; a password hash has no
 * business in a document that is otherwise health data, because it changes what
 * a rules mistake would cost; and a synced lock would silently close a second
 * device somebody never set one on.
 */
describe('the app lock never syncs', () => {
  it('is not something a sync may carry', () => {
    expect([...DATA_CATEGORIES]).not.toContain('app-lock');
    expect(isCloudSyncCandidate('app-lock')).toBe(false);
  });

  it('is in the list of what this device keeps to itself', () => {
    expect(isExcludedFromCloudSync('app-lock')).toBe(true);
  });

  // The inventory is what the published privacy policy points at. A row that
  // said the PIN is stored would be saying something untrue.
  it('says the PIN itself is not stored anywhere', () => {
    const entry = DATA_INVENTORY.find((row) => row.id === 'app-lock');

    expect(entry).toBeDefined();
    expect(entry?.cloudSyncCandidate).toBe(false);
    expect(entry?.reason).toContain('saklanmaz');
    expect(entry?.reason).toContain('hesapla taşınmaz');
  });
});
