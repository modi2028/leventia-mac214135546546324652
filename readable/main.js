"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/main.ts
var main_exports = {};
__export(main_exports, {
  RENDERER_DIST: () => RENDERER_DIST,
  VITE_DEV_SERVER_URL: () => VITE_DEV_SERVER_URL,
  VITE_PUBLIC: () => VITE_PUBLIC
});
module.exports = __toCommonJS(main_exports);
var import_electron10 = require("electron");
var import_node_path4 = __toESM(require("node:path"));

// electron/ipc/roblox.ts
var import_electron2 = require("electron");
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_os2 = __toESM(require("node:os"));
var import_node_child_process2 = require("node:child_process");

// electron/multi-instance.ts
var cookieLockProc = null;
function unlockRobloxCookies() {
  if (cookieLockProc) {
    try {
      cookieLockProc.kill();
    } catch {
    }
    cookieLockProc = null;
  }
}
__name(unlockRobloxCookies, "unlockRobloxCookies");

// electron/store/index.ts
var import_electron = require("electron");
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_crypto = __toESM(require("node:crypto"));
var STORAGE_SECRET = "rdash-storage-v1-Xk9#mP$qN!vL@wZ*rY%tU";
var DEFAULT_SETTINGS = {
  autoRefreshEnabled: false,
  autoRefreshInterval: 60,
  accentColor: "#7c3aed",
  theme: "dark",
  antiAfkEnabled: true,
  antiAfkInterval: 5,
  antiAfkAction: "jump",
  lowGpuEnabled: false,
  healthSweepEnabled: false,
  healthSweepInterval: 30,
  autoAlt: {
    serverKey: "",
    serverCode: "",
    deployBelow: 32,
    deployCount: 4,
    removeAt: 39,
    removeCount: 2,
    interval: 30,
    launchDelay: 15
  }
};
var storePath;
var encKey;
var data = {
  accounts: [],
  settings: { ...DEFAULT_SETTINGS },
  licenseBlob: null,
  keyDatabase: [],
  updates: []
};
function deriveKey(appDataPath) {
  return import_node_crypto.default.createHash("sha256").update(STORAGE_SECRET + ":" + appDataPath).digest();
}
__name(deriveKey, "deriveKey");
function encryptLicense(license) {
  const iv = import_node_crypto.default.randomBytes(12);
  const cipher = import_node_crypto.default.createCipheriv("aes-256-gcm", encKey, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(license), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}
__name(encryptLicense, "encryptLicense");
function decryptLicense(blob) {
  try {
    const buf = Buffer.from(blob, "base64");
    if (buf.length < 28) return null;
    const decipher = import_node_crypto.default.createDecipheriv("aes-256-gcm", encKey, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}
__name(decryptLicense, "decryptLicense");
function initStore() {
  const userDataPath = import_electron.app.getPath("userData");
  storePath = import_node_path.default.join(userDataPath, "dashboard-data.json");
  encKey = deriveKey(userDataPath);
  if (import_node_fs.default.existsSync(storePath)) {
    try {
      const parsed = JSON.parse(import_node_fs.default.readFileSync(storePath, "utf-8"));
      data = {
        accounts: parsed.accounts ?? [],
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings ?? {} },
        licenseBlob: parsed.licenseBlob ?? null,
        keyDatabase: parsed.keyDatabase ?? [],
        updates: parsed.updates ?? []
      };
    } catch {
      data = { accounts: [], settings: { ...DEFAULT_SETTINGS }, licenseBlob: null, keyDatabase: [], updates: [] };
    }
  }
}
__name(initStore, "initStore");
function persist() {
  import_node_fs.default.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
}
__name(persist, "persist");
var getAccounts = /* @__PURE__ */ __name(() => data.accounts, "getAccounts");
var addAccount = /* @__PURE__ */ __name((a) => {
  data.accounts.push(a);
  persist();
}, "addAccount");
var removeAccounts = /* @__PURE__ */ __name((ids) => {
  data.accounts = data.accounts.filter((a) => !ids.includes(a.id));
  persist();
}, "removeAccounts");
var updateAccount = /* @__PURE__ */ __name((id, u) => {
  const i = data.accounts.findIndex((a) => a.id === id);
  if (i !== -1) {
    data.accounts[i] = { ...data.accounts[i], ...u };
    persist();
  }
}, "updateAccount");
var clearAccounts = /* @__PURE__ */ __name(() => {
  data.accounts = [];
  persist();
}, "clearAccounts");
var getSettings = /* @__PURE__ */ __name(() => data.settings, "getSettings");
var saveSettings = /* @__PURE__ */ __name((s) => {
  data.settings = s;
  persist();
}, "saveSettings");
var getLicense = /* @__PURE__ */ __name(() => data.licenseBlob ? decryptLicense(data.licenseBlob) : null, "getLicense");
var saveLicense = /* @__PURE__ */ __name((l) => {
  data.licenseBlob = encryptLicense(l);
  persist();
}, "saveLicense");
var clearLicense = /* @__PURE__ */ __name(() => {
  data.licenseBlob = null;
  persist();
}, "clearLicense");
var getKeyDatabase = /* @__PURE__ */ __name(() => data.keyDatabase, "getKeyDatabase");
var addKeyRecord = /* @__PURE__ */ __name((r) => {
  data.keyDatabase.push(r);
  persist();
}, "addKeyRecord");
var revokeKey = /* @__PURE__ */ __name((key) => {
  const r = data.keyDatabase.find((k) => k.key === key.toUpperCase());
  if (!r || r.revoked) return false;
  r.revoked = true;
  r.revokedAt = (/* @__PURE__ */ new Date()).toISOString();
  persist();
  return true;
}, "revokeKey");
var getUpdates = /* @__PURE__ */ __name(() => data.updates, "getUpdates");
var addUpdate = /* @__PURE__ */ __name((u) => {
  data.updates.unshift(u);
  persist();
}, "addUpdate");
var deleteUpdate = /* @__PURE__ */ __name((id) => {
  const before = data.updates.length;
  data.updates = data.updates.filter((u) => u.id !== id);
  if (data.updates.length === before) return false;
  persist();
  return true;
}, "deleteUpdate");

// electron/supabase-config.ts
var SUPABASE_URL = process.env.LVNT_SUPABASE_URL ?? "https://uwnrvdtsqtfrlbxtffys.supabase.co";
var SUPABASE_KEY = process.env.LVNT_SUPABASE_KEY ?? "sb_publishable_vKsSKm7qg9w0Pn_ldidpDQ_f_a9Payv";
function supabaseEnabled() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_KEY.length > 20;
}
__name(supabaseEnabled, "supabaseEnabled");

// electron/hwid.ts
var import_node_child_process = require("node:child_process");
var import_node_crypto2 = __toESM(require("node:crypto"));
var import_node_os = __toESM(require("node:os"));
var cached = null;
function getHwid() {
  if (cached) return cached;
  let raw = "";
  try {
    const out = (0, import_node_child_process.execSync)(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: "utf8", windowsHide: true }
    );
    const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
    if (m) raw = m[1];
  } catch {
  }
  if (!raw) {
    raw = [import_node_os.default.hostname(), import_node_os.default.cpus()[0]?.model ?? "", import_node_os.default.totalmem(), import_node_os.default.platform()].join("|");
  }
  cached = import_node_crypto2.default.createHash("sha256").update("lvnt-hwid-v1:" + raw).digest("hex").slice(0, 32).toUpperCase();
  return cached;
}
__name(getHwid, "getHwid");

