/**
 * An in-memory AsyncStorage, for every test that does not care about it.
 *
 * ## Why this is global rather than per file
 *
 * The real module is native. Importing it under Jest throws immediately, so
 * until now every test that could reach it mocked it itself - and the ones that
 * could not reach it did not have to think about it.
 *
 * `useLanguage()` changed that. It reads the chosen language from the app
 * store, the store persists through `storage/app-state-storage`, and that
 * imports AsyncStorage. So any test rendering any screen now pulls the native
 * module in, whether or not the test has anything to do with storage. Ten
 * suites would otherwise need a mock apiece for a module they never call.
 *
 * ## It does not override anything
 *
 * A `jest.mock` inside a test file wins over a setup file's, so the suites that
 * mock AsyncStorage on purpose - to assert what was written, or to make a read
 * fail - keep the mock they wrote. This only covers the ones that said nothing.
 *
 * The implementation is the one the library ships for exactly this, rather than
 * a hand-written stub: it behaves like a real store, so a test that does end up
 * writing and reading gets a sensible answer instead of `undefined`.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
