import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import SyncConflictScreen from '@/app/(app)/sync-conflict';
import type { AuthUser } from '@/features/auth/domain/auth-user';

/**
 * The screen that asks somebody to throw one version of their own period
 * history away.
 *
 * Everything under it is faked. What this pins is what the screen shows, what
 * it refuses to show, how many presses a destructive choice takes, and which
 * of the two calls a given press makes — not Firestore, and not the merge.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn(),
  getCurrentAuthUser: jest.fn(),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/features/sync/application/build-conflict-preview', () => ({
  buildConflictPreview: jest.fn(),
}));

jest.mock('@/features/sync/application/resolve-sync-conflict', () => ({
  keepLocalData: jest.fn(),
  keepRemoteData: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/device-id', () => ({
  getDeviceId: jest.fn(async () => 'device-abc'),
}));

jest.mock('@/features/sync/infrastructure/unresolved-conflict', () => ({
  clearUnresolvedConflict: jest.fn(async () => undefined),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(async () => undefined),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(async () => undefined),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(async () => undefined),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/utils/today', () => ({ getTodayLocalISODate: jest.fn(() => '2026-09-21') }));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const authRepository = jest.requireMock('@/features/auth/data/auth-repository');
const previewBuilder = jest.requireMock('@/features/sync/application/build-conflict-preview');
const resolver = jest.requireMock('@/features/sync/application/resolve-sync-conflict');
const unresolvedConflict = jest.requireMock('@/features/sync/infrastructure/unresolved-conflict');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const periodReminder = jest.requireMock(
  '@/features/notifications/application/sync-period-reminder'
);
const db = jest.requireMock('@/storage/db');
const useRouterMock = useRouter as unknown as jest.Mock;

const USER: AuthUser = { uid: 'firebase-uid-1', email: 'someone@example.com' };

const PREVIEW = {
  ifCloudWins: {},
  local: {
    periodRecordCount: 4,
    hasPregnancy: true,
    hasAvatar: false,
    hasCycleSettings: true,
  },
  remote: {
    periodRecordCount: 2,
    hasPregnancy: false,
    hasAvatar: true,
    hasCycleSettings: true,
  },
  revision: 7,
  remoteUpdatedAt: null,
  remoteWrittenByThisDevice: false,
  remotePayload: {},
};

let back: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  back = jest.fn();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  authRepository.observeAuthUser.mockImplementation((listener: (u: AuthUser | null) => void) => {
    listener(USER);

    return () => undefined;
  });
  authRepository.getCurrentAuthUser.mockReturnValue(USER);

  db.openAppDatabase.mockResolvedValue({ name: 'regl-gebelik.db' });
  previewBuilder.buildConflictPreview.mockResolvedValue({ kind: 'ready', preview: PREVIEW });
});

/** Renders and waits for the comparison to appear. */
async function renderLoaded() {
  const screen = await render(<SyncConflictScreen />);

  await waitFor(() => {
    expect(screen.getByLabelText('Bu cihazdakini kullan')).toBeTruthy();
  });

  return screen;
}

describe('what the screen shows', () => {
  it('names both choices', async () => {
    const screen = await renderLoaded();

    expect(screen.getByLabelText('Bu cihazdakini kullan')).toBeTruthy();
    expect(screen.getByLabelText('Buluttakini kullan')).toBeTruthy();
  });

  it('gives counts and presence, and never a date or a value', async () => {
    // This is a screen somebody may be holding in front of another person.
    const screen = await renderLoaded();

    expect(screen.getAllByText('4 kayıt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 kayıt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('var').length).toBeGreaterThan(0);
    expect(screen.getAllByText('yok').length).toBeGreaterThan(0);
  });

  it('asks for the account it is signed in to', async () => {
    await renderLoaded();

    expect(previewBuilder.buildConflictPreview).toHaveBeenCalledWith(
      expect.objectContaining({ uid: USER.uid, deviceId: 'device-abc' })
    );
  });

  it('says so when the account no longer holds anything', async () => {
    previewBuilder.buildConflictPreview.mockResolvedValue({ kind: 'no-remote' });

    const screen = await render(<SyncConflictScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Çözülecek bir çakışma kalmadı/)).toBeTruthy();
    });
  });

  it('clears the note when there is no conflict left to settle', async () => {
    // Otherwise automatic sync stays stopped for a conflict that is gone.
    previewBuilder.buildConflictPreview.mockResolvedValue({ kind: 'no-remote' });

    await render(<SyncConflictScreen />);

    await waitFor(() => {
      expect(unresolvedConflict.clearUnresolvedConflict).toHaveBeenCalled();
    });
  });

  it('says nothing was changed when it could not read both sides', async () => {
    previewBuilder.buildConflictPreview.mockResolvedValue({ kind: 'failed' });

    const screen = await render(<SyncConflictScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Hiçbir veri değiştirilmedi/)).toBeTruthy();
    });

    expect(screen.queryByLabelText('Bu cihazdakini kullan')).toBeNull();
  });
});

