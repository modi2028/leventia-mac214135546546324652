import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ─────────────────────────────────────────────────────────────────────────────
// Low GPU Mode
//
// Writes low-graphics FastFlags to Roblox's ClientAppSettings.json so every
// launched instance renders cheaply (saves VRAM + CPU). RobloxPlayerBeta reads
// FastFlags from the PER-VERSION folder (Versions\version-XXXX\ClientSettings),
// so we write to every installed version folder (plus the global location).
// Originals are backed up per-folder and restored on Leave All / Restore.
//
//   FPS cap            → 30 (low cap = less GPU; 9999 would UNCAP it)
//   Graphics quality   → Level 1
//   Shadows/wind/grass → Off
//   Texture quality    → Minimum
//   Anti-aliasing      → Off
// ─────────────────────────────────────────────────────────────────────────────

// Graphics-only, deliberately conservative: every flag here lowers GPU/visual load
// and nothing else. (Earlier versions also set network/memory flags like
// DFIntProcMemUseLimit:1 — that caps the process's memory and can destabilise or
// crash the client, so they're removed. We only touch rendering now.)
// Graphics-quality flags ONLY (the FPS cap is applied separately so it can be
// customised / used on its own — see buildFlags()).
const LOW_GPU_FLAGS: Record<string, string | number> = {
  // ── THE main lever: force the lowest graphics quality level (1 of 21) and stop
  //    Roblox's auto-quality system from raising it back up. ──
  DFIntDebugFRMQualityLevelOverride: 1,
  FFlagCommitToGraphicsQualityFix: 'True',
  FFlagFixGraphicsQuality: 'True',

  // ── Textures → absolute minimum (0 is lowest) ──
  DFFlagTextureQualityOverrideEnabled: 'True',
  DFIntTextureQualityOverride: 0,

  // ── Post-processing OFF (bloom / blur / depth-of-field) — big, very visible save ──
  FFlagDisablePostFx: 'True',

  // ── Shadows / voxel lighting off ──
  FIntRenderShadowIntensity: 0,
  DFFlagDebugPauseVoxelizer: 'True',
  DFFlagDebugRenderForceTechnologyVoxel: 'True',
  DFIntCullFactorPixelThresholdShadowMapHighQuality: 2147483647,
  DFIntCullFactorPixelThresholdShadowMapLowQuality: 2147483647,
  FIntRenderLocalLightUpdatesMax: 0,
  FIntRenderLocalLightUpdatesMin: 0,

  // ── Sky / wind ──
  FFlagDebugSkyGray: 'True',
  FFlagGlobalWind: 'False',

  // ── Grass / terrain detail ──
  FIntFRMMaxGrassDistance: 0,
  FIntFRMMinGrassDistance: 0,
  FIntTerrainArraySliceSize: 4,

  // ── Anti-aliasing off ──
  FIntDebugForceMSAASamples: 0,

  // ── Renderer: prefer the lighter D3D11 path ──
  FFlagDebugGraphicsPreferD3D11: 'True',
  FFlagDebugGraphicsDisableDirect3D11: 'False',

  // ── Mesh / CSG: snap to lowest LOD immediately ──
  DFIntCSGLevelOfDetailSwitchingDistance: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL23: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL34: 0,
}

const FPS_FLAG = 'DFIntTaskSchedulerTargetFps'

// Independent FastFlag subsets the user can toggle on their own (without the full
// Low GPU bundle). They're a subset of LOW_GPU_FLAGS, so Low GPU still covers them.
//   • Disable Textures   → force every texture to the lowest quality (saves VRAM).
//   • Minimal Lighting   → kill post-FX, shadows, dynamic lights and wind (saves GPU).
const TEXTURE_FLAGS: Record<string, string | number> = {
  DFFlagTextureQualityOverrideEnabled: 'True',
  DFIntTextureQualityOverride: 0,
}
const LIGHTING_FLAGS: Record<string, string | number> = {
  FFlagDisablePostFx: 'True',
  FIntRenderShadowIntensity: 0,
  DFFlagDebugPauseVoxelizer: 'True',
  FIntRenderLocalLightUpdatesMax: 0,
  FIntRenderLocalLightUpdatesMin: 0,
  FFlagGlobalWind: 'False',
}
// Skip / streamline the Roblox loading-splash: kill the frosted GUI blur Roblox
// draws over the join/teleport loading screen, so alts render into the game faster
// and spend less GPU during the load. (Real FastFlag; not part of the Low GPU set.)
const SPLASH_FLAGS: Record<string, string | number> = {
  FIntRobloxGuiBlurIntensity: 0,
}

