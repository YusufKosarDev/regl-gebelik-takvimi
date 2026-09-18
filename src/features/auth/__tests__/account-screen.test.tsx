import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import AccountScreen from '@/app/(app)/account';
import { AuthError } from '@/features/auth/domain/auth-error';
import type { AuthErrorCode } from '@/features/auth/domain/auth-error';
import type { AuthUser } from '@/features/auth/domain/auth-user';

// The repository and the Firebase file are faked. What this pins is what the
// screen sends, what it shows, and what it never shows.
jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signOut: jest.fn(),
  getCurrentAuthUser: jest.fn(),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

// Health data has no business on this screen, signed in or out.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  loadPregnancyProfile: jest.fn(),
  savePregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const repository = jest.requireMock('@/features/auth/data/auth-repository');
const firebase = jest.requireMock('@/features/auth/infrastructure/firebase');
const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancyRepository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatarRepository = jest.requireMock('@/features/avatar/data/avatar-repository');
const cloudSync = jest.requireMock('@/features/privacy/application/build-cloud-sync-payload-v1');
const db = jest.requireMock('@/storage/db');
const logging = jest.requireMock('@/shared/logging');
const useRouterMock = useRouter as unknown as jest.Mock;

const EMAIL = 'someone@example.com';
const PASSWORD = 'a-very-secret-password';
const USER: AuthUser = { uid: 'firebase-uid-1', email: EMAIL };

/** What the repository throws: this app's own error, with a code. */
function authError(code: AuthErrorCode) {
  return new AuthError(code);
}

let notify: (user: AuthUser | null) => void;
let unsubscribe: jest.Mock;
let back: jest.Mock;

beforeEach(() => {
  notify = () => undefined;
  unsubscribe = jest.fn();

  repository.observeAuthUser.mockReset();
  repository.observeAuthUser.mockImplementation((callback: (user: AuthUser | null) => void) => {
    notify = callback;

    return unsubscribe;
  });
  repository.signInWithEmail.mockReset();
  repository.signInWithEmail.mockResolvedValue(USER);
  repository.signUpWithEmail.mockReset();
  repository.signUpWithEmail.mockResolvedValue(USER);
  repository.signOut.mockReset();
  repository.signOut.mockResolvedValue(undefined);

  firebase.isFirebaseConfigured.mockReset();
  firebase.isFirebaseConfigured.mockReturnValue(true);

  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.saveCycleProfile.mockReset();
  pregnancyRepository.loadPregnancyProfile.mockReset();
  avatarRepository.loadAvatarConfig.mockReset();
  cloudSync.buildCloudSyncPayloadV1.mockReset();
  db.openAppDatabase.mockReset();
  logging.logEvent.mockReset();

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });
});

/** Renders and settles the screen into the signed-out form. */
async function renderSignedOut() {
  const screen = await render(<AccountScreen />);

  await waitFor(() => {
    notify(null);
  });

  await waitFor(() => {
    expect(screen.getByLabelText('E-posta')).toBeTruthy();
  });

  return screen;
}

/** Renders and settles the screen into the signed-in state. */
async function renderSignedIn(user: AuthUser = USER) {
  const screen = await render(<AccountScreen />);

  await waitFor(() => {
    notify(user);
  });

  await waitFor(() => {
    expect(screen.getByLabelText('Çıkış yap')).toBeTruthy();
  });

  return screen;
}

async function fill(
  screen: Awaited<ReturnType<typeof renderSignedOut>>,
  email = EMAIL,
  password = PASSWORD
) {
  await fireEvent.changeText(screen.getByLabelText('E-posta'), email);
  await fireEvent.changeText(screen.getByLabelText('Şifre'), password);
}

describe('AccountScreen while the session is being read', () => {
  it('shows a spinner rather than a sign-in form', async () => {
    const screen = await render(<AccountScreen />);

    expect(screen.getByTestId('account-loading')).toBeTruthy();
    expect(screen.queryByLabelText('E-posta')).toBeNull();
    expect(screen.queryByLabelText('Çıkış yap')).toBeNull();
  });

  it('says what it is waiting for', async () => {
    const screen = await render(<AccountScreen />);

    expect(screen.getByText('Hesap bilgileri yükleniyor')).toBeTruthy();
  });
});

