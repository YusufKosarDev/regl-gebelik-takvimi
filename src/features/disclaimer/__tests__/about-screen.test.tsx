import { fireEvent, render } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import AboutScreen from '@/app/(app)/about';
import { getAppVersion } from '@/features/disclaimer/infrastructure/app-version';
import {
  ABOUT_APP_NAME,
  ABOUT_IMPORTANT_PARAGRAPHS,
  ABOUT_IMPORTANT_SECTION_TITLE,
  ABOUT_SCREEN_TITLE,
  ABOUT_VERSION_UNKNOWN,
} from '@/features/disclaimer/presentation/disclaimer-messages';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const useRouterMock = useRouter as unknown as jest.Mock;
const constants = Constants as unknown as { expoConfig: { version?: unknown } | null };

let back: jest.Mock;

beforeEach(() => {
  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  constants.expoConfig = { version: '1.0.0' };
});

describe('reading the version', () => {
  it('takes it from the embedded config, which is what ships', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/1\.0\.0/)).toBeTruthy();
  });

  it('follows the config rather than a second copy of the number', () => {
    constants.expoConfig = { version: '2.4.1' };

    expect(getAppVersion()).toBe('2.4.1');
  });

  it('says so when there is no config at all', () => {
    // Somebody reading this screen is often about to report a problem, and
    // "Bilinmiyor" is at least an answer.
    (constants as { expoConfig: unknown }).expoConfig = null;

    expect(getAppVersion()).toBe(ABOUT_VERSION_UNKNOWN);
  });

  it('says so when the config carries no version', () => {
    constants.expoConfig = {};

    expect(getAppVersion()).toBe(ABOUT_VERSION_UNKNOWN);
  });

  it('treats a blank version as no version', () => {
    constants.expoConfig = { version: '   ' };

    expect(getAppVersion()).toBe(ABOUT_VERSION_UNKNOWN);
  });

  it('treats a non-string version as no version', () => {
    constants.expoConfig = { version: 3 };

    expect(getAppVersion()).toBe(ABOUT_VERSION_UNKNOWN);
  });

  it('renders without a version rather than failing', async () => {
    (constants as { expoConfig: unknown }).expoConfig = null;

    const screen = await render(<AboutScreen />);

    expect(screen.getByText(new RegExp(ABOUT_VERSION_UNKNOWN))).toBeTruthy();
  });
});

describe('what the screen says', () => {
  it('names itself and the app', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(ABOUT_SCREEN_TITLE)).toBeTruthy();
    expect(screen.getByText(ABOUT_APP_NAME)).toBeTruthy();
  });

  it('carries the important section', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(ABOUT_IMPORTANT_SECTION_TITLE)).toBeTruthy();
  });

  it.each(ABOUT_IMPORTANT_PARAGRAPHS.map((text, index) => [index, text]))(
    'shows paragraph %i word for word',
    async (_index, paragraph) => {
      const screen = await render(<AboutScreen />);

      expect(screen.getByText(paragraph as string)).toBeTruthy();
    }
  );

  it('says the estimates are not certain', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/bu tahminler kesin değildir/)).toBeTruthy();
  });

  it('says it is not a contraceptive method', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/Uygulama bir doğum kontrol yöntemi değildir/)).toBeTruthy();
  });

  it('tells somebody not to skip their check-ups, and gives 112', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/düzenli doktor kontrollerini aksatma/)).toBeTruthy();
    expect(screen.getByText(/112'yi ara/)).toBeTruthy();
  });
});

describe('headings and navigation', () => {
  it('marks both headings as headings', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByRole('header', { name: ABOUT_SCREEN_TITLE })).toBeTruthy();
    expect(screen.getByRole('header', { name: ABOUT_IMPORTANT_SECTION_TITLE })).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('links that do not exist yet', () => {
  it('shows no link at all rather than a placeholder', async () => {
    // A row that says "yakında" or opens nothing is worse than no row:
    // somebody looking for a privacy policy has a reason to be looking.
    const screen = await render(<AboutScreen />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('promises nothing it cannot open', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.queryByText(/Gizlilik politikası/)).toBeNull();
    expect(screen.queryByText(/Hesap silme talebi/)).toBeNull();
    expect(screen.queryByText(/yakında/i)).toBeNull();
  });
});
