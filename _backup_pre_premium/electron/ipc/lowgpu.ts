import { ipcMain } from 'electron'
import { applyPerformance, restoreGraphics, isLowGpuApplied } from '../low-gpu.js'
import { getSettings } from '../store/index.js'

export function registerLowGpuHandlers(): void {
  // Apply reads the CURRENT settings (low-graphics preset + FPS cap) and writes the
  // combined flag set — or restores originals when neither is active. The renderer
  // saves the setting first, then calls this, so it always reflects the latest state.
  ipcMain.handle('lowgpu:apply',   () => { const s = getSettings(); return applyPerformance({ lowGpu: s.lowGpuEnabled, fpsCap: s.fpsCap ?? 0 }) })
  ipcMain.handle('lowgpu:restore', () => restoreGraphics())
  ipcMain.handle('lowgpu:status',  () => ({ applied: isLowGpuApplied() }))
}
