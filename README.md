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

### The public pages are in both languages too

The privacy policy and the deletion page are published twice: Turkish at the
root of `docs/` and English under `docs/en/`. `legalPageUrl` takes the
language as a **required** argument for the same reason `formatDisplayDate`
does - a default would be Turkish, and a screen that forgot to pass it would
show an English label over a Turkish document.

| Page | Turkish | English |
| --- | --- | --- |
| Privacy policy | `gizlilik.html` | `en/privacy.html` |
| Account and data deletion | `veri-silme.html` | `en/data-deletion.html` |
| KVKK information notice | `kvkk.html` | *(the same Turkish file)* |

**KVKK is deliberately not translated.** It is the notice required by Turkish
Law No. 6698, addressed to a Turkish regulator, and a translation would read
like the instrument without being it. The English UI links to the Turkish page
and the label says `KVKK notice (Turkish)`, so somebody has been told before
the browser opens rather than after. A test asserts both halves of that: that
the two languages resolve to one file, and that the English label still says
which language it is in.

`src/features/disclaimer/domain/__tests__/legal-pages-exist.test.ts` reads
`docs/` and checks that every URL the app can build names a file that exists,
that the English pages reach the stylesheet one directory up, that each page
declares the `lang` it is written in, and that no English page names an
emergency number. Nothing else connects `legal-links.ts` to `docs/`: a page
renamed in one and not the other typechecks, lints and passes every other test
while shipping a 404 behind "Privacy policy".

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
- A Firebase project, if you want the account features to work
- Android Studio or a device/emulator running Android 7.0 (API 24) or newer
- For a **local** Android build: the Android SDK, with the platform and NDK that
  this Expo SDK asks for — currently platform 36 and NDK 27.1.12297006

### Nothing here pins a toolchain version

That last line is what a local build needs installed, **not a version this
project chose**. It is worth being exact about, because "NDK 27" in a
prerequisites list reads like a pin somebody could bump.

`android/app/build.gradle` says `ndkVersion rootProject.ext.ndkVersion`, and
`compileSdk`, `buildToolsVersion`, `minSdk` and `targetSdk` are read the same
way. Those `ext` values are set by Expo's `expo-root-project` Gradle plugin,
which `android/build.gradle` applies — so they come from the Expo SDK version in
`package.json`, and changing the line above changes nothing. Asked of Gradle
directly, this project currently resolves to:

| | |
| --- | --- |
| `ndkVersion` | 27.1.12297006 |
| `compileSdk` / `targetSdk` | 36 |
| `minSdk` | 24 |
| `buildToolsVersion` | 36.0.0 |

To move any of them, move the Expo SDK. There is no `ndkVersion` in
`gradle.properties` to edit, and `android/` is regenerated by prebuild anyway.

