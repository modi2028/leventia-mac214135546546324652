import { registerRobloxHandlers } from './roblox.js'
import { registerStoreHandlers } from './store.js'
import { registerSystemHandlers } from './system.js'
import { registerAntiAfkHandlers } from './antiafk.js'
import { registerAutoAltHandlers } from './autoalt.js'
import { registerLowGpuHandlers } from './lowgpu.js'
import { registerHealthCheckHandlers } from './healthcheck.js'
import { registerBackgroundHandlers } from './background.js'
import { registerServerMapHandlers } from './servermap.js'
import { registerWebhookHandlers } from './webhook.js'
import { registerWindowHandlers } from './window.js'

export function setupIpcHandlers(): void {
  registerRobloxHandlers()
  registerStoreHandlers()
  registerSystemHandlers()
  registerAntiAfkHandlers()
  registerAutoAltHandlers()
  registerLowGpuHandlers()
  registerHealthCheckHandlers()
  registerBackgroundHandlers()
  registerServerMapHandlers()
  registerWebhookHandlers()
  registerWindowHandlers()
}
