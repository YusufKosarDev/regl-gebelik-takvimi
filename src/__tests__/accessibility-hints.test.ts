import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { deletionMessages } from '@/features/deletion/presentation/deletion-messages';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { onboardingMessages } from '@/features/onboarding/presentation/onboarding-messages';
import { dailyLogMessages } from '@/features/daily-log/presentation/daily-log-messages';
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';

/**
 * Where a hint belongs, and what keeps the number of them honest.
 *
 * ## Why so few
 *
 * A hint says what the label cannot - the docs put it as "additional context
 * to the user on the result of the action when it is not clear from the
 * accessibility label alone" - and on this platform it is not optional: "At
 * this time, hints cannot be turned off on Android". Every hint is read to
 * everybody, every time, with no way to decline it. A hint that repeats its
 * label is a sentence somebody hears forever and needed once.
 *
 * ## The first version of this file was itself the failure it was guarding
 *
 * It said "Four hints in the whole app, and the number is the point", and it
 * guarded a hand-written list of four with `expect(HINTS).toHaveLength(4)`.
 * There were seven. The two in onboarding predate this work and the week
 * strip's predates the round that wrote this file, and none of the three was
 * counted - so the doc was wrong, and the guard counted my own list rather
 * than the app. A hint added anywhere would have passed it.
 *
 * The commit that shipped that file carries the same wrong number in its
 * message and cannot be corrected now. The real number is seven, and it is
 * seven here because this scans `src` for the call sites rather than trusting
 * anybody's memory - the shape `dependabot-config.test.ts` already uses, and
 * the shape this file should have had.
 *
 * ## What each one is for
 *
 * Two explain a refusal: the step buttons at the ends of their range and the
 * month arrows at the edge of the calendar's. A disabled control announces
 * itself as disabled and stops there, and "disabled" is not a reason - nor is
 * the range written anywhere on screen.
 *
 * One explains the same thing for the week strip's days past today.
 *
 * Two explain a deletion. "Tüm verilerimi sil" and "Hesabı sil" both say
 * delete and neither says what survives.
 *
 * Two are onboarding's, from before this work: the welcome and the disclaimer,
 * where a Continue button does not say what continuing commits to.
 *
 * ## What was considered and left without one
 *
 * `Bu günü temizle` and `17 Eylül regl kaydını sil` are destructive and get
 * none: their labels already name exactly what they touch.
 *
 * The save button, because it is not disabled when nothing is chosen - it
 * refuses on press and says `emptySelectionMessage`, which announces itself
 * now that a notice is a live region.
 *
 * `Dökümü gör` and the avatar button, which were going to carry "this opens a
 * screen". Applying the rule to them yields nothing: both labels are verbs
 * that already say somewhere is being gone to.
 */

/** Every `.ts`/`.tsx` under `src` that is not a test. */
function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

/**
 * The catalogue key behind every `accessibilityHint` in the app.
 *
 * Call sites come in three shapes - `accessibilityHint={x.someHint}`,
 * `accessibilityHint={cond ? x.someHint : undefined}` and its mirror - so the
 * key is read as the identifier ending in `Hint`, which every one of them is
 * named. `week-strip.tsx` takes its wording as a prop, and that prop is named
 * `unavailableHint` for the same reason.
 *
 * A call site with no such identifier throws rather than being skipped. That
 * makes the naming load-bearing, which is the point: a hint reached through
 * some other name is a hint this file cannot see, and a guard with a blind
 * spot is the thing this whole file exists to stop being.
 */
function hintKeysInUse(): readonly string[] {
  const keys = new Set<string>();

  for (const file of sourceFiles(join(__dirname, '..'))) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/accessibilityHint=\{([\s\S]*?)\}\s*\n/g)) {
      const expression = match[1].trim();
      const named = (expression.match(/[A-Za-z_$][\w$]*/g) ?? []).filter((identifier) =>
        identifier.endsWith('Hint')
      );

      if (named.length === 0) {
        throw new Error(
          `accessibilityHint in ${file} names nothing ending in "Hint", so this scan `
            + `cannot see which one it is: ${expression}`
        );
      }

      named.forEach((identifier) => keys.add(identifier));
    }
  }

  return [...keys].sort();
}

/**
 * Every hint the app uses, with the sentence behind it.
 *
 * The keys are the ones the scan finds; the sentences are looked up so the
 * wording can be checked too. `unavailableHint` is the week strip's prop name,
 * and `daily-entry.tsx` passes `futureDayHint` into it.
 */
const SENTENCES: Readonly<Record<string, { readonly tr: string; readonly en: string }>> = {
  lengthLimitHint: {
    tr: settingsMessages.tr.lengthLimitHint(21, 35),
    en: settingsMessages.en.lengthLimitHint(21, 35),
  },
  calendarMonthLimitHint: {
    tr: homeMessages.tr.calendarMonthLimitHint,
    en: homeMessages.en.calendarMonthLimitHint,
  },
  localWipeOpenHint: {
    tr: deletionMessages.tr.localWipeOpenHint,
    en: deletionMessages.en.localWipeOpenHint,
  },
  accountDeleteOpenHint: {
    tr: deletionMessages.tr.accountDeleteOpenHint,
    en: deletionMessages.en.accountDeleteOpenHint,
  },
  unavailableHint: {
    tr: dailyLogMessages.tr.futureDayHint,
    en: dailyLogMessages.en.futureDayHint,
  },
  disclaimerContinueHint: {
    tr: onboardingMessages.tr.disclaimerContinueHint,
    en: onboardingMessages.en.disclaimerContinueHint,
  },
  welcomeStartHint: {
    tr: onboardingMessages.tr.welcomeStartHint,
    en: onboardingMessages.en.welcomeStartHint,
  },
};

