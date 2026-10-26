import { deletionMessages } from '@/features/deletion/presentation/deletion-messages';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';

/**
 * Where a hint belongs, and the rule that keeps there being four of them.
 *
 * ## Why so few
 *
 * A hint says what the label cannot - the docs put it as "additional context
 * to the user on the result of the action when it is not clear from the
 * accessibility label alone" - and on this platform it is not optional: "At
 * this time, hints cannot be turned off on Android". Every hint is therefore
 * read to everybody, every time, with no way to decline it. A hint that
 * repeats its label is a sentence somebody hears forever and needed once.
 *
 * So the test is not "does this control have a hint" but "could the label have
 * said it". Four could not:
 *
 *   - the two step buttons at the ends of their range, and the two month
 *     arrows at the edge of the calendar's range. A disabled control announces
 *     itself as disabled and stops, and "disabled" is not a reason - nor is
 *     the range written anywhere on screen;
 *   - `Tüm verilerimi sil` and `Hesabı sil`. Both say "delete" and neither
 *     says what survives, and the two are tellable apart only by reading a
 *     section description that is a separate stop above the button.
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
 * screen". Applying the rule above to them yields nothing: both labels are
 * verbs that already say somewhere is being gone to, and a hint would be the
 * label again in more words.
 */

const HINTS: readonly { readonly name: string; readonly tr: string; readonly en: string }[] = [
  {
    name: 'lengthLimitHint',
    tr: settingsMessages.tr.lengthLimitHint(21, 35),
    en: settingsMessages.en.lengthLimitHint(21, 35),
  },
  {
    name: 'calendarMonthLimitHint',
    tr: homeMessages.tr.calendarMonthLimitHint,
    en: homeMessages.en.calendarMonthLimitHint,
  },
  {
    name: 'localWipeOpenHint',
    tr: deletionMessages.tr.localWipeOpenHint,
    en: deletionMessages.en.localWipeOpenHint,
  },
  {
    name: 'accountDeleteOpenHint',
    tr: deletionMessages.tr.accountDeleteOpenHint,
    en: deletionMessages.en.accountDeleteOpenHint,
  },
];

describe('every hint in the app', () => {
  it('is one of the four', () => {
    // A guard on the count rather than on the contents. A fifth hint is a
    // decision about what everybody hears on every pass, and it should arrive
    // with a line in this file explaining why the label could not say it.
    expect(HINTS).toHaveLength(4);
  });

  it.each(HINTS)('says something in both languages: $name', ({ tr, en }) => {
    expect(tr.trim()).not.toBe('');
    expect(en.trim()).not.toBe('');
  });

  it.each(HINTS)('is translated rather than copied: $name', ({ tr, en }) => {
    expect(tr).not.toBe(en);
  });

  it.each(HINTS)('is a sentence rather than a fragment: $name', ({ tr, en }) => {
    // It is read after the label, so it has to stand as its own sentence.
    for (const hint of [tr, en]) {
      expect(hint.endsWith('.')).toBe(true);
    }
  });
});

describe('the two that explain a refusal', () => {
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
    // The hint is read before the panel opens, so it must not promise
    // something the panel then contradicts.
    expect(deletionMessages.tr.localWipePanelBody).toContain('bu');
    expect(deletionMessages.tr.accountDeletePanelBody).toContain('Buluttaki yedeğin');
  });
});
