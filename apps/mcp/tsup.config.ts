import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// The published artifact is the CLI package (@evan-moon/skope); the MCP ships inside it as
// skope-mcp. Report the CLI's version so both bins agree on the user-facing release.
const pkg = JSON.parse(readFileSync(new URL('../cli/package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  minify: true,
  splitting: false,
  clean: true,
  define: { __SKOPE_VERSION__: JSON.stringify(pkg.version) },
  // Bundle the protocol SDK + zod into the single mcp.js the CLI ships, so the published package
  // doesn't need them as runtime deps. Native/heavy deps (better-sqlite3, drizzle-orm) stay external
  // and are provided by the CLI's dependencies.
  noExternal: ['@modelcontextprotocol/sdk', 'zod'],
});
