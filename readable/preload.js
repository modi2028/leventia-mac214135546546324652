"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var robloxApi = {
  // Public profile
  getUserByUsername: /* @__PURE__ */ __name((username) => import_electron.ipcRenderer.invoke("roblox:get-user-by-username", username), "getUserByUsername"),
  getUserById: /* @__PURE__ */ __name((id) => import_electron.ipcRenderer.invoke("roblox:get-user-by-id", id), "getUserById"),
  getAvatarUrl: /* @__PURE__ */ __name((userId) => import_electron.ipcRenderer.invoke("roblox:get-avatar-url", userId), "getAvatarUrl"),
  getPresence: /* @__PURE__ */ __name((userIds) => import_electron.ipcRenderer.invoke("roblox:get-presence", userIds), "getPresence"),
  getGroup: /* @__PURE__ */ __name((userId) => import_electron.ipcRenderer.invoke("roblox:get-group", userId), "getGroup"),
  // Cookie-based auth
  validateCookie: /* @__PURE__ */ __name((cookie) => import_electron.ipcRenderer.invoke("roblox:validate-cookie", cookie), "validateCookie"),
  browserLogin: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("roblox:browser-login"), "browserLogin"),
  importCookiesFile: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("roblox:import-cookies-file"), "importCookiesFile"),
  // ERLC
  checkSetup: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("roblox:check-setup"), "checkSetup"),
  resolveErlcCode: /* @__PURE__ */ __name((serverCode) => import_electron.ipcRenderer.invoke("roblox:resolve-erlc-code", serverCode), "resolveErlcCode"),
  joinErlc: /* @__PURE__ */ __name((cookie, placeId, accessCode, linkCode, accountId) => import_electron.ipcRenderer.invoke("roblox:join-erlc", cookie, placeId, accessCode, linkCode, accountId), "joinErlc"),
  getRunning: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("roblox:get-running"), "getRunning"),
  disconnect: /* @__PURE__ */ __name((accountId) => import_electron.ipcRenderer.invoke("roblox:disconnect", accountId), "disconnect"),
  disconnectAll: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("roblox:disconnect-all"), "disconnectAll"),
  // Legacy
  loginWithCookie: /* @__PURE__ */ __name((cookie) => import_electron.ipcRenderer.invoke("roblox:login-with-cookie", cookie), "loginWithCookie")
};
var storeApi = {
  getAccounts: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-accounts"), "getAccounts"),
  addAccount: /* @__PURE__ */ __name((account) => import_electron.ipcRenderer.invoke("store:add-account", account), "addAccount"),
  removeAccounts: /* @__PURE__ */ __name((ids) => import_electron.ipcRenderer.invoke("store:remove-accounts", ids), "removeAccounts"),
  updateAccount: /* @__PURE__ */ __name((id, updates) => import_electron.ipcRenderer.invoke("store:update-account", id, updates), "updateAccount"),
  getSettings: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-settings"), "getSettings"),
  saveSettings: /* @__PURE__ */ __name((settings) => import_electron.ipcRenderer.invoke("store:save-settings", settings), "saveSettings"),
  getLicense: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-license"), "getLicense"),
  revalidateLicense: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:revalidate-license"), "revalidateLicense"),
  saveLicense: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:save-license", key), "saveLicense"),
  clearLicense: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:clear-license"), "clearLicense"),
  getHwid: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-hwid"), "getHwid"),
  clearAccounts: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:clear-accounts"), "clearAccounts"),
  validateKey: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:validate-key", key), "validateKey"),
  // Staff-only
  issueKey: /* @__PURE__ */ __name((payload) => import_electron.ipcRenderer.invoke("store:issue-key", payload), "issueKey"),
  getKeys: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-keys"), "getKeys"),
  revokeKey: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:revoke-key", key), "revokeKey"),
  // Updates feed
  getUpdates: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:get-updates"), "getUpdates"),
  postUpdate: /* @__PURE__ */ __name((payload) => import_electron.ipcRenderer.invoke("store:post-update", payload), "postUpdate"),
  deleteUpdate: /* @__PURE__ */ __name((id) => import_electron.ipcRenderer.invoke("store:delete-update", id), "deleteUpdate"),
  // Supabase User Lookup + license management (staff)
  supabaseEnabled: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("store:supabase-enabled"), "supabaseEnabled"),
  leaderboard: /* @__PURE__ */ __name((metric) => import_electron.ipcRenderer.invoke("store:leaderboard", metric), "leaderboard"),
  lookupUser: /* @__PURE__ */ __name((query) => import_electron.ipcRenderer.invoke("store:lookup-user", query), "lookupUser"),
  resetHwid: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:reset-hwid", key), "resetHwid"),
  extendLicense: /* @__PURE__ */ __name((key, days) => import_electron.ipcRenderer.invoke("store:extend-license", key, days), "extendLicense"),
  revokeLicense: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:revoke-license", key), "revokeLicense"),
  enableLicense: /* @__PURE__ */ __name((key) => import_electron.ipcRenderer.invoke("store:enable-license", key), "enableLicense"),
  setRole: /* @__PURE__ */ __name((key, role) => import_electron.ipcRenderer.invoke("store:set-role", key, role), "setRole")
};
var systemApi = {
  getStats: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("system:get-stats"), "getStats")
};
var antiAfkApi = {
  start: /* @__PURE__ */ __name((minutes) => import_electron.ipcRenderer.invoke("antiafk:start", minutes), "start"),
  stop: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("antiafk:stop"), "stop"),
  setInterval: /* @__PURE__ */ __name((minutes) => import_electron.ipcRenderer.invoke("antiafk:set-interval", minutes), "setInterval"),
  status: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("antiafk:status"), "status"),
  leaveAll: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("antiafk:leave-all"), "leaveAll")
};
var lowGpuApi = {
  apply: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("lowgpu:apply"), "apply"),
  restore: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("lowgpu:restore"), "restore"),
  status: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("lowgpu:status"), "status")
};
var healthApi = {
  start: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("health:start"), "start"),
  status: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("health:status"), "status"),
  sweepStart: /* @__PURE__ */ __name((minutes) => import_electron.ipcRenderer.invoke("health:sweep-start", minutes), "sweepStart"),
  sweepStop: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("health:sweep-stop"), "sweepStop")
};
var autoAltApi = {
  testKey: /* @__PURE__ */ __name((serverKey) => import_electron.ipcRenderer.invoke("autoalt:test-key", serverKey), "testKey"),
  start: /* @__PURE__ */ __name((config) => import_electron.ipcRenderer.invoke("autoalt:start", config), "start"),
  stop: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("autoalt:stop"), "stop"),
  status: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("autoalt:status"), "status"),
  deployNow: /* @__PURE__ */ __name((config) => import_electron.ipcRenderer.invoke("autoalt:deploy-now", config), "deployNow"),
  removeNow: /* @__PURE__ */ __name((config) => import_electron.ipcRenderer.invoke("autoalt:remove-now", config), "removeNow")
};
import_electron.contextBridge.exposeInMainWorld("electron", {
  roblox: robloxApi,
  store: storeApi,
  system: systemApi,
  antiAfk: antiAfkApi,
  autoAlt: autoAltApi,
  lowGpu: lowGpuApi,
  health: healthApi
});
