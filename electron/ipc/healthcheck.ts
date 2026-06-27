import { ipcMain } from 'electron'
import { runHealthCheck, getHealthCheckStatus, startHealthSweep, stopHealthSweep } from '../health-check.js'

export function registerHealthCheckHandlers(): void {
  // Kick off a run in the background; renderer polls status.
  ipcMain.handle('health:start',  () => { void runHealthCheck(); return true })
  ipcMain.handle('health:status', () => getHealthCheckStatus())
  ipcMain.handle('health:sweep-start', (_e, minutes: number) => { startHealthSweep(minutes); return true })
  ipcMain.handle('health:sweep-stop',  () => { stopHealthSweep(); return true })
}
