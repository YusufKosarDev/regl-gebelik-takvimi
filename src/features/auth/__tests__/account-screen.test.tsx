import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import AccountScreen from '@/app/(app)/account';
import { AuthError } from '@/features/auth/domain/auth-error';
import type { AuthErrorCode } from '@/features/auth/domain/auth-error';
import type { AuthUser } from '@/features/auth/domain/auth-user';

// The repository and the Firebase file are faked. What this pins is what the
// screen sends, what it shows, and what it never shows.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  sendPasswordReset: jest.fn(),
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

// The backup repository is faked, so these tests are about what the buttons
// ask for and what the screen says back — not about Firestore.
jest.mock('@/features/backup/data/cloud-backup-repository', () => ({
  saveCloudBackup: jest.fn(),
  loadCloudBackup: jest.fn(),
}));

jest.mock('@/features/backup/application/restore-cloud-backup', () => ({
  restoreCloudBackup: jest.fn(),
}));

// A restore refreshes the copies afterwards. Faked so the calls can be counted.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshot: jest.fn(),
  syncWidgetSnapshotQuietly: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminder: jest.fn(),
  syncPeriodReminderQuietly: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminder: jest.fn(),
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
}));

// The sync is faked too. What this pins is what the screen asks for, what it
// says about each outcome, and which of the two paths — the button or the
// scheduler — a given press goes down.
jest.mock('@/features/sync/application/run-cloud-sync', () => ({
  runCloudSync: jest.fn(),
}));

// The scheduler owns every automatic run. The screen only asks it for one.
jest.mock('@/features/sync/application/automatic-sync-scheduler', () => ({
  requestAutomaticSync: jest.fn(),
  onAutomaticSyncOutcome: jest.fn(() => () => undefined),
}));

jest.mock('@/features/sync/infrastructure/last-sync-at', () => ({
  loadLastSyncAt: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/unresolved-conflict', () => ({
  isConflictUnresolved: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/sync-preferences', () => ({
  loadSyncPreferences: jest.fn(),
  setAutomaticSyncEnabled: jest.fn(),
}));

jest.mock('@/utils/today', () => ({ getTodayLocalISODate: jest.fn(() => '2026-09-19') }));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

