// ESLint flat config (ESLint 9). Catches real bugs (unused vars, undefined globals, hook misuse);
// formatting is delegated to Prettier (eslint-config-prettier turns off any stylistic rules that
// would fight it). Run `npm run lint` to check, `npm run lint:fix` to autofix.
import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'assets/**', 'supabase/**', '.claude/**', '**/*.json', 'ml/.venv/**', 'ml/data/**'] },

  js.configs.recommended,

  // Browser app (React + JSX) — src/**
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules, // new JSX transform: no `React` import needed
      // Classic hook rules only — eslint-plugin-react-hooks@7 also ships experimental rules
      // (set-state-in-effect, etc.) that flag legitimate patterns; keep the two stable ones.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off', // this project doesn't use PropTypes
      'react/no-unescaped-entities': 'off', // quotes/apostrophes in JSX text are fine here
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Node tooling — tools/*.mjs, *.cjs, *.mjs (Node scripts: ai-bridge, seed-admin, etc.)
  {
    files: ['tools/**/*.{mjs,cjs}', '*.cjs', '*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // ML tooling — ml/*.mjs (Node ESM scripts: render_dataset, etc.)
  {
    files: ['ml/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // Browser tool pages — tools/*.js (standalone HTML+JS dev tools served by Vite)
  {
    files: ['tools/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // Tests — node --test
  {
    files: ['test/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // Manga reader: .mjs fetch scripts run under Node; the .js reader/manifest run in the browser.
  {
    files: ['manga/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['manga/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // Config files at repo root run under Node.
  {
    files: ['eslint.config.js', 'vite.config.*'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },

  prettier, // must be last: disables rules that conflict with Prettier
]