// electron/supabase.ts
async function rpc(fn, args) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "API access denied." };
    if (!res.ok) {
      let msg = `Server error (HTTP ${res.status}).`;
      try {
        const j = await res.json();
        if (j.message) msg = j.message;
      } catch {
      }
      return { ok: false, error: msg };
    }
    const data2 = await res.json();
    return { ok: true, data: data2 };
  } catch {
    return { ok: false, error: "Could not reach the license server." };
  }
}
__name(rpc, "rpc");
async function supabaseActivate(key) {
  const r = await rpc(
    "rpc_activate",
    { p_key: key.trim().toUpperCase(), p_hwid: getHwid() }
  );
  if (!r.ok) return { valid: false, error: r.error ?? "Activation failed." };
  const d = r.data;
  if (!d.valid) return { valid: false, error: d.error ?? "Invalid key." };
  const expiry = d.expiresAt ? new Date(d.expiresAt) : null;
  if (!expiry || isNaN(expiry.getTime())) return { valid: false, error: "Invalid expiry returned." };
  const role = d.role ?? "standard";
  return { valid: true, expiresAt: expiry, type: role === "staff" ? "staff" : "basic", role };
}
__name(supabaseActivate, "supabaseActivate");
async function supabaseHeartbeat(key, appVersion, cookies) {
  if (!supabaseEnabled()) return;
  await rpc("rpc_heartbeat", {
    p_key: key.toUpperCase(),
    p_hwid: getHwid(),
    p_version: appVersion,
    p_total: cookies.total,
    p_healthy: cookies.healthy,
    p_expired: cookies.expired
  });
}
__name(supabaseHeartbeat, "supabaseHeartbeat");
async function supabaseIssueKey(staffKey, months, role, discordId, discordUsername) {
  const r = await rpc(
    "rpc_issue_key",
    { p_staff_key: staffKey, p_months: months, p_role: role, p_discord_id: discordId ?? "", p_discord_username: discordUsername ?? "" }
  );
  if (!r.ok || !r.data?.key) return null;
  const d = r.data;
  return {
    key: d.key,
    type: "basic",
    issuedAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: d.expiresAt ?? "",
    months: d.months ?? months,
    revoked: false,
    role: d.role,
    discordId,
    discordUsername
  };
}
__name(supabaseIssueKey, "supabaseIssueKey");
async function supabaseListKeys(staffKey) {
  const r = await rpc("rpc_list_keys", { p_staff_key: staffKey });
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map((row) => {
    const created = row.created_at ?? (/* @__PURE__ */ new Date()).toISOString();
    const months = Math.max(1, Math.round((new Date(row.expires_at).getTime() - new Date(created).getTime()) / (30 * 864e5)));
    return {
      key: row.key,
      type: "basic",
      issuedAt: created,
      expiresAt: row.expires_at,
      months,
      revoked: row.status === "revoked",
      role: row.role,
      discordUsername: row.discord_username ?? void 0,
      discordId: row.discord_id ?? void 0
    };
  });
}
__name(supabaseListKeys, "supabaseListKeys");
async function supabaseLookupUser(staffKey, query) {
  const r = await rpc("rpc_lookup_user", { p_staff_key: staffKey, p_query: query.trim() });
  if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return { found: false, session: "offline", role: "standard" };
  const row = r.data[0];
  const now = Date.now();
  const expired = new Date(row.expires_at) < /* @__PURE__ */ new Date();
  const status3 = row.status === "revoked" ? "revoked" : expired ? "expired" : "active";
  const hbMs = row.last_heartbeat ? new Date(row.last_heartbeat).getTime() : 0;
  const session = hbMs && now - hbMs < 2 * 60 * 1e3 ? "live" : hbMs ? "last-known" : "offline";
  return {
    found: true,
    discordId: row.discord_id ?? void 0,
    discordUsername: row.discord_username ?? void 0,
    role: row.role || "standard",
    license: { key: row.key, plan: row.plan || row.role || "basic", expiresAt: row.expires_at, status: status3 },
    hardware: { hwid: row.hwid, lastHeartbeat: row.last_heartbeat, appVersion: row.app_version },
    cookies: {
      total: row.cookies_total ?? 0,
      healthy: row.cookies_healthy ?? 0,
      expired: row.cookies_expired ?? 0,
      lastCheck: row.cookies_last_check
    },
    session
  };
}
__name(supabaseLookupUser, "supabaseLookupUser");
var supabaseResetHwid = /* @__PURE__ */ __name(async (staffKey, key) => (await rpc("rpc_reset_hwid", { p_staff_key: staffKey, p_key: key })).ok, "supabaseResetHwid");
var supabaseRevoke = /* @__PURE__ */ __name(async (staffKey, key) => (await rpc("rpc_set_status", { p_staff_key: staffKey, p_key: key, p_status: "revoked" })).ok, "supabaseRevoke");
var supabaseEnable = /* @__PURE__ */ __name(async (staffKey, key) => (await rpc("rpc_set_status", { p_staff_key: staffKey, p_key: key, p_status: "active" })).ok, "supabaseEnable");
var supabaseSetRole = /* @__PURE__ */ __name(async (staffKey, key, role) => (await rpc("rpc_set_role", { p_staff_key: staffKey, p_key: key, p_role: role })).ok, "supabaseSetRole");
var supabaseExtend = /* @__PURE__ */ __name(async (staffKey, key, days) => (await rpc("rpc_extend", { p_staff_key: staffKey, p_key: key, p_days: days })).ok, "supabaseExtend");
function rowToUpdate(r) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    version: r.version ?? void 0,
    category: r.category ?? "announcement",
    author: r.author,
    postedAt: r.posted_at
  };
}
__name(rowToUpdate, "rowToUpdate");
async function supabaseGetUpdates() {
  const r = await rpc("rpc_get_updates", {});
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map(rowToUpdate);
}
__name(supabaseGetUpdates, "supabaseGetUpdates");
async function supabasePostUpdate(staffKey, payload) {
  const r = await rpc("rpc_post_update", {
    p_staff_key: staffKey,
    p_title: payload.title,
    p_body: payload.body,
    p_version: payload.version ?? "",
    p_category: payload.category
  });
  if (!r.ok || !r.data) return null;
  return rowToUpdate(r.data);
}
__name(supabasePostUpdate, "supabasePostUpdate");
async function supabaseDeleteUpdate(staffKey, id) {
  return (await rpc("rpc_delete_update", { p_staff_key: staffKey, p_id: id })).ok;
}
__name(supabaseDeleteUpdate, "supabaseDeleteUpdate");
async function supabaseRecordLaunch(key, sessionAlts) {
  if (!supabaseEnabled()) return;
  await rpc("rpc_record_launch", { p_key: key.toUpperCase(), p_session_alts: sessionAlts });
}
__name(supabaseRecordLaunch, "supabaseRecordLaunch");
async function supabaseLeaderboard(metric) {
  const r = await rpc("rpc_leaderboard", { p_metric: metric });
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data;
}
__name(supabaseLeaderboard, "supabaseLeaderboard");

