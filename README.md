# Regl & Gebelik Takvimi

A Turkish-language menstrual cycle and pregnancy tracker for Android, built with
Expo and React Native.

The app has two modes and a switch between them on the home screen:

- **Cycle** — record period starts and ends, see a month calendar, the current
  cycle phase (menstrual, follicular, ovulatory, luteal), the fertility window
  and ovulation estimate, daily supporting content, and a full editable history.
- **Pregnancy** — estimate a due date from the last menstrual period, follow
  week-by-week content for weeks 1–40, adjust the due date, or stop tracking.

Alongside those: a customisable avatar, an Android home-screen widget backed by
a local Kotlin module, local reminder notifications, an optional Firebase
account, cloud backup, and cloud sync that can be run by hand or left to run on
its own.

Health data lives in the app's own SQLite database on the device. Nothing leaves
the phone until somebody signs in and asks for it — by pressing a button, or by
turning on automatic sync — and only the fields listed in
[`docs/data-privacy.md`](docs/data-privacy.md) can ever leave. That document is
tied to the code by a test, so the two cannot drift apart.

Automatic sync has no background task. Every run is the tail of something the
person did: turning the switch on, signing in, bringing the app forward, editing
a record, or closing the app with an edit still waiting. Nothing runs while the
app is closed. It never resolves a conflict on its own — when two sides changed
the same thing, it stops for that account and waits for somebody to choose a
side on the conflict screen.

The user interface is entirely Turkish. Source comments and identifiers are in
English. There is no i18n layer — interface strings are constants in the screen
and presentation modules.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19.2 |
| Language | TypeScript 6 (`strict: true`) |
| Routing | `expo-router` (file-based, `typedRoutes` enabled) |
| Rendering | New Architecture + Hermes, React Compiler enabled |
| Local database | `expo-sqlite` — `regl-gebelik.db`, `user_version` migrations (schema v6) |
| Local key-value | `@react-native-async-storage/async-storage` |
| State | `zustand` (one small store: mode, onboarding flag, hydration) |
| Accounts | Firebase Auth (email + password), persisted via AsyncStorage |
| Cloud backup | Cloud Firestore — a single document at `users/{uid}/backups/current` |
| Notifications | `expo-notifications`, local scheduled reminders only (no push, no FCM) |
| Native module | `modules/widget-snapshot-bridge` — Kotlin, Android only |

There is no analytics, crash reporting, advertising or payment SDK, and the app
makes no network calls of its own beyond the Firebase SDK.

## Project structure

```
src/
├── app/                  expo-router routes
│   ├── (onboarding)/     first-run setup flow
│   ├── (app)/            everything after onboarding completes
│   └── _layout.tsx       startup gate: hydrate state, mount one route group
├── components/           ThemedText / ThemedView
├── constants/            theme tokens (colours, spacing, fonts)
├── features/             the actual domain work — see the layer contract below
├── hooks/                colour scheme and theme hooks
├── navigation/           routing-gate.ts, a pure decision function
├── shared/logging/       event-name allowlist so health data never reaches logs
├── storage/              single DB connection + schema migrations
├── store/                zustand app store
├── types/                AppState, ISODate, ambient declarations
└── utils/                date arithmetic, formatting, "today"
```

### The `features/` layer contract

Every module under `src/features/` follows the same shape, and the boundaries
are enforced by where things are allowed to import from:

| Folder | Holds | May not touch |
| --- | --- | --- |
| `domain/` | pure rules, types and validators | database, network, clock |
| `application/` | use cases that sequence domain + repositories | UI |
| `data/` | SQLite and Firestore repositories | UI |
| `infrastructure/` | platform surfaces (Firebase SDK, notification queue, device id) | domain rules |
| `presentation/` | Turkish labels and messages for screens | data access |
| `components/` | React components belonging to that feature | — |
| `__tests__/` | tests, colocated per folder | — |

The current features are `auth`, `avatar`, `backup`, `cycle`, `notifications`,
`onboarding`, `pregnancy`, `privacy`, `sync` and `widget`.

Keeping `domain/` free of I/O is what makes the rules testable without a device:
the cycle phase calculation, the sync decision table, the three-way merge and the
rules deciding whether an automatic sync may run at all are plain functions.

## Prerequisites

- Node.js 20 or newer (developed on 24) and npm
- Android SDK with platform 36, plus NDK 27
- A Firebase project, if you want the account features to work
- Android Studio or a device/emulator running Android 7.0 (API 24) or newer

