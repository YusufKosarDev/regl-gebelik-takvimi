import { readFileSync } from 'fs';

import { WIPED_TABLES } from '@/features/deletion/data/local-data-repository';
import { join } from 'path';

import type { DataCategory } from '../data-category';
import {
  DATA_CATEGORIES,
  DATA_INVENTORY,
  EXCLUDED_FROM_CLOUD_SYNC,
  isCloudSyncCandidate,
  isDataCategory,
  isExcludedFromCloudSync,
} from '../data-category';

const DOCS_DIR = join(__dirname, '..', '..', '..', '..', '..', 'docs');

const DOC = readFileSync(join(DOCS_DIR, 'data-privacy.md'), 'utf8');

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
      // Whether the reminders may name a period on the lock screen. Beside the
      // lock for the same reason it is turned on by the lock: who reads a lock
      // screen is a fact about the phone in somebody's hand, not about them.
      'discreet-notifications',
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

  /**
   * ## This used to pass while the document contradicted itself
   *
   * It checked that each category name appeared *somewhere*, which it did -
   * `daily-entries` was in the numbered list the whole time. What it did not
   * check was the sentence two paragraphs above, which said the sync carries
   * "beş kategori" while the list below it held six. Green for as long as the
   * sixth category existed.
   *
   * The assertion named something only the author could see, the property was
   * something a reader would notice. The count is now bound to
   * `DATA_CATEGORIES.length`, in both places the document states it, so the
   * two cannot drift apart again.
   */
  it('lists every category a backup carries, and says what it leaves out', () => {
    for (const category of DATA_CATEGORIES) {
      expect(DOC).toContain(`\`${category}\` — `);
    }

    expect(DOC).toContain('loglar, bildirim kuyruğu');
  });

  it('states the number of categories, and states the right one', () => {
    const written = ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'][
      DATA_CATEGORIES.length - 1
    ];

    expect(written).toBeDefined();

    // Both places the document names the count, so a seventh category cannot
    // be added by fixing only the one somebody happens to read.
    const claims = DOC.split('\n').filter((line) => line.includes('kategorid'));

    expect(claims).toHaveLength(2);

    for (const claim of claims) {
      expect([claim.trim(), claim.includes(`${written} kategorid`)]).toEqual([
        claim.trim(),
        true,
      ]);
    }
  });

  it('says which parts of a sync exist', () => {
    expect(DOC).toContain('senkronizasyon ve çakışmaları çözme ekranı var');
    // The promise the conflict message on screen makes, written down here too.
    expect(DOC).toContain('iki taraftaki veriler olduğu gibi bırakılır');
  });

  /**
   * ## The other one that passed while the document was wrong
   *
   * It checked five hard-coded strings appeared somewhere in the file. The
   * deletion section listed six tables where the wipe clears eight -
   * `daily_entries` and `daily_entry_symptoms` were missing - and this stayed
   * green, partly *because* `sync_state` was in the list that was wrong.
   *
   * `WIPED_TABLES` has been exported from the deletion repository all along,
   * for exactly this. Bound to it now, so a ninth table cannot be added
   * without the document gaining a row.
   */
  it('names every table a wipe clears, from the list the wipe itself uses', () => {
    for (const table of WIPED_TABLES) {
      expect([table, DOC.includes(`\`${table}\``)]).toEqual([table, true]);
    }
  });

  it('says how many tables that is, and counts them right', () => {
    const written = ['altı', 'yedi', 'sekiz', 'dokuz', 'on'][WIPED_TABLES.length - 6];

    expect(written).toBeDefined();
    expect(DOC).toContain(`her şeyi siler: ${written}`);
  });

  it('names every key a deletion clears, including the two the sync added', () => {
    for (const key of [
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
/**
 * The published pages, against the same inventory.
 *
 * ## Why this exists
 *
 * `daily-entries` was added to the payload, to `DATA_CATEGORIES`, to the
 * inventory table and to the summary tables on the pages themselves - and not
 * to a single enumeration in prose. Eight published sentences told a reader
 * five categories were kept, stored or deleted when six were, and two of them
 * were the "where your data is kept" paragraph, which is the sentence people
 * actually read.
 *
 * Nothing caught it because nothing bound these files to anything.
 * `legal-pages-exist.test.ts` checks they exist, reach the stylesheet, declare
 * their language and name no emergency number in English. Their claims about
 * data were unbound in all five.
 *
 * ## What it binds, and what it cannot
 *
 * Only the six categories a backup carries, because those are the
 * disclosure-relevant ones and the only ones the pages enumerate. A page that
 * fails to name one is a page that under-discloses a stored category, which is
 * the direction that matters: the file can over-explain safely and cannot
 * under-explain safely.
 *
 * It cannot check that a sentence reads well, or that a list is in a sensible
 * order, or that the words are the right words. It checks that each category is
 * named somewhere on each page - which is exactly the "the string appears
 * somewhere" shape this file has twice been caught by. Here that shape is the
 * whole of the available property: the pages are prose, they name categories in
 * words rather than keys, and no rule can tell a complete enumeration from an
 * incomplete one that happens to mention everything elsewhere. So the guard is
 * a floor, not a ceiling, and it is written down as one.
 */
describe('the published pages name every category a backup carries', () => {
  const PAGES = [
    ['tr', 'gizlilik.html'],
    ['tr', 'kvkk.html'],
    ['tr', 'veri-silme.html'],
    ['en', join('en', 'privacy.html')],
    ['en', join('en', 'data-deletion.html')],
  ] as const;

  /**
   * How each category is named in prose, in each language.
   *
   * A complete `Record`, so a seventh category is a compile error here rather
   * than a runtime surprise - the person adding it has to decide what the
   * pages will call it before anything builds.
   *
   * Alternatives where two pages legitimately differ: `kvkk.html` is a legal
   * notice and names the underlying data ("ortalama döngü ve regl süresi",
   * "tahmini doğum tarihi") where the privacy pages name the feature. Both are
   * correct; neither should be forced to copy the other.
   */
  const NAMED_AS: Record<DataCategory, { readonly tr: RegExp; readonly en: RegExp }> = {
    'cycle-settings': {
      tr: /döngü ayarlar|döngü ve regl süresi/i,
      en: /cycle settings/i,
    },
    'period-records': { tr: /regl kayıt/i, en: /period records/i },
    'pregnancy-profile': {
      tr: /gebelik bilgi|tahmini doğum/i,
      en: /pregnancy details/i,
    },
    'avatar-config': { tr: /avatar/i, en: /avatar/i },
    'notification-preferences': {
      tr: /hatırlatıcı tercih/i,
      en: /reminder preferences/i,
    },
    'daily-entries': { tr: /günlük kayıt/i, en: /daily records/i },
  };

  /**
   * Whitespace collapsed before matching.
   *
   * These are hand-written HTML files wrapped at about ninety columns, so a
   * phrase sits across a line break as often as not - and the convention for
   * editing them is to append an item to a list, which rewraps the lines after
   * it. A guard that broke on a rewrap would be a guard that fails on correct
   * content, and this file has already recorded what that teaches people.
   */
  function flattened(relative: string): string {
    return readFileSync(join(DOCS_DIR, relative), 'utf8').replace(/\s+/g, ' ');
  }

  it.each(
    PAGES.flatMap(([language, relative]) =>
      DATA_CATEGORIES.map((category) => [relative, category, language] as const)
    )
  )('%s names %s', (relative, category, language) => {
    const pattern = NAMED_AS[category][language];
    const html = flattened(relative);

    expect([relative, category, pattern.test(html)]).toEqual([relative, category, true]);
  });

  /**
   * The guard that would actually have caught it.
   *
   * The assertions above are a floor: they catch a category removed from a page
   * entirely. The defect was narrower and worse - a page that named every
   * category *somewhere* while one sentence in it, the one people read, listed
   * five of six. Removing `daily-entries` from the "where your data is kept"
   * paragraph leaves it mentioned twice elsewhere, so the floor stays green.
   *
   * So this looks at enumerations rather than at pages. Any block element that
   * names four or more of the categories is a list, and a list that names four
   * or more has to name all of them. Below four it is prose mentioning a couple
   * of examples, which is legitimate and common.
   *
   * Run against the pages as they were before this was written, it flags six of
   * the eight sentences that were wrong - every one on the four pages that
   * enumerate. It is honest about the other two: the Android-backup sentence on
   * each privacy page named three categories and the widget, which is under the
   * threshold. Lowering the threshold to three starts flagging prose.
   *
   * `kvkk.html` is deliberately not here. It is a legal notice built as a table
   * with one data category per row, so its health row names four categories and
   * correctly omits the avatar and the reminder preferences, which have a row of
   * their own. It stays bound by the floor above, which it passes.
   */
  describe('no enumeration leaves a category out', () => {
    /** Four or more named categories is a list rather than an example. */
    const ENUMERATION = 4;

    const ENUMERATING_PAGES = [
      ['tr', 'gizlilik.html'],
      ['tr', 'veri-silme.html'],
      ['en', join('en', 'privacy.html')],
      ['en', join('en', 'data-deletion.html')],
    ] as const;

    /**
     * One block element, one unit.
     *
     * Split on the closing tags rather than on sentence punctuation, because
     * the summary tables on these pages put each category in its own cell with
     * no full stop - and a sentence-based split merged those cells into one
     * apparent list of five, which flagged two correct tables.
     */
    function enumerations(relative: string): readonly string[] {
      return readFileSync(join(DOCS_DIR, relative), 'utf8')
        .split(/<\/(?:li|p|td|th|h1|h2|h3)>/)
        .map((part) =>
          part
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[a-z]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter((part) => part.length > 0);
    }

    it.each(ENUMERATING_PAGES)('%s names all of them wherever it names four', (language, relative) => {
      const incomplete = enumerations(relative)
        .map((part) => ({
          part,
          named: DATA_CATEGORIES.filter((category) => NAMED_AS[category][language].test(part)),
        }))
        .filter(({ named }) => named.length >= ENUMERATION && named.length < DATA_CATEGORIES.length)
        .map(({ part, named }) => ({
          missing: DATA_CATEGORIES.filter((category) => !named.includes(category)),
          // Enough of the text to find it in the file, and no more.
          text: part.slice(0, 120),
        }));

      expect(incomplete).toEqual([]);
    });
  });

  it('covers every page the app links to, so none can be left unbound', () => {
    // The pages here and the pages `legal-pages-exist.test.ts` requires are the
    // same set. A sixth published page would otherwise be able to say anything.
    expect(PAGES.map(([, relative]) => relative.replace(/\\/g, '/')).sort()).toEqual([
      'en/data-deletion.html',
      'en/privacy.html',
      'gizlilik.html',
      'kvkk.html',
      'veri-silme.html',
    ]);
  });
});

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
