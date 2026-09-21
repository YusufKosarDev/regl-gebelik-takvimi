/// <reference types="expo/types" />

// Expo's ambient declarations, referenced from a file that is actually in the
// repository.
//
// The generated `expo-env.d.ts` at the root carries this same reference, but it
// is gitignored — Expo writes it during `start`, `prebuild` and `run:*`, and
// says in its own header that it should not be committed. A clean checkout that
// only runs `npm ci` therefore never has it, which leaves `tsc` with no
// declaration for the side-effect `import '@/global.css'` in
// `src/constants/theme.ts` and fails the type check with TS2882.
//
// Repeating the reference here is harmless when the generated file is present:
// a triple-slash reference to the same types resolves to the same declarations.