describe('AccountScreen when nobody is signed in', () => {
  it('offers an address, a password and both ways in', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByLabelText('E-posta')).toBeTruthy();
    expect(screen.getByLabelText('Şifre')).toBeTruthy();
    expect(screen.getByLabelText('Giriş yap')).toBeTruthy();
    expect(screen.getByLabelText('Hesap oluştur')).toBeTruthy();
  });

  it('masks the password field', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByLabelText('Şifre').props.secureTextEntry).toBe(true);
  });

  it('leaves the address alone for the keyboard to not capitalise', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByLabelText('E-posta').props.autoCapitalize).toBe('none');
  });

  it('says an account is optional and that nothing is sent', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByText(/Hesap açmak isteğe bağlı/)).toBeTruthy();
    expect(screen.getByText(/hiçbir yere gönderilmez/)).toBeTruthy();
  });

  it('offers a way back, so the screen is never a gate', async () => {
    const screen = await renderSignedOut();

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('AccountScreen signing in', () => {
  it('sends what was typed', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(repository.signInWithEmail).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it('trims the address, which a keyboard may have padded', async () => {
    const screen = await renderSignedOut();

    await fill(screen, `  ${EMAIL} `);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(repository.signInWithEmail).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it('leaves the password exactly as typed, spaces and all', async () => {
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '  spaces are characters  ');
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(repository.signInWithEmail).toHaveBeenCalledWith(EMAIL, '  spaces are characters  ');
  });

  it('shows the signed-in state once the session says so', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    await waitFor(() => {
      notify(USER);
    });

    expect(await screen.findByLabelText('Çıkış yap')).toBeTruthy();
  });

});

describe('AccountScreen creating an account', () => {
  it('sends what was typed', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(repository.signUpWithEmail).toHaveBeenCalledWith(EMAIL, PASSWORD);
    expect(repository.signInWithEmail).not.toHaveBeenCalled();
  });

  it('says what to fix when the password is too short for Firebase', async () => {
    repository.signUpWithEmail.mockRejectedValue(authError('weak-password'));

    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '123');
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(await screen.findByText('Şifre en az 6 karakter olmalı.')).toBeTruthy();
  });

  it('clears the password after a refusal, so a retry is typed again', async () => {
    repository.signUpWithEmail.mockRejectedValue(authError('weak-password'));

    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '123');
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    await waitFor(() => {
      expect(screen.getByLabelText('Şifre').props.value).toBe('');
    });
  });
});

