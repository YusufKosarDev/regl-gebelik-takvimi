/**
 * The emulator suite's own Jest, separate from the app's.
 *
 * The app suite runs thousands of component tests with no emulator anywhere
 * near them; these few tests cannot run WITHOUT one. Folding them into the
 * main config would make `npx jest` fail on every machine that has not
 * started an emulator, so the main config ignores this directory and the
 * `test:rules` script runs this one inside `firebase emulators:exec`.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|js)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  // Generous for the same reason as the app suite's, scaled to what runs
  // here: a cold emulator answers the first request slowly, and a hung rule
  // evaluation does not take 30 seconds, it takes forever.
  testTimeout: 30000,
};
