// ESLint flat config.
//
// The base config comes from `eslint-config-expo`, which is version-matched to
// the Expo SDK and already knows about JSX, TypeScript, platform globals and
// the `.android.ts` / `.ios.ts` / `.web.ts` extensions. Everything here on top
// of it is about what to *skip*, not what to enforce.

const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');
const { defineConfig, globalIgnores } = require('eslint/config');

// The two rules this project adds. Neither is style: with the suite pinned to
// Turkish rendering, a hard-coded Turkish string and a date formatted without
// a language both pass every test and still show Turkish to an English user.
// Nothing else catches either one.
//
// One file per rule, and one plugin namespace for both, so a screen sees them
// as what they are - two halves of the same guarantee.
const noTurkishOutsideCatalogues = require('./eslint-rules/no-turkish-outside-catalogues');
const requireLanguageArgument = require('./eslint-rules/require-language-argument');

const i18nPlugin = {
  rules: {
    ...noTurkishOutsideCatalogues.rules,
    ...requireLanguageArgument.rules,
  },
};

module.exports = defineConfig([
  // Nothing generated, vendored or compiled is source, and linting it would
  // report on files that are rewritten by `expo prebuild` or a build anyway.
  globalIgnores([
    'node_modules/',
    'android/',
    'ios/',
    '.expo/',
    'dist/',
    'coverage/',
    'web-build/',
    // The native module is Kotlin plus its Gradle output; only its `src/`
    // TypeScript bridge is linted.
    'modules/*/android/',
    '**/build/',
  ]),

  expoConfig,

  // The Jest setup files run inside Jest, not inside the app, so `jest`,
  // `beforeEach` and `afterEach` are globals there. Without this every mock
  // file reports a handful of `no-undef` errors that say nothing, and real
  // errors sit in the same list waiting to be scrolled past.
  {
    files: ['jest/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  // The icon generator is a Node script run by hand, and `sharp` is installed
  // with `--no-save` on purpose - it is a build tool for this one file, not
  // something the app or CI needs - so it is never resolvable from here.
  {
    files: ['assets/icon-source/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  },

  // `require` is the API in a Jest mock factory, so this rule reports on every
  // test that fakes a module and never on anything anybody will change. Fifty-six
  // standing warnings is not a backlog, it is a screen nobody reads - and the
  // next real warning would have arrived in the middle of it. Off here rather
  // than left to be scrolled past, so the count means something again.
  //
  // Narrow on purpose: only test files and the Jest helpers. A `require` in
  // shipped code is still a warning, which is what the rule is for.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'jest/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { i18n: i18nPlugin },
    rules: {
      'i18n/no-turkish-outside-catalogues': 'error',
      'i18n/require-language-argument': 'error',
    },
  },
]);
