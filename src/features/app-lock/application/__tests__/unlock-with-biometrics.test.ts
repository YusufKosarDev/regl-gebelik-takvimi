import { setAppLock } from '../set-app-lock';
import { unlockWithBiometrics } from '../unlock-with-biometrics';
import { unlockWithPin } from '../unlock-with-pin';

/**
 * Opening with a fingerprint.
 *
 * The guard that stops the prompt's own background transition re-locking the
 * screen is the thing this file is really about. The loop it prevents only
 * happens on a device, so what is asserted here is the contract the device
 * behaviour depends on: set before, cleared after, cleared on every path.
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  (globalThis as Record<string, unknown>).__secureStore = store;

  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytesAsync: jest.fn(async (count: number) =>
    Uint8Array.from({ length: count }, (_, index) => index)
  ),
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
    let hash = 0x811c9dc5;

    for (let index = 0; index < data.length; index++) {
      hash ^= data.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

/** Records what the guard was doing at each moment of the prompt. */
const guardTimeline: boolean[] = [];

jest.mock('../use-app-lock', () => ({
  setAuthenticationInProgress: jest.fn((value: boolean) => {
    guardTimeline.push(value);
  }),
}));

const biometrics = jest.requireMock('expo-local-authentication');
const secureStore = () => (globalThis as Record<string, unknown>).__secureStore as Map<string, string>;

const PIN = '135790';
const WRONG = '246801';
const NOW = 1_800_000_000_000;

beforeEach(() => {
  secureStore().clear();
  guardTimeline.length = 0;

  // Call counts, not just return values: several of these assert the prompt was
  // never shown, and a count left over from the previous test would pass or
  // fail for the wrong reason.
  biometrics.hasHardwareAsync.mockClear();
  biometrics.isEnrolledAsync.mockClear();
  biometrics.authenticateAsync.mockClear();

  biometrics.hasHardwareAsync.mockResolvedValue(true);
  biometrics.isEnrolledAsync.mockResolvedValue(true);
  biometrics.authenticateAsync.mockResolvedValue({ success: true });
});

