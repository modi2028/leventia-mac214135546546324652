import { ipcMain } from 'electron'
import { sendTestWebhook } from '../webhook.js'

export function registerWebhookHandlers(): void {
  // Send a test message to the given Discord webhook URL (Settings "Send test").
  ipcMain.handle('webhook:test', (_e, url: string) => sendTestWebhook(url))
}