EAS Build supplies its own JDK, SDK and NDK, so none of this applies to a cloud
build — see [App versions and the version code](#app-versions-and-the-version-code).

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

A release build's merged manifest carries **ten** `<uses-permission>` entries.

**Observed, not derived.** The merger considers 34 entries across the app and
every library it links, and removes 24, and the ten below are what
`:app:processReleaseManifestForPackage` actually produced — read out of
`packaged_manifests/release/` by the command under
[Checking a build](#checking-a-build). Every figure here comes from that run and
from the merger's own report, which names the library each entry arrived from.
Before that run this section's ten was reasoned from the *debug* report, which
is a different merge: see the warning at the end of that section.

Six are capabilities this app's own features need:

| Permission | Why | Declared by |
| --- | --- | --- |
| `INTERNET` | The Firebase JS SDK, for accounts, backup and sync | the app's own manifest |
| `POST_NOTIFICATIONS` | Reminders, on Android 13 and newer | `expo-notifications` |
| `RECEIVE_BOOT_COMPLETED` | So a scheduled reminder survives a restart | `expo-notifications` |
| `VIBRATE` | A reminder's own notification | the app's own manifest |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Opening the app lock with a fingerprint or a face | the app's manifest and `expo-local-authentication` |

### Three arrive with Cloud Messaging, which this app does not use

This is the part the derived list had wrong, and it is worth stating plainly
because it is three entries rather than one.

`expo-notifications` depends on `com.google.firebase:firebase-messaging`, and
**that dependency — not any feature of this app — is what declares these:**

| Permission | Declared by |
| --- | --- |
| `ACCESS_NETWORK_STATE` | `firebase-messaging`, also merged from `firebase-installations`, `play-services-cloud-messaging` and `transport-backend-cct` |
| `WAKE_LOCK` | `firebase-messaging`, also merged from `play-services-cloud-messaging` |
| `com.google.android.c2dm.permission.RECEIVE` | `firebase-messaging`, also merged from `play-services-cloud-messaging` |

An earlier version of this table credited `ACCESS_NETWORK_STATE` to the Firebase
SDK checking whether it can reach the server, and `WAKE_LOCK` to delivering a
reminder while the screen is off. Both readings are wrong, and the first could
not have been right: this app talks to Firebase through the **JavaScript** SDK,
which has no Android manifest and cannot contribute a permission to one. Neither
entry appears anywhere in `expo-notifications`' own manifest — local
notifications need neither.

**This app sends no push messages.** Every reminder is scheduled locally on the
device with a `DATE` trigger. So all three are unused, and the honest figure is
that **three of the ten exist because of a push stack that never runs.**

They are left in rather than blocked because they come from a library's own
manifest and `expo-notifications` registers its receiver against the c2dm one;
removing them means excluding the dependency, not adding a line to
`blockedPermissions`. Worth doing before a store release, and worth more than it
looked: it would take the list from ten to seven, and `WAKE_LOCK` in particular
is not a thing a period tracker should appear to want.

### And one that is not a request at all

`com.yusufkosardev.regltakvimi.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is
namespaced to this app's own package and declared by `androidx.core:core:1.18.0`,
which holds it itself so that a dynamically registered receiver is reachable by
nothing else. It grants this app nothing it did not already have, and it is not
what a person sees on a store listing.

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

Ten lines is the expected answer, and ten lines is what it gave on
2026-10-03 — the list is in the table above.

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
node assets/icon-source/generate-icons.mjs
```

`sharp` renders the SVG and resizes it, and is a devDependency. It used to be
installed with `--no-save` on the grounds that it is a build tool rather than
something the app ships. That is true and it was still the wrong call: the next
person to run either generator met a missing module with nothing saying what to
install, and an asset pipeline that works only on the machine that last ran it
is not a pipeline. It is in the lockfile now.

### The store graphics come from the same geometry

[`assets/icon-source/generate-store-graphics.mjs`](assets/icon-source/generate-store-graphics.mjs)
writes the Play feature graphic in both languages and the 512px store icon into
`assets/store/`, which is not bundled into the app.

```sh
node assets/icon-source/generate-store-graphics.mjs
```

It is deliberately not a separate piece of design. The crescent is the icon's
own construction scaled — r=250 cut by r=225 at +108/−52, disc r=60 at
+148/−72 — the gradient is the icon background's two ends, and the dotted arc is
the one the cycle screen draws under the day count. A brand change that reached
the icons and missed the banner is precisely the drift the generator's "the
shapes cannot drift apart" exists to prevent, and the store page is the first
thing anybody sees.

Two things it does that are not obvious:

- **The words are drawn by `ffmpeg`, not by the SVG.** Fraunces is bundled
  rather than installed, and librsvg resolves font families by name — the SVG
  would fall back to whatever serif the machine has and nobody would notice
  until the banner was live. `drawtext` takes a font file by path, so the type
  comes from `node_modules/@expo-google-fonts/fraunces` or it does not render.
- **The line breaks are written out rather than wrapped**, because they have to
  clear the crescent and the two languages are different lengths. At 66px on
  three lines the type ends 189px short of the mark in Turkish and 165px in
  English; the first attempt, 78px on two lines, ran the second line through it.

Play's two fields want different things and the script writes both: the feature
graphic is 1024x500 24-bit with **no** alpha, and the store icon is 512x512
**with** one, which is why it is a re-render of `icon.png` rather than a copy.

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
npm test           # Jest — 250 suites, 6,899 tests
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

### Screen tests render through a safe area provider

`jest/safe-area-test-provider.tsx`, and it is a change in what a lot of tests
are exercising rather than a detail of one.

`useSafeAreaInsets` throws without a `SafeAreaProvider`. The app always has
one — `ExpoRoot` wraps the whole tree in a provider seeded with
`initialMetrics`, which is why a screen can read its own insets on a device
(see `node_modules/expo-router/build/ExpoRoot.js`). A test that renders one
screen starts below that, so it has to supply the same thing.

It is the real provider seeded the same way, not a mocked hook. Mocking the
hook would have tested a hook that does not ship.

Two places use it, and both now exercise the provider for every screen they
render: `src/features/cycle/__tests__/calendar-screen.test.tsx`, because the
calendar reads its top inset to let the sky reach the screen edge, and
`src/app/__tests__/every-screen-english.test.tsx`, which renders all
twenty-one screens and therefore renders that one. A screen that starts
reading its insets needs no new setup in either.

The insets are a 24 point status bar and zero everywhere else. The bottom is
deliberately zero: a screen that only looks right once something is
subtracted from the bottom should fail there rather than pass on a borrowed
inset. Anything asserted about the top edge is asserted against
`SAFE_AREA_TEST_INSETS.top` rather than a literal 24.

### A screenshot is evidence of whatever build is on the device

The device does not announce what it has, and nothing in the capture process
asks. A store screenshot taken from a stale build is wrong in a way that
survives: it goes up on the listing and stays there.

This nearly happened. The first capture of the beyond-horizon screen showed

    Sonraki regl tahmini    4 Ekim 2026

on a device where today was 14 October — a next-period estimate naming a day
ten days gone, which is exactly the defect #33 had been fixed to stop. The fix
was real and committed. The APK on the emulator had been installed at 06:37 and
the fix landed at 10:00, so the build predated it, along with every other
user-visible change made that day: the permission notices, the silenced-channel
line, the weekly reminder's description. Four screenshots would have advertised
behaviour the app no longer had, and one of them would have advertised a
defect.

**Before capturing anything, compare the install time with the commit you mean
to be photographing:**

```sh
adb shell dumpsys package com.yusufkosardev.regltakvimi | grep lastUpdateTime
git log -1 --format='%ad' --date=iso
```

If the build is older, rebuild and reinstall. `./gradlew assembleRelease`
succeeds on this machine; the Hermes block recorded under the local build notes
has not recurred.

**Checking the APK's own bundle needs the right encoding.** Verifying that a
fresh build contains today's copy by grepping
`assets/index.android.bundle` finds nothing, because the bundle is Hermes
bytecode and Turkish strings sit in its string table as **UTF-16LE**. An ASCII
string such as `period-reminder-v1` is findable with plain `grep`; `Beklenen
gün geçti` is not. The check reported a correctly built APK as missing the
day's work until it was calibrated against a string known to be present — the
same discipline as the sweeps above, arriving from the other direction. A false
alarm and a false all-clear cost the same.

```js
const b = fs.readFileSync('index.android.bundle');
b.includes(Buffer.from('Beklenen gün geçti', 'utf16le'));   // true
b.includes(Buffer.from('Beklenen gün geçti', 'utf8'));      // false
```

### Android's own surfaces follow the phone, not the app

A Turkish build on an English phone asks for notification permission in
**English**: "Allow Regl & Gebelik Takvimi to send you notifications?" The
app's language setting reaches the app's own strings and nothing else. The
permission dialog, the channel names' surrounding chrome, the App info page and
the "1 category turned off" summary beneath it are all drawn by Android in the
system locale.

This is worth writing down for two readers. Anybody capturing store screenshots
should know that a system dialog in frame is not evidence of a translation bug
and should not be "fixed" by a code change — the only way to photograph it in
Turkish is to set the **device** to Turkish. And anybody reviewing a report of
one should know the same before filing it.

The channel names themselves *are* the app's: "Regl hatırlatıcıları" and
"Gebelik hatırlatıcıları" appear in Turkish on an English phone, because the
app creates the channels with its own strings. The two sit side by side on the
same settings page, in different languages, and that is correct.

A related one on that page: a channel nothing has ever been posted on is
collapsed under **Show unused categories**, so a freshly installed app shows no
channel rows at all until the first reminder has actually been delivered. A
channel that has been *switched off* is not hidden — being silenced is enough to
make Android count it as used — so the page does show the one the app is
complaining about.

The disclosure stops mattering for this app's own route regardless, because
`CHANNEL_NOTIFICATION_SETTINGS` opens a channel page when it is asked for by
name, used or not. Measured: with neither reminder ever delivered and both
therefore collapsed out of sight, that intent still opened "Regl
hatırlatıcıları" with the app's own Turkish name and description and **Show
notifications** at the top.

### Play's aspect limit rules out a modern phone's native resolution

Google Play requires that a screenshot's **longest side be no more than twice
its shortest**, and recommends 1080x1920 for portrait. The emulator here, like
most current phones, is **1080x2400** — a ratio of 2.22, which fails. Captured
natively it is rejected rather than merely ugly.

So the display is resized for the capture session and reset afterwards:

```sh
adb shell wm size 1080x1920      # exactly 9:16, Play's recommendation
# ... capture ...
adb shell wm size reset
```

The app relayouts for the shorter screen, which is a real supported
configuration rather than a trick. The alternative — cropping 1080x2400 down to
1080x2160 — removes 240px of real interface to buy nothing.

Two more things the capture needs. `adb exec-out screencap -p` emits **32-bit
RGBA**, and Play accepts "JPEG or 24-bit PNG (no alpha)", so each file is
re-encoded (`ffmpeg -i in.png -pix_fmt rgb24 out.png`). And the status bar is
put into a fixed state first, which is what Play means by "edit excess elements
in the notification bar":

```sh
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0930
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
# ... capture ...
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

### A `uiautomator dump` reports clipped rows with inverted bounds

Device evidence in this project is a `uiautomator dump` paired with a
`screencap`, and the dump has one trap worth knowing before trusting it.

A node that is scrolled off the bottom comes back with its top below its
bottom:

```
text="Doğurganlık tahmini"  bounds="[63,2380][1017,2337]"
```

2380 is the top and 2337 is the bottom. Nothing is wrong on screen — the row
is simply below the fold and clipped — but read naively it says a row is
drawn 170 points past the top of a floating tab bar, which is exactly what a
real overlap looks like in that output. Two of this list's findings were
about text reaching the tab bar, so the shape is not hypothetical.

Treat `bottom <= top` as "off screen, measure something else", and confirm
any suspected overlap against the screenshot before reporting it. A check
written over these dumps should compare the lowest **bottom** of every node,
not only the text ones: the ring's dots carry no text and at 200% they come
closer to the bar than any sentence does.

### A dump of the Cycle tab takes four times as long, and can come back stale

The sky drifts. Two `withRepeat(..., -1, true)` animations in `sky-field.tsx`
move the gradient sheets for as long as that tab is on screen, which is
deliberate and documented there. The side effect is that the window never
reports idle, and `uiautomator dump` waits for idle before dumping.

Measured on a device, four runs each:

```
Cycle tab      ~11.3s per dump
Calendar tab    ~2.7s per dump
```

The command does not fail. It waits out its idle timeout and dumps anyway,
roughly nine seconds after it was asked — by which time the screen may have
moved on, so the file describes the state *before* whatever happened in
between. Two stale reads in one session were put down to timing before this
was measured; it is the kind of thing that corrupts evidence quietly rather
than failing loudly.

Turn the animations off while measuring:

```sh
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

The Cycle tab then renders zero frames in fifteen seconds and dumps in 2.5s.
This is a fair test rather than a crippled one: the app reads that setting
through `use-motion-allowed.ts` and stops the drift because somebody asked it
to, so what is being measured is the app behaving as designed. Put the three
settings back to 1 afterwards.


### App info relays out as it loads, and Uninstall arrives under your finger

Driving Android's own settings with `adb shell input tap` is how the
notification checks are run, and the App info page is the one screen on that
route where a mistimed tap is expensive. It renders in two passes: first a
plain list with **Notifications** near the top, then — once the package sizes
have been computed — an Archive / Uninstall / Force stop row appears *above*
the list and pushes everything down by about 220px.

A tap aimed at **Notifications** from a screenshot taken during the first pass
lands on **Uninstall** in the second, and the confirmation dialog is one more
tap from wiping the app and every record in it. This happened once here. It was
cancelled, and `pm list packages` confirmed the package and its 155MB of data
were intact, but nothing about the tap itself said it was about to do that.

So: on that screen, screenshot immediately before every tap and read the
screenshot, rather than reusing coordinates from the one before. Where a direct
intent exists, prefer it to navigating the page at all —

```sh
adb shell am start -a android.settings.APP_NOTIFICATION_SETTINGS \
  --es android.provider.extra.APP_PACKAGE com.yusufkosardev.regltakvimi

adb shell am start -a android.settings.CHANNEL_NOTIFICATION_SETTINGS \
  --es android.provider.extra.APP_PACKAGE com.yusufkosardev.regltakvimi \
  --es android.provider.extra.CHANNEL_ID period-reminders
```

— the first lands on the app's notification page and the second on one
reminder's own, neither with an Uninstall button anywhere on it. The same holds
for `uiautomator dump` on App info: it describes a layout that may already have
been replaced, which is the stale-evidence problem above pointing at something
that deletes data.

**The app sends nobody there any more either.** "Bildirim ayarlarını aç" used to
call `Linking.openSettings()`, which is documented as the app's own settings
and on Android means App info — so a sentence saying a reminder had been
switched off *in the notification settings* handed somebody a page with
Uninstall on it and left them to find Notifications themselves.
`open-notification-settings.ts` sends the two actions above instead, picking
between them by what the panel is reporting.

### Mutation testing, and verifying the mutation landed

A test that says a rule is held is worth only what it costs to break the rule
and watch it fail. The practice in this repo is to break the code deliberately
after writing a rule-carrying test, run the test, and keep the result only if
it goes red for the reason you expected.

**Check that the mutation actually applied before you trust the outcome.** A
mutation that silently fails to apply is indistinguishable from a test that
proves nothing: both come back green, and the second one is a lie you will
quote later.

This is not theoretical either. `themed-text.tsx` was mutated with a `node -e`
replace that matched on `",\n"`. The files in this repo have CRLF endings, so
the pattern never matched, nothing changed, and the suite passed. The
conclusion drawn from that run — "the test does not hold the rule" — was
false; applied with `sed`, the same mutation fails three of four. It was caught
only because the result contradicted a direct measurement of
`StyleSheet.flatten`, which is not a safety net that will be there next time.

So: after applying a mutation and before running anything, confirm the change
is in the file.

```sh
# apply, prove it landed, then run
sed -i '/the line you are removing/d' src/path/to/file.ts
git diff --stat src/path/to/file.ts     # or: grep -c 'the line' src/path/to/file.ts
npx jest src/path/to/__tests__/the.test.ts
```

**Use `sed` or the editor. Do not use a `node -e` string replacement.** Every
file in this repo has CRLF endings, so a pattern written with `\n` matches
nothing and the script exits quietly having changed not one byte. That has now
happened four times, in four separate rounds, each time producing a green run
that was read as "the test does not hold the rule" and each time wrong.

**`perl -0pi -e` fails the same way, and it is the more dangerous one.** It
slurps the file and matches multi-line patterns, which is exactly what you
reach for when removing a block — and `\n` in the pattern will not match
`\r\n`. It reports nothing, exits 0, and the suite goes green.

Worse, it sometimes works, which is how the rule came to be trusted. Several
mutations in the notifications round applied cleanly with `perl -0pi` — but
only because those files had already been rewritten to LF earlier in the same
session. The first one aimed at an untouched file changed nothing and the test
passed. The rule had been holding by luck in the rounds before it.

If you need multi-line matching, normalise first and let git put the endings
back on commit (`core.autocrlf` is `true` here, so the working copy is CRLF
and the index is LF):

```js
// a mutation script that cannot match nothing by accident
const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
if (!s.includes(target)) throw new Error('not found');   // fail loudly
fs.writeFileSync(p, s.replace(target, replacement));
```

The `throw` is the point. A mutation script that cannot tell you it matched
nothing is the same hazard as a test that cannot fail.

A minute spent proving the mutation is real is cheaper than a result that was
never tested. The two rules together:

1. mutate with `sed`, not with a script that matches on line endings;
2. read the file afterwards — `git diff`, or a `grep -c` of the text you
   removed — before running anything.

The second rule is not satisfied by the tool reporting success. One of the
three near-misses was a `String.replace` call given a counter as a third
argument, which JavaScript ignores: the script printed `replacements: 0` while
both replacements had in fact applied. A script's own summary is not evidence
about the file. Read the file.

### Tests that defend the thing they are named against

Five tests in this repo have been found asserting the opposite of the property
in their own name. Every one was green for its entire life, and none was caught
by review. They share a tell worth knowing, because it is visible while you are
writing the assertion:

**The assertion names something only the author could see — an argument, a
literal, a declared value, a branch that was taken — where the property is
something a person would notice.**

| test | what it asserted | what the name promised |
|---|---|---|
| the `lockscreenVisibility` channel test | the option was passed to `setNotificationChannelAsync` | that a reminder did not print its words on a locked screen |
| `app-lock-messages.test.ts` | the copy contained `göremez` | that nothing there promised more than the lock does |
| the day-cell `minHeight` test | a reservation existed | that the drawn label fitted inside it |
| `notification-permission.test.ts` | `granted` was trusted over `status` | that the status reported what the system would deliver |
| `sync-period-reminder-staleness.test.ts` | the staleness gate was reached | that no stale reminder could be queued |

Each of those first columns is true. The channel option *was* passed — Android
discarded it. The copy *did* contain `göremez` — that word was the overpromise.
The reservation *was* 58px — the label drew 92. And each second column is what
somebody would have found out by using the app.

#### A mock is how the insulation gets installed

Four of the five needed one to stay green. Replace the thing standing between
the assertion and the outcome with something that always agrees, and the test
can no longer fail for the reason it exists.
`sync-period-reminder-staleness.test.ts` mocked `period-reminder-scheduler`
wholesale and so reported a reminder "scheduled" for 1 February on a `today` in
April, without complaint, for as long as it existed.

This is not "mocks are bad", and the distinction is sharp enough to apply:

- `sync-pregnancy-weekly-reminder.test.ts` also mocks
  `period-reminder-scheduler`, and should keep doing so. It uses it for two
  negative assertions — `cancelPeriodReminders` and `schedulePeriodReminder`
  were never called — proving the weekly sync never reaches across to the
  period queue. **There the mock is the instrument.** A real module would
  weaken that assertion, not strengthen it.
- `sync-period-reminder.test.ts` mocks the same module for nineteen
  assertions that are about the use case's own contract — cancel counts, call
  ordering, the discreet flag and the language being passed through — and that
  is right too. What was wrong were its two remaining assertions, which named
  a **date** as the outcome while mocking away the rule that decides whether a
  date can be an outcome at all.

So the question is not whether a boundary is mocked. It is whether the property
in the test's name survives the mock. If the mock can make the assertion true
on its own, the test is describing the code rather than the behaviour.

#### One more tell: a fixture pinned to a calendar date

`sync-period-reminder.test.ts` asserted a reminder scheduled for
`2026-09-28`. That was a future date when it was written and a past one from
29 September onwards, at which point the real scheduler would have refused it
and only the mock still said yes. Anything whose correctness depends on "is
this before or after now" counts from the clock:

```ts
const TODAY = getTodayLocalISODate();
const record = addDays(TODAY, -10);   // not '2026-09-01'
```

A date written down stops meaning what it meant, silently, on a day nobody
chose.

#### A different tell: the right assertion, reached by the wrong event

The five above assert the wrong thing. This one asserts exactly the right
thing and never reaches the state it is named for.

`settings-screen.test.tsx` had a test called **"picks up a permission granted
while the app was in the background"**, and a whole `describe` block called
**"the queue after permission arrives from outside the app"**. Both drove
`focusAgain()` — the shared router mock's navigation refocus. Navigation focus
is not the app coming back from Android: a trip to system settings and a press
of Back leaves the same screen focused the entire time, so the one event those
tests were named for was the one event they never fired.

The assertions were right. The notice does clear and the queue is rebuilt — on
a refocus. On a device, somebody who followed this screen's own "Bildirim
ayarlarını aç" button, granted the permission and came back got the notice from
before they left and **no reminders queued at all**; `dumpsys alarm` counted
zero for the package, and two after a tab change. The fix was an `AppState`
listener in `use-data-change-reload.ts`, which is the fourth place in this app
to need one.

The tell is in the name. **If a test's name says *when* — on resume, on
reconnect, after a restart, while backgrounded — read what fires it and ask
whether that is the same event.** A test harness only has the stimuli somebody
built into it, and the easiest stimulus to reach for is rarely the one the name
describes. `focusAgain()` existed; nothing acted out leaving the app, so
nothing did.

The repair is to keep both and name both. `jest/app-state-driver.ts` offers
`returnToForeground()` beside the router mock's `focusAgain()`, and four test
files use it — the same reason `expo-router-mock.js` is shared rather than
copied.

Its listeners are held in a registry that honours `remove()` rather than
replayed out of `mock.calls`, and that is not tidiness. A stand-in that keeps
calling listeners a screen has already removed answers "does an unfocused
screen still read" with a cheerful yes, so the test cannot fail for the reason
it exists. That shortcut was written first here, and it reported a correctly
unsubscribed hook as leaking — a test that could not fail for the right reason,
written while fixing a test that could not fail for the right reason.

### Two scanners for defects nothing else can see

Some faults are invisible to both the test suite and code review, because the
element tree, the types and the logic are all correct and only the pixels are
wrong. Two instruments exist for those.

- `src/components/__tests__/undefined-colour-class.test.ts` runs on every
  `npm test`. It reads the source for a colour that might be `undefined` being
  spread into a style object — the shape that drew the calendar legend's
  predicted-period mark black on a dark page, where it was invisible.
  `StyleSheet.flatten` keeps a key whose value is `undefined`, so such a colour
  overwrites the theme rather than falling through to it. `ThemedText` and
  `ThemedView` now refuse one; this keeps the claim that nothing else does
  true on every run.
- `sweep/scan.ps1` is **not in this repo** — it lives beside it, with its
  captures. It pairs a `uiautomator` dump with a screenshot and measures the
  drawn ink of every label against the bounds of the node it was given,
  flagging any whose ink starts at the left edge and stops short of the right.
  That asymmetry is what a truncated label looks like; a label merely given
  room centres its ink. It found the Turkish export button rendering
  `Verilerini dışa` with " aktar" missing, which depends on the device's
  system locale rather than on the app's language setting and so never appears
  on a Turkish phone. Worth running over the app again before a store build.

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

### The EAS Android build quota, and building locally without it

This account is on the EAS free plan, which allows a limited number of Android
builds per month. **The quota was spent on 13 October 2026 and resets on 1
November**, so `eas build --platform android` fails until then with:

```
This account has used its Android builds from the Free plan this month,
which will reset in 18 days (on Sun Nov 01 2026).
```

That bears on the release schedule, not only on a device pass: there is no new
cloud build before November without upgrading the plan.

Gradle builds the same source locally in the meantime:

```sh
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

Use it to judge layout and copy on a device. Do not use it to conclude anything
about packaging: it is signed with a different key and built in a different
environment from an EAS build, so size, signing and anything install-related
are not comparable. `android/` is generated and gitignored, so the first run
after a clean checkout takes considerably longer.

#### The Hermes step was blocked once and has not been since

`createBundleReleaseJsAndAssets` failed early on with `hermesc.exe was blocked
by your organization's Device Guard policy` — the JS bundle was written and only
the bytecode step refused. That sat under a "TODO before release" heading for a
while saying a release build needed a policy exception or another machine.

It has not recurred. Every local `assembleRelease` on 14 October 2026 succeeded
on the same machine, several of them, in 49s to 1m02s. The note is kept here
rather than deleted because the failure is environmental and could come back
with a policy update — but it is not a blocker, and leaving it written as one
would have had somebody arranging a second machine for a problem that is not
there. A TODO that has quietly stopped being true is worse than no TODO: it is
read as a current state of the build.

### App versions and the version code

Two different numbers, and only one of them is in this repository.

`version` in `app.json` — `1.0.0` — is the name a person sees, on the About
screen and on the Play listing. It is still set here and still committed.

`android.versionCode` is **not in `app.json` any more**, and should not be put
back. `eas.json` sets `cli.appVersionSource: "remote"`, which makes EAS the
source of truth: it stores the version code server-side and
`autoIncrement: true` on the `production` profile raises it on every build. A
local value is ignored, and EAS prints a recommendation to remove it on each
build while one is present.

That is the arrangement worth having, because a duplicate version code is
rejected by Play after the upload rather than before the build, and a number kept
in a committed file only increments if somebody remembers to commit it.

To see the current one:

```sh
eas build:version:get --platform android
```

It is also on each build's page in the EAS dashboard, and in the build log. To
set it by hand — moving to a new store listing, or recovering after an upload
that was rejected — `eas build:version:set --platform android`.

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

## License

See [LICENSE](LICENSE).
