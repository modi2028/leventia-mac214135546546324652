import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JavaScriptObfuscator from 'javascript-obfuscator'

// Obfuscate the production bundles. Two profiles:
//
//   • MAIN / PRELOAD (Node target) — MAXED. All sensitive logic + secrets
//     (Supabase, key validation, launcher, kill-switch) live here.
//   • RENDERER (browser target) — strong but React-safe. The UI has no secrets,
//     but we obfuscate it too so channel names, request shapes, license/role
//     gating and the staff/owner panels aren't trivially readable in the asar.
//
// Three options stay OFF in BOTH profiles because they break the app:
//   • renameGlobals   — renames require/module/process/exports (CJS dies) and the
//                       browser globals React relies on.
//   • debugProtection — injects a debugger loop that freezes/hangs the app.
//   • selfDefending   — tamper-check fires ~10s AFTER boot and silently kills the
//                       process (Electron main) — do NOT enable.
//
// String VALUES are preserved at runtime (RC4 is decoded on use), so IPC channel
// names and the contextBridge `window.electron` contract still match across the
// main ⇄ preload ⇄ renderer boundary.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── MAIN-PROCESS profile (Node) — MAXED, proven to boot reliably ─────────────
const mainOpts = {
  compact: true,
  target: 'node',

  // Structural obfuscation — maxed
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  numbersToExpressions: true,
  simplify: true,
  transformObjectKeys: true,
  unicodeEscapeSequence: true,   // escape every literal char on top of the RC4 array

  // String protection — RC4 array, calls-transform, max wrappers, tiny splits
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['rc4'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayWrappersCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  splitStrings: true,
  splitStringsChunkLength: 3,

  identifierNamesGenerator: 'hexadecimal',

  // Kept OFF — break Electron's main process (see note above)
  selfDefending: false,
  renameGlobals: false,
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
}

// ── RENDERER profile (browser) — strong but React-safe ───────────────────────
//
// Deliberately OMITS controlFlowFlattening + deadCodeInjection. On a ~400 KB
// bundled React app those two are the usual sources of breakage AND can multiply
// bundle size / startup time several-fold for no extra secrecy here. Everything
// else that hardens the code without rewriting control flow is ON: RC4 string
// array with wrappers + calls-transform, split strings, number expressions, and
// full identifier renaming. transformObjectKeys stays OFF — React/JSX props and
// inline style objects are safer left structurally intact.
const rendererOpts = {
  compact: true,
  target: 'browser',

  // Cranked hard but still React-safe. controlFlowFlattening 0.75 + a light
  // deadCodeInjection (0.2) add real structural noise; unicodeEscapeSequence hides
  // any literal characters; tiny string splits + full calls-transform + 5 wrappers
  // make the string array a maze. (Verified the renderer still mounts fast.)
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  numbersToExpressions: true,
  simplify: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: true,

  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['rc4'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayWrappersCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  splitStrings: true,
  splitStringsChunkLength: 4,

  identifierNamesGenerator: 'hexadecimal',

  selfDefending: false,
  renameGlobals: false,
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
}

function obfuscateFile(absPath, opts, label) {
  const code = readFileSync(absPath, 'utf8')
  const out = JavaScriptObfuscator.obfuscate(code, opts).getObfuscatedCode()
  writeFileSync(absPath, out, 'utf8')
  const map = absPath + '.map'
  if (existsSync(map)) rmSync(map)   // drop the stale source map
  console.log(`✓ obfuscated ${label}  (${(out.length / 1024).toFixed(0)} KB)`)
}

// ── Main process: main.js + preload.js ───────────────────────────────────────
for (const t of ['dist-electron/main.js', 'dist-electron/preload.js']) {
  const p = join(root, t)
  if (!existsSync(p)) { console.log('skip (missing):', t); continue }
  obfuscateFile(p, mainOpts, t)
}

// ── Renderer: every JS chunk Vite emitted into dist/assets ───────────────────
const assetsDir = join(root, 'dist', 'assets')
if (existsSync(assetsDir)) {
  const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'))
  if (!jsFiles.length) console.log('skip (no renderer JS found in dist/assets)')
  for (const f of jsFiles) obfuscateFile(join(assetsDir, f), rendererOpts, `dist/assets/${f}`)
} else {
  console.log('skip (missing): dist/assets — run `vite build` first')
}
