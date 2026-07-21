// ESLint 9 flat config - minimal TypeScript/React Native setup
module.exports = [
  {
    ignores: ['node_modules/', 'dist/', '.expo/', '.expo-types/'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        __DEV__: 'readonly',
        React: false,
      },
    },
    plugins: {
      'import': require('eslint-plugin-import'),
      'react': require('eslint-plugin-react'),
      'react-hooks': require('eslint-plugin-react-hooks'),
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      // TypeScript/React Native basic rules
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        vars: 'all',
        args: 'none',
        ignoreRestSiblings: true,
      }],
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Import rules
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'never',
      }],
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
        typescript: true,
      },
      'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
    },
  },
];