jest.mock('@/features/deletion/application/delete-account', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock('@/features/deletion/infrastructure/pending-account-deletion', () => ({
  clearPendingAccountDeletion: jest.fn(),
  isAccountDeletionPending: jest.fn(),
}));

const repository = jest.requireMock('@/features/auth/data/auth-repository');
const deletion = jest.requireMock('@/features/deletion/application/delete-account');
const pendingDeletion = jest.requireMock(
  '@/features/deletion/infrastructure/pending-account-deletion'
);
const firebase = jest.requireMock('@/features/auth/infrastructure/firebase');
const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancyRepository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatarRepository = jest.requireMock('@/features/avatar/data/avatar-repository');
const cloudSync = jest.requireMock('@/features/privacy/application/build-cloud-sync-payload-v1');
const backup = jest.requireMock('@/features/backup/data/cloud-backup-repository');
const restore = jest.requireMock('@/features/backup/application/restore-cloud-backup');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const periodReminderSync = jest.requireMock(
  '@/features/notifications/application/sync-period-reminder'
);
const pregnancyReminderSync = jest.requireMock(
  '@/features/notifications/application/sync-pregnancy-weekly-reminder'
);
const cloudSyncRun = jest.requireMock('@/features/sync/application/run-cloud-sync');
const syncPreferences = jest.requireMock('@/features/sync/infrastructure/sync-preferences');
const scheduler = jest.requireMock('@/features/sync/application/automatic-sync-scheduler');
const lastSyncAt = jest.requireMock('@/features/sync/infrastructure/last-sync-at');
const unresolvedConflict = jest.requireMock('@/features/sync/infrastructure/unresolved-conflict');
const db = jest.requireMock('@/storage/db');
const logging = jest.requireMock('@/shared/logging');
const useRouterMock = useRouter as unknown as jest.Mock;

const EMAIL = 'someone@example.com';
const PASSWORD = 'a-very-secret-password';
const USER: AuthUser = { uid: 'firebase-uid-1', email: EMAIL };

/** Stand-ins: the screen passes these through without looking inside. */
const DATABASE = { name: 'regl-gebelik.db' };
const PAYLOAD = {
  version: 1,
  cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [],
  pregnancyProfile: null,
  avatarConfig: null,
  notificationPreferences: {
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  },
};

/** What the repository throws: this app's own error, with a code. */
function authError(code: AuthErrorCode) {
  return new AuthError(code);
}

let notify: (user: AuthUser | null) => void;
let unsubscribe: jest.Mock;
let back: jest.Mock;
let push: jest.Mock;

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
  repository.sendPasswordReset.mockReset();
  repository.sendPasswordReset.mockResolvedValue(undefined);

  firebase.isFirebaseConfigured.mockReset();
  firebase.isFirebaseConfigured.mockReturnValue(true);

  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.saveCycleProfile.mockReset();
  pregnancyRepository.loadPregnancyProfile.mockReset();
  avatarRepository.loadAvatarConfig.mockReset();
  cloudSync.buildCloudSyncPayloadV1.mockReset();
  cloudSync.buildCloudSyncPayloadV1.mockResolvedValue(PAYLOAD);
  backup.saveCloudBackup.mockReset();
  backup.saveCloudBackup.mockResolvedValue(undefined);
  backup.loadCloudBackup.mockReset();
  backup.loadCloudBackup.mockResolvedValue(null);
  restore.restoreCloudBackup.mockReset();
  restore.restoreCloudBackup.mockResolvedValue(undefined);
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  periodReminderSync.syncPeriodReminderQuietly.mockReset();
  periodReminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockReset();
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
  cloudSyncRun.runCloudSync.mockReset();
  cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'noop', revision: 3 });
  scheduler.requestAutomaticSync.mockReset();
  scheduler.requestAutomaticSync.mockResolvedValue(null);
  scheduler.onAutomaticSyncOutcome.mockReset();
  scheduler.onAutomaticSyncOutcome.mockImplementation(() => () => undefined);
  lastSyncAt.loadLastSyncAt.mockReset();
  lastSyncAt.loadLastSyncAt.mockResolvedValue(null);
  unresolvedConflict.isConflictUnresolved.mockReset();
  unresolvedConflict.isConflictUnresolved.mockResolvedValue(false);
  syncPreferences.loadSyncPreferences.mockReset();
  syncPreferences.loadSyncPreferences.mockResolvedValue({ automaticSyncEnabled: false });
  syncPreferences.setAutomaticSyncEnabled.mockReset();
  syncPreferences.setAutomaticSyncEnabled.mockImplementation(async (enabled: boolean) => ({
    automaticSyncEnabled: enabled,
  }));
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue(DATABASE);
  logging.logEvent.mockReset();
  deletion.deleteAccount.mockReset();
  deletion.deleteAccount.mockResolvedValue({ kind: 'deleted' });
  pendingDeletion.clearPendingAccountDeletion.mockReset();
  pendingDeletion.clearPendingAccountDeletion.mockResolvedValue(undefined);
  pendingDeletion.isAccountDeletionPending.mockReset();
  pendingDeletion.isAccountDeletionPending.mockResolvedValue(false);

  back = jest.fn();
  push = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push, replace: jest.fn() });
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

  it('signs in with a password shorter than new ones are allowed to be', async () => {
    // An account made before the eight-character rule. Its owner has to be
    // able to get in, and the rule is about choosing, not about typing.
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, 'abc123');
    await fireEvent.press(screen.getByLabelText('Giriş yap'));

    expect(repository.signInWithEmail).toHaveBeenCalledWith(EMAIL, 'abc123');
    expect(screen.queryByText('Şifre en az 8 karakter olmalı.')).toBeNull();
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

  it('refuses a short password before Firebase is asked', async () => {
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '1234567');
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(await screen.findByText('Şifre en az 8 karakter olmalı.')).toBeTruthy();
    expect(repository.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('accepts one of exactly the minimum length', async () => {
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, '12345678');
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(repository.signUpWithEmail).toHaveBeenCalledWith(EMAIL, '12345678');
  });

  it('still says what to fix if Firebase refuses one anyway', async () => {
    // The form cannot produce this any more, but the code is still mapped
    // and the sentence still has to be the right one.
    repository.signUpWithEmail.mockRejectedValue(authError('weak-password'));

    const screen = await renderSignedOut();

    await fill(screen);
    await fireEvent.press(screen.getByLabelText('Hesap oluştur'));

    expect(await screen.findByText('Şifre en az 8 karakter olmalı.')).toBeTruthy();
  });

  it('shows the minimum in the hint under the field', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByLabelText('Şifre').props.placeholder).toBe('En az 8 karakter');
  });

  it('clears the password after a refusal, so a retry is typed again', async () => {
    repository.signUpWithEmail.mockRejectedValue(authError('weak-password'));

    const screen = await renderSignedOut();

    await fill(screen);
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

const RESET_SENT = 'Eğer bu e-posta ile bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.';

/** Opens the reset form from the signed-out state. */
async function openReset(screen: Awaited<ReturnType<typeof renderSignedOut>>) {
  await fireEvent.press(screen.getByLabelText('Şifremi unuttum'));

  await waitFor(() => {
    expect(screen.getByLabelText('Sıfırlama bağlantısı gönder')).toBeTruthy();
  });
}

describe('AccountScreen opening the reset form', () => {
  it('offers it to someone who is signed out', async () => {
    const screen = await renderSignedOut();

    expect(screen.getByLabelText('Şifremi unuttum')).toBeTruthy();
  });

  it('swaps the sign-in buttons for the reset ones', async () => {
    const screen = await renderSignedOut();

    await openReset(screen);

    expect(screen.getByLabelText('Sıfırlama bağlantısı gönder')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
    expect(screen.queryByLabelText('Giriş yap')).toBeNull();
    expect(screen.queryByLabelText('Hesap oluştur')).toBeNull();
  });

  it('asks for no password, because a reset request has none', async () => {
    const screen = await renderSignedOut();

    await openReset(screen);

    expect(screen.queryByLabelText('Şifre')).toBeNull();
  });

  it('keeps the address that was already typed', async () => {
    const screen = await renderSignedOut();

    await fill(screen, EMAIL, PASSWORD);
    await openReset(screen);

    expect(screen.getByLabelText('E-posta').props.value).toBe(EMAIL);
  });

  it('says where the link leads', async () => {
    const screen = await renderSignedOut();

    await openReset(screen);

    expect(screen.getByText(/şifre sıfırlama bağlantısı gönderelim/)).toBeTruthy();
  });

  it('goes back to signing in on Vazgeç', async () => {
    const screen = await renderSignedOut();

    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    await waitFor(() => {
      expect(screen.getByLabelText('Giriş yap')).toBeTruthy();
    });

    expect(screen.getByLabelText('Şifre')).toBeTruthy();
    expect(screen.queryByLabelText('Sıfırlama bağlantısı gönder')).toBeNull();
  });

  it('sends nothing when it is only opened and closed', async () => {
    const screen = await renderSignedOut();

    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('AccountScreen asking for a reset link', () => {
  it('sends the address that was typed', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(repository.sendPasswordReset).toHaveBeenCalledWith(EMAIL);
    expect(repository.sendPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('trims it on the way', async () => {
    const screen = await renderSignedOut();

    await fill(screen, `  ${EMAIL}  `);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(repository.sendPasswordReset).toHaveBeenCalledWith(EMAIL);
  });

  it('sends no password with it', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(repository.sendPasswordReset.mock.calls[0]).toEqual([EMAIL]);
  });

  it('asks for an address rather than sending an empty one', async () => {
    const screen = await renderSignedOut();

    await fill(screen, '   ');
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(screen.getByText('E-posta adresi gerekli.')).toBeTruthy();
    expect(repository.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('signs nobody in and creates nothing', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(repository.signInWithEmail).not.toHaveBeenCalled();
    expect(repository.signUpWithEmail).not.toHaveBeenCalled();
  });
});

describe('AccountScreen after a reset request', () => {
  it('gives the same answer whether or not the address has an account', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(await screen.findByText(RESET_SENT)).toBeTruthy();
  });

  it('announces it', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect((await screen.findByText(RESET_SENT)).props.accessibilityRole).toBe('alert');
  });

  it('says nothing about whether an account was found', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    await screen.findByText(RESET_SENT);

    for (const forbidden of [
      /hesap bulunamadı/i,
      /böyle bir hesap/i,
      /kayıtlı değil/i,
      /bulundu/i,
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it('goes back to signing in with the answer above it', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    await screen.findByText(RESET_SENT);

    expect(screen.getByLabelText('Giriş yap')).toBeTruthy();
  });

  it.each([
    ['invalid-email', 'Geçerli bir e-posta adresi gir.'],
    ['too-many-requests', 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.'],
    ['network-failed', 'İşlem tamamlanamadı.'],
    ['unknown', 'İşlem tamamlanamadı.'],
  ] as readonly (readonly [AuthErrorCode, string])[])(
    'shows this app’s own sentence for %s',
    async (code, message) => {
      repository.sendPasswordReset.mockRejectedValue(authError(code));

      const screen = await renderSignedOut();

      await fill(screen);
      await openReset(screen);
      await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

      expect(await screen.findByText(message)).toBeTruthy();
    }
  );

  it('shows nothing the SDK wrote', async () => {
    const raw = new Error(
      `Firebase: There is no user record corresponding to ${EMAIL}. (auth/user-not-found).`
    ) as Error & { code: string };
    raw.code = 'auth/user-not-found';
    repository.sendPasswordReset.mockRejectedValue(raw);

    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(await screen.findByText('İşlem tamamlanamadı.')).toBeTruthy();
    expect(screen.queryByText(/Firebase|auth\/|user record/)).toBeNull();
  });

  it('keeps the form usable after a refusal', async () => {
    repository.sendPasswordReset.mockRejectedValue(authError('invalid-email'));

    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    await screen.findByText('Geçerli bir e-posta adresi gir.');

    expect(screen.getByLabelText('Sıfırlama bağlantısı gönder')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('writes nothing to the log or the console', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));
    await screen.findByText(RESET_SENT);

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('reads no health data', async () => {
    const screen = await renderSignedOut();

    await fill(screen);
    await openReset(screen);
    await fireEvent.press(screen.getByLabelText('Sıfırlama bağlantısı gönder'));

    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });
});

describe('AccountScreen reset form in the other states', () => {
  it('is not offered in a build with no Firebase project', async () => {
    firebase.isFirebaseConfigured.mockReturnValue(false);

    const screen = await render(<AccountScreen />);

    await screen.findByText('Bulut hesabı şu anda yapılandırılmamış.');

    expect(screen.queryByLabelText('Şifremi unuttum')).toBeNull();
    expect(screen.queryByLabelText('Sıfırlama bağlantısı gönder')).toBeNull();
  });

  it('is not offered to someone already signed in', async () => {
    const screen = await renderSignedIn();

    expect(screen.queryByLabelText('Şifremi unuttum')).toBeNull();
  });

  it('is not offered while the session is still being read', async () => {
    const screen = await render(<AccountScreen />);

    expect(screen.queryByLabelText('Şifremi unuttum')).toBeNull();
  });
});

describe('AccountScreen cloud backup, signed in', () => {
  it('offers both buttons under a heading', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByText('Bulut yedekleme')).toBeTruthy();
    expect(screen.getByLabelText('Yedek oluştur')).toBeTruthy();
    expect(screen.getByLabelText('Yedeği kontrol et')).toBeTruthy();
  });

  it('says what a backup carries and that nothing else is sent', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByText(/regl kayıtların, gebelik bilgin, avatarın/)).toBeTruthy();
    // Two buttons send now rather than one, and the sentence says so. The
    // promise it keeps is the same: nothing leaves without a press.
    expect(screen.getByText(/sen bir düğmeye basmadan hiçbir gönderim olmaz/)).toBeTruthy();
    expect(screen.getByText(/Yedek oluşturduğunda ya da senkronize ettiğinde/)).toBeTruthy();
  });

  it('sends nothing until a button is pressed', async () => {
    await renderSignedIn();

    expect(backup.saveCloudBackup).not.toHaveBeenCalled();
    expect(backup.loadCloudBackup).not.toHaveBeenCalled();
    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
    expect(cloudSyncRun.runCloudSync).not.toHaveBeenCalled();
  });
});

describe('AccountScreen creating a backup', () => {
  it('builds the payload from the database and sends it for this account', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(cloudSync.buildCloudSyncPayloadV1).toHaveBeenCalledWith(DATABASE);
    expect(backup.saveCloudBackup).toHaveBeenCalledWith(USER, PAYLOAD);
  });

  it('says it worked', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    expect(await screen.findByText('Yedek oluşturuldu.')).toBeTruthy();
  });

  it('announces the result', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    expect((await screen.findByText('Yedek oluşturuldu.')).props.accessibilityRole).toBe('alert');
  });

  it('sends nothing when the payload could not be built', async () => {
    cloudSync.buildCloudSyncPayloadV1.mockRejectedValue(new Error('database is locked'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    expect(backup.saveCloudBackup).not.toHaveBeenCalled();
    expect(await screen.findByText('İşlem tamamlanamadı.')).toBeTruthy();
  });

  it.each([
    ['invalid-credentials', 'E-posta veya şifre hatalı.'],
    ['network-failed', 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.'],
    ['not-configured', 'Bulut hesabı şu anda yapılandırılmamış.'],
    ['unknown', 'İşlem tamamlanamadı.'],
  ] as readonly (readonly [AuthErrorCode, string])[])(
    'shows this app’s own sentence for %s',
    async (code, message) => {
      backup.saveCloudBackup.mockRejectedValue(authError(code));

      const screen = await renderSignedIn();

      await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

      expect(await screen.findByText(message)).toBeTruthy();
    }
  );

  it('shows nothing Firestore wrote', async () => {
    const raw = new Error(
      'Missing or insufficient permissions on users/firebase-uid-1/backups/current'
    ) as Error & { code: string };
    raw.code = 'permission-denied';
    backup.saveCloudBackup.mockRejectedValue(raw);

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    await screen.findByText('İşlem tamamlanamadı.');

    expect(screen.queryByText(/users\/|permission|Firestore/)).toBeNull();
  });
});

describe('AccountScreen checking a backup', () => {
  it('asks for this account’s backup and nothing else', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    expect(backup.loadCloudBackup).toHaveBeenCalledWith(USER);
    expect(backup.saveCloudBackup).not.toHaveBeenCalled();
  });

  it('says there is one', async () => {
    backup.loadCloudBackup.mockResolvedValue({
      version: 1,
      payload: PAYLOAD,
      updatedAt: '2026-09-19T06:00:00.000Z',
    });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    expect(await screen.findByText('Yedek bulundu.')).toBeTruthy();
  });

  it('says there is not', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    expect(await screen.findByText('Henüz yedek yok.')).toBeTruthy();
  });

  it('shows nothing that was in the backup', async () => {
    backup.loadCloudBackup.mockResolvedValue({
      version: 1,
      payload: {
        ...PAYLOAD,
        periodRecords: [
          {
            id: 'period-2026-09-02',
            startDate: '2026-09-02',
            endDate: '2026-09-07',
            isOngoing: false,
          },
        ],
      },
      updatedAt: '2026-09-19T06:00:00.000Z',
    });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    await screen.findByText('Yedek bulundu.');

    expect(screen.queryByText(/2026-09-02|2026-09-19|28|period-/)).toBeNull();
  });

  it('reads nothing from the phone to answer', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    await screen.findByText('Henüz yedek yok.');

    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });

  it('says so plainly when the check fails', async () => {
    backup.loadCloudBackup.mockRejectedValue(authError('network-failed'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    expect(
      await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol et.')
    ).toBeTruthy();
  });

  it('restores nothing, whatever it found', async () => {
    backup.loadCloudBackup.mockResolvedValue({
      version: 1,
      payload: PAYLOAD,
      updatedAt: null,
    });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği kontrol et'));

    await screen.findByText('Yedek bulundu.');

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
    expect(db.openAppDatabase).not.toHaveBeenCalled();
  });
});

describe('AccountScreen backup in the other states', () => {
  it('is not offered to somebody signed out', async () => {
    const screen = await renderSignedOut();

    expect(screen.queryByText('Bulut yedekleme')).toBeNull();
    expect(screen.queryByLabelText('Yedek oluştur')).toBeNull();
    expect(screen.queryByLabelText('Yedeği kontrol et')).toBeNull();
  });

  it('is not offered in a build with no Firebase project', async () => {
    firebase.isFirebaseConfigured.mockReturnValue(false);

    const screen = await render(<AccountScreen />);

    await screen.findByText('Bulut hesabı şu anda yapılandırılmamış.');

    expect(screen.queryByLabelText('Yedek oluştur')).toBeNull();
  });

  it('is not offered while the session is still being read', async () => {
    const screen = await render(<AccountScreen />);

    expect(screen.queryByLabelText('Yedek oluştur')).toBeNull();
  });

  it('goes away when the session does', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByLabelText('Yedek oluştur')).toBeTruthy();

    await waitFor(() => {
      notify(null);
    });

    await screen.findByLabelText('E-posta');

    expect(screen.queryByLabelText('Yedek oluştur')).toBeNull();
    expect(screen.queryByText('Bulut yedekleme')).toBeNull();
  });
});

describe('what the backup buttons never do', () => {
  it('write nothing to the log or the console', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    backup.saveCloudBackup.mockRejectedValue(authError('unknown'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));
    await screen.findByText('İşlem tamamlanamadı.');

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('send a second copy without a second press', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));
    await screen.findByText('Yedek oluşturuldu.');

    expect(backup.saveCloudBackup).toHaveBeenCalledTimes(1);
  });
});

/** A backup that differs from the phone in every way the preview reports. */
const DIFFERENT_PAYLOAD = {
  ...PAYLOAD,
  cycleSettings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
  periodRecords: [
    { id: 'period-2026-08-02', startDate: '2026-08-02', endDate: '2026-08-07', isOngoing: false },
  ],
};

function storedBackup(payload: unknown = DIFFERENT_PAYLOAD) {
  return { version: 1, payload, updatedAt: '2026-09-19T06:00:00.000Z' };
}

/** Opens the preview from the signed-in state. */
async function openPreview(screen: Awaited<ReturnType<typeof renderSignedIn>>) {
  await fireEvent.press(screen.getByLabelText('Yedeği geri yükle'));

  await waitFor(() => {
    expect(screen.getByLabelText('Geri yükle')).toBeTruthy();
  });
}

describe('AccountScreen restore, before anything is shown', () => {
  it('offers the button to somebody signed in', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByLabelText('Yedeği geri yükle')).toBeTruthy();
  });

  it('is not offered to somebody signed out', async () => {
    const screen = await renderSignedOut();

    expect(screen.queryByLabelText('Yedeği geri yükle')).toBeNull();
    expect(screen.queryByLabelText('Geri yükle')).toBeNull();
  });

  it('is not offered in a build with no Firebase project', async () => {
    firebase.isFirebaseConfigured.mockReturnValue(false);

    const screen = await render(<AccountScreen />);

    await screen.findByText('Bulut hesabı şu anda yapılandırılmamış.');

    expect(screen.queryByLabelText('Yedeği geri yükle')).toBeNull();
  });

  it('reads nothing until it is pressed', async () => {
    await renderSignedIn();

    expect(backup.loadCloudBackup).not.toHaveBeenCalled();
    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });
});

describe('AccountScreen restore preview', () => {
  beforeEach(() => {
    backup.loadCloudBackup.mockResolvedValue(storedBackup());
  });

  it('reads the backup and what is on the phone', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(backup.loadCloudBackup).toHaveBeenCalledWith(USER);
    expect(cloudSync.buildCloudSyncPayloadV1).toHaveBeenCalledWith(DATABASE);
  });

  it('writes nothing while it is only showing', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });

  it('shows a line for each of the five things', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(screen.getByText('Neler değişecek')).toBeTruthy();
    expect(screen.getByText('Döngü ayarları')).toBeTruthy();
    expect(screen.getByText('Regl kayıtları')).toBeTruthy();
    expect(screen.getByText('Gebelik bilgisi')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(screen.getByText('Hatırlatıcı tercihleri')).toBeTruthy();
  });

  it('says what would happen to the settings', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(screen.getByLabelText('Döngü ayarları: Değişecek')).toBeTruthy();
  });

  it('says how many records would move', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    // The phone has none and the backup has one.
    expect(screen.getByLabelText('Regl kayıtları: 1 eklenecek')).toBeTruthy();
  });

  it('says all three counts when all three would happen', async () => {
    cloudSync.buildCloudSyncPayloadV1.mockResolvedValue({
      ...PAYLOAD,
      periodRecords: [
        { id: 'stays', startDate: '2026-07-02', endDate: '2026-07-07', isOngoing: false },
        { id: 'changes', startDate: '2026-08-02', endDate: '2026-08-07', isOngoing: false },
        { id: 'goes', startDate: '2026-09-02', endDate: '2026-09-07', isOngoing: false },
      ],
    });

    backup.loadCloudBackup.mockResolvedValue(
      storedBackup({
        ...PAYLOAD,
        periodRecords: [
          { id: 'stays', startDate: '2026-07-02', endDate: '2026-07-07', isOngoing: false },
          { id: 'changes', startDate: '2026-08-03', endDate: '2026-08-07', isOngoing: false },
          { id: 'arrives', startDate: '2026-10-02', endDate: '2026-10-07', isOngoing: false },
        ],
      })
    );

    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(
      screen.getByLabelText('Regl kayıtları: 1 eklenecek, 1 değişecek, 1 silinecek')
    ).toBeTruthy();
  });

  it('says a thing is unchanged when it is', async () => {
    backup.loadCloudBackup.mockResolvedValue(storedBackup(PAYLOAD));

    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(screen.getByLabelText('Regl kayıtları: Aynı kalacak')).toBeTruthy();
    expect(screen.getByLabelText('Avatar: Aynı kalacak')).toBeTruthy();
  });

  it('warns that this would overwrite the phone', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    const warning = screen.getByText(
      'Bu yedek telefondaki mevcut verilerin üzerine yazılacak.'
    );

    expect(warning.props.accessibilityRole).toBe('alert');
  });

  it('offers both a way on and a way out', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(screen.getByLabelText('Geri yükle')).toBeTruthy();
    expect(screen.getByLabelText('Geri yüklemekten vazgeç')).toBeTruthy();
  });

  it('shows no date, record id or health value', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);

    expect(screen.queryByText(/2026-|2027-|period-|skin-tone|wavy/)).toBeNull();
  });

  it('says there is nothing to restore when there is no backup', async () => {
    backup.loadCloudBackup.mockResolvedValue(null);

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği geri yükle'));

    expect(await screen.findByText('Henüz yedek yok.')).toBeTruthy();
    expect(screen.queryByLabelText('Geri yükle')).toBeNull();
  });

  it('says so plainly when the backup could not be read', async () => {
    backup.loadCloudBackup.mockRejectedValue(authError('network-failed'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği geri yükle'));

    expect(
      await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol et.')
    ).toBeTruthy();
    expect(screen.queryByLabelText('Geri yükle')).toBeNull();
  });

  it('shows nothing Firestore wrote', async () => {
    const raw = new Error('Missing or insufficient permissions on users/firebase-uid-1') as Error & {
      code: string;
    };
    raw.code = 'permission-denied';
    backup.loadCloudBackup.mockRejectedValue(raw);

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği geri yükle'));

    await screen.findByText('İşlem tamamlanamadı.');

    expect(screen.queryByText(/users\/|permission|Firestore/)).toBeNull();
  });
});

