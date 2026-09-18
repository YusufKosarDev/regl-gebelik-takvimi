import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

import { AuthError } from '../domain/auth-error';

/**
 * The one place this app talks to Firebase.
 *
 * Nothing above this file imports the SDK. Everything else speaks in this app's
 * own types, so what Firebase is used for stays a question with an answer that
 * fits on one screen — and so swapping it later is a change to one file rather
 * than to every screen that ever touched a `User`.
 *
 * There is no Firestore here and no upload of anything. This step is an account
 * and a session; the health data stays in SQLite on the device, and the
 * boundary that says which of it could ever leave is in
 * `src/features/privacy/` and `docs/data-privacy.md`.
 *
 * The config comes from `EXPO_PUBLIC_*` environment variables. Those values are
 * not secrets — a Firebase web config ships inside every client that uses it,
 * and what protects the data is the security rules on the project, not the
 * config being hidden — but they are also not this repository's to carry: a key
 * committed here is a key that cannot be rotated without a release, and it
 * pins the source to one project.
 */

/** Read as literal expressions, which is what lets Expo inline them at build. */
function readEnvironment(): Record<string, string | undefined> {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
}

/** The variable each field comes from, for an error that can be acted on. */
const ENVIRONMENT_NAMES: Readonly<Record<string, string>> = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

/**
 * Whether this build has been given a Firebase project.
 *
 * Asked rather than assumed, so a build without one can behave as an app with
 * no accounts instead of crashing on a screen that tried to sign in.
 */
export function isFirebaseConfigured(): boolean {
  return Object.values(readEnvironment()).every(
    (value) => typeof value === 'string' && value.trim() !== ''
  );
}

/**
 * The config, or a refusal naming what is missing.
 *
 * The names of the missing variables are in the message; no value ever is, set
 * or unset. Someone reading this error needs to know which variable to set, and
 * knowing that tells them nothing about what belongs in it.
 */
export function readFirebaseConfig(): FirebaseOptions {
  const environment = readEnvironment();

  const missing = Object.keys(ENVIRONMENT_NAMES)
    .filter((field) => {
      const value = environment[field];

      return typeof value !== 'string' || value.trim() === '';
    })
    .map((field) => ENVIRONMENT_NAMES[field]);

  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured. Missing environment variables: ${missing.join(', ')}.`
    );
  }

  return {
    apiKey: environment.apiKey,
    authDomain: environment.authDomain,
    projectId: environment.projectId,
    storageBucket: environment.storageBucket,
    messagingSenderId: environment.messagingSenderId,
    appId: environment.appId,
  };
}

/** The app name, so a second initialisation is recognisably the same one. */
const FIREBASE_APP_NAME = '[DEFAULT]';

/**
 * The one Firebase app.
 *
 * `getApps()` is asked first rather than a module-level flag being kept: fast
 * refresh re-runs this module while the SDK's own registry survives, so a flag
 * would say "not yet" about an app that already exists and the second
 * `initializeApp` would throw.
 */
export function getFirebaseApp(): FirebaseApp {
  const existing = getApps();

  if (existing.length > 0) {
    return getApp();
  }

  return initializeApp(readFirebaseConfig(), FIREBASE_APP_NAME);
}

/**
 * The auth instance, with the session kept across restarts.
 *
 * `initializeAuth` with React Native persistence rather than `getAuth`, which
 * would leave the session in memory: someone who signed in would be signed out
 * by closing the app, which is not what signing in means.
 *
 * The storage is the `AsyncStorage` this app already depends on, so the session
 * lands beside the small amount of app state already kept there. What goes in
 * is the SDK's own token, never anything from the cycle database.
 *
 * Initialised once and then held. A second `initializeAuth` on the same app
 * throws, so the instance is remembered here, and the remembered one is dropped
 * if the app it belonged to is gone — which is what a reload leaves behind.
 */
let auth: Auth | null = null;
let authApp: FirebaseApp | null = null;

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();

  if (auth !== null && authApp === app) {
    return auth;
  }

  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  authApp = app;

  return auth;
}

/**
 * Forgets the remembered instance.
 *
 * For tests, which build a fresh one per case. Nothing in the app calls this:
 * signing out is `signOut`, which keeps the session's storage tidy, while this
 * would only lose track of it.
 */
export function resetFirebaseAuthForTests(): void {
  auth = null;
  authApp = null;
}

/**
 * The auth instance, or an `AuthError` a screen can show.
 *
 * Callers that are about to do something on behalf of a person use this rather
 * than `getFirebaseAuth`, so "this build has no Firebase project" arrives as
 * the same kind of thing as "that password was wrong" instead of as a stray
 * exception with a stack.
 */
export function requireFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new AuthError('not-configured');
  }

  return getFirebaseAuth();
}