// Every FastFlag key this module may write — used when stripping our changes on
// restore. (TEXTURE/LIGHTING keys are a subset of LOW_GPU_FLAGS; SPLASH is extra.)
const ALL_MANAGED_KEYS = [...Object.keys(LOW_GPU_FLAGS), ...Object.keys(SPLASH_FLAGS), FPS_FLAG]

export interface PerfFlagOpts {
  lowGpu: boolean
  fpsCap: number
  disableTextures?: boolean
  minimalLighting?: boolean
  skipSplash?: boolean
}

// Build the exact FastFlag set to write, given the user's performance settings:
//   • lowGpu          → all the low-graphics flags (quality, shadows, textures, …)
//   • disableTextures → just the texture-minimum flags
//   • minimalLighting → just the lighting/post-FX-off flags
//   • fpsCap>0        → cap every client's FPS to that value (the reliable usage lever)
//   • lowGpu with no custom cap → default to a 30 FPS cap (part of "low" mode)
// Returns {} when nothing should be applied (→ caller restores originals).
export function buildFlags(opts: PerfFlagOpts): Record<string, string> {
  const out: Record<string, string> = {}
  if (opts.lowGpu) for (const [k, v] of Object.entries(LOW_GPU_FLAGS)) out[k] = String(v)
  if (opts.disableTextures) for (const [k, v] of Object.entries(TEXTURE_FLAGS)) out[k] = String(v)
  if (opts.minimalLighting) for (const [k, v] of Object.entries(LIGHTING_FLAGS)) out[k] = String(v)
  if (opts.skipSplash) for (const [k, v] of Object.entries(SPLASH_FLAGS)) out[k] = String(v)
  const fps = opts.fpsCap > 0 ? Math.round(opts.fpsCap) : (opts.lowGpu ? 30 : 0)
  if (fps > 0) out[FPS_FLAG] = String(fps)
  return out
}

const BACKUP_NAME = '.lvnt-graphics-backup.json'
const SETTINGS_NAME = 'ClientAppSettings.json'

