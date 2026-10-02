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

The interface is Turkish and English. Turkish is the source language: every
string exists in it first, and the English side is type-checked against it.
Source comments and identifiers are in English throughout.

Every screen, every message and every piece of health content exists in both.
See [Languages](#languages) for how one is chosen and for the two rules in
`eslint-rules/` that keep a half-translated screen from looking finished.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19.2 |
| Language | TypeScript 6 (`strict: true`) |
| Routing | `expo-router` (file-based, `typedRoutes` enabled) |
| Rendering | New Architecture + Hermes, React Compiler enabled |
| Local database | `expo-sqlite` — `regl-gebelik.db`, `user_version` migrations (schema v8) |
| Local key-value | `@react-native-async-storage/async-storage` |
| State | `zustand` (one small store: mode, onboarding flag, hydration) |
| Accounts | Firebase Auth (email + password), persisted via AsyncStorage |
| Cloud backup | Cloud Firestore — a single document at `users/{uid}/backups/current` |
| Notifications | `expo-notifications`, local scheduled reminders only (no push, no FCM) |
| Native modules | `modules/widget-snapshot-bridge` and `modules/screen-privacy` — Kotlin, Android only |

There is no analytics, crash reporting, advertising or payment SDK, and the app
makes no network calls of its own beyond the Firebase SDK.

## Project structure

```
src/
├── app/                  expo-router routes
│   ├── (onboarding)/     first-run setup flow
│   ├── (lock)/           the PIN screen, when a lock is set
│   ├── (app)/            everything after onboarding completes
│   └── _layout.tsx       startup gate: hydrate state, mount one route group
├── components/           shared UI: themed primitives, error boundary, language picker
├── constants/            theme tokens (colours, spacing, fonts)
├── features/             the actual domain work — see the layer contract below
├── hooks/                colour scheme and theme hooks
├── i18n/                 which language the interface is in, and how that is decided
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
| `presentation/` | the Turkish/English catalogue pair for screens | data access |
| `components/` | React components belonging to that feature | — |
| `__tests__/` | tests, colocated per folder | — |

The current features are `app-lock`, `auth`, `avatar`, `backup`, `cycle`,
`daily-log`, `deletion`, `disclaimer`, `notifications`, `onboarding`,
`pregnancy`, `privacy`, `sync` and `widget`.

Keeping `domain/` free of I/O is what makes the rules testable without a device:
the cycle phase calculation, the sync decision table, the three-way merge and the
rules deciding whether an automatic sync may run at all are plain functions.

## Languages

The app is Turkish and English. Turkish is the source language, and that is a
technical fact rather than a preference: every string is written in Turkish
first, the English catalogue is typed against the Turkish one, and a key that
exists in one and not the other is a compile error where the pair is declared.

### How a language is chosen

`src/i18n/language.ts` decides, as a pure function of two things — what the
person stored and what the phone says:

- A stored `'tr'` or `'en'` wins over everything. Somebody who chose is not
  asked again by a phone that disagrees.
- `'system'` follows the phone: a device asking for Turkish gets Turkish, and
  **anything else gets English**. Not Turkish — a Turkish speaker with an
  English phone can find the setting, while somebody handed a language they
  cannot read has no idea what they are looking for.
- A device that will not answer gets **Turkish**, the source language. `null`
  from `getLocales()` is not a device asking for English; it is a device that
  did not answer.

`src/i18n/device-locale.ts` is the only module that talks to
`expo-localization`, and every one of its three reads can return `null`.

The stored side comes from one place: a three-choice row in settings — Türkçe,
English, and follow the phone. The two languages name themselves in both
interfaces rather than being translated, because the person most likely to open
that row is somebody who has landed in a language they cannot read, for whom a
translated list of languages is a list of words they cannot match to anything.
Only "follow the phone" is translated, because it is a sentence rather than a
name.

"Follow the phone" is a third answer, not a default that collapses into one of
the other two. It and "Türkçe" produce the same interface on a Turkish phone and
different ones on the next, and somebody who picked the first did not pick the
second.

The preference is an optional field on the stored app state. A state written
before the field existed loads without it and resolves to "follow the phone",
and `validateAppState` checks the field only when it is present: a missing
field is an older shape, not a corrupt one. A bad `mode` still throws.

Code that cannot call a hook — schedulers, the widget write, anything running
outside React — reads `currentLanguage()` instead, which resolves the same two
inputs from the store directly.

### What a language change does not reach immediately

Two things keep the words they were already given, and both are visible to
somebody who switches:

- **A reminder already queued keeps the language it was scheduled in.** Android
  holds the notification text, not the app, so retranslating a pending reminder
  would mean cancelling and rescheduling it. The reminders reschedule on their
  own triggers, so the next one arrives in the new language.
- **The widget follows at the next snapshot write.** It renders the last
  snapshot the app wrote, so it changes when something writes one, not at the
  moment the row is pressed.

### How a feature holds its strings

One catalogue pair per feature, in its `presentation/` folder. The Turkish
object is written without `as const` — that would give it string-literal types
and the English half could not then differ — and its inferred type is the
contract the English half is checked against:

```ts
const xMessagesTr = { title: 'Geçmiş kayıtlar' };

export type XMessages = typeof xMessagesTr;

const xMessagesEn: XMessages = { title: 'History' };

export const xMessages: Messages<XMessages> = { tr: xMessagesTr, en: xMessagesEn };
```

A screen reads the pair with `useMessages(xMessages)`, which is a bare hook
with no provider, mirroring `useTheme()`.

`src/features/daily-log/` is the worked example — it was converted first and the
rest follow its shape. Nearly every catalogue also re-exports its Turkish
strings under their original constant names; that block is a transitional crutch
for the roughly two thousand existing assertions that name those constants, not
part of the pattern. A string added after the second language gets no such
export, and each catalogue's test lists the ones that deliberately have none.

### Dates

`src/utils/format-date.ts` holds a month table per language and takes the
language as an argument. It does not use `Intl`: Hermes projects Android's own
ICU, whose data varies by device, so `Intl` would fall back to English on some
phones and not others.

### The two rules that keep it honest

Both live in `eslint-rules/` and are registered in `eslint.config.js`. Neither
is style — they exist because the test suite **cannot** catch what they catch.
`jest/expo-localization-mock.js` pins the suite to a Turkish device, so a
screen that ignores the catalogue still renders correctly in every test.

| Rule | Forbids |
| --- | --- |
| `no-turkish-outside-catalogues` | a string literal with a Turkish-specific letter outside a presentation catalogue |
| `require-language-argument` | calling `formatDisplayDate` / `formatDisplayMonth` without a language |

The second exists because the language argument is optional and defaults to
Turkish. That default is what lets the assertions written before the second
language existed keep calling with one argument and keep proving the Turkish
output is unchanged; the rule is what stops it being reachable anywhere else.

`no-turkish-outside-catalogues` carries an allow-list, and it is no longer a
list of things waiting their turn — the `TEMPORARY` entries are gone. What
remains is Turkish that is meant to stay: the Turkish half of a pair. The month
tables in `src/utils/format-date.ts`, the weekly pregnancy content, the daily
cycle support text and the avatar names all exist in both languages but live
outside `presentation/`, each for a reason written where its entry sits. One
entry is not interface text at all: `data-category.ts` holds the Turkish prose
that `docs/data-privacy.md` mirrors, and a test binds the two.

### What proves the migration finished

Not an empty allow-list. The claim rests on two things instead.

Every presentation catalogue exports a `Messages<T>` pair, and every pair has a
parity test built on `jest/catalogue-parity.ts`. That helper holds the two
halves to the same keys, the same shapes and the same list lengths; it refuses a
Turkish letter in an English value, and an English value identical to its
Turkish counterpart unless the file names the exception and the exception is
itself asserted to exist. It **calls** every function the catalogue has rather
than counting them, because a sentence assembled inside a function body is
invisible to the type system.

The four two-language files outside `presentation/` carry the same kind of test
beside them, so being on the allow-list buys a file nothing: it still has to
prove it has both halves.

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

## What must not be committed

`.gitignore` refuses `google-services.json` and `GoogleService-Info.plist`, and
that is deliberate rather than tidiness.

This app reaches Firebase through the **JS SDK**, configured from the
`EXPO_PUBLIC_FIREBASE_*` variables. It uses Authentication and Cloud Firestore
and nothing else. `expo-notifications` still declares Cloud Messaging
components in the merged manifest — `ExpoFirebaseMessagingService` and
`FirebaseInstanceIdReceiver` — but they are inert, because the native Firebase
SDK has no project to initialise from and the Google Services Gradle plugin is
not applied.

Dropping `google-services.json` into `android/app/` would change that. The
native SDK would initialise, those components would become live, and the app
would register for Cloud Messaging. The published privacy policy states that
no Firebase product other than Authentication and Firestore is used, so that
file turns a true statement into a false one without anybody editing a line of
code.

If push notifications are ever genuinely needed, the policy and
[`docs/data-privacy.md`](docs/data-privacy.md) have to change first.

## Android permissions

A release build's merged manifest carries ten `<uses-permission>` entries.
Eight of them are capabilities the app asks the person for, and each is here
because something needs it:

| Permission | Why |
| --- | --- |
| `INTERNET` | The Firebase SDK, for accounts, backup and sync |
| `ACCESS_NETWORK_STATE` | Same — the SDK checks whether it can reach the server |
| `POST_NOTIFICATIONS` | Reminders, on Android 13 and newer |
| `RECEIVE_BOOT_COMPLETED` | So a scheduled reminder survives a restart |
| `VIBRATE` | A reminder's own notification |
| `WAKE_LOCK` | Delivering one while the screen is off |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Opening the app lock with a fingerprint or a face |

The other two are not capability requests and are not what a person sees on a
store listing:

- `com.yusufkosardev.regltakvimi.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is
  namespaced to this app's own package. AndroidX declares it and holds it
  itself, so that a dynamically registered receiver is reachable by nothing
  else. It grants this app nothing it did not already have.
- `com.google.android.c2dm.permission.RECEIVE` arrives from
  `com.google.firebase:firebase-messaging`, by way of `expo-notifications`.
  **This app sends no push messages** — every reminder is scheduled locally on
  the device — so the permission is unused. It is left in rather than blocked
  because it is what `expo-notifications` registers its receiver against, and
  removing it is a change to that library's wiring rather than a line in
  `app.json`. Worth revisiting before a store release: if it can go, the app
  asks for nothing it does not use.

There is no location, no camera, no contacts, no storage and no calendar
permission, because there is no feature that would use one.

### The twenty-four that are blocked

The manifest merger considers thirty-four `<uses-permission>` entries across
the app and every library it links. Twenty-four are removed, leaving the ten
above. They break down as twenty from **ShortcutBadger** — which
`expo-notifications` depends on for drawing an unread count on the launcher
icon — plus four others:

```
com.android.launcher.permission.INSTALL_SHORTCUT / UNINSTALL_SHORTCUT
com.android.launcher.permission.READ_SETTINGS / WRITE_SETTINGS
android.permission.READ_APP_BADGE
… and OEM badge permissions for Samsung, HTC, Sony, Huawei, Oppo, Anddoes,
   Majeur and Badger
```

The four others are
`com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`,
which is Play's install-attribution service, and the three that were blocked
before any of this: `SYSTEM_ALERT_WINDOW` and read/write external storage.

None of them is used. `foreground-notification-handler.ts` sets
`shouldSetBadge: false` and says why — this app keeps no unread count, and a
number nothing ever clears is worse than no number — so the badge code never
runs, and nothing here reads an install referrer. They are listed in
`android.blockedPermissions` in `app.json`, which adds `tools:node="remove"` to
each and drops them at merge time.

This matters more than tidiness. The permission list is what somebody reads on
the Play listing before installing a period tracker, and "read launcher
settings" and "install shortcuts" are not things this app should appear to
want.

### Checking a build

The manifest is produced long before the JS bundle, so this works even on a
machine where the Hermes step is blocked:

```sh
cd android && ./gradlew :app:processReleaseManifestForPackage
grep -oE '<uses-permission[^>]*android:name="[^"]+"' \
  app/build/intermediates/packaged_manifests/release/*/AndroidManifest.xml \
  | grep -oE 'android:name="[^"]+"' | sort -u
```

Ten lines is the expected answer.

Match the whole name rather than a `permission\.[A-Z_]+` tail. Two of the ten
do not have that shape — `com.google.android.c2dm.permission.RECEIVE` has a
digit in it and the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` has no
`.permission.` segment at all — and a pattern that misses them reports eight
and looks like a clean answer.

To see what was removed as well as what survived, read the merger's own report,
which names every entry and the library it came from:

```sh
grep -oE 'uses-permission#[a-zA-Z0-9._]+' \
  app/build/outputs/logs/manifest-merger-release-report.txt | sort -u
```

**Use the release variant, not debug.** A debug manifest also carries
`SYSTEM_ALERT_WINDOW`, which comes from
`react-native/ReactAndroid/src/debug/AndroidManifest.xml` for the dev menu
overlay. It is not in a release build, and `blockedPermissions` does not remove
it from a debug one — which looks alarming and is not.

Changing `blockedPermissions` in `app.json` does **not** change a build on its
own. The Expo config plugin writes the `tools:node="remove"` attributes into
`android/app/src/main/AndroidManifest.xml` at prebuild time, and that file is
what Gradle merges. Editing `app.json` and re-running Gradle merges the old
manifest and proves nothing.

## Android auto backup

Android copies an app's data to the user's Google Drive by default. This app
is excluded from that, because the privacy policy says health data leaves the
phone only when the person asks it to, and the default would have made that
untrue.

Two mechanisms, both in [`plugins/with-backups-disabled.js`](plugins/with-backups-disabled.js)
and `android.allowBackup` in `app.json`, because Google documents that on some
manufacturers' devices `allowBackup="false"` stops the Drive backup but not
the device-to-device transfer.

To check a build:

```sh
adb shell bmgr backupnow com.yusufkosardev.regltakvimi
```

`Backup is not allowed` is the answer to expect.

## Why the database is not encrypted

`regl-gebelik.db` is a plain SQLite file. That is a decision, taken on
2026-09-27 after measuring the alternative, not something nobody got round to.

What protects it today is Android itself: file-based encryption while the
device is locked, app-private storage no other app can read, and the auto
backup above turned off so no copy leaves the phone.

The alternative considered was SQLCipher, which `expo-sqlite` supports through
the `expo.sqlite.useSQLCipher` Gradle property. The investigation went far
enough to build the module and take real measurements.

### What it would have cost

| | |
| --- | --- |
| A third-party OpenSSL | `io.github.ronickg:openssl:3.3.2-1`, an ndkports AAR on Maven Central. The POM names one developer, no organisation and no email. No dependency verification is configured in this project, so nothing would notice a substitution. |
| Download size | `libcrypto.so` is 5,755,512 bytes for arm64-v8a (4,235,428 for armeabi-v7a, 4,662,888 for x86, 5,954,584 for x86_64) against a 57 MB arm64 native baseline. |
| A SQLite downgrade | The vendored SQLCipher 4.7.0 sits on SQLite **3.49.1**; the plain build ships **3.50.3**. Encryption means tracking SQLCipher's rebase cadence rather than SQLite's. |
| A build that does not work yet | Two separate problems, below. |
| Packaging that is unproven | The OpenSSL AAR carries its `.so` files only under `prefab/`, which is for linking, with no `jni/` directory — and the dependency is `compileOnly`. `libcrypto.so` is very likely not packaged, and it is not an NDK public library, so the system copy cannot stand in. Nobody has run a build far enough to find out. |

Two build problems, and only one of them is real:

- **The NDK versions conflict.** `expo-sqlite` compiled from source pins NDK
  27.0.12077973; React Native 0.86's own modules pin 27.1.12297006; `ndk.dir`
  is a single global setting. The baseline never hits this because
  `shouldUsePublication.groovy` makes `expo-sqlite` ship as a prebuilt AAR —
  setting any of its build properties turns that off and the module compiles.
- **The link errors were self-inflicted**, and this is recorded so the next
  person does not repeat the diagnosis. Removing `ndk.dir` to let each module
  resolve its own version made Gradle use a path containing a space, which is
  the `CLANG_~1.EXE` problem documented under
  [Building on Windows with a space in your user folder](#building-on-windows-with-a-space-in-your-user-folder).
  A second directory junction pointing at 27.0.12077973 would probably clear
  both. The build cost is smaller than it first appeared.

### The reason that actually decided it

Losing the key means losing everything, and the key can be lost without anybody
doing anything wrong.

The key would live in `expo-secure-store` — Android Keystore over
SharedPreferences, the same place the app lock's hash lives. Read
`SecureStoreModule.kt` and two of its failure paths return `null` **silently**:
`KeyPermanentlyInvalidatedException` logs a warning and returns null, and
`BadPaddingException` *deletes the stored entry* and returns null, with a
comment saying this usually means the app was reinstalled.

Today that is harmless, and `lock-record-store.ts` says why in as many words:
failing open "disables a lock that was never encrypting anything — the database
was plaintext either way." Encryption removes that escape. The same silent null
would leave a database that is intact, unreadable, and unrecoverable.

The way back would be the cloud backup — and **the account is optional and off
by default**. So for most people the trade would be a rare but total loss
against protection from someone obtaining a copy of the database file, which is
rarer still.

### And it would not have covered the likely threats anyway

A rooted device defeats it: the app reads the key on every launch, so anything
running as root can have it. Someone holding the unlocked phone with the app
open is untouched by it — that is what the app lock is for. The home-screen
widget snapshot in `shared_prefs/` stays plaintext either way, as do the auth
session and app state in AsyncStorage.

### What would change the decision

Any one of these is worth reopening it for:

- **A first-party encrypted storage option in Expo.** The dependency argument
  and most of the build argument disappear together.
- **A maintained, multi-party OpenSSL artifact**, or `expo-sqlite` vendoring
  the crypto itself. One maintainer supplying the primitive that protects a
  period history is the part that does not sit well.
- **Making the account non-optional**, or shipping some other guaranteed
  recovery path. That is what turns key loss from unrecoverable into annoying,
  and it is the single change that matters most.
- A threat this does cover becoming the realistic one — device seizure or
  forensic extraction as a design case rather than a hypothetical.

If it is reopened: the first thing to build is not the key handling. It is a
build that links, loads and runs, with `libcrypto.so` proven to be in the APK,
and cold-start timings measured against the baseline. Everything else is
downstream of that.

## Two rules about stored data

Both exist because this app keeps a period history, and the way to lose one
is not a crash — it is a newer build and an older build disagreeing quietly.

### Never overwrite what you cannot reproduce

The cloud payload is versioned, and a field may be **added** to a version
without changing the number. An older build reads past a field it does not
know and keeps it: that is what `parseCloudSyncPayloadV1` promises.

The danger is the write, not the read. A build that has no table for a field
rebuilds its payload without it, and a push would then delete whatever a newer
phone wrote. So every write reads what it is about to replace, inside the same
transaction, and refuses when this build cannot reproduce it:

| | |
| --- | --- |
| `unknownCloudSyncPayloadFields` | names the fields this build has no meaning for |
| `pushRemoteSyncState` | refuses with `refused-unknown-fields` |
| `saveCloudBackup` | refuses with `OutdatedAppError` |
| `mergeCloudSyncPayload` | carries them through, as a backstop |

The marker is **derived, not stored**. A later build that adds a field does not
have to announce it anywhere — the field is the announcement, and every earlier
build can see it by comparing what it was handed against what it knows. A flag
written beside the payload could be forgotten or wrong, and would only work for
builds shipped after the flag existed.

Pulling is always allowed. An older build may read and restore everything it
understands; it just may not write over the rest.

The content hash stays deliberately blind to unknown fields. It answers "would
a restore write something different?", and a build with no table for a field
cannot write it either way — the reasoning is in `cloud-sync-hash.ts`.

### Catalogue entries are hidden, never removed

Avatar options, and the symptom, flow and mood catalogues. The database stores
the id and deliberately does not constrain it to the catalogue, so that adding
an option needs no migration. The price is that deleting one does not delete
the rows pointing at it — it only makes them unreadable, and what somebody
chose disappears from their own record.

To retire an entry, mark it hidden so it is not offered to anyone choosing now,
and leave it in the catalogue so what was already chosen still has a name.

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

This app contains two local Expo native modules
(`modules/widget-snapshot-bridge` and `modules/screen-privacy`), so Android
needs a development build rather than Expo Go:

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
npm test           # Jest — 222 suites, 6,501 tests
npm run test:watch # watch mode
```

All three must pass. Lint is clean of errors; the warnings that remain are
`require()` calls in tests, where the module registry is being manipulated on
purpose and an `import` would defeat it.

ESLint is configured in `eslint.config.js`, which composes the base config from
`eslint-config-expo/flat` and ignores everything generated — `android/`, `ios/`,
`.expo/`, build output, and the Kotlin half of the native modules. The two
project-specific rules it adds are described under [Languages](#languages).

**After editing anything in `eslint-rules/`, delete `.expo/cache/eslint` before
trusting `npm run lint`.** `expo lint` passes `--cache`, and ESLint's cache is
invalidated by a change to the config file — not by a change to a rule module
the config `require`s. So a rule edit leaves every file's previous result cached
and the run reports clean. This is not theoretical: the marker list in
`no-turkish-outside-catalogues` was added, `npm run lint` said zero errors, and
`npx eslint "src/app/(app)/history.tsx"` said two. Clearing the cache made the
same two appear.

```sh
rm -rf .expo/cache/eslint && npm run lint
```

Beyond ordinary unit tests there are a few contract tests worth knowing about:

- `src/shared/logging/__tests__/no-raw-logging.test.ts` fails if anything logs
  raw values instead of an allowlisted event name.
- `src/features/privacy/domain/__tests__/data-category.test.ts` ties
  `docs/data-privacy.md` to `DATA_INVENTORY` in the code; a category in one but
  not the other fails the suite.
- `src/features/widget/domain/__tests__/widget-snapshot-native-contract.test.ts`
  pins the JS ↔ Kotlin snapshot contract.
- `src/utils/__tests__/format-date-tables.test.ts` holds the two month tables
  against each other, so a table pasted from the other and left unedited fails
  rather than shipping.
- `src/i18n/__tests__/jest-environment-language.test.ts` pins the suite to a
  Turkish device. Roughly 2,250 assertions depend on it, so it is a tripwire
  rather than a test of the mock.
- `src/app/__tests__/error-boundary.test.tsx` asserts that neither the thrown
  message nor its stack reaches the screen.

Both Kotlin modules have their own unit tests, under
`modules/widget-snapshot-bridge/android/src/test/` and
`modules/screen-privacy/android/src/test/`. They run through Gradle rather than
Jest, so `npm test` does not cover them and neither does CI.

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
