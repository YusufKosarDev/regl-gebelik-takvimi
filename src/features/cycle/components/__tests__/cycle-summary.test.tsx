import { render } from '@testing-library/react-native';

import { CycleSummary } from '../cycle-summary';

import { homeMessages } from '@/features/cycle/presentation/home-messages';

/**
 * The rows at the top of the home screen, as a screen reader hears them.
 *
 * ## Why this file exists
 *
 * The component had no test, and it was making a promise in prose that the code
 * did not keep. Its own doc block said the note under a row "is still read as
 * part of the same accessible label, so the fertility estimate and the warning
 * about it are one thing to a screen reader", and `SummaryRow`'s doc said the
 * note "travels with the row rather than being placed near it, so the number
 * and the warning about it cannot be separated".
 *
 * Both were false. `Surface` was given `accessible`, which collapses the whole
 * row into one node, and the label handed to it was `labelledValue(label,
 * value)` - which has no note in it. So the visible text was there for anybody
 * who could see it and silently absent for anybody who could not, and the
 * absent sentence was the one saying the estimate must not be used as
 * contraception.
 *
 * `home-messages-parity.test.ts` already asserted that the row *model* carries
 * the note. Nothing asserted that it is spoken, which is the gap a prose
 * promise leaves and a test does not.
 */

const tr = homeMessages.tr;

/** The real fertility row, with the real disclaimer travelling on it. */
const fertilityRow = {
  label: tr.rowFertility,
  value: 'Yüksek',
  note: tr.fertilityDisclaimer,
};

describe('a row that carries a note', () => {
  it('speaks the note as part of the row', async () => {
    const { getByLabelText } = await render(<CycleSummary rows={[fertilityRow]} />);

    expect(
      getByLabelText(tr.labelledValueWithNote(tr.rowFertility, 'Yüksek', tr.fertilityDisclaimer))
    ).toBeTruthy();
  });

  /**
   * Stated against the sentence itself rather than only against the builder.
   *
   * The builder could be changed to drop the note and the assertion above would
   * follow it. This one names the thing that must be audible: a fertility
   * estimate and the words "gebelikten korunma yöntemi olarak
   * kullanılmamalıdır" reach a screen reader together or the row is a reading
   * of somebody's fertility with the caveat removed.
   */
  it('includes the contraception warning in what is spoken', async () => {
    const { getByLabelText } = await render(<CycleSummary rows={[fertilityRow]} />);

    const spoken = getByLabelText(
      tr.labelledValueWithNote(tr.rowFertility, 'Yüksek', tr.fertilityDisclaimer)
    ).props.accessibilityLabel as string;

    expect(spoken).toContain('Yüksek');
    expect(spoken).toContain('gebelikten korunma yöntemi olarak kullanılmamalıdır');
  });

  it('says the value before the caveat about it', async () => {
    const { getByLabelText } = await render(<CycleSummary rows={[fertilityRow]} />);

    const spoken = getByLabelText(
      tr.labelledValueWithNote(tr.rowFertility, 'Yüksek', tr.fertilityDisclaimer)
    ).props.accessibilityLabel as string;

    // The row answers the question first and qualifies it second, which is the
    // order the eye reads it in.
    expect(spoken.indexOf('Yüksek')).toBeLessThan(spoken.indexOf(tr.fertilityDisclaimer));
  });

  it('still shows the note on screen', async () => {
    // The fix is about what is spoken. The visible sentence was never the
    // problem and must not become one.
    const { getByText } = await render(<CycleSummary rows={[fertilityRow]} />);

    expect(getByText(tr.fertilityDisclaimer)).toBeTruthy();
  });
});

describe('a row with no note', () => {
  it('is spoken as label and value, with nothing appended', async () => {
    const { getByLabelText } = await render(
      <CycleSummary rows={[{ label: tr.rowCycleDay, value: '14' }]} />
    );

    expect(getByLabelText(tr.labelledValue(tr.rowCycleDay, '14'))).toBeTruthy();
  });

  it('does not leave a dangling separator where the note would be', async () => {
    const { getByLabelText } = await render(
      <CycleSummary rows={[{ label: tr.rowCycleDay, value: '14' }]} />
    );

    const spoken = getByLabelText(tr.labelledValue(tr.rowCycleDay, '14')).props
      .accessibilityLabel as string;

    expect(spoken.trimEnd()).toBe(spoken);
    expect(spoken.endsWith('.')).toBe(false);
  });
});

describe('every row is one stop', () => {
  /**
   * The reason `accessible` is on the surface in the first place: a label and a
   * value read as two separate stops is a row somebody has to assemble in their
   * head. That stays true - what changed is only what the one stop says.
   */
  it('collapses each row into a single node', async () => {
    const { getByLabelText } = await render(
      <CycleSummary
        rows={[{ label: tr.rowCycleDay, value: '14' }, fertilityRow]}
      />
    );

    for (const label of [
      tr.labelledValue(tr.rowCycleDay, '14'),
      tr.labelledValueWithNote(tr.rowFertility, 'Yüksek', tr.fertilityDisclaimer),
    ]) {
      expect(getByLabelText(label).props.accessible).toBe(true);
    }
  });
});
