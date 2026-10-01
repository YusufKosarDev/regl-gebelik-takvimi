import { fireEvent, render } from '@testing-library/react-native';

import { LanguagePicker } from '@/components/language-picker';
import { appMessages } from '@/shared/presentation/app-messages';

/**
 * The one setting that changes every other screen.
 *
 * The presentational half is rendered here rather than the connected one, so
 * these assertions are about what it shows and reports and not about the store.
 * The store's own behaviour - that choosing is written before it is shown, and
 * that it survives every other write - is asserted in `app-store.test.ts`.
 */

describe('LanguagePicker', () => {
  it('offers all three choices', async () => {
    const screen = await render(<LanguagePicker preference="system" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Türkçe')).toBeTruthy();
    expect(screen.getByLabelText('English')).toBeTruthy();
    expect(screen.getByLabelText(appMessages.tr.languageSystemLabel)).toBeTruthy();
  });

  it('names the two languages in their own language, whatever the app is in', async () => {
    // The person most likely to open this setting is somebody who has landed in
    // a language they cannot read. A translated list would be a list of words
    // they cannot match to anything.
    const screen = await render(<LanguagePicker preference="en" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Türkçe')).toBeTruthy();
    expect(screen.getByLabelText('English')).toBeTruthy();
  });

  it('marks the chosen one as selected and the others as not', async () => {
    const screen = await render(<LanguagePicker preference="en" onChange={jest.fn()} />);

    expect(screen.getByLabelText('English').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Türkçe').props.accessibilityState.selected).toBe(false);
  });

  it('reports a choice rather than acting on it', async () => {
    const onChange = jest.fn();
    const screen = await render(<LanguagePicker preference="system" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('English'));

    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('offers system as its own choice rather than as a resolved language', async () => {
    // "Follow the phone" and "Turkish" produce the same interface on a Turkish
    // phone and different ones on the next. Somebody who picked the first did
    // not pick the second.
    const onChange = jest.fn();
    const screen = await render(<LanguagePicker preference="tr" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText(appMessages.tr.languageSystemLabel));

    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('uses radios, so a screen reader can say which one is in force', async () => {
    // Three buttons would say nothing about which is chosen.
    const screen = await render(<LanguagePicker preference="system" onChange={jest.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});
