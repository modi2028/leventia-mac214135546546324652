import { ipcMain, BrowserWindow } from 'electron'

// Custom window controls (the app runs frameless — see main.ts `frame: false`).
export function registerWindowHandlers(): void {
  const wnd = (e: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender)

  ipcMain.handle('window:minimize', (e) => { wnd(e)?.minimize() })

  ipcMain.handle('window:maximize', (e) => {
    const w = wnd(e)
    if (!w) return false
    if (w.isMaximized()) w.unmaximize(); else w.maximize()
    return w.isMaximized()
  })

  ipcMain.handle('window:close', (e) => { wnd(e)?.close() })

  ipcMain.handle('window:is-maximized', (e) => wnd(e)?.isMaximized() ?? false)
}
