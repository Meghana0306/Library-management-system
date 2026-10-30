import js from '@eslint/js'
import react from 'eslint-plugin-react'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    // Some files carry historical disable directives; unused directives are not reported.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    ...js.configs.recommended,
    ...react.configs.flat.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
