import { fireEvent, render } from '@testing-library/react-native';

import { ConnectedLanguagePicker, LanguagePicker } from '@/components/language-picker';
import { appMessages } from '@/shared/presentation/app-messages';

/**
 * The one setting that changes every other screen.
 *
 * Most of this file renders the presentational half rather than the connected
 * one, so those assertions are about what it shows and reports and not about
 * the store. The store's own behaviour - that choosing is written before it is
 * shown, and that it survives every other write - is asserted in
 * `app-store.test.ts`.
 *
 * The connected half gets its own describe at the bottom, for the one thing it
 * does beyond reading the store.
 */

/**
 * The store, down to the two members the connected picker reads.
 *
 * A stable object the factory closes over, not a factory that builds its own
 * spy — and not `jest.resetModules()` either. Resetting the registry around a
 * component hands it a second copy of React, whose dispatcher is null by the
 * time the testing library renders it; the first version of these tests failed
 * on `useReducer` for exactly that reason.
 */
const mockStore = {
  languagePreference: 'system' as const,
  setLanguagePreference: jest.fn(),
};

jest.mock('@/store/app-store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector(mockStore),
}));

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

/**
 * The connected half, and the one thing it does beyond reading the store.
 *
 * `onChanged` is how the settings screen learns to rewrite the widget's
 * snapshot. Without it the card keeps the old language until something
 * unrelated happens to write one, which for somebody who switches and puts the
 * phone down could be days.
 */
describe('ConnectedLanguagePicker', () => {
  beforeEach(() => {
    mockStore.setLanguagePreference.mockReset();
    mockStore.setLanguagePreference.mockResolvedValue(undefined);
  });

  it('writes the choice', async () => {
    const screen = await render(<ConnectedLanguagePicker />);

    await fireEvent.press(screen.getByLabelText('English'));

    expect(mockStore.setLanguagePreference).toHaveBeenCalledWith('en');
  });

  it('tells the caller once the choice is stored', async () => {
    const onChanged = jest.fn();
    const screen = await render(<ConnectedLanguagePicker onChanged={onChanged} />);

    await fireEvent.press(screen.getByLabelText('English'));

    // After the write resolves, so whatever runs in it reads the language that
    // was actually stored rather than racing it.
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('tells nobody when the write failed', async () => {
    mockStore.setLanguagePreference.mockRejectedValue(new Error('storage said no'));

    const onChanged = jest.fn();
    const screen = await render(<ConnectedLanguagePicker onChanged={onChanged} />);

    await fireEvent.press(screen.getByLabelText('English'));

    // Nothing changed, so there is nothing to refresh — and a widget rewritten
    // from a preference that was not stored would be the card disagreeing with
    // the row.
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('works for a caller that does not want telling', async () => {
    const screen = await render(<ConnectedLanguagePicker />);

    await fireEvent.press(screen.getByLabelText('English'));

    expect(mockStore.setLanguagePreference).toHaveBeenCalledTimes(1);
  });
});
