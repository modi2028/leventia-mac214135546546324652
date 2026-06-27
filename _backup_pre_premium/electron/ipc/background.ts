import { ipcMain, dialog, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// Served by the lvnt-media:// protocol registered in main.ts (works in packaged builds).
function mediaUrl(filePath: string): string {
  return `lvnt-media://bg/?p=${encodeURIComponent(filePath)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom background media (image / video). The chosen file is copied into
// userData/backgrounds so it survives the original being moved/deleted, and the
// renderer references it by file:// URL.
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif']
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v']

function bgDir(): string {
  const dir = path.join(app.getPath('userData'), 'backgrounds')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function clearBgFiles(): void {
  try {
    const dir = bgDir()
    for (const f of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, f)) } catch {} }
  } catch {}
}

export function registerBackgroundHandlers(): void {
  ipcMain.handle('bg:pick', async (_e, kind: 'image' | 'video') => {
    const exts = kind === 'video' ? VIDEO_EXT : IMAGE_EXT
    const res = await dialog.showOpenDialog({
      title: kind === 'video' ? 'Choose a background video' : 'Choose a background image',
      filters: [{ name: kind === 'video' ? 'Video' : 'Image', extensions: exts }],
      properties: ['openFile'],
    })
    if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true }
    try {
      const src = res.filePaths[0]
      const ext = (path.extname(src).slice(1) || (kind === 'video' ? 'mp4' : 'png')).toLowerCase()
      clearBgFiles()  // only one background at a time
      const dest = path.join(bgDir(), `bg-${Date.now()}.${ext}`)
      fs.copyFileSync(src, dest)
      return { success: true, url: mediaUrl(dest) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('bg:clear', () => { clearBgFiles(); return { success: true } })
}