describe('AccountScreen cancelling a restore', () => {
  beforeEach(() => {
    backup.loadCloudBackup.mockResolvedValue(storedBackup());
  });

  it('writes nothing at all', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yüklemekten vazgeç'));

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('puts the button back and takes the preview away', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yüklemekten vazgeç'));

    await waitFor(() => {
      expect(screen.getByLabelText('Yedeği geri yükle')).toBeTruthy();
    });

    expect(screen.queryByText('Neler değişecek')).toBeNull();
    expect(screen.queryByLabelText('Geri yükle')).toBeNull();
  });

  it('syncs nothing either', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yüklemekten vazgeç'));

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
    expect(periodReminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });
});

describe('AccountScreen confirming a restore', () => {
  beforeEach(() => {
    backup.loadCloudBackup.mockResolvedValue(storedBackup());
  });

  it('writes the backup that was previewed', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(restore.restoreCloudBackup).toHaveBeenCalledWith(DATABASE, DIFFERENT_PAYLOAD);
    expect(restore.restoreCloudBackup).toHaveBeenCalledTimes(1);
  });

  it('takes two presses: the first only shows what would change', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Yedeği geri yükle'));

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByLabelText('Geri yükle')).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(restore.restoreCloudBackup).toHaveBeenCalledTimes(1);
  });

  it('says it worked', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(await screen.findByText('Yedek geri yüklendi.')).toBeTruthy();
  });

  it('takes the preview away afterwards', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklendi.');

    expect(screen.queryByText('Neler değişecek')).toBeNull();
    expect(screen.getByLabelText('Yedeği geri yükle')).toBeTruthy();
  });

  it('brings the widget and both reminders up to date afterwards', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklendi.');

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    expect(periodReminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs only after the write, never instead of it', async () => {
    const order: string[] = [];

    restore.restoreCloudBackup.mockImplementation(async () => {
      order.push('restore');
    });
    widgetSync.syncWidgetSnapshotQuietly.mockImplementation(async () => {
      order.push('widget');

      return null;
    });

    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklendi.');

    expect(order).toEqual(['restore', 'widget']);
  });

  it('still counts as restored when the widget cannot be refreshed', async () => {
    widgetSync.syncWidgetSnapshotQuietly.mockRejectedValue(new Error('no bridge'));

    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(await screen.findByText('Yedek geri yüklendi.')).toBeTruthy();
  });

  it('still counts as restored when a reminder cannot be queued', async () => {
    periodReminderSync.syncPeriodReminderQuietly.mockRejectedValue(new Error('no queue'));

    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(await screen.findByText('Yedek geri yüklendi.')).toBeTruthy();
  });
});

