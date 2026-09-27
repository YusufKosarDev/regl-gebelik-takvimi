// ESLint flat config.
//
// The base config comes from `eslint-config-expo`, which is version-matched to
// the Expo SDK and already knows about JSX, TypeScript, platform globals and
// the `.android.ts` / `.ios.ts` / `.web.ts` extensions. Everything here on top
// of it is about what to *skip*, not what to enforce.

const expoConfig = require('eslint-config-expo/flat');
const { defineConfig, globalIgnores } = require('eslint/config');

// The one rule this project adds. It is not style: with the suite pinned to
// Turkish rendering, a hard-coded Turkish string passes every test and still
// shows Turkish to an English user. Nothing else catches that.
const i18nPlugin = require('./eslint-rules/no-turkish-outside-catalogues');

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

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { i18n: i18nPlugin },
    rules: {
      'i18n/no-turkish-outside-catalogues': 'error',
    },
  },
]);
