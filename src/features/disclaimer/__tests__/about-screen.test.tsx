import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import AboutScreen from '@/app/(app)/about';
import {
  LEGAL_BASE_URL,
  SUPPORT_EMAIL,
  legalPageUrl,
  supportMailtoUrl,
} from '@/features/disclaimer/domain/legal-links';
import { getAppVersion } from '@/features/disclaimer/infrastructure/app-version';
import {
  ABOUT_APP_NAME,
  ABOUT_IMPORTANT_PARAGRAPHS,
  ABOUT_IMPORTANT_SECTION_TITLE,
  ABOUT_SCREEN_TITLE,
  ABOUT_TRANSFER_PARAGRAPH,
  ABOUT_TRANSFER_SECTION_TITLE,
  ABOUT_DELETION_LABEL,
  ABOUT_KVKK_LABEL,
  ABOUT_PRIVACY_LABEL,
  ABOUT_VERSION_UNKNOWN,
  aboutSupportLabel,
  linkOpenFailedMessage,
  mailOpenFailedMessage,
} from '@/features/disclaimer/presentation/disclaimer-messages';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

// React Native's own, so the links need no new dependency — spied rather than
// module-mocked, since there is no browser or mail app under Jest.
const openURLMock = jest.spyOn(Linking, 'openURL');

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

  openURLMock.mockReset();
  openURLMock.mockResolvedValue(undefined);
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

describe('what happens when the phone changes', () => {
  it('says so under its own heading', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByRole('header', { name: ABOUT_TRANSFER_SECTION_TITLE })).toBeTruthy();
    expect(screen.getByText(ABOUT_TRANSFER_PARAGRAPH)).toBeTruthy();
  });

  it("says the records are out of Android's backup", async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/otomatik yedeklemesine dahil edilmez/)).toBeTruthy();
  });

  it('says what to do about it rather than only what happens', async () => {
    // A warning with no instruction leaves somebody knowing they are about
    // to lose something and not how to stop it.
    const screen = await render(<AboutScreen />);

    expect(screen.getByText(/yedek al/)).toBeTruthy();
  });

  it('reaches somebody who never made an account', async () => {
    // The whole reason it is on this screen too: the account screen is
    // behind signing in, and this is the person who loses everything.
    const screen = await render(<AboutScreen />);

    expect(screen.queryByText(ABOUT_TRANSFER_PARAGRAPH)).not.toBeNull();
  });
});

describe('headings and navigation', () => {
  it('marks all three headings as headings', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByRole('header', { name: ABOUT_SCREEN_TITLE })).toBeTruthy();
    expect(screen.getByRole('header', { name: ABOUT_IMPORTANT_SECTION_TITLE })).toBeTruthy();
    expect(screen.getByRole('header', { name: ABOUT_TRANSFER_SECTION_TITLE })).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('the public pages', () => {
  it('offers all three, plus the support address', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.getByLabelText(ABOUT_PRIVACY_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(ABOUT_KVKK_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(ABOUT_DELETION_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(aboutSupportLabel(SUPPORT_EMAIL))).toBeTruthy();
  });

  it.each([
    [ABOUT_PRIVACY_LABEL, 'privacy'],
    [ABOUT_KVKK_LABEL, 'kvkk'],
    [ABOUT_DELETION_LABEL, 'deletion'],
  ] as const)('opens %s at its own page', async (label, page) => {
    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText(label));

    await waitFor(() => {
      expect(openURLMock).toHaveBeenCalledWith(legalPageUrl(page));
    });
  });

  it('opens the mail app for support', async () => {
    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText(aboutSupportLabel(SUPPORT_EMAIL)));

    await waitFor(() => {
      expect(openURLMock).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
    });
  });

  it('builds every address from the one base', async () => {
    // A move is one edit; no row may be left pointing at the old host.
    const screen = await render(<AboutScreen />);

    for (const label of [ABOUT_PRIVACY_LABEL, ABOUT_KVKK_LABEL, ABOUT_DELETION_LABEL]) {
      await fireEvent.press(screen.getByLabelText(label));
    }

    await waitFor(() => {
      expect(openURLMock).toHaveBeenCalledTimes(3);
    });

    for (const call of openURLMock.mock.calls) {
      expect(String(call[0]).startsWith(LEGAL_BASE_URL)).toBe(true);
    }
  });

  it('marks them as links, not buttons', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.queryAllByRole('link')).toHaveLength(4);
  });
});

describe('when the phone will not open a link', () => {
  it('says where the page was, so it can be typed by hand', async () => {
    // Somebody who pressed "Gizlilik politikası" has a reason to want it. A
    // silent failure leaves them with nothing.
    openURLMock.mockRejectedValue(new Error('no browser'));

    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText(ABOUT_PRIVACY_LABEL));

    await waitFor(() => {
      expect(screen.getByText(linkOpenFailedMessage(legalPageUrl('privacy')))).toBeTruthy();
    });
  });

  it('gives the address itself when the mail app will not open', async () => {
    openURLMock.mockRejectedValue(new Error('no mail app'));

    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText(aboutSupportLabel(SUPPORT_EMAIL)));

    await waitFor(() => {
      expect(screen.getByText(mailOpenFailedMessage(SUPPORT_EMAIL))).toBeTruthy();
    });
  });

  it('says nothing until something has actually failed', async () => {
    const screen = await render(<AboutScreen />);

    expect(screen.queryByText(/Açılamadı/)).toBeNull();
    expect(screen.queryByText(/açılamadı/)).toBeNull();
  });

  it('clears an old failure when the next press works', async () => {
    openURLMock.mockRejectedValueOnce(new Error('no browser'));

    const screen = await render(<AboutScreen />);

    await fireEvent.press(screen.getByLabelText(ABOUT_PRIVACY_LABEL));

    await waitFor(() => {
      expect(screen.getByText(/Açılamadı/)).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText(ABOUT_KVKK_LABEL));

    await waitFor(() => {
      expect(screen.queryByText(/Açılamadı/)).toBeNull();
    });
  });
});

describe('the addresses themselves', () => {
  it('points at the four pages that exist', () => {
    expect(legalPageUrl('privacy')).toBe(`${LEGAL_BASE_URL}gizlilik.html`);
    expect(legalPageUrl('kvkk')).toBe(`${LEGAL_BASE_URL}kvkk.html`);
    expect(legalPageUrl('deletion')).toBe(`${LEGAL_BASE_URL}veri-silme.html`);
  });

  it('survives a base somebody pasted without a trailing slash', () => {
    // .../regl-gebelik-takvimigizlilik.html is the kind of broken link nobody
    // notices until they need the privacy policy.
    expect(legalPageUrl('privacy', 'https://example.com/app')).toBe(
      'https://example.com/app/gizlilik.html'
    );
  });

  it('keeps one already there', () => {
    expect(legalPageUrl('kvkk', 'https://example.com/app/')).toBe(
      'https://example.com/app/kvkk.html'
    );
  });

  it('builds the mailto from the support address', () => {
    expect(supportMailtoUrl()).toBe(`mailto:${SUPPORT_EMAIL}`);
  });
});
