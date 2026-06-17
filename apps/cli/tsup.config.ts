import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  minify: true,
  splitting: false,
  clean: true,
  define: { __SKOPE_VERSION__: JSON.stringify(pkg.version) },
});
