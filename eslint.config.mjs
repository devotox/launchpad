import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error - eslint-config-extreme doesn't have proper TypeScript types
import eslintExtreme from 'eslint-config-extreme';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('eslint').Linter.Config[]} */
const config = [
  // @ts-expect-error - eslint-config-extreme doesn't have proper TypeScript types
  ...eslintExtreme.typescript,
  {
    // Global TypeScript configuration for the entire monorepo
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, 'tsconfig.json'),
        tsconfigRootDir: __dirname
      }
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: resolve(__dirname, 'tsconfig.json'),
          tsconfigRootDir: __dirname
        }
      }
    }
  },
  {
    rules: {
      'no-console': 'off',
      'n/no-extraneous-import': [
        'error',
        {
          allowModules: [
            '@Root/deploy',
            '@Root/config',
            '@Root/tsconfig.json',
            '@Root/vitest.setup.ts',
            '@Root/vitest.config.ts',
            '@Root/tsconfig.build.json',
            '@Root/vitest.server.config.ts'
          ]
        }
      ],
      // Restrict relative imports to encourage TypeScript path aliases
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Prefer TypeScript path aliases (@/*) over relative imports with parent directory'
            },
            {
              group: ['../../*'],
              message:
                'Prefer TypeScript path aliases (@/*) over relative imports with multiple levels'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-statements': 'off',
      'max-lines-per-function': 'off'
    }
  }
];

export default config;
