import { ipcMain } from 'electron'
import { trimNow, getResourceTrimStatus } from '../resource-trim.js'

export function registerTrimHandlers(): void {
  // The autoTrim toggle is persisted via store:save-settings; the trim loop reads
  // it each tick. `trim:now` lets the renderer force an immediate sweep right after
  // enabling it (instant feedback instead of waiting for the next interval).
  ipcMain.handle('trim:now',    async () => { await trimNow(); return getResourceTrimStatus() })
  ipcMain.handle('trim:status', () => getResourceTrimStatus())
}
