# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Android development build

This app now contains a local Expo native module
(`modules/widget-snapshot-bridge`), so Android needs a development build rather
than Expo Go:

```sh
npx expo run:android
```

Expo Go can still run everything else; it simply does not contain the bridge,
and anything that calls it raises an error saying so.

### Building on Windows with a space in your user folder

`android/` is generated and not committed, so `android/local.properties` has to
be re-created after a `prebuild --clean`. On Windows, if your user folder has a
space in it (for example `C:\Users\Ada Lovelace`), point Gradle at paths that do
not:

```properties
sdk.dir=C:/Users/ADALOV~1/AppData/Local/Android/Sdk
ndk.dir=C:/ProgramData/android-ndk-27
```

where `C:\ProgramData\android-ndk-27` is a directory junction to the real NDK:

```sh
New-Item -ItemType Junction -Path C:\ProgramData\android-ndk-27 \
  -Target "C:\Users\Ada Lovelace\AppData\Local\Android\Sdk\ndk\27.1.12297006"
```

Without this, CMake converts the compiler path to an 8.3 short name, `clang++.exe`
becomes `CLANG_~1.EXE`, and clang — which picks its C or C++ mode from `argv[0]` —
runs as the C driver. The C++ standard library is then never linked, and
`react-native-screens` and `react-native-worklets` fail with dozens of
`undefined symbol: operator new` style errors that have nothing to do with this
app's code.