describe('when biometrics are on', () => {
  beforeEach(async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: true });
  });

  it('opens on a successful print', async () => {
    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'unlocked' });
  });

  it('asks for a strong biometric, not a face a photograph defeats', async () => {
    await unlockWithBiometrics(NOW);

    expect(biometrics.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ biometricsSecurityLevel: 'strong' })
    );
  });

  /**
   * Measured on a device, not reasoned about.
   *
   * With the system fallback left on, Android puts "Use PIN" on the sheet and
   * accepts the DEVICE passcode - and authenticateAsync returns success. An app
   * lock set to one PIN opened to a completely different device passcode.
   *
   * That undoes the thing this feature is most for. The threat is not a
   * stranger; it is somebody who lives with you and has watched you unlock your
   * phone.
   */
  it('refuses the device passcode as a way in', async () => {
    await unlockWithBiometrics(NOW);

    expect(biometrics.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true })
    );
  });

  it('falls back rather than opening when the print is not recognised', async () => {
    biometrics.authenticateAsync.mockResolvedValue({ success: false, error: 'unknown' });

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'failed' });
  });

  /**
   * ## Tapping "PIN'i kullan" is not a failure
   *
   * Every non-success used to come back as `failed`, and the screen answered
   * all of them with "Tanınamadı." — "not recognised". Somebody who had just
   * chosen to type their PIN was told the sensor had rejected them, which is a
   * report of an event that did not happen.
   *
   * Both end at the same pad. Only one of them is worth explaining.
   */
  it.each([
    // What Android actually sends. `user_cancel` is the library's answer for
    // ERROR_NEGATIVE_BUTTON, which is the "PIN'i kullan" button.
    ['the negative button', 'user_cancel'],
    ['the app taking its own prompt down', 'app_cancel'],
    ['the sensor waiting and nothing happening', 'timeout'],
    // iOS spellings of the first two, listed so an iOS build does not start
    // misreporting on the day it exists.
    ['the fallback button, where the platform calls it that', 'user_fallback'],
    ['the system taking the prompt away', 'system_cancel'],
  ])('reports a dismissal as cancelled: %s', async (_name, reason) => {
    biometrics.authenticateAsync.mockResolvedValue({ success: false, error: reason });

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'cancelled' });
  });

  it('still reports a rejected print as a failure', async () => {
    // The distinction is between "nobody was judged" and "the sensor said no",
    // not between one kind of sensor problem and another. A lockout, a wet
    // thumb and an unreadable sensor stay one answer.
    //
    // These are the library's own strings for the rest of the Android error
    // codes, so the two lists together cover everything it can send.
    for (const reason of ['lockout', 'unable_to_process', 'not_available', 'no_space', 'unknown']) {
      biometrics.authenticateAsync.mockResolvedValue({ success: false, error: reason });

      expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'failed' });
    }
  });

  it('treats a refusal with no reason as a failure rather than a cancel', async () => {
    // Saying nothing is not saying "they chose the pad". The safe reading is
    // the one that explains itself.
    biometrics.authenticateAsync.mockResolvedValue({ success: false });

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'failed' });
  });

  it('costs no PIN attempt when it is cancelled either', async () => {
    biometrics.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    await unlockWithBiometrics(NOW);
    await unlockWithBiometrics(NOW);
    await unlockWithBiometrics(NOW);

    expect(await unlockWithPin(PIN, NOW)).toEqual({ kind: 'unlocked' });
  });

  it('clears the guard on a cancel, so coming back still locks', async () => {
    // A flag left set would be worse than the loop it prevents: returning from
    // the background would stop locking at all.
    biometrics.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    await unlockWithBiometrics(NOW);

    expect(guardTimeline).toEqual([true, false]);
  });

  // A wet thumb is not a wrong PIN. The platform runs its own lockout, and
  // charging a PIN attempt too would be two penalties for one event.
  it('costs no PIN attempt when it fails', async () => {
    biometrics.authenticateAsync.mockResolvedValue({ success: false });

    await unlockWithBiometrics(NOW);
    await unlockWithBiometrics(NOW);
    await unlockWithBiometrics(NOW);

    const stored = JSON.parse([...secureStore().values()][0]) as {
      attempts: { failedAttempts: number };
    };

    expect(stored.attempts.failedAttempts).toBe(0);
  });

  it('clears the PIN counters when it succeeds', async () => {
    await unlockWithPin(WRONG, NOW);
    await unlockWithPin(WRONG, NOW);

    await unlockWithBiometrics(NOW);

    const stored = JSON.parse([...secureStore().values()][0]) as {
      attempts: { failedAttempts: number };
    };

    expect(stored.attempts.failedAttempts).toBe(0);
  });

  // A wait on one door of two is not a wait.
  it('is refused while a PIN wait is running', async () => {
    for (let i = 0; i < 6; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'waiting', remainingMs: 30_000 });
    expect(biometrics.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('when biometrics are off or unavailable', () => {
  it('does not prompt when the lock was set without them', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'unavailable' });
    expect(biometrics.authenticateAsync).not.toHaveBeenCalled();
  });

  it('does not prompt when there is no lock at all', async () => {
    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'unavailable' });
  });

  it('reports unavailable when nothing is enrolled on the phone', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: true });
    biometrics.isEnrolledAsync.mockResolvedValue(false);

    expect(await unlockWithBiometrics(NOW)).toEqual({ kind: 'unavailable' });
    expect(biometrics.authenticateAsync).not.toHaveBeenCalled();
  });
});

/**
 * The guard, which is the whole reason this is a use case.
 *
 * On several Android devices the biometric sheet backgrounds the activity. The
 * AppState listener reads that as "they left" and locks — while the sheet that
 * was going to unlock it is still up. A flag left set afterwards would be worse
 * than the loop: returning from the background would stop locking at all.
 */
describe('the guard around the prompt', () => {
  beforeEach(async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: true });
  });

  it('is set before the prompt and cleared after it', async () => {
    await unlockWithBiometrics(NOW);

    expect(guardTimeline).toEqual([true, false]);
  });

  it('is cleared when the print is refused', async () => {
    biometrics.authenticateAsync.mockResolvedValue({ success: false });

    await unlockWithBiometrics(NOW);

    expect(guardTimeline).toEqual([true, false]);
  });

  it('is cleared even when the prompt throws', async () => {
    biometrics.authenticateAsync.mockRejectedValue(new Error('sheet died'));

    await unlockWithBiometrics(NOW);

    expect(guardTimeline).toEqual([true, false]);
    expect(guardTimeline[guardTimeline.length - 1]).toBe(false);
  });

  it('is never set when the prompt is not going to be shown', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });

    await unlockWithBiometrics(NOW);

    expect(guardTimeline).toEqual([]);
  });
});
