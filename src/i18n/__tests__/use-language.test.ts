import { renderHook } from '@testing-library/react-native';

import { useAppStore } from '@/store/app-store';

import { useLanguage, useMessages } from '../use-language';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
  getCalendars: jest.fn(),
}));

const localization = jest.requireMock('expo-localization');

beforeEach(() => {
  localization.getLocales.mockReset();
  localization.getLocales.mockReturnValue([{ languageCode: 'tr' }]);
  localization.getCalendars.mockReset();
  localization.getCalendars.mockReturnValue([{}]);
});

const messages = {
  tr: { greeting: 'Merhaba', count: (n: number) => `${n} kayıt` },
  en: { greeting: 'Hello', count: (n: number) => `${n} records` },
};

describe('useLanguage', () => {
  it('follows a Turkish phone', async () => {
    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('tr');
  });

  it('follows a phone set to anything else', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'de' }]);

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('en');
  });

  /**
   * A device that says nothing reads as the source language.
   *
   * This is not what `jest-expo` provides — it supplies a complete `en-US`
   * device, which `jest-environment-language.test.ts` records and explains.
   * This case is for a real phone whose locale cannot be read.
   */
  it('shows Turkish when there is no device to ask', async () => {
    localization.getLocales.mockReturnValue([]);

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('tr');
  });

  it('needs no provider above it', async () => {
    // A bare hook like useTheme: nothing to forget to wrap a tree in, and no
    // way for one subtree to disagree with another.
    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBeDefined();
  });
});

describe('useMessages', () => {
  it('picks the Turkish catalogue on a Turkish phone', async () => {
    const { result } = await renderHook(() => useMessages(messages));

    expect(result.current.greeting).toBe('Merhaba');
  });

  it('picks the English catalogue otherwise', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'en' }]);

    const { result } = await renderHook(() => useMessages(messages));

    expect(result.current.greeting).toBe('Hello');
  });

  it('returns functions, not only strings', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'en' }]);

    const { result } = await renderHook(() => useMessages(messages));

    expect(result.current.count(3)).toBe('3 records');
  });

  it('hands back the catalogue itself rather than a copy', async () => {
    // Nothing is rebuilt per render: the pair is a module constant and this
    // picks one side of it.
    const { result } = await renderHook(() => useMessages(messages));

    expect(result.current).toBe(messages.tr);
  });
});

/**
 * The stored preference, now that there is one.
 *
 * `useLanguage()` used to ignore what somebody chose and follow the phone. It
 * reads the app store now, so these assertions are about the two of them
 * disagreeing - which is the whole reason the preference is stored one value
 * wider than the language that gets shown.
 */
describe('useLanguage, against the stored preference', () => {
  afterEach(() => {
    useAppStore.setState({ languagePreference: 'system' });
  });

  it('shows Turkish on an English phone when Turkish was chosen', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'en' }]);
    useAppStore.setState({ languagePreference: 'tr' });

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('tr');
  });

  it('shows English on a Turkish phone when English was chosen', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'tr' }]);
    useAppStore.setState({ languagePreference: 'en' });

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('en');
  });

  it('follows the phone while the preference is system', async () => {
    localization.getLocales.mockReturnValue([{ languageCode: 'de' }]);
    useAppStore.setState({ languagePreference: 'system' });

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('en');
  });

  it('follows the phone before the store has been hydrated', async () => {
    // The store starts at 'system', so a render that somehow beat the read
    // shows what the phone asked for rather than guessing a language.
    localization.getLocales.mockReturnValue([{ languageCode: 'tr' }]);
    useAppStore.setState({ languagePreference: 'system', hydrated: false });

    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('tr');
  });
});
