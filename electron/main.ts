import { app, BrowserWindow, shell, protocol, Menu, globalShortcut } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { setupIpcHandlers } from './ipc/index.js'
import { initStore, getLicense, getSettings } from './store/index.js'
import { runMultiExe } from './ipc/roblox.js'
import { holdRobloxMutex, releaseRobloxMutex } from './multi-instance.js'
import { startHeartbeat } from './heartbeat.js'
import { supabaseEnabled } from './supabase.js'
import { initHealthSweep } from './health-check.js'
import { startAntiAfk, leaveAll } from './anti-afk.js'
import { stopAutoAlt } from './auto-alting.js'
import { startAutoRejoin } from './auto-rejoin.js'
import { startAutoAltScheduler } from './auto-alt-schedule.js'
import { startResourceTrim } from './resource-trim.js'
import { startKillSwitch } from './killswitch.js'
import { startRemoteControl } from './remote-control.js'
import { startPresence } from './discord-presence.js'

// Platform-specific icon extension
const ICON_EXT = process.platform === 'darwin' ? 'icns' : 'ico'

// Custom scheme for serving the user's background image/video. Registered as a
// privileged streaming scheme so <video> works (range requests) even in the
// packaged asar build, where raw file:// URLs are blocked. Must be set before ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'lvnt-media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
])

const MEDIA_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif',
}

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// Scales the entire UI up uniformly. Applies in both windowed and fullscreen.
const UI_ZOOM = 1.18

// DevTools / console are allowed ONLY when running against the Vite dev server.
// In a packaged build they're hard-disabled so users can't open the inspector to
// read/tamper with the frontend.
const IS_DEV = !!VITE_DEV_SERVER_URL

// Refuse to launch with remote-debugging / inspector flags in production. These
// attach an external Chromium/Node debugger to the renderer or main process even
// when devTools is disabled, so a user could crack the frontend through them.
if (!IS_DEV && process.argv.some(a =>
  /^--(remote-debugging-port|remote-debugging-pipe|inspect|inspect-brk)(=|$)/.test(a))) {
  app.quit()
  process.exit(0)
}

// Hard-disable every route to DevTools / the inspector in production. Layered on
// purpose: devTools:false neuters openDevTools(), the removed menu kills the
// "Toggle Developer Tools" accelerator, and we still swallow the shortcuts and
// re-close DevTools if anything slips through.
function lockDownDevTools(w: BrowserWindow): void {
  if (IS_DEV) return

  // Block F12, Ctrl/Cmd+Shift+I/J/C (DevTools), Ctrl/Cmd+U (view-source),
  // and Ctrl/Cmd(+Shift)+R (reload) before the page ever sees them.
  w.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = (input.key || '').toLowerCase()
    const mod = input.control || input.meta
    const blocked =
      key === 'f12' ||
      (mod && input.shift && (key === 'i' || key === 'j' || key === 'c')) ||
      (mod && (key === 'u' || key === 'r'))
    if (blocked) event.preventDefault()
  })

  // Belt-and-suspenders: if DevTools ever get opened (programmatically, attach,
  // remote debugger), slam them shut immediately.
  w.webContents.on('devtools-opened', () => w.webContents.closeDevTools())
}

