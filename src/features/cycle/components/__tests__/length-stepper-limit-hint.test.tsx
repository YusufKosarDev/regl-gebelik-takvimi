import { render } from '@testing-library/react-native';

import { LengthStepper } from '../length-stepper';

import { settingsMessages } from '@/features/cycle/presentation/settings-messages';

/**
 * Why a step button will not take a press.
 *
 * ## The rule, and why it is kept small
 *
 * A hint says what the label cannot: the docs put it as "additional context to
 * the user on the result of the action when it is not clear from the
 * accessibility label alone". And on this platform it is not optional - "At
 * this time, hints cannot be turned off on Android" - so every hint is read to
 * everyone, every time, with no way to decline it. A hint that repeats the
 * label is a sentence the person hears forever and never needed once.
 *
 * Which is why there are four in the whole app rather than forty, and why two
 * of them are here and at the calendar's month arrows: a disabled control
 * announces itself as disabled and then stops, and "disabled" is not a reason.
 * At the end of a range there is nothing on screen that says where the range
 * ends.
 *
 * `Bu günü temizle` and `17 Eylül regl kaydını sil` get no hint, though both
 * are destructive: their labels already name exactly what they touch. The two
 * that do get one are `Tüm verilerimi sil` and `Hesabı sil`, where the label
 * says "delete" and nothing says what survives.
 */

const tr = settingsMessages.tr;

function renderStepper(value: number) {
  return render(
    <LengthStepper
      label={tr.cycleLengthFieldLabel}
      note={tr.cycleLengthFieldNote}
      value={value}
      min={21}
      max={35}
      decreaseLabel={tr.cycleLengthDecreaseLabel}
      increaseLabel={tr.cycleLengthIncreaseLabel}
      onChange={() => {}}
      disabled={false}
    />
  );
}

describe('at the bottom of the range', () => {
  it('says what the range is, on the button that will not move', async () => {
    const { getByLabelText } = await renderStepper(21);

    expect(getByLabelText(tr.cycleLengthDecreaseLabel).props.accessibilityHint).toBe(
      tr.lengthLimitHint(21, 35)
    );
  });

  it('leaves the button that still works without one', async () => {
    // The hint is about a refusal. On a button that works it would be a
    // sentence read out on every pass for no reason.
    const { getByLabelText } = await renderStepper(21);

    expect(getByLabelText(tr.cycleLengthIncreaseLabel).props.accessibilityHint).toBeUndefined();
  });
});

describe('at the top of the range', () => {
  it('says what the range is, on the button that will not move', async () => {
    const { getByLabelText } = await renderStepper(35);

    expect(getByLabelText(tr.cycleLengthIncreaseLabel).props.accessibilityHint).toBe(
      tr.lengthLimitHint(21, 35)
    );
  });

  it('leaves the other one alone', async () => {
    const { getByLabelText } = await renderStepper(35);

    expect(getByLabelText(tr.cycleLengthDecreaseLabel).props.accessibilityHint).toBeUndefined();
  });
});

describe('in the middle of the range', () => {
  it('puts no hint on either button', async () => {
    const { getByLabelText } = await renderStepper(28);

    for (const label of [tr.cycleLengthDecreaseLabel, tr.cycleLengthIncreaseLabel]) {
      expect([label, getByLabelText(label).props.accessibilityHint]).toEqual([label, undefined]);
    }
  });
});

describe('the hint itself', () => {
  it('names the real bounds rather than saying there is a limit', () => {
    // "You are at the limit" leaves somebody to find the other end by
    // pressing. The numbers are already on the component.
    expect(tr.lengthLimitHint(21, 35)).toContain('21');
    expect(tr.lengthLimitHint(21, 35)).toContain('35');
  });

  it('is said in English for an English reader', () => {
    expect(settingsMessages.en.lengthLimitHint(21, 35)).toContain('21');
    expect(settingsMessages.en.lengthLimitHint(21, 35)).not.toBe(tr.lengthLimitHint(21, 35));
  });
});