describe('AccountScreen when a restore fails', () => {
  beforeEach(() => {
    backup.loadCloudBackup.mockResolvedValue(storedBackup());
    restore.restoreCloudBackup.mockRejectedValue(new Error('disk is full'));
  });

  it('says so in its own words', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    expect(await screen.findByText('Yedek geri yüklenemedi.')).toBeTruthy();
  });

  it('shows nothing of what went wrong', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklenemedi.');

    expect(screen.queryByText(/disk|SQLITE|transaction/i)).toBeNull();
  });

  it('syncs nothing, because nothing was written', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklenemedi.');

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
    expect(periodReminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('leaves the preview up to try again', async () => {
    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));

    await screen.findByText('Yedek geri yüklenemedi.');

    expect(screen.getByLabelText('Geri yükle')).toBeTruthy();
    expect(screen.getByLabelText('Geri yüklemekten vazgeç')).toBeTruthy();
  });

  it('writes nothing to the log or the console', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const screen = await renderSignedIn();

    await openPreview(screen);
    await fireEvent.press(screen.getByLabelText('Geri yükle'));
    await screen.findByText('Yedek geri yüklenemedi.');

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

describe('the automatic sync switch', () => {
  it('is off for somebody who has never been asked', async () => {
    const screen = await renderSignedIn();

    expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(false);
  });

  it('follows what was stored', async () => {
    syncPreferences.loadSyncPreferences.mockResolvedValue({ automaticSyncEnabled: true });

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(true);
    });
  });

  it('says it syncs while the app is open, and not while it is closed', async () => {
    const screen = await renderSignedIn();

    // The second half is the promise that matters on a health app.
    expect(screen.getByText(/Uygulama kapalıyken hiçbir şey gönderilmez/)).toBeTruthy();
  });

  it('records the choice when it is turned on', async () => {
    const screen = await renderSignedIn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', true);

    await waitFor(() => {
      expect(syncPreferences.setAutomaticSyncEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('records the choice when it is turned off', async () => {
    syncPreferences.loadSyncPreferences.mockResolvedValue({ automaticSyncEnabled: true });

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(true);
    });

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', false);

    await waitFor(() => {
      expect(syncPreferences.setAutomaticSyncEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('syncs once straight away when it is switched on', async () => {
    // So the answer to "is it working?" is on screen rather than up to thirty
    // seconds away.
    const screen = await renderSignedIn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', true);

    await waitFor(() => {
      expect(scheduler.requestAutomaticSync).toHaveBeenCalledWith('enabled');
    });
  });

  it('goes through the scheduler rather than round it', async () => {
    // The rules that say no — a pending deletion, an unresolved conflict —
    // live there, and a direct call would walk past all of them.
    const screen = await renderSignedIn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', true);

    await waitFor(() => {
      expect(scheduler.requestAutomaticSync).toHaveBeenCalled();
    });

    expect(cloudSyncRun.runCloudSync).not.toHaveBeenCalled();
  });

  it('starts nothing by being switched off', async () => {
    syncPreferences.loadSyncPreferences.mockResolvedValue({ automaticSyncEnabled: true });

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(true);
    });

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByText(/Otomatik senkronizasyon kapatıldı/)).toBeTruthy();
    });

    expect(scheduler.requestAutomaticSync).not.toHaveBeenCalled();
  });

  it('stays where it was when the choice could not be written', async () => {
    syncPreferences.setAutomaticSyncEnabled.mockRejectedValue(new Error('storage unavailable'));

    const screen = await renderSignedIn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', true);

    await screen.findByText('Senkronizasyon tercihi kaydedilemedi.');

    expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(false);
  });

  it('says so, and stays off, when the stored choice could not be read', async () => {
    syncPreferences.loadSyncPreferences.mockRejectedValue(new Error('storage unavailable'));

    const screen = await renderSignedIn();

    await screen.findByText('Senkronizasyon tercihi kaydedilemedi.');

    expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(false);
  });

  it('shows no message from storage when a write fails', async () => {
    syncPreferences.setAutomaticSyncEnabled.mockRejectedValue(
      new Error('SQLITE_FULL: database or disk is full')
    );

    const screen = await renderSignedIn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', true);

    await screen.findByText('Senkronizasyon tercihi kaydedilemedi.');

    expect(screen.queryByText(/SQLITE_FULL|disk is full/)).toBeNull();
  });
});

describe('manual backup while automatic sync is on', () => {
  /** Renders signed in with the switch already on. */
  async function renderWithSyncOn() {
    syncPreferences.loadSyncPreferences.mockResolvedValue({ automaticSyncEnabled: true });

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Otomatik senkronizasyon').props.value).toBe(true);
    });

    return screen;
  }

  it('turns the backup button off', async () => {
    const screen = await renderWithSyncOn();

    expect(screen.getByLabelText('Yedek oluştur').props.accessibilityState.disabled).toBe(true);
  });

  it('says why, rather than leaving a greyed-out button to explain itself', async () => {
    const screen = await renderWithSyncOn();

    expect(screen.getByText(/Otomatik senkronizasyon açıkken "Yedek oluştur" kapalı/)).toBeTruthy();
  });

  it('sends nothing when it is pressed anyway', async () => {
    const screen = await renderWithSyncOn();

    await fireEvent.press(screen.getByLabelText('Yedek oluştur'));

    expect(backup.saveCloudBackup).not.toHaveBeenCalled();
  });

  it('leaves restoring alone, which only reads', async () => {
    const screen = await renderWithSyncOn();

    expect(screen.getByLabelText('Yedeği geri yükle').props.accessibilityState.disabled).toBe(
      false
    );
    expect(screen.getByLabelText('Yedeği kontrol et').props.accessibilityState.disabled).toBe(
      false
    );
  });

  it('gives the backup button back when the switch goes off', async () => {
    const screen = await renderWithSyncOn();

    await fireEvent(screen.getByLabelText('Otomatik senkronizasyon'), 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByLabelText('Yedek oluştur').props.accessibilityState.disabled).toBe(false);
    });
  });

  it('says nothing about it while the switch is off', async () => {
    const screen = await renderSignedIn();

    expect(screen.queryByText(/Otomatik senkronizasyon açıkken/)).toBeNull();
    expect(screen.getByLabelText('Yedek oluştur').props.accessibilityState.disabled).toBe(false);
  });
});