describe('AccountScreen when something is missing', () => {
  it('asks for an address rather than sending an empty one', async () => {
    const screen = await renderSignedOut();

    await fill(screen, '   ', PASSWORD);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(screen.getByText('E-posta adresi gerekli.')).toBeTruthy();
    expect(repository.signInWithEmail).not.toHaveBeenCalled();
  });

  it('asks for a password rather than sending an empty one', async () => {
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '');
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(screen.getByText('Şifre gerekli.')).toBeTruthy();
    expect(repository.signInWithEmail).not.toHaveBeenCalled();
  });

  it('asks for both in turn, starting with the address', async () => {
    const screen = await renderSignedOut();

    await fill(screen, '', '');
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(screen.getByText('E-posta adresi gerekli.')).toBeTruthy();
    expect(repository.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('clears the complaint as soon as something is typed', async () => {
    const screen = await renderSignedOut();

    await fireEvent.press(screen.getByLabelText('Giriş yap'));
    expect(screen.getByText('E-posta adresi gerekli.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('E-posta'), 's');

    expect(screen.queryByText('E-posta adresi gerekli.')).toBeNull();
  });
});

describe('AccountScreen when the attempt is refused', () => {
  it.each([
    ['invalid-credentials', 'E-posta veya şifre hatalı.'],
    ['invalid-email', 'Bu e-posta adresi kullanılamıyor.'],
    ['email-already-in-use', 'Bu e-posta adresi kullanılamıyor.'],
    ['too-many-requests', 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.'],
    ['network-failed', 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.'],
    ['unknown', 'İşlem tamamlanamadı.'],
  ] as readonly (readonly [AuthErrorCode, string])[])('shows this app’s own sentence for %s', async (code, message) => {
    repository.signInWithEmail.mockRejectedValue(authError(code));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('says the same thing for an address in use as for one that is malformed', async () => {
    // Anything else would answer "does this address have an account here".
    const messages: string[] = [];

    for (const code of ['email-already-in-use', 'invalid-email'] as const) {
      repository.signUpWithEmail.mockRejectedValue(authError(code));

      const screen = await renderSignedOut();

      await fill(screen);
      await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

      messages.push((await screen.findByText(/kullanılamıyor/)).props.children as string);
    }

    expect(messages[0]).toBe(messages[1]);
  });

  it('announces the message, so it is not only a colour', async () => {
    repository.signInWithEmail.mockRejectedValue(authError('invalid-credentials'));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    const notice = await screen.findByText('E-posta veya şifre hatalı.');

    expect(notice.props.accessibilityRole).toBe('alert');
  });

  it('shows nothing the SDK wrote', async () => {
    const raw = new Error(
      `Firebase: The password is invalid for ${EMAIL}. Password ${PASSWORD} rejected. (auth/wrong-password).`
    ) as Error & { code: string };
    raw.code = 'auth/wrong-password';
    repository.signInWithEmail.mockRejectedValue(raw);

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(await screen.findByText('E-posta veya şifre hatalı.')).toBeTruthy();
    expect(screen.queryByText(new RegExp(PASSWORD))).toBeNull();
    expect(screen.queryByText(/Firebase|auth\//)).toBeNull();
  });

  it('keeps the form usable afterwards', async () => {
    repository.signInWithEmail.mockRejectedValue(authError('invalid-credentials'));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    await waitFor(() => {
      expect(screen.getByLabelText('Giriş yap').props.accessibilityState.disabled).toBe(false);
    });
  });
});

describe('AccountScreen when someone is signed in', () => {
  it('shows which account it is', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it('offers a way out and nothing to sign in with', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByLabelText('Çıkış yap')).toBeTruthy();
    expect(screen.queryByLabelText('E-posta')).toBeNull();
    expect(screen.queryByLabelText('Giriş yap')).toBeNull();
  });

  it('copes with an account that has no address', async () => {
    const screen = await renderSignedIn({ uid: 'firebase-uid-1', email: null });

    expect(screen.getByText('E-posta adresi yok')).toBeTruthy();
  });

  it('signs out when asked', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Çıkış yap'));

    expect(repository.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the form again once the session is gone', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Çıkış yap'));

    await waitFor(() => {
      notify(null);
    });

    expect(await screen.findByLabelText('E-posta')).toBeTruthy();
  });

  it('says so plainly when signing out fails', async () => {
    repository.signOut.mockRejectedValue(authError('network-failed'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Çıkış yap'));

    expect(await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol et.')).toBeTruthy();
  });
});

describe('AccountScreen in a build with no Firebase project', () => {
  beforeEach(() => {
    firebase.isFirebaseConfigured.mockReturnValue(false);
  });

  it('says so instead of crashing', async () => {
    const screen = await render(<AccountScreen />);

    expect(await screen.findByText('Bulut hesabı şu anda yapılandırılmamış.')).toBeTruthy();
  });

  it('says the rest of the app is unaffected', async () => {
    const screen = await render(<AccountScreen />);

    expect(
      await screen.findByText('Uygulamanın geri kalanı hesapsız da tam olarak çalışır.')
    ).toBeTruthy();
  });

  it('offers nothing to sign in with', async () => {
    const screen = await render(<AccountScreen />);

    await screen.findByText('Bulut hesabı şu anda yapılandırılmamış.');

    expect(screen.queryByLabelText('E-posta')).toBeNull();
    expect(screen.queryByLabelText('Giriş yap')).toBeNull();
    expect(screen.queryByLabelText('Hesap oluştur')).toBeNull();
  });

  it('watches no session', async () => {
    await render(<AccountScreen />);

    expect(repository.observeAuthUser).not.toHaveBeenCalled();
  });

  it('still offers a way back', async () => {
    const screen = await render(<AccountScreen />);

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('what the account screen never touches', () => {
  it('reads no health data, signed out', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
    expect(pregnancyRepository.loadPregnancyProfile).not.toHaveBeenCalled();
    expect(avatarRepository.loadAvatarConfig).not.toHaveBeenCalled();
  });

  it('reads no health data, signed in', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Çıkış yap'));

    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
  });

  it('builds no cloud sync payload, because nothing is sent', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    await waitFor(() => {
      notify(USER);
    });

    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });

  it('writes nothing to the log, whatever happens', async () => {
    repository.signInWithEmail.mockRejectedValue(authError('invalid-credentials'));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    await screen.findByText('E-posta veya şifre hatalı.');

    expect(logging.logEvent).not.toHaveBeenCalled();
  });

  it('writes nothing to the console either', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    repository.signInWithEmail.mockRejectedValue(authError('invalid-credentials'));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Giriş yap'));
    await screen.findByText('E-posta veya şifre hatalı.');

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('shows the password nowhere on the screen', async () => {
    const screen = await renderSignedOut();

    await fill(screen);

    expect(screen.queryByText(PASSWORD)).toBeNull();
  });
});

describe('AccountScreen stops watching when it goes away', () => {
  it('unsubscribes on unmount', async () => {
    const screen = await render(<AccountScreen />);

    await screen.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
