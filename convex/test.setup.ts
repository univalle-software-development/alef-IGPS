// Provide a lightweight local declaration for `import.meta.glob` so tests can run
// without relying on global `vite` type definitions.
//
// This keeps the test setup portable and avoids the TypeScript error:
//   Cannot find type definition file for 'vite/client'.
//
// We augment `ImportMeta` with a `glob` signature that matches Vite's runtime shape
// as used by `convex-test` (a map of module paths to loaders).
declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<any>>;
  }
}

// This glob pattern includes all files with a single extension ending in `s` (like `.js` or `.ts`)
// in the current directory (`convex/`) and any of its subdirectories.
// It excludes files with multiple extensions, like `.test.ts` or `.d.ts`.
// We intentionally keep the same glob string used previously — the test setup will pass
// the resulting `modules` object to `convexTest(schema, modules)`.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