describe('syncing now', () => {
  it('does not sync by being opened', async () => {
    await renderSignedIn();

    expect(cloudSyncRun.runCloudSync).not.toHaveBeenCalled();
  });

  it('does not sync by somebody signing in', async () => {
    const screen = await render(<AccountScreen />);

    await waitFor(() => {
      notify(null);
    });

    await waitFor(() => {
      notify(USER);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Çıkış yap')).toBeTruthy();
    });

    expect(cloudSyncRun.runCloudSync).not.toHaveBeenCalled();
  });

  it('syncs the signed-in account when the button is pressed', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await waitFor(() => {
      expect(cloudSyncRun.runCloudSync).toHaveBeenCalledWith({
        db: DATABASE,
        uid: 'firebase-uid-1',
      });
    });
  });

  it('sends the account id and not the address', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await waitFor(() => {
      expect(cloudSyncRun.runCloudSync).toHaveBeenCalled();
    });

    expect(JSON.stringify(cloudSyncRun.runCloudSync.mock.calls[0][0])).not.toContain(EMAIL);
  });

  it.each([
    [{ kind: 'noop', revision: 3 }, 'Her şey güncel. Telefonun ve hesabın aynı.'],
    [{ kind: 'pushed', revision: 4 }, 'Telefondaki veriler hesabına gönderildi.'],
    [{ kind: 'pulled', revision: 4 }, 'Hesabındaki veriler telefona alındı.'],
    [{ kind: 'merged', revision: 5 }, 'İki taraftaki değişiklikler birleştirildi.'],
  ])('says what happened for $kind', async (outcome, message) => {
    cloudSyncRun.runCloudSync.mockResolvedValue(outcome);

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText(message as string);
  });

  it('says plainly that nothing changed when there is a conflict', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({
      kind: 'conflict',
      reason: 'unresolved',
      conflicts: [
        {
          path: 'periodRecords/period-2026-09-02',
          reason: 'changed-on-both-sides',
          base: { present: true, value: 1 },
          local: { present: true, value: 2 },
          remote: { present: true, value: 3 },
        },
      ],
    });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText(/Çakışma bulundu; hiçbir veri değiştirilmedi/);
  });

  it('counts the conflicts without naming any of them', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({
      kind: 'conflict',
      reason: 'unresolved',
      conflicts: [
        {
          path: 'periodRecords/period-2026-09-02',
          reason: 'changed-on-both-sides',
          base: { present: true, value: 1 },
          local: { present: true, value: 2 },
          remote: { present: true, value: 3 },
        },
      ],
    });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText('Çözülmeyi bekleyen 1 çakışma var.');

    expect(screen.queryByText(/2026-09-02|periodRecords/)).toBeNull();
  });

  it('asks somebody to try again when the account moved first', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'retry-required', actualRevision: 9 });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText(/Tekrar dene/);
  });

  it.each([
    ['network-failed', 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.'],
    ['not-configured', 'Bulut hesabı şu anda yapılandırılmamış.'],
    ['local-failed', 'Telefondaki veriler okunamadı. Hiçbir veri değiştirilmedi.'],
  ])('says what went wrong for %s', async (failure, message) => {
    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'error', failure });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText(message);
  });

  it('refreshes the widget and the reminders when the phone changed', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'pulled', revision: 4 });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(DATABASE, '2026-09-19');
    });

    expect(periodReminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
      DATABASE,
      '2026-09-19'
    );
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledWith(DATABASE);
  });

  it('leaves them alone when nothing on the phone changed', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'pushed', revision: 4 });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText('Telefondaki veriler hesabına gönderildi.');

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
    expect(periodReminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('still reports the sync when a refresh afterwards refuses', async () => {
    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'pulled', revision: 4 });
    widgetSync.syncWidgetSnapshotQuietly.mockRejectedValue(new Error('widget unavailable'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText('Hesabındaki veriler telefona alındı.');
  });

  it('shows no raw message when something outside the sync fails', async () => {
    db.openAppDatabase.mockRejectedValue(new Error('unable to open database file'));

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));

    await screen.findByText(/Senkronizasyon tamamlanamadı/);

    expect(screen.queryByText(/unable to open database file/)).toBeNull();
  });

  it('syncs once for one press and not again on its own', async () => {
    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));
    await screen.findByText('Her şey güncel. Telefonun ve hesabın aynı.');

    expect(cloudSyncRun.runCloudSync).toHaveBeenCalledTimes(1);
  });

  it('turns the button off while a sync is running', async () => {
    const screen = await renderSignedIn();

    // The disabled state is what stops a second tap; the ref behind it is what
    // stops the two that both read it as false in the same frame.
    expect(
      screen.getByLabelText('Şimdi senkronize et').props.accessibilityState.disabled
    ).toBe(false);

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));
    await screen.findByText('Her şey güncel. Telefonun ve hesabın aynı.');

    expect(
      screen.getByLabelText('Şimdi senkronize et').props.accessibilityState.disabled
    ).toBe(false);
  });

  it('writes nothing to the log or the console, whatever the outcome', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    cloudSyncRun.runCloudSync.mockResolvedValue({ kind: 'error', failure: 'network-failed' });

    const screen = await renderSignedIn();

    await fireEvent.press(screen.getByLabelText('Şimdi senkronize et'));
    await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol et.');

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('is not offered to somebody who is signed out', async () => {
    const screen = await renderSignedOut();

    expect(screen.queryByLabelText('Şimdi senkronize et')).toBeNull();
    expect(screen.queryByLabelText('Otomatik senkronizasyon')).toBeNull();
  });
});

