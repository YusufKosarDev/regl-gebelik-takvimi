/**
 * Jest's configuration, moved out of `package.json` so that one number in it
 * can explain itself.
 *
 * Everything below `testTimeout` is what the `"jest"` key held, unchanged.
 */
module.exports = {
  preset: 'jest-expo',

  /**
   * How long a single test may take before Jest calls it failed.
   *
   * ## Why it is not the default
   *
   * Jest's default is 5 seconds. On 14 October 2026 a CI run failed with
   * twenty-eight red tests in `account-screen.test.tsx`, every one of them
   * `Exceeded timeout of 5000 ms`, on a commit that touched nothing in that
   * feature. The same commit passed on a re-run with no change at all:
   *
   *     failing run   account-screen.test.tsx   209 s     whole suite 5m16s
   *     re-run        account-screen.test.tsx    13.4 s   whole suite   47.7 s
   *
   * The runner was degraded by a factor of about seventeen. Nothing was wrong
   * with the code, but the failure did not read that way: twenty-eight tests
   * with real names, reporting what looked like a defect in sign-in.
   *
   * ## Why this number
   *
   * Measured rather than guessed. The slowest single test in this repo takes
   * **2.2 seconds** — `every-screen-english.test.tsx`, which renders
   * twenty-one screens — and the second slowest 2.1. The 5 second default left
   * those with barely twice their own running time in hand, which is why a
   * slow machine took the suite down.
   *
   * 60 seconds is twenty-seven times the slowest real test. That is deliberate
   * and should not be tuned down to something that looks tidier. A timeout
   * here is not a speed limit: nothing is being enforced, and a test that
   * takes four seconds instead of two is not a problem anybody has. The only
   * job of this number is to tell a slow runner apart from a test that will
   * never finish — an unresolved promise, a missing `await`, a fake timer
   * nobody advanced — and those do not take 60 seconds, they take forever.
   *
   * The cost of being generous is that a genuinely hung test holds its worker
   * for a minute before reporting. The cost of being tight is a suite that
   * goes red for reasons that have nothing to do with the code, which is worse
   * in the way that matters: it teaches people that red does not mean broken.
   *
   * **If a test ever fails on this, do not raise it.** At 60 seconds the test
   * is hung rather than slow, and the number is not the thing to change.
   */
  testTimeout: 60000,

  moduleNameMapper: {
    '\\.css$': '<rootDir>/jest/style-mock.js',
  },

  setupFiles: [
    '<rootDir>/jest/expo-localization-mock.js',
    '<rootDir>/jest/async-storage-mock.js',
    'react-native-gesture-handler/jestSetup',
    '<rootDir>/jest/native-ui-mocks.js',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest/fail-on-act-warning.js'],
};