describe('choosing a side', () => {
  it('writes nothing on the first press', async () => {
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    expect(resolver.keepLocalData).not.toHaveBeenCalled();
    expect(resolver.keepRemoteData).not.toHaveBeenCalled();
  });

  it('says what will be destroyed before the second press', async () => {
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Buluttakini kullan'));

    await waitFor(() => {
      expect(screen.getByText(/Bu cihazdaki veriler buluttakilerle değiştirilecek/)).toBeTruthy();
    });
  });

  it('keeps the phone when that is confirmed', async () => {
    resolver.keepLocalData.mockResolvedValue({ kind: 'local-kept', revision: 8 });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Bu cihazdakini gönder'));

    await waitFor(() => {
      expect(screen.getByText(/Çakışma çözüldü/)).toBeTruthy();
    });

    expect(resolver.keepRemoteData).not.toHaveBeenCalled();
  });

  it('keeps the account when that is confirmed', async () => {
    resolver.keepRemoteData.mockResolvedValue({ kind: 'remote-kept', revision: 7 });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Buluttakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Buluttakini indir')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Buluttakini indir'));

    await waitFor(() => {
      expect(screen.getByText(/Çakışma çözüldü/)).toBeTruthy();
    });

    expect(resolver.keepLocalData).not.toHaveBeenCalled();
  });

  it('carries the revision the person was shown', async () => {
    // A third device writing while this sat open must not have its work
    // overwritten by a decision made about an older version.
    resolver.keepLocalData.mockResolvedValue({ kind: 'local-kept', revision: 8 });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Bu cihazdakini gönder'));

    await waitFor(() => {
      expect(resolver.keepLocalData).toHaveBeenCalledWith(
        expect.objectContaining({ uid: USER.uid, expectedRevision: 7 })
      );
    });
  });

  it('changes nothing when the confirmation is dismissed', async () => {
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Vazgeç'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Bu cihazdakini gönder')).toBeNull();
    });

    expect(resolver.keepLocalData).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});

describe('after a choice lands', () => {
  it('refreshes the copies when the phone was rewritten', async () => {
    resolver.keepRemoteData.mockResolvedValue({ kind: 'remote-kept', revision: 7 });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Buluttakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Buluttakini indir')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Buluttakini indir'));

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalled();
    });

    expect(periodReminder.syncPeriodReminderQuietly).toHaveBeenCalled();
  });

  it('leaves the copies alone when only the account was rewritten', async () => {
    resolver.keepLocalData.mockResolvedValue({ kind: 'local-kept', revision: 8 });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Bu cihazdakini gönder'));

    await waitFor(() => {
      expect(screen.getByText(/Çakışma çözüldü/)).toBeTruthy();
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('when a choice cannot be applied', () => {
  it('says nothing was changed, and leaves the choices there', async () => {
    resolver.keepLocalData.mockResolvedValue({ kind: 'failed', reason: 'network-failed' });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Bu cihazdakini gönder'));

    await waitFor(() => {
      expect(screen.getByText(/Bağlantı kurulamadı/)).toBeTruthy();
    });

    expect(screen.getByLabelText('Bu cihazdakini kullan')).toBeTruthy();
  });

  it('shows the account as it now is when it moved underneath', async () => {
    // The answer to "the cloud changed" is to show the cloud as it now is, not
    // to argue with the person about it.
    resolver.keepRemoteData.mockResolvedValue({ kind: 'failed', reason: 'revision-moved' });

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Buluttakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Buluttakini indir')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Buluttakini indir'));

    await waitFor(() => {
      expect(screen.getByText(/Seçimini güncel verilere göre tekrar yap/)).toBeTruthy();
    });

    expect(previewBuilder.buildConflictPreview).toHaveBeenCalledTimes(2);
  });

  it('never repeats what the failure said for itself', async () => {
    resolver.keepLocalData.mockRejectedValue(
      new Error('permission denied for users/firebase-uid-1')
    );

    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Bu cihazdakini kullan'));

    await waitFor(() => {
      expect(screen.getByLabelText('Bu cihazdakini gönder')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Bu cihazdakini gönder'));

    await waitFor(() => {
      expect(screen.getByText(/Çakışma çözülemedi/)).toBeTruthy();
    });

    expect(screen.queryByText(/firebase-uid-1/)).toBeNull();
  });
});
