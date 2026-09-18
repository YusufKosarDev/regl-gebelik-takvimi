import type { Persistence } from 'firebase/auth';

/**
 * What `firebase/auth` really exports on React Native.
 *
 * The `firebase` package ships one set of type definitions, taken from its web
 * build, while Metro resolves the import through `@firebase/auth`'s
 * `react-native` condition to a build that has one more export:
 * `getReactNativePersistence`. The function is there at runtime — it is what
 * the Expo guide tells you to call — but the types this package hands
 * TypeScript do not mention it.
 *
 * So it is declared here rather than silenced at the call site. A `@ts-ignore`
 * would turn off checking for whatever else that line does; this says what the
 * export is and keeps the call type-checked.
 *
 * Deletable the day the umbrella package ships React Native types: the call
 * will still compile, and this file will simply be saying something already
 * said.
 */
declare module 'firebase/auth' {
  /** Anything with the three methods the SDK uses to keep a session. */
  export type ReactNativeAsyncStorageLike = {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  };

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorageLike
  ): Persistence;
}
