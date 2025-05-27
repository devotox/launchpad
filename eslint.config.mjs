import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import eslintExtreme from 'eslint-config-extreme';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {{ references: Array<{ path: string }> }} */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const buildConfig = require('./tsconfig.json');

const packagePaths = buildConfig.references
  .map((ref) => ref.path.replace('./', ''))
  .filter((path) => path.startsWith('packages/'));

const appPaths = buildConfig.references
  .map((ref) => ref.path.replace('./', ''))
  .filter((path) => path.startsWith('apps/'));

const packageConfigs = packagePaths.map((pkgPath) => ({
  files: [`${pkgPath}/**/*.{ts,tsx}`, `${pkgPath}/*.{ts,tsx}`],
  settings: {
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
        moduleDirectory: ['node_modules', pkgPath],
        tsconfigRootDir: resolve(__dirname, pkgPath),
        project: resolve(__dirname, pkgPath, 'tsconfig.json')
      }
    }
  }
}));

const appConfigs = appPaths.map((appPath) => ({
  files: [`${appPath}/**/*.{ts,tsx}`, `${appPath}/*.{ts,tsx}`],
  settings: {
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
        moduleDirectory: ['node_modules', appPath],
        tsconfigRootDir: resolve(__dirname, appPath),
        project: resolve(__dirname, appPath, 'tsconfig.json')
      }
    }
  }
}));

const rootConfig = {
  files: ['*.{ts,tsx}', 'config/**/*.{ts,tsx}', 'deploy/**/*.{ts,tsx}'],
  settings: {
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
        tsconfigRootDir: __dirname,
        moduleDirectory: ['node_modules', '.'],
        project: resolve(__dirname, 'tsconfig.json')
      }
    }
  }
};

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...eslintExtreme.typescript,
  ...packageConfigs,
  ...appConfigs,
  rootConfig,
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
      ]
    },
    // Explicitly set these rules to be more strict for our test files
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*'],
            message:
              'TEST: Prefer TypeScript path aliases (@/*) over relative imports with parent directory'
          },
          {
            group: ['../../*'],
            message:
              'TEST: Prefer TypeScript path aliases (@/*) over relative imports with multiple levels'
          }
        ]
      }
    ]
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
