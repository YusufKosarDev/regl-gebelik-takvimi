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
      'shared-preferences',
      'scheduled-notifications',
      'app-mode',
      'derived-cycle-data',
      'content-sources',
      'logs',
    ]);
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

  it('says out loud that nothing syncs yet', () => {
    expect(DOC).toContain('Ağ isteği yok');
    expect(DOC).toContain('Firebase yok, analytics yok, crash reporting yok');
    expect(DOC).toContain('Sağlık verisi cihazda');
    expect(DOC).toContain('Loglar ham sağlık verisi içermez');
  });
});