function createWindow() {
  win = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1200,
    minHeight: 740,
    backgroundColor: '#07070e',
    icon: path.join(VITE_PUBLIC, `icon.${ICON_EXT}`),
    frame: false,            // custom title bar + window controls (see TitleBar.tsx)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      zoomFactor: UI_ZOOM,
      devTools: IS_DEV,
    },
  })

  lockDownDevTools(win)

  // Keep the renderer's maximize button icon in sync with the actual window state
  // (covers double-click drag-to-maximize and OS-driven changes).
  win.on('maximize',   () => win?.webContents.send('window:maximized-changed', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized-changed', false))

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Re-apply zoom after every load (covers dev HMR reloads and pinch-zoom drift)
  win.webContents.on('did-finish-load', () => {
    win?.webContents.setZoomFactor(UI_ZOOM)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  initStore()

  // Serve lvnt-media://bg/?p=<absolute path> with byte-range support so <video>
  // streams/seeks correctly (works in the packaged build where file:// is blocked).
  protocol.handle('lvnt-media', (request) => {
    try {
      const p = new URL(request.url).searchParams.get('p')   // searchParams already decodes
      if (!p || !fs.existsSync(p)) return new Response(null, { status: 404 })
      const stat = fs.statSync(p)
      const type = MEDIA_MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream'
      const range = request.headers.get('Range')
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range)
        const start = m && m[1] ? parseInt(m[1], 10) : 0
        const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1
        return new Response(Readable.toWeb(fs.createReadStream(p, { start, end })) as unknown as ReadableStream, {
          status: 206,
          headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1) },
        })
      }
      return new Response(Readable.toWeb(fs.createReadStream(p)) as unknown as ReadableStream, {
        status: 200,
        headers: { 'Content-Type': type, 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes' },
      })
    } catch {
      return new Response(null, { status: 500 })
    }
  })

  setupIpcHandlers()
  holdRobloxMutex()   // binary-free singleton-mutex keeper → multiple instances coexist
  runMultiExe()       // also try multi.exe (belt-and-suspenders if present)
  initHealthSweep()  // resume background cookie health sweep if enabled

  // Auto-start Anti-AFK if it was left enabled AND the user has Premium access
  // (staff, or a non-"standard" role). Safe at boot: no Roblox windows yet.
  try {
    const s = getSettings()
    const lic = getLicense()
    // TEMP: Premium open to all (mirror of the renderer's PREMIUM_OPEN flag).
    const PREMIUM_OPEN = true
    const premium = PREMIUM_OPEN || (!!lic && (lic.type === 'staff' || (lic.role ?? 'standard') !== 'standard'))
    if (premium && s.antiAfkEnabled) startAntiAfk(s.antiAfkInterval)
  } catch {}

  // Resume heartbeat for an already-activated DB-backed license
  const lic = getLicense()
  if (lic && lic.type !== 'staff' && supabaseEnabled()) {
    startHeartbeat(lic.key)
  }

  // Poll for remote commands queued by the Discord bot (deploy/remove/stop alts).
  startRemoteControl()

  // Auto-Rejoin watcher (self-gates on the autoRejoinEnabled setting each tick).
  startAutoRejoin()

  // Scheduled auto-alting — runs the auto-alt engine inside the user's daily time
  // windows (self-gates on the autoAltSchedule setting each tick).
  startAutoAltScheduler()

  // Resource Trim — periodically minimizes/low-priorities/RAM-trims running alts
  // to cut specs for 24/7 alting (self-gates on the autoTrim setting each tick).
  startResourceTrim()

  // Master kill-switch enforcement — polls the server and, when the owner kills
  // the app, halts every background worker + closes all alts + blocks new launches
  // in the main process (not just the renderer overlay). Fails open on errors.
  startKillSwitch()

  // Show "Playing Leventia Alting" on Discord while the app is open.
  startPresence()

  // Drop the application menu in production → removes the "View → Toggle
  // Developer Tools" item (and its Ctrl+Shift+I accelerator) entirely.
  if (!IS_DEV) Menu.setApplicationMenu(null)

  // PANIC hotkey — Ctrl+Alt+Shift+Q from ANYWHERE (even mid-game, app unfocused):
  // stop auto-alting + close every Roblox instance + stop anti-AFK, instantly.
  try {
    globalShortcut.register('CommandOrControl+Alt+Shift+Q', () => {
      try { stopAutoAlt() } catch {}
      void leaveAll()
      try { win?.webContents.send('panic:triggered') } catch {}
    })
  } catch {}

  createWindow()
})

// Release global hotkeys on exit.
app.on('will-quit', () => { try { globalShortcut.unregisterAll() } catch {}; try { releaseRobloxMutex() } catch {} })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
