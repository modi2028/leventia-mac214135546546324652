import { ipcMain } from 'electron'
import {
  startAutoAlt, stopAutoAlt, getAutoAltStatus, deployNow, removeNow,
} from '../auto-alting.js'
import { refreshSchedule, getScheduleStatus } from '../auto-alt-schedule.js'
import { getServerStatus } from '../erlc-api.js'
import type { AutoAltConfig } from '../../src/types/index.js'

export function registerAutoAltHandlers(): void {
  ipcMain.handle('autoalt:test-key', (_e, serverKey: string) => getServerStatus(serverKey))
  ipcMain.handle('autoalt:start',    (_e, config: AutoAltConfig) => startAutoAlt(config))
  ipcMain.handle('autoalt:stop',     () => { stopAutoAlt(); return true })
  ipcMain.handle('autoalt:status',   () => getAutoAltStatus())
  ipcMain.handle('autoalt:deploy-now', (_e, config: AutoAltConfig) => deployNow(config))
  ipcMain.handle('autoalt:remove-now', (_e, config: AutoAltConfig) => removeNow(config))

  // Scheduled auto-alting. The schedule itself is persisted in settings; these
  // just let the renderer re-evaluate it immediately after an edit and read live
  // status (whether a window is open + whether the engine is running).
  ipcMain.handle('autoalt:schedule-refresh', () => { refreshSchedule(); return getScheduleStatus() })
  ipcMain.handle('autoalt:schedule-status',  () => getScheduleStatus())
}