describe('the account deletion result outliving the session that produced it', () => {
  /** Opens the delete panel from the signed-in state and fills the password. */
  async function startDeletion(screen: ReturnType<typeof render> extends Promise<infer S> ? S : never) {
    await fireEvent.press(screen.getByLabelText('Hesabı sil'));

    await waitFor(() => {
      expect(screen.getByLabelText('Şifre')).toBeTruthy();
    });

    await fireEvent.changeText(screen.getByLabelText('Şifre'), PASSWORD);
  }

  it('still shows the result after the session ends', async () => {
    // Deleting an account ends its session, so the screen swaps to the
    // signed-out form. The sentence that says what happened to the records has
    // to survive that swap — it used to be rendered inside the signed-in
    // branch, where it was unmounted before anyone could read it.
    deletion.deleteAccount.mockResolvedValue({ kind: 'deleted' });

    const screen = await renderSignedIn();

    await startDeletion(screen);
    await fireEvent.press(screen.getByLabelText('Hesabı kalıcı olarak sil'));

    // Firebase ends the session; the watcher reports it.
    await waitFor(() => {
      notify(null);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('E-posta')).toBeTruthy();
    });

    expect(screen.getByText('Hesabın silindi. Kayıtların bu telefonda kaldı.')).toBeTruthy();
  });

  it('shows the wipe-failed result after the session ends too', async () => {
    deletion.deleteAccount.mockResolvedValue({ kind: 'deleted-wipe-failed' });

    const screen = await renderSignedIn();

    await startDeletion(screen);
    await fireEvent.press(screen.getByLabelText('Hesabı kalıcı olarak sil'));

    await waitFor(() => {
      notify(null);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('E-posta')).toBeTruthy();
    });

    expect(screen.getByText(/Hesabın silindi ama bu cihazdaki kayıtlar silinemedi/)).toBeTruthy();
  });

  it('says nothing when the phone was wiped as well, because the screen is going', async () => {
    deletion.deleteAccount.mockResolvedValue({ kind: 'deleted-and-wiped' });

    const screen = await renderSignedIn();

    await startDeletion(screen);
    await fireEvent.press(screen.getByLabelText('Hesabı kalıcı olarak sil'));

    await waitFor(() => {
      notify(null);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('E-posta')).toBeTruthy();
    });

    expect(screen.queryByText(/Hesabın silindi/)).toBeNull();
  });

  it('clears the result once a new sign-in is started', async () => {
    deletion.deleteAccount.mockResolvedValue({ kind: 'deleted' });

    const screen = await renderSignedIn();

    await startDeletion(screen);
    await fireEvent.press(screen.getByLabelText('Hesabı kalıcı olarak sil'));

    await waitFor(() => {
      notify(null);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('E-posta')).toBeTruthy();
    });

    expect(screen.queryByText('Hesabın silindi. Kayıtların bu telefonda kaldı.')).toBeTruthy();

    // Typing is the start of a new thing; the old result is no longer about it.
    await fireEvent.changeText(screen.getByLabelText('E-posta'), 'a');

    expect(screen.queryByText('Hesabın silindi. Kayıtların bu telefonda kaldı.')).toBeNull();
  });

  it('keeps a failed deletion on the signed-in view, where the panel still is', async () => {
    deletion.deleteAccount.mockResolvedValue({ kind: 'failed', reason: 'network-failed' });

    const screen = await renderSignedIn();

    await startDeletion(screen);
    await fireEvent.press(screen.getByLabelText('Hesabı kalıcı olarak sil'));

    await waitFor(() => {
      expect(
        screen.getByText('İnternet bağlantısı yok. Hesap silinmedi, tekrar deneyebilirsin.')
      ).toBeTruthy();
    });

    // Still signed in: nothing was deleted.
    expect(screen.getByLabelText('Çıkış yap')).toBeTruthy();
  });
});

