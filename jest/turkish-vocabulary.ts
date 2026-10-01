import type { Messages } from '@/i18n';

import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { authMessages } from '@/features/auth/presentation/auth-messages';
import { avatarCatalogue } from '@/features/avatar/data/avatar-catalog';
import { avatarLabels } from '@/features/avatar/presentation/avatar-labels';
import { restoreLabels } from '@/features/backup/presentation/restore-labels';
import { cycleDailySupport } from '@/features/cycle/data/cycle-daily-support';
import { cycleLabels } from '@/features/cycle/presentation/cycle-labels';
import { historyMessages } from '@/features/cycle/presentation/history-messages';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';
import { dailyLogCatalogueLabels } from '@/features/daily-log/presentation/daily-log-catalogues';
import { dailyLogMessages } from '@/features/daily-log/presentation/daily-log-messages';
import { deletionMessages } from '@/features/deletion/presentation/deletion-messages';
import { disclaimerMessages } from '@/features/disclaimer/presentation/disclaimer-messages';
import { reminderMessages } from '@/features/notifications/presentation/reminder-messages';
import { onboardingMessages } from '@/features/onboarding/presentation/onboarding-messages';
import { pregnancyWeeklyContent } from '@/features/pregnancy/data/pregnancy-weekly-content';
import { pregnancyLabels } from '@/features/pregnancy/presentation/pregnancy-labels';
import { conflictLabels } from '@/features/sync/presentation/conflict-labels';
import { syncMessages } from '@/features/sync/presentation/sync-messages';
import { appMessages } from '@/shared/presentation/app-messages';

/**
 * Every Turkish string the interface can say, that English says differently.
 *
 * ## What this is for
 *
 * `jest/expo-localization-mock.js` pins the whole suite to a Turkish device, so
 * a screen that ignores `useMessages()` renders correctly in every test and
 * looks right in Turkish. Two bugs of exactly that shape reached the shipped
 * app and both were found on a phone rather than by a test: a pregnancy week
 * that read "9. hafta" under an English heading, and a delete button that read
 * "Sil" in English.
 *
 * `no-turkish-outside-catalogues` is the guard against Turkish being *typed
 * into* a screen. This is the guard against a screen reading the *wrong half*
 * of a real catalogue - which the lint rule cannot see, because the string is
 * in a catalogue exactly where it belongs.
 *
 * ## Why only strings whose halves differ
 *
 * A pair that says the same thing in both languages is not evidence of
 * anything. "Türkçe" and "English" are deliberately identical; so is a
 * separator, a URL, a citation. Including them would fail an English render for
 * showing the English value, which is absurd. So the set holds `tr` values
 * only where `en` says something else - the same test `describeCatalogueParity`
 * makes, used here for the opposite purpose.
 *
 * ## What it cannot catch, stated so nobody trusts it too far
 *
 * Function-valued keys are skipped. A sentence assembled at call time has no
 * value to collect without inventing arguments, and inventing them would
 * produce strings no screen ever renders. `describeCatalogueParity` already
 * calls every function and checks its return for Turkish letters; the ASCII
 * case there is covered by the lint rule's marker list, not by this.
 */

/** Collected once. Twenty-one catalogues walked per test file would be waste. */
let cached: ReadonlySet<string> | null = null;

/**
 * Every catalogue pair in the app.
 *
 * Listed by hand rather than discovered by globbing the filesystem: a glob that
 * silently stops matching is a sweep that silently stops sweeping, and this
 * file is only worth having if its coverage is the kind you can read.
 *
 * `avatar-catalog`, `cycle-daily-support` and `pregnancy-weekly-content` live
 * in `data/` rather than `presentation/` but are catalogue pairs all the same -
 * they are three of the four entries on the lint rule's allow-list for that
 * reason, and their Turkish reaches the screen like any other.
 */
const CATALOGUES: readonly Messages<unknown>[] = [
  appLockMessages,
  appMessages,
  authMessages,
  avatarCatalogue,
  avatarLabels,
  conflictLabels,
  cycleDailySupport,
  cycleLabels,
  dailyLogCatalogueLabels,
  dailyLogMessages,
  deletionMessages,
  disclaimerMessages,
  historyMessages,
  homeMessages,
  onboardingMessages,
  pregnancyLabels,
  pregnancyWeeklyContent,
  reminderMessages,
  restoreLabels,
  settingsMessages,
  syncMessages,
];

/**
 * Walks the two halves together, collecting Turkish that English disagrees with.
 *
 * In step rather than separately, because "differs from its counterpart" is a
 * question about a pair of positions, not about two bags of strings. Arrays are
 * walked by index and objects by key for the same reason; the parity test has
 * already proved both halves have the same shape, so a mismatch here would mean
 * that test is broken, and the walk simply stops at the shallower side.
 */
function collect(tr: unknown, en: unknown, into: Set<string>): void {
  if (typeof tr === 'string') {
    if (typeof en === 'string' && en !== tr && tr.trim() !== '') {
      into.add(tr);
    }

    return;
  }

  if (Array.isArray(tr) && Array.isArray(en)) {
    for (let index = 0; index < Math.min(tr.length, en.length); index += 1) {
      collect(tr[index], en[index], into);
    }

    return;
  }

  // Functions, numbers and booleans fall through: see the note at the top about
  // what this cannot catch.
  if (typeof tr === 'object' && tr !== null && typeof en === 'object' && en !== null) {
    for (const key of Object.keys(tr)) {
      collect(
        (tr as Record<string, unknown>)[key],
        (en as Record<string, unknown>)[key],
        into
      );
    }
  }
}

/** Every Turkish-only string in the app's catalogues. */
export function turkishOnlyStrings(): ReadonlySet<string> {
  if (cached !== null) {
    return cached;
  }

  const found = new Set<string>();

  for (const catalogue of CATALOGUES) {
    collect(catalogue.tr, catalogue.en, found);
  }

  cached = found;

  return found;
}
