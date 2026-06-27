import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Produce READABLE (un-minified, original names kept) compiled JS for the
// main-process bundles — same code that ships, just human-readable. NOT for
// distribution (use `npm run dist:obf` for that). Output: readable/.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  absWorkingDir: root,
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: 'readable',
  external: ['electron'],
  minify: false,       // <-- readable
  keepNames: true,     // <-- keep original function/class names
  legalComments: 'none',
  logLevel: 'info',
})

console.log('✓ wrote readable/main.js and readable/preload.js')
