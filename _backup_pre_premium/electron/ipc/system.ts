import { ipcMain } from 'electron'
import os from 'node:os'
import type { SystemStats } from '../../src/types/index.js'

function sampleCpus() {
  return os.cpus().map(cpu => ({ ...cpu.times }))
}

export function registerSystemHandlers(): void {
  ipcMain.handle('system:get-stats', (): Promise<SystemStats> => {
    return new Promise(resolve => {
      const before = sampleCpus()
      setTimeout(() => {
        const after = sampleCpus()
        let idleDiff = 0
        let totalDiff = 0
        for (let i = 0; i < before.length; i++) {
          const b = before[i], a = after[i]
          idleDiff += a.idle - b.idle
          totalDiff += (a.user + a.nice + a.sys + a.irq + a.idle) -
                       (b.user + b.nice + b.sys + b.irq + b.idle)
        }
        const cpuUsage = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0
        const totalRam = parseFloat((os.totalmem() / 1024 ** 3).toFixed(1))
        const usedRam = parseFloat(((os.totalmem() - os.freemem()) / 1024 ** 3).toFixed(1))
        resolve({ cpuUsage, totalRam, usedRam })
      }, 200)
    })
  })
}