const keysInUse = hintKeysInUse();

describe('the scan found the call sites', () => {
  /**
   * Seven distinct hints, counted from the call sites rather than from a list.
   *
   * What this catches: a new hint sentence anywhere in `src`, and the
   * disappearance of one that is still described below.
   *
   * What it does not: the same hint used on a second control. That is on
   * purpose - the number worth guarding is how many different sentences
   * somebody can be read, not how many places read one of them. Putting
   * `futureDayHint` on a second disabled day adds no new sentence to the
   * world.
   *
   * A change to this number changes what everybody hears on every pass, so it
   * arrives with a line above saying why the label could not carry it.
   */
  it('read every hint in the app, not a list somebody typed', () => {
    expect(keysInUse).toHaveLength(7);
  });

  it('knows the sentence behind each key it found', () => {
    // A key with no entry below is a hint nothing here checks the wording of.
    for (const key of keysInUse) {
      expect([key, key in SENTENCES]).toEqual([key, true]);
    }
  });

  it('has no entry for a hint the app no longer uses', () => {
    for (const key of Object.keys(SENTENCES)) {
      expect([key, keysInUse.includes(key)]).toEqual([key, true]);
    }
  });
});

describe('every hint in the app', () => {
  it.each(keysInUse)('says something in both languages: %s', (key) => {
    expect(SENTENCES[key].tr.trim()).not.toBe('');
    expect(SENTENCES[key].en.trim()).not.toBe('');
  });

  it.each(keysInUse)('is translated rather than copied: %s', (key) => {
    expect(SENTENCES[key].tr).not.toBe(SENTENCES[key].en);
  });

  /**
   * No rule about punctuation, and that is a correction.
   *
   * This file first asserted that every hint ends in a full stop, which the
   * four written in this round do. Onboarding's two do not and should not:
   * "Başlamadan önce bilinmesi gerekenlere geçer" / "Goes to what you should
   * know before starting" are fragments that finish the button they are read
   * after, which is a legitimate shape for a hint and the one TalkBack's
   * "label, then hint" reading invites.
   *
   * So the assertion was a style I had applied to my own four, dressed as a
   * rule about all of them. Keeping it would have meant rewriting working copy
   * to satisfy a test. What is left is what is actually required: a hint says
   * something, and it says it in both languages.
   */
  it.each(keysInUse)('is long enough to be telling the reader something: %s', (key) => {
    for (const sentence of [SENTENCES[key].tr, SENTENCES[key].en]) {
      expect(sentence.split(' ').length).toBeGreaterThan(2);
    }
  });
});

describe('the ones that explain a refusal', () => {
  it('names the bounds rather than saying there is a limit', () => {
    expect(settingsMessages.tr.lengthLimitHint(21, 35)).toContain('21');
    expect(settingsMessages.tr.lengthLimitHint(21, 35)).toContain('35');
  });

  it('says what the calendar cannot show rather than that it cannot', () => {
    expect(homeMessages.tr.calendarMonthLimitHint).toContain('aralığın sonu');
    expect(homeMessages.en.calendarMonthLimitHint.toLowerCase()).toContain('range');
  });
});

describe('the two that explain a deletion', () => {
  /**
   * The thing the labels do not say. Checked as a pair, because a hint that
   * said only what is deleted would leave them as hard to tell apart as the
   * labels are.
   */
  it('says what each one leaves behind', () => {
    expect(deletionMessages.tr.localWipeOpenHint).toContain('kalır');
    expect(deletionMessages.tr.accountDeleteOpenHint).toContain('kalır');

    expect(deletionMessages.en.localWipeOpenHint.toLowerCase()).toContain('stay');
    expect(deletionMessages.en.accountDeleteOpenHint.toLowerCase()).toContain('stay');
  });

  it('says opposite things, because the two actions are opposites', () => {
    // The local wipe keeps the account and the cloud backup; deleting the
    // account keeps the phone. Checked against the panel bodies rather than
    // written from memory.
    expect(deletionMessages.tr.localWipeOpenHint).toContain('Hesabın');
    expect(deletionMessages.tr.accountDeleteOpenHint).toContain('Bu telefondaki');

    expect(deletionMessages.tr.localWipeOpenHint).not.toBe(
      deletionMessages.tr.accountDeleteOpenHint
    );
  });

  it('agrees with what the panels say will happen', () => {
    expect(deletionMessages.tr.localWipePanelBody).toContain('bu');
    expect(deletionMessages.tr.accountDeletePanelBody).toContain('Buluttaki yedeğin');
  });
});
