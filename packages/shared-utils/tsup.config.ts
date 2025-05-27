import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  minify: false,
  treeshake: true,
  tsconfig: 'tsconfig.build.json'
});
