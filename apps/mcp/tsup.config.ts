import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  minify: true,
  splitting: false,
  clean: true,
  // Bundle the protocol SDK + zod into the single mcp.js the CLI ships, so the published package
  // doesn't need them as runtime deps. Native/heavy deps (better-sqlite3, drizzle-orm) stay external
  // and are provided by the CLI's dependencies.
  noExternal: ['@modelcontextprotocol/sdk', 'zod'],
});