## Environment setup

Copy `.env.example` to `.env.local` and fill in the values from the Firebase
console (Project settings → Your apps → Web app → SDK setup and config):

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

These are not secrets — a Firebase web config ships inside every client that
uses it, and what protects the data is the project's security rules in
[`firestore.rules`](firestore.rules), not the config being hidden. They are kept
out of the repository so the source is not pinned to one project and so a key
can be rotated without a release.

If any of the six is missing the app still runs, as an app with no accounts:
signing in raises an `AuthError` with the code `not-configured`, and nothing
else changes.

The rules that actually protect the stored backups are deployed separately,
from this repository — see [Firestore rules](#firestore-rules) below.

## Firestore rules

The security rules live in [`firestore.rules`](firestore.rules) at the root of
the repository. `firebase.json` points the Firebase CLI at that file and
`.firebaserc` pins the project (`regl-gebelik-takvimi`), so neither has to be
passed on the command line. Nothing else is configured: no Hosting, no
Functions, no Storage, no indexes — the app writes one document per user and
runs no queries, so there is no index to declare.

### Deploying

```sh
npm run rules:deploy
```

The script is `npx --yes firebase-tools@15 deploy --only firestore:rules`. The
CLI is deliberately **not** a dependency of this project: it drags in a large
dependency tree that has nothing to do with building the app, and as a
devDependency it would be installed by `npm ci` on every CI run that never
deploys anything. npx fetches it on demand instead.

It has to be `firebase-tools`, not `firebase`. `npx firebase` resolves to the
Firebase **JS SDK** already installed here, which ships no executable, and npm
fails with `could not determine executable to run`.

Once per machine, log in first:

```sh
npx --yes firebase-tools@15 login
```

The account needs write access to the Firebase project.

### Deploy after every change

Editing `firestore.rules` changes nothing on its own. Until the file is
deployed, the rules enforced on the stored backups are whatever was released
last — so a commit that tightens the rules leaves the data as loosely protected
as before, with the repository claiming otherwise.

### Checking that the deployed rules match the file

The deploy itself reports this. Before uploading, the CLI downloads the
released ruleset and compares it with the local file, and says which of the two
happened:

```
i  firestore: latest version of firestore.rules already up to date, skipping upload...
```

means the deployed rules are identical to the file, and nothing was changed.

```
i  firestore: uploading rules firestore.rules...
```

means they differed, and the file has now been released.

`--dry-run` does not answer this question. It stops after the prepare phase,
which only compiles the rules and checks them for errors; the comparison above
happens in the deploy phase, which a dry run skips. A dry run is a syntax
check, not a diff against what is live.

## Icons and artwork

Every icon in the app is one crescent, drawn once. The geometry, the palette
and the code that renders it all live in
[`assets/icon-source/generate-icons.mjs`](assets/icon-source/generate-icons.mjs).
It writes the SVG sources next to itself and the PNGs into `assets/images/`,
so the launcher icon, the three Android adaptive layers, the notification
silhouette, both splash images and the favicon cannot drift apart.

To change any of them, edit that file and run it again:

```sh
npm install --no-save sharp
node assets/icon-source/generate-icons.mjs
```

`sharp` renders the SVG and resizes it. `--no-save` keeps it out of
`package.json` and the lockfile: it is a build tool for this one script, and
nothing the app or CI needs.

### The palette

| | Hex | Where |
| --- | --- | --- |
| Lavender mist | `#EDE8FA` | The crescent itself; the dark-mode splash mark |
| Supporting lavender | `#C3B6E4` | The disc beside the crescent |
| Muted lavender | `#8B7AC0` | The light end of the icon background |
| Deep plum-indigo | `#4A3D78` | The dark end of the icon background; the light-mode splash mark |
| Light-mode accent | `#7160AB` | `Colors.light.primary`; the notification tint; the adaptive icon fallback colour |
| Dark-mode accent | `#B6A9DD` | `Colors.dark.primary` |

The first four are in `Brand` in [`src/constants/theme.ts`](src/constants/theme.ts);
the last two are the interface accent. They differ on purpose. `#8B7AC0` reads
at 3.72:1 on white, which is under WCAG AA, so it stays in the artwork — where
no text sits on it — and the interface uses a darkened sibling in light mode
and a lightened one in dark mode. `src/constants/__tests__/theme-contrast.test.ts`
holds those ratios to AA so the palette cannot be loosened by accident.

### Sizes

The Android adaptive layers are 432×432, which is Expo's 108dp baseline at
xxxhdpi — the largest size `expo prebuild` asks for. The artwork sits in the
middle 72dp of that canvas and the outer ring is left empty, because a
launcher may crop the icon to a circle and only the central 66dp is
guaranteed to survive. The notification icon is 96×96, all white on
transparent, as `expo-notifications` documents.

## Running the app

```sh
npm install
npm run android
```

Other scripts:

```sh
npm start        # Metro bundler
npm run web      # web target (unverified; expo-sqlite needs a WASM setup)
npm run ios      # present, but iOS is not supported — see below
```

### Why a development build is required

This app contains a local Expo native module (`modules/widget-snapshot-bridge`),
so Android needs a development build rather than Expo Go:

```sh
npx expo run:android
```

Expo Go can still run everything else; it simply does not contain the bridge,
and anything that calls it raises an error saying so.

### iOS

Not supported. The native widget module declares `"platforms": ["android"]`, the
`ios/` directory is gitignored and has never been generated, and the `ios`
script is left over from the template.

## Checks

```sh
npm run typecheck  # tsc --noEmit, under strict mode
npm run lint       # ESLint, via eslint-config-expo's flat config
npm test           # Jest — 120 suites, 4733 tests
npm run test:watch # watch mode
```

All three must pass. Lint is clean of errors; the warnings that remain are
`require()` calls in tests, where the module registry is being manipulated on
purpose and an `import` would defeat it.

ESLint is configured in `eslint.config.js`, which composes the base config from
`eslint-config-expo/flat` and ignores everything generated — `android/`, `ios/`,
`.expo/`, build output, and the Kotlin half of the native module.

Beyond ordinary unit tests there are a few contract tests worth knowing about:

- `src/shared/logging/__tests__/no-raw-logging.test.ts` fails if anything logs
  raw values instead of an allowlisted event name.
- `src/features/privacy/domain/__tests__/data-category.test.ts` ties
  `docs/data-privacy.md` to `DATA_INVENTORY` in the code; a category in one but
  not the other fails the suite.
- `src/features/widget/domain/__tests__/widget-snapshot-native-contract.test.ts`
  pins the JS ↔ Kotlin snapshot contract.

The Kotlin module has its own unit tests under
`modules/widget-snapshot-bridge/android/src/test/`, which run through Gradle
rather than Jest.

### Continuous integration

`.github/workflows/ci.yml` runs the same three checks on every push to `main`
and on every pull request, on the Node version in `.nvmrc`. It uses `npm ci`,
so a lockfile that has drifted from `package.json` fails the build.

The workflow needs no secrets and sets no Firebase variables: the suite does not
read them, and without a project the app is simply one with no accounts.

## Android build notes

`android/` is generated by `expo prebuild` and is not committed. Anything
written into it by hand is lost the next time it is regenerated, which is why
the widget receiver is declared in the native module's own manifest instead.

Regenerating it:

```sh
npx expo prebuild --platform android --clean
```

`android/local.properties` is **not** regenerated, so back it up before a clean
prebuild and restore it afterwards.

### Building on Windows with a space in your user folder

On Windows, if your user folder has a space in it (for example
`C:\Users\Ada Lovelace`), point Gradle at paths that do not:

```properties
sdk.dir=C:/Users/ADALOV~1/AppData/Local/Android/Sdk
ndk.dir=C:/ProgramData/android-ndk-27
```

where `C:\ProgramData\android-ndk-27` is a directory junction to the real NDK:

```sh
New-Item -ItemType Junction -Path C:\ProgramData\android-ndk-27 \
  -Target "C:\Users\Ada Lovelace\AppData\Local\Android\Sdk\ndk\27.1.12297006"
```

Without this, CMake converts the compiler path to an 8.3 short name,
`clang++.exe` becomes `CLANG_~1.EXE`, and clang — which picks its C or C++ mode
from `argv[0]` — runs as the C driver. The C++ standard library is then never
linked, and `react-native-screens` and `react-native-worklets` fail with dozens
of `undefined symbol: operator new` style errors that have nothing to do with
this app's code.

## TODO before release

- **Release bundling.** `createBundleReleaseJsAndAssets` currently fails on the
  development machine: `hermesc.exe was blocked by your organization's Device
  Guard policy`. The JS bundle itself is written; only the Hermes bytecode step
  is blocked. A release build needs that policy exception, or another machine.

## License

See [LICENSE](LICENSE).