// electron/ipc/roblox.ts
async function getRobloxExePath() {
  const local = process.env.LOCALAPPDATA ?? import_node_path2.default.join(import_node_os2.default.homedir(), "AppData", "Local");
  const searchBases = [
    import_node_path2.default.join(local, "Roblox", "Versions"),
    import_node_path2.default.join(local, "Bloxstrap", "Versions"),
    import_node_path2.default.join(local, "Fishstrap", "Versions"),
    import_node_path2.default.join(local, "Programs", "Roblox", "Versions")
  ];
  const candidates = [];
  for (const base of searchBases) {
    try {
      const dirs = import_node_fs2.default.readdirSync(base);
      for (const d of dirs) {
        const exePath = import_node_path2.default.join(base, d, "RobloxPlayerBeta.exe");
        try {
          candidates.push({ exePath, mtime: import_node_fs2.default.statSync(exePath).mtimeMs });
        } catch {
        }
      }
    } catch {
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].exePath;
}
__name(getRobloxExePath, "getRobloxExePath");
async function wipeRobloxCookies() {
  const local = process.env.LOCALAPPDATA ?? import_node_path2.default.join(import_node_os2.default.homedir(), "AppData", "Local");
  const cookiesPath = import_node_path2.default.join(local, "Roblox", "LocalStorage", "RobloxCookies.dat");
  try {
    import_node_fs2.default.unlinkSync(cookiesPath);
  } catch {
  }
}
__name(wipeRobloxCookies, "wipeRobloxCookies");
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Content-Type": "application/json",
  "Origin": "https://www.roblox.com",
  "Referer": "https://www.roblox.com/"
};
async function robloxFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...HEADERS, ...options.headers ?? {} }
  });
}
__name(robloxFetch, "robloxFetch");
async function getCsrfToken(cookie) {
  const headers = {};
  if (cookie) headers["Cookie"] = `.ROBLOSECURITY=${cookie}`;
  const res = await robloxFetch("https://auth.roblox.com/v2/login", {
    method: "POST",
    body: "{}",
    headers
  });
  return res.headers.get("x-csrf-token") ?? "";
}
__name(getCsrfToken, "getCsrfToken");
async function getGameAuthTicket(cleanCookie) {
  const url = "https://auth.roblox.com/v1/authentication-ticket/";
  const headers = {
    "User-Agent": "Roblox/WinInet",
    "Referer": "https://www.roblox.com/develop",
    "RBX-For-Gameauth": "true",
    "Content-Type": "application/json",
    "Cookie": `.ROBLOSECURITY=${cleanCookie}`
  };
  try {
    const res1 = await fetch(url, { method: "POST", headers, body: "{}" });
    const csrf = res1.headers.get("x-csrf-token");
    if (!csrf) return null;
    headers["X-CSRF-TOKEN"] = csrf;
    const res2 = await fetch(url, { method: "POST", headers, body: "{}" });
    return res2.headers.get("rbx-authentication-ticket");
  } catch {
    return null;
  }
}
__name(getGameAuthTicket, "getGameAuthTicket");
var runningProcesses = /* @__PURE__ */ new Map();
var multiProcess = null;
async function runMultiExe() {
  if (multiProcess && !multiProcess.killed) return true;
  const candidates = [
    import_node_path2.default.join(process.resourcesPath ?? "", "multi.exe"),
    import_node_path2.default.join(import_node_path2.default.dirname(process.execPath), "multi.exe"),
    import_node_path2.default.join(__dirname, "multi.exe"),
    // same dir as compiled main.js (dist-electron/)
    import_node_path2.default.join(__dirname, "..", "resources", "multi.exe"),
    import_node_path2.default.join(process.cwd(), "multi.exe"),
    import_node_path2.default.join(process.cwd(), "resources", "multi.exe")
  ];
  const multiPath = candidates.find((p) => {
    try {
      return import_node_fs2.default.existsSync(p);
    } catch {
      return false;
    }
  });
  if (!multiPath) {
    console.log("[Multi] multi.exe not found, tried:", candidates.join(", "));
    return false;
  }
  console.log("[Multi] Starting:", multiPath);
  const proc = (0, import_node_child_process2.spawn)(multiPath, [], {
    cwd: import_node_path2.default.dirname(multiPath),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: false
  });
  multiProcess = proc;
  proc.stdout?.on("data", (d) => console.log("[multi]", d.toString().trim()));
  proc.stderr?.on("data", (d) => console.error("[multi]", d.toString().trim()));
  proc.on("exit", (code) => {
    console.log("[multi] exited", code);
    multiProcess = null;
  });
  await new Promise((r) => setTimeout(r, 3e3));
  console.log("[Multi] PID", proc.pid, "\u2014 mutex held");
  return true;
}
__name(runMultiExe, "runMultiExe");
var launchQueue = Promise.resolve();
async function doJoin(cookie, placeId, linkCode, accountId) {
  const cleanCookie = cookie.trim().replace(/^\.ROBLOSECURITY=/, "");
  const psCode = (linkCode ?? "").trim();
  if (!psCode) return { success: false, error: "No server code provided." };
  try {
    await wipeRobloxCookies();
    const ticket = await getGameAuthTicket(cleanCookie);
    if (!ticket) return { success: false, error: "Could not get auth ticket \u2014 cookie may be expired." };
    const launchData = encodeURIComponent(JSON.stringify({ psCode }));
    const joinUrl = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&placeId=${placeId}&launchData=${launchData}`;
    const robloxPath = await getRobloxExePath();
    if (!robloxPath) return { success: false, error: "RobloxPlayerBeta.exe not found. Make sure Roblox is installed." };
    const browserTracker = String(Math.floor(Math.random() * 1e5) + 5e5) + String(Math.floor(Math.random() * 8e4) + 1e4);
    const args = [
      "--app",
      "-t",
      ticket,
      "-j",
      joinUrl,
      "-b",
      browserTracker,
      "--launchtime",
      String(Date.now()),
      "--rloc",
      "en_us",
      "--gloc",
      "en_us"
    ];
    console.log("[Join] launching", accountId);
    const proc = (0, import_node_child_process2.spawn)(robloxPath, args, { detached: true, stdio: "ignore", windowsHide: false });
    runningProcesses.set(accountId, proc);
    proc.on("exit", () => runningProcesses.delete(accountId));
    proc.unref();
    try {
      const lic = getLicense();
      if (lic && supabaseEnabled()) void supabaseRecordLaunch(lic.key, runningProcesses.size);
    } catch {
    }
    await new Promise((r) => setTimeout(r, 2e3));
    await wipeRobloxCookies();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
__name(doJoin, "doJoin");
function deployErlc(cookie, placeId, linkCode, accountId) {
  const task = launchQueue.then(() => doJoin(cookie, placeId, linkCode, accountId));
  launchQueue = task.catch(() => {
  });
  return task;
}
__name(deployErlc, "deployErlc");
function removeRunning(accountId) {
  const proc = runningProcesses.get(accountId);
  if (!proc) return false;
  try {
    proc.kill();
    runningProcesses.delete(accountId);
    return true;
  } catch {
    return false;
  }
}
__name(removeRunning, "removeRunning");
function getRunningIds() {
  return [...runningProcesses.keys()];
}
__name(getRunningIds, "getRunningIds");
function registerRobloxHandlers() {
  import_electron2.ipcMain.handle("roblox:get-user-by-username", async (_e, username) => {
    try {
      const res = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
      });
      if (!res.ok) return null;
      const data2 = await res.json();
      return data2.data[0] ?? null;
    } catch {
      return null;
    }
  });
  import_electron2.ipcMain.handle("roblox:get-user-by-id", async (_e, id) => {
    try {
      const res = await robloxFetch(`https://users.roblox.com/v1/users/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  });
  import_electron2.ipcMain.handle("roblox:get-avatar-url", async (_e, userId) => {
    try {
      const res = await robloxFetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
      );
      if (!res.ok) return null;
      const data2 = await res.json();
      return data2.data[0]?.imageUrl ?? null;
    } catch {
      return null;
    }
  });
  import_electron2.ipcMain.handle("roblox:get-presence", async (_e, userIds) => {
    try {
      const res = await robloxFetch("https://presence.roblox.com/v1/presence/users", {
        method: "POST",
        body: JSON.stringify({ userIds })
      });
      if (!res.ok) return [];
      const data2 = await res.json();
      return data2.userPresences;
    } catch {
      return [];
    }
  });
  import_electron2.ipcMain.handle("roblox:get-group", async (_e, userId) => {
    try {
      const res = await robloxFetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
      if (!res.ok) return "None";
      const data2 = await res.json();
      return data2.data[0]?.group?.name ?? "None";
    } catch {
      return "None";
    }
  });
  import_electron2.ipcMain.handle("roblox:validate-cookie", async (_e, rawCookie) => {
    const cookie = rawCookie.trim().replace(/^\.ROBLOSECURITY=/, "");
    try {
      const res = await robloxFetch("https://users.roblox.com/v1/users/authenticated", {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
      });
      if (!res.ok) return null;
      const user = await res.json();
      const [avatarRes, groupRes] = await Promise.all([
        robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`),
        robloxFetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`)
      ]);
      let avatarUrl = "";
      if (avatarRes.ok) {
        const d = await avatarRes.json();
        avatarUrl = d.data[0]?.imageUrl ?? "";
      }
      let group = "None";
      if (groupRes.ok) {
        const d = await groupRes.json();
        group = d.data[0]?.group?.name ?? "None";
      }
      return { id: user.id, name: user.name, displayName: user.displayName, avatarUrl, group, cookie };
    } catch {
      return null;
    }
  });
  import_electron2.ipcMain.handle("roblox:browser-login", async () => {
    return new Promise((resolve) => {
      const loginWin = new import_electron2.BrowserWindow({
        width: 920,
        height: 680,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: `persist:roblox-login-${Date.now()}`
        },
        title: "Log in to Roblox",
        autoHideMenuBar: true,
        backgroundColor: "#1a1a1a"
      });
      loginWin.loadURL("https://www.roblox.com/login");
      let resolved = false;
      const tryExtract = /* @__PURE__ */ __name(async () => {
        if (resolved) return;
        try {
          const cookies = await loginWin.webContents.session.cookies.get({
            url: "https://www.roblox.com",
            name: ".ROBLOSECURITY"
          });
          if (!cookies.length) return;
          const cookie = cookies[0].value;
          const authRes = await robloxFetch("https://users.roblox.com/v1/users/authenticated", {
            headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
          });
          if (!authRes.ok) return;
          const user = await authRes.json();
          resolved = true;
          loginWin.close();
          const [avatarRes, groupRes] = await Promise.all([
            robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`),
            robloxFetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`)
          ]);
          let avatarUrl = "";
          if (avatarRes.ok) {
            const d = await avatarRes.json();
            avatarUrl = d.data[0]?.imageUrl ?? "";
          }
          let group = "None";
          if (groupRes.ok) {
            const d = await groupRes.json();
            group = d.data[0]?.group?.name ?? "None";
          }
          resolve({ id: user.id, name: user.name, displayName: user.displayName, avatarUrl, group, cookie });
        } catch {
        }
      }, "tryExtract");
      loginWin.webContents.session.cookies.on("changed", () => setTimeout(tryExtract, 400));
      loginWin.webContents.on("did-navigate", () => setTimeout(tryExtract, 600));
      loginWin.on("closed", () => {
        if (!resolved) resolve(null);
      });
    });
  });
  import_electron2.ipcMain.handle("roblox:import-cookies-file", async () => {
    const result = await import_electron2.dialog.showOpenDialog({
      title: "Import Cookie File",
      filters: [
        { name: "Text / CSV", extensions: ["txt", "csv"] },
        { name: "All Files", extensions: ["*"] }
      ],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths[0]) return [];
    const content = import_node_fs2.default.readFileSync(result.filePaths[0], "utf-8");
    const lines = content.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const cookies = [];
    for (const line of lines) {
      const eqMatch = line.match(/\.ROBLOSECURITY=([^\s,;]+)/);
      if (eqMatch) {
        cookies.push(eqMatch[1]);
        continue;
      }
      if (line.startsWith("_|WARNING") || line.length > 50 && /^[A-Za-z0-9_|%+/=\-]+$/.test(line)) {
        cookies.push(line);
      }
    }
    return cookies;
  });
  import_electron2.ipcMain.handle("roblox:check-setup", () => {
    const player = findRobloxPlayer();
    const multiCandidates = [
      import_node_path2.default.join(process.resourcesPath ?? "", "multi.exe"),
      import_node_path2.default.join(import_node_path2.default.dirname(process.execPath), "multi.exe"),
      import_node_path2.default.join(__dirname, "..", "resources", "multi.exe"),
      import_node_path2.default.join(__dirname, "..", "..", "resources", "multi.exe"),
      import_node_path2.default.join(process.cwd(), "resources", "multi.exe")
    ];
    const multiFound = multiCandidates.some((p) => {
      try {
        return import_node_fs2.default.existsSync(p);
      } catch {
        return false;
      }
    });
    return {
      found: !!player,
      type: player?.type ?? null,
      path: player?.path ?? null,
      multiInstance: player?.type === "bloxstrap" || multiFound,
      multiExe: multiFound
    };
  });
  import_electron2.ipcMain.handle("roblox:resolve-erlc-code", async (_e, serverCode) => {
    const psCode = serverCode.trim();
    try {
      const res = await fetch(`https://erlc.xyz/join/${psCode}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
        redirect: "follow"
      });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/"psCode"\s*:\s*"([^"]+)"/) ?? html.match(/psCode[=:\s]+"?([A-Za-z0-9_-]{3,})"?/);
        if (m?.[1]) return { placeId: "2534724415", linkCode: m[1] };
      }
    } catch {
    }
    return { placeId: "2534724415", linkCode: psCode };
  });
  import_electron2.ipcMain.handle("roblox:get-running", () => getRunningIds());
  import_electron2.ipcMain.handle("roblox:disconnect", (_e, accountId) => {
    if (!removeRunning(accountId)) return { success: false, error: "No running process for this account." };
    return { success: true };
  });
  import_electron2.ipcMain.handle("roblox:disconnect-all", () => {
    let count = 0;
    for (const id of getRunningIds()) {
      if (removeRunning(id)) count++;
    }
    unlockRobloxCookies();
    return { success: true, count };
  });
  import_electron2.ipcMain.handle("roblox:join-erlc", (_e, cookie, placeId, _accessCode, linkCode, accountId) => {
    return deployErlc(cookie, placeId, linkCode, accountId);
  });
  import_electron2.ipcMain.handle("roblox:login-with-cookie", async (_e, cookie) => {
    try {
      const cleanCookie = cookie.trim().replace(/^\.ROBLOSECURITY=/, "");
      const res = await robloxFetch("https://users.roblox.com/v1/users/authenticated", {
        headers: { Cookie: `.ROBLOSECURITY=${cleanCookie}` }
      });
      if (!res.ok) return { success: false, error: "Invalid cookie \u2014 could not authenticate." };
      const user = await res.json();
      return { success: true, userId: user.id, username: user.name, cookie: cleanCookie };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  import_electron2.ipcMain.handle("roblox:login-with-credentials", async (_e, username, password) => {
    try {
      const csrfToken = await getCsrfToken();
      const res = await robloxFetch("https://auth.roblox.com/v2/login", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: JSON.stringify({ ctype: "Username", cvalue: username, password })
      });
      const setCookie = res.headers.get("set-cookie") ?? "";
      const cookieMatch = setCookie.match(/\.ROBLOSECURITY=([^;]+)/);
      if (res.status === 200) {
        const body2 = await res.json();
        if (cookieMatch) return { success: true, userId: body2.user?.id, username: body2.user?.name, cookie: cookieMatch[1] };
        if (body2.isChallengeRequired) {
          return { success: false, requiresTwoStep: true, twoStepTicket: String(body2.twoStepVerificationData?.ticket ?? ""), twoStepType: String(body2.twoStepVerificationData?.mediaType ?? "Email"), userId: body2.user?.id, username: body2.user?.name };
        }
        return { success: true, userId: body2.user?.id, username: body2.user?.name };
      }
      const body = await res.json();
      if (res.status === 403 && body.errors?.[0]?.fieldData) {
        const fd = (body.errors?.[0]).fieldData;
        return { success: false, requiresTwoStep: true, twoStepTicket: String(fd?.ticket ?? ""), twoStepType: String(fd?.mediaType ?? "Email") };
      }
      return { success: false, error: body.errors?.[0]?.message ?? `HTTP ${res.status}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  import_electron2.ipcMain.handle("roblox:verify-2fa", async (_e, userId, ticket, code, challengeType) => {
    try {
      const csrfToken = await getCsrfToken();
      const typeSlug = challengeType.toLowerCase() === "authenticatorapp" ? "totp" : "email";
      const verifyRes = await robloxFetch(
        `https://twostepverification.roblox.com/v1/users/${userId}/challenges/${typeSlug}/verify`,
        { method: "POST", headers: { "x-csrf-token": csrfToken }, body: JSON.stringify({ actionType: "Login", challengeId: ticket, code }) }
      );
      if (!verifyRes.ok) {
        const body2 = await verifyRes.json();
        return { success: false, error: body2.errors?.[0]?.message ?? "Invalid 2FA code." };
      }
      const verifyData = await verifyRes.json();
      if (!verifyData.verificationToken) return { success: false, error: "2FA verification failed." };
      const loginRes = await robloxFetch("https://auth.roblox.com/v2/login", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: JSON.stringify({ ctype: "Username", cvalue: "", password: "", challengeId: ticket, verificationToken: verifyData.verificationToken, rememberDevice: false })
      });
      const setCookie = loginRes.headers.get("set-cookie") ?? "";
      const cookieMatch = setCookie.match(/\.ROBLOSECURITY=([^;]+)/);
      const body = await loginRes.json();
      if (cookieMatch) return { success: true, userId: body.user?.id, username: body.user?.name, cookie: cookieMatch[1] };
      return { success: false, error: "Could not extract session cookie after 2FA." };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
__name(registerRobloxHandlers, "registerRobloxHandlers");

// electron/ipc/store.ts
var import_electron4 = require("electron");

// electron/key-validator.ts
var import_node_crypto3 = __toESM(require("node:crypto"));
var STAFF_RE = /^LVNT-STAFF-([A-F0-9]{8})-(\d{8})$/i;
var BASIC_RE = /^LVNT-BASIC-([A-F0-9]{6})-([A-F0-9]{6})-(\d{8})$/i;
var LEGACY_RE = /^(?:LVNT|RDASH)-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-(\d{8})$/i;
var DEMO_KEYS = /* @__PURE__ */ new Set(["RDASH-DEMO-0001-TEST-20271231", "LVNT-DEMO-0001-TEST-20271231"]);
function parseExpiry(d) {
  if (!/^\d{8}$/.test(d)) return null;
  const date = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), 23, 59, 59);
  return isNaN(date.getTime()) ? null : date;
}
__name(parseExpiry, "parseExpiry");
async function validateKey(key, keyDatabase) {
  const norm = key.trim().toUpperCase();
  const staffM = STAFF_RE.exec(norm);
  if (staffM) {
    const expiry = parseExpiry(staffM[2]);
    if (!expiry) return { valid: false, error: "Invalid expiry date in key." };
    if (expiry < /* @__PURE__ */ new Date()) return { valid: false, error: "This staff key has expired." };
    return { valid: true, expiresAt: expiry, type: "staff" };
  }
  const basicM = BASIC_RE.exec(norm);
  if (basicM) {
    const expiry = parseExpiry(basicM[3]);
    if (!expiry) return { valid: false, error: "Invalid expiry date in key." };
    if (expiry < /* @__PURE__ */ new Date()) return { valid: false, error: "This key has expired." };
    const record = keyDatabase.find((r) => r.key === norm);
    if (!record) return { valid: false, error: "Key not found. Contact staff to obtain a valid key." };
    if (record.revoked) return { valid: false, error: "This key has been revoked." };
    return { valid: true, expiresAt: expiry, type: "basic" };
  }
  const legM = LEGACY_RE.exec(norm);
  if (legM) {
    const expiry = parseExpiry(legM[1]);
    if (!expiry) return { valid: false, error: "Invalid expiry date in key." };
    if (expiry < /* @__PURE__ */ new Date()) return { valid: false, error: "This key has expired." };
    if (DEMO_KEYS.has(norm)) return { valid: true, expiresAt: expiry, type: "basic" };
    const record = keyDatabase.find((r) => r.key === norm);
    if (record && !record.revoked) return { valid: true, expiresAt: expiry, type: "basic" };
    return { valid: false, error: "Key not found. Contact staff to obtain a valid key." };
  }
  return { valid: false, error: "Unrecognised key format. Expected LVNT-STAFF-\u2026 or LVNT-BASIC-\u2026" };
}
__name(validateKey, "validateKey");
function generateLocalKey(months) {
  const expiry = /* @__PURE__ */ new Date();
  expiry.setMonth(expiry.getMonth() + months);
  const dateStr = [
    expiry.getFullYear(),
    String(expiry.getMonth() + 1).padStart(2, "0"),
    String(expiry.getDate()).padStart(2, "0")
  ].join("");
  const uid = import_node_crypto3.default.randomBytes(3).toString("hex").toUpperCase();
  const rand = import_node_crypto3.default.randomBytes(3).toString("hex").toUpperCase();
  return `LVNT-BASIC-${uid}-${rand}-${dateStr}`;
}
__name(generateLocalKey, "generateLocalKey");

// electron/heartbeat.ts
var import_electron3 = require("electron");
var timer = null;
var activeKey = null;
function tick() {
  if (!activeKey || !supabaseEnabled()) return;
  const accounts = getAccounts();
  const total = accounts.length;
  const healthy = accounts.filter((a) => !!a.cookie).length;
  const expired = total - healthy;
  void supabaseHeartbeat(activeKey, import_electron3.app.getVersion(), { total, healthy, expired });
}
__name(tick, "tick");
function startHeartbeat(key) {
  activeKey = key.toUpperCase();
  if (timer) clearInterval(timer);
  tick();
  timer = setInterval(tick, 60 * 1e3);
}
__name(startHeartbeat, "startHeartbeat");
function stopHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  activeKey = null;
}
__name(stopHeartbeat, "stopHeartbeat");

// electron/ipc/store.ts
var import_node_crypto4 = __toESM(require("node:crypto"));
function registerStoreHandlers() {
  import_electron4.ipcMain.handle("store:get-accounts", () => getAccounts());
  import_electron4.ipcMain.handle("store:add-account", (_e, a) => addAccount(a));
  import_electron4.ipcMain.handle("store:remove-accounts", (_e, ids) => removeAccounts(ids));
  import_electron4.ipcMain.handle("store:update-account", (_e, id, u) => updateAccount(id, u));
  import_electron4.ipcMain.handle("store:clear-accounts", () => clearAccounts());
  import_electron4.ipcMain.handle("store:get-settings", () => getSettings());
  import_electron4.ipcMain.handle("store:save-settings", (_e, s) => saveSettings(s));
  import_electron4.ipcMain.handle("store:get-license", () => getLicense());
  import_electron4.ipcMain.handle("store:revalidate-license", async () => {
    const lic = getLicense();
    if (!lic) return null;
    if (supabaseEnabled()) {
      const result = await supabaseActivate(lic.key);
      if (!result.valid) {
        stopHeartbeat();
        clearLicense();
        return null;
      }
      const updated = {
        key: lic.key,
        type: result.type,
        role: result.role ?? lic.role,
        hwid: getHwid(),
        expiresAt: result.expiresAt.toISOString(),
        validatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveLicense(updated);
      if (result.type !== "staff") startHeartbeat(lic.key);
      return updated;
    }
    if (new Date(lic.expiresAt) < /* @__PURE__ */ new Date()) {
      clearLicense();
      return null;
    }
    return lic;
  });
  import_electron4.ipcMain.handle("store:save-license", async (_e, key) => {
    const normKey = key.trim().toUpperCase();
    if (supabaseEnabled()) {
      const result = await supabaseActivate(normKey);
      if (!result.valid) throw new Error(result.error);
      const license2 = {
        key: normKey,
        type: result.type,
        role: result.role ?? "standard",
        hwid: getHwid(),
        expiresAt: result.expiresAt.toISOString(),
        validatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveLicense(license2);
      if (result.type !== "staff") startHeartbeat(normKey);
      return license2;
    }
    const local = await validateKey(normKey, getKeyDatabase());
    if (!local.valid) throw new Error(local.error);
    const license = {
      key: normKey,
      type: local.type,
      role: local.type === "staff" ? "staff" : "standard",
      hwid: getHwid(),
      expiresAt: local.expiresAt.toISOString(),
      validatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLicense(license);
    return license;
  });
  import_electron4.ipcMain.handle("store:clear-license", () => {
    stopHeartbeat();
    clearLicense();
    return true;
  });
  import_electron4.ipcMain.handle("store:get-hwid", () => getHwid());
  import_electron4.ipcMain.handle("store:validate-key", async (_e, key) => {
    return validateKey(key, getKeyDatabase());
  });
  function staffKey() {
    const lic = getLicense();
    if (lic?.type !== "staff") throw new Error("Staff access required.");
    return lic.key;
  }
  __name(staffKey, "staffKey");
  function assertStaff() {
    staffKey();
  }
  __name(assertStaff, "assertStaff");
  import_electron4.ipcMain.handle("store:issue-key", async (_e, payload) => {
    const sk = staffKey();
    const months = payload.months;
    const role = payload.role || "standard";
    if (supabaseEnabled()) {
      const record2 = await supabaseIssueKey(sk, months, role, payload.discordId, payload.discordUsername);
      if (!record2) throw new Error("Failed to issue key on the server.");
      return record2;
    }
    const key = generateLocalKey(months);
    const expiry = /* @__PURE__ */ new Date();
    expiry.setMonth(expiry.getMonth() + months);
    const record = {
      key,
      type: "basic",
      issuedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: expiry.toISOString(),
      months,
      revoked: false,
      discordUsername: payload.discordUsername,
      discordId: payload.discordId,
      role
    };
    addKeyRecord(record);
    return record;
  });
  import_electron4.ipcMain.handle("store:get-keys", async () => {
    const sk = staffKey();
    if (supabaseEnabled()) return supabaseListKeys(sk);
    return getKeyDatabase();
  });
  import_electron4.ipcMain.handle("store:revoke-key", async (_e, key) => {
    const sk = staffKey();
    if (supabaseEnabled()) {
      if (!await supabaseRevoke(sk, key)) throw new Error("Failed to revoke key.");
      return { success: true };
    }
    const ok = revokeKey(key);
    if (!ok) throw new Error("Key not found or already revoked.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:get-updates", async () => {
    if (supabaseEnabled()) return supabaseGetUpdates();
    return getUpdates();
  });
  import_electron4.ipcMain.handle("store:post-update", async (_e, payload) => {
    const sk = staffKey();
    const title = (payload.title ?? "").trim();
    const body = (payload.body ?? "").trim();
    if (!title) throw new Error("Title is required.");
    if (!body) throw new Error("Body is required.");
    const data2 = { title, body, version: payload.version?.trim() || void 0, category: payload.category ?? "announcement" };
    if (supabaseEnabled()) {
      const post2 = await supabasePostUpdate(sk, data2);
      if (!post2) throw new Error("Failed to post update to the server.");
      return post2;
    }
    const post = {
      id: import_node_crypto4.default.randomBytes(8).toString("hex"),
      author: "Leventia Staff",
      postedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...data2
    };
    addUpdate(post);
    return post;
  });
  import_electron4.ipcMain.handle("store:delete-update", async (_e, id) => {
    const sk = staffKey();
    if (supabaseEnabled()) {
      if (!await supabaseDeleteUpdate(sk, id)) throw new Error("Failed to delete update.");
      return { success: true };
    }
    const ok = deleteUpdate(id);
    if (!ok) throw new Error("Update not found.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:supabase-enabled", () => supabaseEnabled());
  import_electron4.ipcMain.handle("store:leaderboard", (_e, metric) => {
    if (!supabaseEnabled()) return [];
    return supabaseLeaderboard(metric);
  });
  import_electron4.ipcMain.handle("store:lookup-user", async (_e, query) => {
    const sk = staffKey();
    if (!supabaseEnabled()) throw new Error("Supabase is not configured. Add credentials in supabase-config.ts.");
    return supabaseLookupUser(sk, query);
  });
  import_electron4.ipcMain.handle("store:reset-hwid", async (_e, key) => {
    const sk = staffKey();
    if (!await supabaseResetHwid(sk, key)) throw new Error("Failed to reset HWID.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:extend-license", async (_e, key, days) => {
    const sk = staffKey();
    if (!await supabaseExtend(sk, key, days)) throw new Error("Failed to extend license.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:revoke-license", async (_e, key) => {
    const sk = staffKey();
    if (!await supabaseRevoke(sk, key)) throw new Error("Failed to revoke license.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:enable-license", async (_e, key) => {
    const sk = staffKey();
    if (!await supabaseEnable(sk, key)) throw new Error("Failed to enable license.");
    return { success: true };
  });
  import_electron4.ipcMain.handle("store:set-role", async (_e, key, role) => {
    const sk = staffKey();
    if (!await supabaseSetRole(sk, key, role)) throw new Error("Failed to set role.");
    return { success: true };
  });
}
__name(registerStoreHandlers, "registerStoreHandlers");

// electron/ipc/system.ts
var import_electron5 = require("electron");
var import_node_os3 = __toESM(require("node:os"));
function sampleCpus() {
  return import_node_os3.default.cpus().map((cpu) => ({ ...cpu.times }));
}
__name(sampleCpus, "sampleCpus");
function registerSystemHandlers() {
  import_electron5.ipcMain.handle("system:get-stats", () => {
    return new Promise((resolve) => {
      const before = sampleCpus();
      setTimeout(() => {
        const after = sampleCpus();
        let idleDiff = 0;
        let totalDiff = 0;
        for (let i = 0; i < before.length; i++) {
          const b = before[i], a = after[i];
          idleDiff += a.idle - b.idle;
          totalDiff += a.user + a.nice + a.sys + a.irq + a.idle - (b.user + b.nice + b.sys + b.irq + b.idle);
        }
        const cpuUsage = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
        const totalRam = parseFloat((import_node_os3.default.totalmem() / 1024 ** 3).toFixed(1));
        const usedRam = parseFloat(((import_node_os3.default.totalmem() - import_node_os3.default.freemem()) / 1024 ** 3).toFixed(1));
        resolve({ cpuUsage, totalRam, usedRam });
      }, 200);
    });
  });
}
__name(registerSystemHandlers, "registerSystemHandlers");

// electron/ipc/antiafk.ts
var import_electron6 = require("electron");

// electron/anti-afk.ts
var import_node_child_process3 = require("node:child_process");
var timer2 = null;
var intervalMinutes = 5;
var lastWiggle = null;
var lastWindowCount = 0;
function actionBody(action) {
  switch (action) {
    case "forward":
      return "Key $h 0x57 0x11 700";
    // hold W ~0.7s
    case "ws":
      return "Key $h 0x57 0x11 400; Start-Sleep -Milliseconds 90; Key $h 0x53 0x1F 400";
    // W then S
    case "mouse":
      return `
      $x = Get-Random -Minimum 60 -Maximum 400
      $y = Get-Random -Minimum 60 -Maximum 300
      $lp = [IntPtr](($y * 65536) -bor $x)
      [AAFK]::PostMessageW($h, 0x200, [IntPtr]0, $lp) | Out-Null
      Key $h 0x30 0x0B 40`;
    // wiggle + tap 0
    case "jump":
    default:
      return "Key $h 0x20 0x39 80";
  }
}
__name(actionBody, "actionBody");
function buildScript(action) {
  return `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AAFK {
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
}
"@
function Key($h, $vk, $scan, $hold) {
  $down = [IntPtr]([int64](($scan * 65536) + 1))
  $up   = [IntPtr]([int64](($scan * 65536) + 1 + 3221225472))   # | KF_UP | KF_REPEAT bits
  [AAFK]::PostMessageW($h, 0x100, [IntPtr]$vk, $down) | Out-Null   # WM_KEYDOWN
  Start-Sleep -Milliseconds $hold
  [AAFK]::PostMessageW($h, 0x101, [IntPtr]$vk, $up) | Out-Null     # WM_KEYUP
}
$count = 0
Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object {
  $h = $_.MainWindowHandle
  if ($h -ne [IntPtr]::Zero) {
    $count++
    ${actionBody(action)}
  }
}
Write-Output $count
`;
}
__name(buildScript, "buildScript");
function runPowerShell(script) {
  return new Promise((resolve) => {
    const ps = (0, import_node_child_process3.spawn)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
    let out = "";
    ps.stdout.on("data", (d) => {
      out += d.toString();
    });
    ps.on("close", () => resolve(out.trim()));
    ps.on("error", () => resolve(""));
  });
}
__name(runPowerShell, "runPowerShell");
async function wiggle() {
  let action = "jump";
  try {
    action = getSettings().antiAfkAction ?? "jump";
  } catch {
  }
  const out = await runPowerShell(buildScript(action));
  const n = parseInt(out.split(/\s+/).pop() ?? "0", 10);
  lastWindowCount = isNaN(n) ? 0 : n;
  lastWiggle = (/* @__PURE__ */ new Date()).toISOString();
}
__name(wiggle, "wiggle");
function countRobloxInstances() {
  return new Promise((resolve) => {
    const tl = (0, import_node_child_process3.spawn)("tasklist", ["/FI", "IMAGENAME eq RobloxPlayerBeta.exe", "/FO", "CSV", "/NH"], { windowsHide: true });
    let out = "";
    tl.stdout.on("data", (d) => {
      out += d.toString();
    });
    tl.on("close", () => {
      const lines = out.split(/[\r\n]+/).filter((l) => l.toLowerCase().includes("robloxplayerbeta"));
      resolve(lines.length);
    });
    tl.on("error", () => resolve(0));
  });
}
__name(countRobloxInstances, "countRobloxInstances");
function startAntiAfk(minutes) {
  if (minutes && minutes > 0) intervalMinutes = minutes;
  if (timer2) clearInterval(timer2);
  void wiggle();
  timer2 = setInterval(() => {
    void wiggle();
  }, intervalMinutes * 60 * 1e3);
}
__name(startAntiAfk, "startAntiAfk");
function stopAntiAfk() {
  if (timer2) {
    clearInterval(timer2);
    timer2 = null;
  }
}
__name(stopAntiAfk, "stopAntiAfk");
function setAntiAfkInterval(minutes) {
  intervalMinutes = Math.max(1, Math.min(19, minutes));
  if (timer2) startAntiAfk(intervalMinutes);
}
__name(setAntiAfkInterval, "setAntiAfkInterval");
async function getAntiAfkStatus() {
  const windowCount = await countRobloxInstances();
  lastWindowCount = windowCount;
  return {
    running: timer2 !== null,
    intervalMinutes,
    windowCount,
    lastWiggle
  };
}
__name(getAntiAfkStatus, "getAntiAfkStatus");
function leaveAll() {
  stopAntiAfk();
  unlockRobloxCookies();
  return new Promise((resolve) => {
    const tk = (0, import_node_child_process3.spawn)("taskkill", ["/F", "/IM", "RobloxPlayerBeta.exe"], { windowsHide: true });
    let out = "";
    tk.stdout.on("data", (d) => {
      out += d.toString();
    });
    tk.on("close", () => {
      const killed = (out.match(/SUCCESS/gi) ?? []).length;
      lastWindowCount = 0;
      resolve(killed);
    });
    tk.on("error", () => resolve(0));
  });
}
__name(leaveAll, "leaveAll");

// electron/ipc/antiafk.ts
function registerAntiAfkHandlers() {
  import_electron6.ipcMain.handle("antiafk:start", (_e, minutes) => {
    startAntiAfk(minutes);
    return true;
  });
  import_electron6.ipcMain.handle("antiafk:stop", () => {
    stopAntiAfk();
    return true;
  });
  import_electron6.ipcMain.handle("antiafk:set-interval", (_e, minutes) => {
    setAntiAfkInterval(minutes);
    return true;
  });
  import_electron6.ipcMain.handle("antiafk:status", () => getAntiAfkStatus());
  import_electron6.ipcMain.handle("antiafk:leave-all", () => leaveAll());
}
__name(registerAntiAfkHandlers, "registerAntiAfkHandlers");

// electron/ipc/autoalt.ts
var import_electron7 = require("electron");

// electron/erlc-api.ts
var BASE = "https://api.erlc.gg/v2";
async function prcFetch(path5, serverKey) {
  return fetch(`${BASE}${path5}`, {
    headers: {
      "server-key": serverKey,
      "Accept": "application/json"
    }
  });
}
__name(prcFetch, "prcFetch");
function extractName(p) {
  if (typeof p === "string") return p.split(":")[0].trim().toLowerCase();
  if (p && typeof p === "object") {
    const o = p;
    const raw = o.Player ?? o.player ?? o.Name ?? o.name ?? o.Username ?? o.username ?? "";
    return String(raw).split(":")[0].trim().toLowerCase();
  }
  return "";
}
__name(extractName, "extractName");
async function getServerStatus(serverKey) {
  const key = serverKey.trim();
  if (!key) return { ok: false, players: 0, maxPlayers: 0, names: [], error: "No server key provided." };
  try {
    const [statusRes, playersRes] = await Promise.all([
      prcFetch("/server", key),
      prcFetch("/server/players", key)
    ]);
    if (statusRes.status === 401 || statusRes.status === 403 || playersRes.status === 401 || playersRes.status === 403) {
      return { ok: false, players: 0, maxPlayers: 0, names: [], error: "Invalid server key." };
    }
    if (statusRes.status === 429 || playersRes.status === 429) {
      return { ok: false, players: 0, maxPlayers: 0, names: [], error: "Rate limited by PRC \u2014 slow down." };
    }
    let names = [];
    let playersOk = false;
    if (playersRes.ok) {
      try {
        const data2 = await playersRes.json();
        const arr = Array.isArray(data2) ? data2 : data2?.players ?? data2?.Players ?? [];
        names = arr.map(extractName).filter(Boolean);
        playersOk = true;
      } catch {
      }
    }
    let maxPlayers = 40;
    let currentFromStatus;
    let serverName;
    if (statusRes.ok) {
      try {
        const s = await statusRes.json();
        maxPlayers = s.MaxPlayers ?? s.maxPlayers ?? s.max_players ?? 40;
        currentFromStatus = s.CurrentPlayers ?? s.currentPlayers ?? s.current_players;
        serverName = s.Name ?? s.name;
      } catch {
      }
    }
    if (!playersOk && currentFromStatus === void 0) {
      return { ok: false, players: 0, maxPlayers, names: [], error: `PRC unreachable (HTTP ${statusRes.status}/${playersRes.status}).` };
    }
    const players = playersOk ? names.length : currentFromStatus ?? 0;
    return { ok: true, players, maxPlayers, names, name: serverName };
  } catch (err) {
    return { ok: false, players: 0, maxPlayers: 0, names: [], error: err instanceof Error ? err.message : "Network error." };
  }
}
__name(getServerStatus, "getServerStatus");

// electron/auto-alting.ts
var ERLC_PLACE_ID = "2534724415";
var timer3 = null;
var busy = false;
var cfg = null;
var deployedIds = /* @__PURE__ */ new Set();
var status = {
  running: false,
  players: 0,
  maxPlayers: 0,
  ourAlts: 0,
  available: 0,
  lastCheck: null,
  log: []
};
function log(line) {
  const stamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false });
  status.log.unshift(`[${stamp}] ${line}`);
  if (status.log.length > 60) status.log.length = 60;
  console.log("[auto-alt]", line);
}
__name(log, "log");
function cookieAccounts() {
  return getAccounts().filter((a) => !!a.cookie);
}
__name(cookieAccounts, "cookieAccounts");
function ourRunningDeployed() {
  const running = new Set(getRunningIds());
  return [...deployedIds].filter((id) => running.has(id));
}
__name(ourRunningDeployed, "ourRunningDeployed");
function availableAccounts() {
  return cookieAccounts().filter((a) => !deployedIds.has(a.id));
}
__name(availableAccounts, "availableAccounts");
async function deployWave(count) {
  const avail = availableAccounts();
  const toDeploy = avail.slice(0, Math.max(0, count));
  if (toDeploy.length === 0) {
    log("No available accounts to deploy.");
    return;
  }
  if (!cfg) return;
  log(`Below ${cfg.deployBelow} \u2014 deploying ${toDeploy.length} alt${toDeploy.length > 1 ? "s" : ""}\u2026`);
  let done = 0;
  for (const acc of toDeploy) {
    deployedIds.add(acc.id);
    const res = await deployErlc(acc.cookie, ERLC_PLACE_ID, cfg.serverCode, acc.id);
    if (res.success) {
      done++;
    } else {
      deployedIds.delete(acc.id);
      log(`Failed to deploy ${acc.username}: ${res.error ?? "error"}`);
    }
    if (cfg.launchDelay > 0) await new Promise((r) => setTimeout(r, cfg.launchDelay * 1e3));
  }
  log(`Deployed ${done}/${toDeploy.length} alts.`);
}
__name(deployWave, "deployWave");
async function removeWave(count) {
  const running = ourRunningDeployed();
  const toRemove = running.slice(0, Math.max(0, count));
  if (toRemove.length === 0) {
    log("No deployed alts to remove.");
    return;
  }
  log(`Removing ${toRemove.length} alt${toRemove.length > 1 ? "s" : ""} to free slots\u2026`);
  for (const id of toRemove) {
    removeRunning(id);
    deployedIds.delete(id);
  }
  log(`Removed ${toRemove.length} alts.`);
}
__name(removeWave, "removeWave");
async function tick2() {
  if (!cfg || busy) return;
  busy = true;
  try {
    const srv = await getServerStatus(cfg.serverKey);
    status.lastCheck = (/* @__PURE__ */ new Date()).toISOString();
    if (!srv.ok) {
      log(`PRC query failed: ${srv.error ?? "unknown error"}`);
      return;
    }
    status.players = srv.players;
    status.maxPlayers = srv.maxPlayers;
    const running = new Set(getRunningIds());
    const accounts = getAccounts();
    let pending = 0;
    for (const id of [...deployedIds]) {
      const acc = accounts.find((a) => a.id === id);
      const inServer = acc ? srv.names.includes(acc.username.toLowerCase()) : false;
      if (inServer) continue;
      if (running.has(id)) pending++;
      else deployedIds.delete(id);
    }
    const ourAlts = ourRunningDeployed().length;
    const available = availableAccounts().length;
    status.ourAlts = ourAlts;
    status.available = available;
    const projected = srv.players + pending;
    log(`Players: ${srv.players}/${srv.maxPlayers} | Our alts: ${ourAlts} | Available: ${available}`);
    if (projected < cfg.deployBelow && available > 0) {
      const gap = cfg.deployBelow - projected;
      const need = Math.min(cfg.deployCount, gap, available);
      if (need > 0) await deployWave(need);
    } else if (srv.players >= cfg.removeAt && ourAlts > 0) {
      await removeWave(cfg.removeCount);
    }
  } finally {
    busy = false;
  }
}
__name(tick2, "tick");
function startAutoAlt(config) {
  if (!config.serverKey.trim()) return { ok: false, error: "Server key is required." };
  if (!config.serverCode.trim()) return { ok: false, error: "Server code is required." };
  cfg = { ...config };
  if (timer3) clearInterval(timer3);
  status.running = true;
  log("Automation started.");
  void tick2();
  timer3 = setInterval(() => void tick2(), Math.max(10, cfg.interval) * 1e3);
  return { ok: true };
}
__name(startAutoAlt, "startAutoAlt");
function stopAutoAlt() {
  if (timer3) {
    clearInterval(timer3);
    timer3 = null;
  }
  status.running = false;
  log("Automation stopped.");
}
__name(stopAutoAlt, "stopAutoAlt");
function getAutoAltStatus() {
  return { ...status, log: [...status.log] };
}
__name(getAutoAltStatus, "getAutoAltStatus");
async function deployNow(config) {
  cfg = cfg ?? { ...config };
  if (!cfg.serverCode.trim()) {
    log("Set a server code first.");
    return;
  }
  await deployWave(config.deployCount);
}
__name(deployNow, "deployNow");
async function removeNow(config) {
  cfg = cfg ?? { ...config };
  await removeWave(config.removeCount);
}
__name(removeNow, "removeNow");

// electron/ipc/autoalt.ts
function registerAutoAltHandlers() {
  import_electron7.ipcMain.handle("autoalt:test-key", (_e, serverKey) => getServerStatus(serverKey));
  import_electron7.ipcMain.handle("autoalt:start", (_e, config) => startAutoAlt(config));
  import_electron7.ipcMain.handle("autoalt:stop", () => {
    stopAutoAlt();
    return true;
  });
  import_electron7.ipcMain.handle("autoalt:status", () => getAutoAltStatus());
  import_electron7.ipcMain.handle("autoalt:deploy-now", (_e, config) => deployNow(config));
  import_electron7.ipcMain.handle("autoalt:remove-now", (_e, config) => removeNow(config));
}
__name(registerAutoAltHandlers, "registerAutoAltHandlers");

// electron/ipc/lowgpu.ts
var import_electron8 = require("electron");

// electron/low-gpu.ts
var import_node_fs3 = __toESM(require("node:fs"));
var import_node_path3 = __toESM(require("node:path"));
var import_node_os4 = __toESM(require("node:os"));
var LOW_GPU_FLAGS = {
  DFIntDebugDynamicRenderKiloPixels: 37,
  DFIntTaskSchedulerTargetFps: 9999,
  DFFlagDisableDPIScale: "True",
  DFFlagTextureQualityOverrideEnabled: "True",
  DFIntTextureQualityOverride: 1,
  DFIntDebugFRMQualityLevelOverride: 1,
  FIntDebugForceMSAASamples: 0,
  FFlagDebugGraphicsDisableDirect3D11: "False",
  FFlagDebugGraphicsPreferD3D11: "True",
  DFIntCSGLevelOfDetailSwitchingDistance: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL23: 0,
  DFIntCSGLevelOfDetailSwitchingDistanceL34: 0,
  FIntFRMMaxGrassDistance: 0,
  FIntFRMMinGrassDistance: 0,
  DFFlagDebugPauseVoxelizer: "True",
  FFlagDebugSkyGray: "True",
  FIntRenderShadowIntensity: 0,
  DFIntCullFactorPixelThresholdShadowMapHighQuality: 2147483647,
  DFIntCullFactorPixelThresholdShadowMapLowQuality: 2147483647,
  FIntRenderLocalLightUpdatesMax: 1,
  FIntRenderLocalLightUpdatesMin: 1,
  DFFlagDebugRenderForceTechnologyVoxel: "True",
  FFlagDebugGraphicsCharacterDiffusion: "False",
  FFlagGlobalWind: "False",
  FFlagEnableInGameMenuChromeABTest3: "False",
  DFIntRailgunNetLatency: 0,
  DFIntNetworkLatencyTolerance: 1,
  DFIntProcMemUseLimit: 1,
  FFlagNetworkUsePropertySnapping: "False",
  FFlagHandleAltEnterFullscreenManually: "False"
};
var BACKUP_NAME = ".lvnt-graphics-backup.json";
var SETTINGS_NAME = "ClientAppSettings.json";
function targetDirs() {
  const local = process.env.LOCALAPPDATA ?? import_node_path3.default.join(import_node_os4.default.homedir(), "AppData", "Local");
  const bases = [
    import_node_path3.default.join(local, "Roblox", "Versions"),
    import_node_path3.default.join(local, "Bloxstrap", "Versions"),
    import_node_path3.default.join(local, "Fishstrap", "Versions"),
    import_node_path3.default.join(local, "Programs", "Roblox", "Versions")
  ];
  const dirs = /* @__PURE__ */ new Set();
  for (const base of bases) {
    try {
      for (const v of import_node_fs3.default.readdirSync(base)) {
        const verDir = import_node_path3.default.join(base, v);
        try {
          if (import_node_fs3.default.existsSync(import_node_path3.default.join(verDir, "RobloxPlayerBeta.exe"))) {
            dirs.add(import_node_path3.default.join(verDir, "ClientSettings"));
          }
        } catch {
        }
      }
    } catch {
    }
  }
  dirs.add(import_node_path3.default.join(local, "Roblox", "ClientSettings"));
  return [...dirs];
}
__name(targetDirs, "targetDirs");
function isLowGpuApplied() {
  return targetDirs().some((dir) => {
    try {
      return import_node_fs3.default.existsSync(import_node_path3.default.join(dir, BACKUP_NAME));
    } catch {
      return false;
    }
  });
}
__name(isLowGpuApplied, "isLowGpuApplied");
function applyToDir(dir) {
  import_node_fs3.default.mkdirSync(dir, { recursive: true });
  const file = import_node_path3.default.join(dir, SETTINGS_NAME);
  const backup = import_node_path3.default.join(dir, BACKUP_NAME);
  if (!import_node_fs3.default.existsSync(backup)) {
    const existed = import_node_fs3.default.existsSync(file);
    const original = existed ? import_node_fs3.default.readFileSync(file, "utf-8") : "";
    import_node_fs3.default.writeFileSync(backup, JSON.stringify({ existed, original }), "utf-8");
  }
  let current = {};
  try {
    if (import_node_fs3.default.existsSync(file)) current = JSON.parse(import_node_fs3.default.readFileSync(file, "utf-8"));
  } catch {
  }
  import_node_fs3.default.writeFileSync(file, JSON.stringify({ ...current, ...LOW_GPU_FLAGS }, null, 2), "utf-8");
}
__name(applyToDir, "applyToDir");
function restoreDir(dir) {
  const file = import_node_path3.default.join(dir, SETTINGS_NAME);
  const backup = import_node_path3.default.join(dir, BACKUP_NAME);
  try {
    if (import_node_fs3.default.existsSync(backup)) {
      const { existed, original } = JSON.parse(import_node_fs3.default.readFileSync(backup, "utf-8"));
      if (existed) import_node_fs3.default.writeFileSync(file, original, "utf-8");
      else if (import_node_fs3.default.existsSync(file)) import_node_fs3.default.unlinkSync(file);
      import_node_fs3.default.unlinkSync(backup);
    } else if (import_node_fs3.default.existsSync(file)) {
      const current = JSON.parse(import_node_fs3.default.readFileSync(file, "utf-8"));
      for (const k of Object.keys(LOW_GPU_FLAGS)) delete current[k];
      import_node_fs3.default.writeFileSync(file, JSON.stringify(current, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("[low-gpu] restore failed for", dir, err);
  }
}
__name(restoreDir, "restoreDir");
function applyLowGpu() {
  const dirs = targetDirs();
  let any = false;
  for (const dir of dirs) {
    try {
      applyToDir(dir);
      any = true;
    } catch (err) {
      console.error("[low-gpu] apply failed for", dir, err);
    }
  }
  console.log("[low-gpu] applied to", dirs.length, "folder(s)");
  return any;
}
__name(applyLowGpu, "applyLowGpu");
function restoreGraphics() {
  const dirs = targetDirs();
  for (const dir of dirs) restoreDir(dir);
  console.log("[low-gpu] restored");
  return true;
}
__name(restoreGraphics, "restoreGraphics");

// electron/ipc/lowgpu.ts
function registerLowGpuHandlers() {
  import_electron8.ipcMain.handle("lowgpu:apply", () => applyLowGpu());
  import_electron8.ipcMain.handle("lowgpu:restore", () => restoreGraphics());
  import_electron8.ipcMain.handle("lowgpu:status", () => ({ applied: isLowGpuApplied() }));
}
__name(registerLowGpuHandlers, "registerLowGpuHandlers");

// electron/ipc/healthcheck.ts
var import_electron9 = require("electron");

// electron/health-check.ts
var HEADERS2 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json"
};
var BATCH_SIZE = 5;
var ACCOUNT_DELAY = 1500;
var BATCH_COOLDOWN = 5e3;
var MAX_RETRIES = 2;
var sleep = /* @__PURE__ */ __name((ms) => new Promise((r) => setTimeout(r, ms)), "sleep");
var status2 = { running: false, total: 0, done: 0, valid: 0, expired: 0, unknown: 0, log: [] };
var sweepTimer = null;
function log2(line) {
  const stamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false });
  status2.log.unshift(`[${stamp}] ${line}`);
  if (status2.log.length > 60) status2.log.length = 60;
  console.log("[health]", line);
}
__name(log2, "log");
async function checkCookie(cleanCookie) {
  try {
    const res = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: { ...HEADERS2, Cookie: `.ROBLOSECURITY=${cleanCookie}` }
    });
    if (res.status === 401 || res.status === 403) return { code: "expired" };
    if (res.status === 429) return { code: "rate" };
    if (!res.ok) return { code: "unknown" };
    const user = await res.json();
    let avatarUrl = "";
    let group = "None";
    try {
      const [aRes, gRes] = await Promise.all([
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`, { headers: HEADERS2 }),
        fetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`, { headers: HEADERS2 })
      ]);
      if (aRes.ok) {
        const d = await aRes.json();
        avatarUrl = d.data[0]?.imageUrl ?? "";
      }
      if (gRes.ok) {
        const d = await gRes.json();
        group = d.data[0]?.group?.name ?? "None";
      }
    } catch {
    }
    return { code: "valid", name: user.name, displayName: user.displayName, avatarUrl, group };
  } catch {
    return { code: "unknown" };
  }
}
__name(checkCookie, "checkCookie");
async function runHealthCheck() {
  if (status2.running) return status2;
  const accounts = getAccounts().filter((a) => a.cookie);
  status2 = { running: true, total: accounts.length, done: 0, valid: 0, expired: 0, unknown: 0, log: [] };
  log2(`Starting health check on ${accounts.length} account${accounts.length !== 1 ? "s" : ""}\u2026`);
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    for (const acc of batch) {
      const cookie = (acc.cookie ?? "").replace(/^\.ROBLOSECURITY=/, "");
      let result = { code: "unknown" };
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        result = await checkCookie(cookie);
        if (result.code !== "rate") break;
        const wait = 1e4 + Math.floor(Math.random() * 1e4);
        log2(`Rate limited on ${acc.username} \u2014 waiting ${Math.round(wait / 1e3)}s (retry ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (result.code === "valid") {
        updateAccount(acc.id, {
          username: result.name,
          displayName: result.displayName,
          avatarUrl: result.avatarUrl || acc.avatarUrl,
          group: result.group,
          refreshedAt: now,
          cookieStatus: "valid"
        });
        status2.valid++;
      } else if (result.code === "expired") {
        updateAccount(acc.id, { cookieStatus: "expired" });
        status2.expired++;
      } else {
        updateAccount(acc.id, { cookieStatus: "unknown" });
        status2.unknown++;
      }
      status2.done++;
      await sleep(ACCOUNT_DELAY);
    }
    if (i + BATCH_SIZE < accounts.length) await sleep(BATCH_COOLDOWN);
  }
  status2.running = false;
  log2(`Health check: ${status2.valid} valid, ${status2.expired} expired, ${status2.unknown} unknown`);
  return status2;
}
__name(runHealthCheck, "runHealthCheck");
function getHealthCheckStatus() {
  return { ...status2, log: [...status2.log] };
}
__name(getHealthCheckStatus, "getHealthCheckStatus");
function startHealthSweep(intervalMinutes2) {
  if (sweepTimer) clearInterval(sweepTimer);
  const ms = Math.max(5, intervalMinutes2) * 60 * 1e3;
  sweepTimer = setInterval(() => {
    if (!status2.running) void runHealthCheck();
  }, ms);
  console.log("[health] background sweep every", intervalMinutes2, "min");
}
__name(startHealthSweep, "startHealthSweep");
function stopHealthSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
__name(stopHealthSweep, "stopHealthSweep");
function initHealthSweep() {
  try {
    const s = getSettings();
    if (s.healthSweepEnabled) startHealthSweep(s.healthSweepInterval);
  } catch {
  }
}
__name(initHealthSweep, "initHealthSweep");

// electron/ipc/healthcheck.ts
function registerHealthCheckHandlers() {
  import_electron9.ipcMain.handle("health:start", () => {
    void runHealthCheck();
    return true;
  });
  import_electron9.ipcMain.handle("health:status", () => getHealthCheckStatus());
  import_electron9.ipcMain.handle("health:sweep-start", (_e, minutes) => {
    startHealthSweep(minutes);
    return true;
  });
  import_electron9.ipcMain.handle("health:sweep-stop", () => {
    stopHealthSweep();
    return true;
  });
}
__name(registerHealthCheckHandlers, "registerHealthCheckHandlers");

// electron/ipc/index.ts
function setupIpcHandlers() {
  registerRobloxHandlers();
  registerStoreHandlers();
  registerSystemHandlers();
  registerAntiAfkHandlers();
  registerAutoAltHandlers();
  registerLowGpuHandlers();
  registerHealthCheckHandlers();
}
__name(setupIpcHandlers, "setupIpcHandlers");

// electron/main.ts
process.env.APP_ROOT = import_node_path4.default.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var RENDERER_DIST = import_node_path4.default.join(process.env.APP_ROOT, "dist");
var VITE_PUBLIC = VITE_DEV_SERVER_URL ? import_node_path4.default.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win;
var UI_ZOOM = 1.18;
function createWindow() {
  win = new import_electron10.BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1200,
    minHeight: 740,
    backgroundColor: "#07070e",
    icon: import_node_path4.default.join(VITE_PUBLIC, "icon.ico"),
    webPreferences: {
      preload: import_node_path4.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      zoomFactor: UI_ZOOM
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    import_electron10.shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.setZoomFactor(UI_ZOOM);
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(import_node_path4.default.join(RENDERER_DIST, "index.html"));
  }
  win.on("closed", () => {
    win = null;
  });
}
__name(createWindow, "createWindow");
import_electron10.app.whenReady().then(() => {
  initStore();
  setupIpcHandlers();
  runMultiExe();
  initHealthSweep();
  const lic = getLicense();
  if (lic && lic.type !== "staff" && supabaseEnabled()) {
    startHeartbeat(lic.key);
  }
  createWindow();
});
import_electron10.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron10.app.quit();
    win = null;
  }
});
import_electron10.app.on("activate", () => {
  if (import_electron10.BrowserWindow.getAllWindows().length === 0) createWindow();
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RENDERER_DIST,
  VITE_DEV_SERVER_URL,
  VITE_PUBLIC
});