// Every ClientSettings folder Roblox might read FastFlags from.
function targetDirs(): string[] {
  // macOS: ~/Library/Application Support/Roblox
  // Windows: %LOCALAPPDATA%\Roblox
  const local = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
    : (process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'))
  const bases = [
    path.join(local, 'Roblox', 'Versions'),
    path.join(local, 'Bloxstrap', 'Versions'),
    path.join(local, 'Fishstrap', 'Versions'),
    path.join(local, 'Programs', 'Roblox', 'Versions'),
  ]
  const dirs = new Set<string>()

  for (const base of bases) {
    try {
      for (const v of fs.readdirSync(base)) {
        const verDir = path.join(base, v)
        try {
          if (fs.existsSync(path.join(verDir, 'RobloxPlayerBeta.exe'))) {
            dirs.add(path.join(verDir, 'ClientSettings'))
          }
        } catch {}
      }
    } catch {}
  }
  // Global location (some Roblox builds also read this)
  dirs.add(path.join(local, 'Roblox', 'ClientSettings'))
  return [...dirs]
}

export function isLowGpuApplied(): boolean {
  return targetDirs().some(dir => {
    try { return fs.existsSync(path.join(dir, BACKUP_NAME)) } catch { return false }
  })
}

function applyToDir(dir: string, flags: Record<string, string>): boolean {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, SETTINGS_NAME)
  const backup = path.join(dir, BACKUP_NAME)

  // Make sure the file is writable. Older builds locked it read-only (0o444),
  // and writing to a read-only file throws EPERM — that silent failure is why
  // Low GPU "sometimes didn't make changes". Always clear the attribute first.
  try { if (fs.existsSync(file)) fs.chmodSync(file, 0o666) } catch {}

  // Back up the original exactly once per folder
  if (!fs.existsSync(backup)) {
    try {
      const existed = fs.existsSync(file)
      const original = existed ? fs.readFileSync(file, 'utf-8') : ''
      fs.writeFileSync(backup, JSON.stringify({ existed, original }), 'utf-8')
    } catch {}
  }

  let current: Record<string, unknown> = {}
  try { if (fs.existsSync(file)) current = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch {}
  // Start from the original minus ANY flag we manage, so de-selecting Low GPU while
  // keeping an FPS cap (or lowering the cap) doesn't leave stale flags behind.
  for (const k of ALL_MANAGED_KEYS) delete current[k]
  // Roblox's FastFlag loader expects EVERY value to be a string ("30", "True").
  const content = JSON.stringify({ ...current, ...flags }, null, 2)

  try {
    fs.writeFileSync(file, content, 'utf-8')
  } catch {
    // Still locked/read-only → force-remove the stale file and write fresh.
    try { fs.rmSync(file, { force: true }) } catch {}
    fs.writeFileSync(file, content, 'utf-8')
  }
  // Deliberately leave the file WRITABLE (no read-only lock). We re-apply before
  // every launch, so even if Roblox rewrites it during an update we just overwrite
  // it again next time — far more reliable than locking it and risking a failed
  // re-apply that leaves the flags silently un-set.

  // Verify EVERY flag actually landed (read-back) so callers know it really worked.
  try {
    const back = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
    return Object.entries(flags).every(([k, v]) => String(back[k]) === v)
  } catch { return false }
}

function restoreDir(dir: string): void {
  const file = path.join(dir, SETTINGS_NAME)
  const backup = path.join(dir, BACKUP_NAME)

  try {
    // Clear the read-only lock so we can restore/delete the file.
    try { if (fs.existsSync(file)) fs.chmodSync(file, 0o666) } catch {}
    if (fs.existsSync(backup)) {
      const { existed, original } = JSON.parse(fs.readFileSync(backup, 'utf-8')) as { existed: boolean; original: string }
      if (existed) fs.writeFileSync(file, original, 'utf-8')
      else if (fs.existsSync(file)) fs.unlinkSync(file)
      fs.unlinkSync(backup)
    } else if (fs.existsSync(file)) {
      // No backup — strip every flag we manage (graphics + FPS) defensively
      const current = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
      for (const k of ALL_MANAGED_KEYS) delete current[k]
      fs.writeFileSync(file, JSON.stringify(current, null, 2), 'utf-8')
    }
  } catch (err) {
    console.error('[low-gpu] restore failed for', dir, err)
  }
}

// Apply the user's performance settings (low-graphics preset and/or FPS cap).
// `playerExe` (optional): the EXACT RobloxPlayerBeta.exe about to be launched — we
// derive its sibling ClientSettings folder and write there too, so we're guaranteed
// to hit the folder the launching client actually reads, even if the broad version
// scan misses it. If nothing should be applied (both off) we restore originals.
// Returns true if the flags verified in at least one folder.
export function applyPerformance(opts: PerfFlagOpts, playerExe?: string): boolean {
  const flags = buildFlags(opts)
  if (Object.keys(flags).length === 0) { restoreGraphics(); return false }

  const dirs = new Set(targetDirs())
  if (playerExe) {
    try { dirs.add(path.join(path.dirname(playerExe), 'ClientSettings')) } catch {}
  }
  const list = [...dirs]
  let verified = 0
  const ok: string[] = []
  for (const dir of list) {
    try { if (applyToDir(dir, flags)) { verified++; ok.push(dir) } } catch (err) { console.error('[low-gpu] apply failed for', dir, err) }
  }
  console.log(`[low-gpu] applied & verified in ${verified}/${list.length} folder(s):`, flags, ok)
  return verified > 0
}

// Back-compat thin wrapper (low-graphics preset only, default cap).
export function applyLowGpu(playerExe?: string): boolean {
  return applyPerformance({ lowGpu: true, fpsCap: 0 }, playerExe)
}

// True if ANY performance FastFlag option is enabled in settings (used to decide
// whether to (re)write or restore FastFlags).
export function anyPerfFlag(opts: PerfFlagOpts): boolean {
  return !!(opts.lowGpu || opts.fpsCap > 0 || opts.disableTextures || opts.minimalLighting || opts.skipSplash)
}

/** The ClientSettings folder a given player exe reads its FastFlags from. */
export function clientSettingsForExe(playerExe: string): string {
  return path.join(path.dirname(playerExe), 'ClientSettings')
}

export function restoreGraphics(): boolean {
  const dirs = targetDirs()
  for (const dir of dirs) restoreDir(dir)
  console.log('[low-gpu] restored')
  return true
}
