import { ipcMain } from 'electron'
import {
  startAntiAfk, stopAntiAfk, setAntiAfkInterval,
  getAntiAfkStatus, leaveAll,
} from '../anti-afk.js'
import { setMuteRoblox } from '../mute-roblox.js'

export function registerAntiAfkHandlers(): void {
  ipcMain.handle('antiafk:start',        (_e, minutes?: number) => { startAntiAfk(minutes); return true })
  ipcMain.handle('antiafk:stop',         ()                     => { stopAntiAfk(); return true })
  ipcMain.handle('antiafk:set-interval', (_e, minutes: number)  => { setAntiAfkInterval(minutes); return true })
  ipcMain.handle('antiafk:status',       ()                     => getAntiAfkStatus())
  ipcMain.handle('antiafk:leave-all',    ()                     => leaveAll())
  // Apply/clear the per-process audio mute immediately so toggling mute OFF can
  // actually un-mute running instances (previously it only ever muted on a wiggle).
  ipcMain.handle('antiafk:set-mute',     (_e, mute: boolean)    => { setMuteRoblox(!!mute); return true })
}
