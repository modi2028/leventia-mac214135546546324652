import { ipcMain } from 'electron'
import { getServerDetail } from '../erlc-api.js'

export function registerServerMapHandlers(): void {
  ipcMain.handle('servermap:fetch', (_e, serverKey: string) => getServerDetail(serverKey))
}
