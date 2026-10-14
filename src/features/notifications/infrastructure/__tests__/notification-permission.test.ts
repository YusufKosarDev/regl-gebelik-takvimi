import {
  ensureNotificationPermission,
  getNotificationPermissionStatus,
} from '../notification-permission';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const notifications = jest.requireMock('expo-notifications');

beforeEach(() => {
  notifications.getPermissionsAsync.mockReset();
  notifications.requestPermissionsAsync.mockReset();
});

describe('getNotificationPermissionStatus', () => {
  it('reports granted', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: false,
    });

    await expect(getNotificationPermissionStatus()).resolves.toBe('granted');
  });

  it('reports a refusal that can only be undone in settings as denied', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    await expect(getNotificationPermissionStatus()).resolves.toBe('denied');
  });

  it('reports an Android permission nobody has been asked for as undetermined', async () => {
    // POST_NOTIFICATIONS comes back as "denied" before it has ever been asked
    // for. Reading that as a real no means never showing the dialog at all.
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });

    await expect(getNotificationPermissionStatus()).resolves.toBe('undetermined');
  });

  it('reports an undetermined status as undetermined', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
    });

    await expect(getNotificationPermissionStatus()).resolves.toBe('undetermined');
  });

  /**
   * ## This assertion used to say the opposite, and that was the defect
   *
   * It read "trusts granted even when the status string says something else",
   * against `{ status: 'provisional', granted: true }` - an iOS status this
   * app never receives, since there is no iOS build and every channel call is
   * already behind a `Platform.OS` check.
   *
   * On Android 13+ `granted` is the POST_NOTIFICATIONS bit on its own, while
   * `status` is 'granted' only when the permission is held *and*
   * `areNotificationsEnabled()` is true. So a held permission under a denied
   * status is a real state - notifications switched off for the whole app -
   * and the old rule made the app certain it was permitted while Android threw
   * every reminder away. The test passed throughout, because it pinned the
   * rule rather than the outcome.
   */
  it('does not read a held permission as delivery when the status disagrees', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: true,
      canAskAgain: true,
    });

    // 'denied' rather than 'undetermined': no dialog can turn app-level
    // notifications back on, so system settings is the only route and the
    // screen has to offer that one.
    await expect(getNotificationPermissionStatus()).resolves.toBe('denied');
  });

  /**
   * The ambiguity this layer cannot resolve, stated so nobody tries.
   *
   * `canAskAgain` is a flag `expo-modules-core` persists when the app asks, and
   * a successful grant writes it false for good. Revoke that grant in system
   * settings and the response is field for field what an app that has never
   * asked receives - because the platform does not distinguish them at query
   * time either.
   *
   * Which is why nothing here can answer "is somebody waiting for a reminder
   * that will not come", and why the screen asks the stored preference instead.
   */
  it('cannot tell a revoked grant from a permission nobody has been asked for', async () => {
    const neverAsked = { status: 'denied', granted: false, canAskAgain: true };
    const revokedAfterGranting = { status: 'denied', granted: false, canAskAgain: true };

    notifications.getPermissionsAsync.mockResolvedValue(neverAsked);

    await expect(getNotificationPermissionStatus()).resolves.toBe('undetermined');

    notifications.getPermissionsAsync.mockResolvedValue(revokedAfterGranting);

    // The same answer, and it has to be: the dialog is available in both, which
    // is the one thing this status is for.
    await expect(getNotificationPermissionStatus()).resolves.toBe('undetermined');
  });

  it('asks nobody anything', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

    await getNotificationPermissionStatus();

    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('passes a failure on', async () => {
    notifications.getPermissionsAsync.mockRejectedValue(new Error('no notification module'));

    await expect(getNotificationPermissionStatus()).rejects.toThrow('no notification module');
  });
});

describe('ensureNotificationPermission when the answer is not known yet', () => {
  beforeEach(() => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
    });
  });

  it('asks, and reports a yes', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });

    await expect(ensureNotificationPermission()).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('asks, and reports a no', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    await expect(ensureNotificationPermission()).resolves.toBe('denied');
  });

  it('reports a dialog that was dismissed rather than answered', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });

    await expect(ensureNotificationPermission()).resolves.toBe('undetermined');
  });
});

describe('ensureNotificationPermission on Android, before the first ask', () => {
  it('shows the dialog rather than reading the default as a refusal', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });

    await expect(ensureNotificationPermission()).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('ensureNotificationPermission when the answer is already known', () => {
  it('does not ask again after a yes', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: false,
    });

    await expect(ensureNotificationPermission()).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not ask again after a no', async () => {
    // Android does not show the dialog twice, so asking would return the same
    // refusal while looking to the caller like a fresh question.
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    await expect(ensureNotificationPermission()).resolves.toBe('denied');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reads the current status exactly once', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: false,
    });

    await ensureNotificationPermission();

    expect(notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('the permission helper does nothing on its own', () => {
  it('asks for nothing when the module is merely imported', () => {
    // Importing it is what a screen does on open; a dialog there would be a
    // question nobody asked for.
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
