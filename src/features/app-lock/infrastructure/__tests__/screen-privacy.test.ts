/**
 * The app's side of keeping its own screen out of the task switcher.
 *
 * ## Why this file exists
 *
 * This adapter held **18% statement and 20% branch coverage**, and all of it was
 * incidental — two screen tests happen to import it and fake it away. Nothing
 * exercised the three states it exists to turn into something an app can run
 * with: the native module missing, `apply` rejecting, and `blocksScreenshots`
 * throwing.
 *
 * It is a privacy feature, and every one of those states is a path where the
 * wrong choice is silent. Failing loudly on a missing module would stop the app
 * starting in Expo Go; failing loudly on a cold-start rejection would stop it
 * starting on a real phone. The adapter chooses quiet in all three, and quiet is
 * exactly the kind of decision that rots untested.
 *
 * ## What the Kotlin already covers, and what it cannot
 *
 * Which protection suits which Android version is decided in Kotlin and tested
 * there (`ScreenPrivacyPolicyTest`). What crosses this line is one boolean. So
 * this file is about the boundary — never about the policy.
 *
 * The module is faked at the path it is imported from, spelled out as a literal
 * because babel only hoists `jest.mock` above the imports when it can see one.
 */

const mockNative = {
  apply: jest.fn(),
  blocksScreenshots: jest.fn(),
};

jest.mock('../../../../../modules/screen-privacy/src/ScreenPrivacyModule', () => ({
  __esModule: true,
  default: mockNative,
}));

// One object, shared by every fresh copy of the adapter. `jest.resetModules`
// re-runs the factory, so a factory that built its own `jest.fn()` would hand
// each copy a spy this file is not holding — which is how the first version of
// this test came to assert against a mock nothing was calling.
const mockLogging = { logEvent: jest.fn() };

jest.mock('@/shared/logging', () => mockLogging);

const NATIVE_MODULE_PATH = '../../../../../modules/screen-privacy/src/ScreenPrivacyModule';

const logEvent = mockLogging.logEvent;

type Adapter = typeof import('../screen-privacy');

/**
 * A fresh copy of the adapter, told what the native module answers.
 *
 * Both helpers set the answer explicitly, and that symmetry is load-bearing:
 * `jest.doMock` outlives `jest.resetModules`, so a helper that only *removed*
 * the module would leak `null` into every test that ran after it. The first
 * version of this file did exactly that, and the "logs a rejected apply" case
 * failed for a reason that had nothing to do with logging.
 *
 * The registry has to be reset either way, because the adapter binds its import
 * once — `requireOptionalNativeModule` is read at module scope.
 */
function adapterWith(nativeModule: unknown): Adapter {
  jest.resetModules();
  jest.doMock(NATIVE_MODULE_PATH, () => ({ __esModule: true, default: nativeModule }));

  return require('../screen-privacy');
}

/** The adapter as it is with the native module built in. */
function withNativeModule(): Adapter {
  return adapterWith(mockNative);
}

/**
 * The adapter as it is in Expo Go and the web build.
 *
 * `requireOptionalNativeModule` answers `null` there, and the adapter reads
 * that as a value rather than catching a module-not-found.
 */
function withoutNativeModule(): Adapter {
  return adapterWith(null);
}

beforeEach(() => {
  jest.resetModules();
  mockNative.apply.mockReset();
  mockNative.apply.mockResolvedValue(undefined);
  mockNative.blocksScreenshots.mockReset();
  mockNative.blocksScreenshots.mockReturnValue(false);
  logEvent.mockReset();
});

describe('a build with the native module', () => {
  it('says the protection is available', () => {
    expect(withNativeModule().isScreenPrivacyAvailable()).toBe(true);
  });

  it.each([true, false])('passes the lock state straight through for %s', async (enabled) => {
    await withNativeModule().applyScreenPrivacy(enabled);

    // One boolean crosses this line, and this is it. Nothing here reports what
    // is on the screen.
    expect(mockNative.apply).toHaveBeenCalledWith(enabled);
  });

  it('answers whether turning the lock on costs screenshots', () => {
    mockNative.blocksScreenshots.mockReturnValue(true);

    expect(withNativeModule().blocksScreenshots()).toBe(true);
  });
});

describe('a build without the native module', () => {
  it('says the protection is unavailable', () => {
    expect(withoutNativeModule().isScreenPrivacyAvailable()).toBe(false);
  });

  it('applies nothing, quietly', async () => {
    // Refusing to start over a blank thumbnail would be worse than the thing it
    // protects against.
    await expect(withoutNativeModule().applyScreenPrivacy(true)).resolves.toBeUndefined();

    expect(mockNative.apply).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('promises no screenshot cost it cannot deliver', () => {
    expect(withoutNativeModule().blocksScreenshots()).toBe(false);
  });
});

describe('the native module refusing', () => {
  it('logs a rejected apply rather than throwing it', async () => {
    // A cold start can arrive before there is a current activity. That is a
    // state, not a fault, and the next call gets it.
    mockNative.apply.mockRejectedValue(new Error('no current activity'));

    await expect(withNativeModule().applyScreenPrivacy(true)).resolves.toBeUndefined();

    expect(logEvent).toHaveBeenCalledWith(
      'app lock screen privacy failed',
      expect.any(Error)
    );
  });

  it('reads a throwing blocksScreenshots as no', () => {
    mockNative.blocksScreenshots.mockImplementation(() => {
      throw new Error('bridge is not ready');
    });

    // The setup screen asks this to decide what to promise. "No" is the answer
    // that promises nothing.
    expect(withNativeModule().blocksScreenshots()).toBe(false);
  });
});