describe('the status line and the conflict notice', () => {
  it('says nothing has synced before anything has', async () => {
    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByText('Henüz senkronize edilmedi.')).toBeTruthy();
    });
  });

  it('shows when the last sync finished', async () => {
    const when = new Date();
    when.setHours(9, 5, 0, 0);

    lastSyncAt.loadLastSyncAt.mockResolvedValue(when.toISOString());

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByText('Son senkronizasyon: bugün 09:05')).toBeTruthy();
    });
  });

  it('reads storage rather than trusting what the last run reported', async () => {
    // A sync that failed to write its own timestamp must not make this screen
    // claim it succeeded.
    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(lastSyncAt.loadLastSyncAt).toHaveBeenCalled();
    });

    expect(screen.getByText('Henüz senkronize edilmedi.')).toBeTruthy();
  });

  it('says nothing about a conflict when there is none', async () => {
    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByText('Henüz senkronize edilmedi.')).toBeTruthy();
    });

    expect(screen.queryByText(/Çakışma var/)).toBeNull();
    expect(screen.queryByLabelText('Çakışmayı çöz')).toBeNull();
  });

  it('says a conflict is waiting, and what it stops', async () => {
    unresolvedConflict.isConflictUnresolved.mockResolvedValue(true);

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(
        screen.getByText('Çakışma var. Çözülene kadar otomatik senkronizasyon duracak.')
      ).toBeTruthy();
    });
  });

  it('offers the way out of it rather than only the news', async () => {
    unresolvedConflict.isConflictUnresolved.mockResolvedValue(true);

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Çakışmayı çöz')).toBeTruthy();
    });
  });

  it('opens the conflict screen when that is pressed', async () => {
    unresolvedConflict.isConflictUnresolved.mockResolvedValue(true);

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByLabelText('Çakışmayı çöz')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Çakışmayı çöz'));

    expect(push).toHaveBeenCalledWith('/(app)/sync-conflict');
  });

  it('asks only about the account that is signed in', async () => {
    // A conflict belongs to one account. Two can be used on one phone.
    await renderSignedIn();

    await waitFor(() => {
      expect(unresolvedConflict.isConflictUnresolved).toHaveBeenCalledWith(USER.uid);
    });
  });

  it('listens for automatic syncs so the line does not go stale', async () => {
    // The sync that moves this most likely happened while somebody was on
    // another screen.
    await renderSignedIn();

    await waitFor(() => {
      expect(scheduler.onAutomaticSyncOutcome).toHaveBeenCalled();
    });
  });

  it('re-reads both after an automatic sync finishes', async () => {
    let announce: () => void = () => undefined;

    scheduler.onAutomaticSyncOutcome.mockImplementation((listener: () => void) => {
      announce = listener;

      return () => undefined;
    });

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByText('Henüz senkronize edilmedi.')).toBeTruthy();
    });

    const when = new Date();
    when.setHours(11, 20, 0, 0);

    lastSyncAt.loadLastSyncAt.mockResolvedValue(when.toISOString());
    unresolvedConflict.isConflictUnresolved.mockResolvedValue(true);

    announce();

    await waitFor(() => {
      expect(screen.getByText('Son senkronizasyon: bugün 11:20')).toBeTruthy();
    });

    expect(screen.getByLabelText('Çakışmayı çöz')).toBeTruthy();
  });

  it('keeps the line it had when storage cannot be read', async () => {
    // A worry about storage in place of a status line helps nobody.
    lastSyncAt.loadLastSyncAt.mockRejectedValue(new Error('storage unavailable'));

    const screen = await renderSignedIn();

    await waitFor(() => {
      expect(screen.getByText('Henüz senkronize edilmedi.')).toBeTruthy();
    });
  });
});
