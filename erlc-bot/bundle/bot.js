var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// bot.js
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  MessageFlags as MessageFlags2,
  ActivityType
} from "discord.js";

// store.js
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
var FILE = join(DIR, "store.json");
function emptyGuild() {
  return {
    config: {},
    // channel/role ids keyed by setting name
    infractions: [],
    // { id, userId, type, reason, mod, ts }
    promotions: [],
    // { id, userId, fromRank, toRank, reason, mod, ts }
    giveaways: {},
    // messageId -> { channelId, prize, winners, endsAt, host, entries[], ended }
    tickets: {},
    // channelId -> { userId, claimedBy, openedAt }
    ticketCounter: 0,
    afk: {},
    // userId -> { reason, since }
    reviews: [],
    // { id, staffId, stars, comment, author, ts }
    trainings: [],
    // { id, type, host, when, status, ts }
    suggestions: [],
    // { id, messageId, authorId, text, ts }
    roleplays: []
    // { id, title, players, host, messageId, ts, revoked }
  };
}
var db = { guilds: {} };
function load() {
  try {
    if (existsSync(FILE)) db = JSON.parse(readFileSync(FILE, "utf8"));
  } catch (e) {
    console.error("\u26A0\uFE0F  store.json unreadable, starting fresh:", e.message);
    db = { guilds: {} };
  }
}
load();
var pending = null;
function save() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try {
      if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
      const tmp = FILE + ".tmp";
      writeFileSync(tmp, JSON.stringify(db, null, 2));
      renameSync(tmp, FILE);
    } catch (e) {
      console.error("\u26A0\uFE0F  failed to save store:", e.message);
    }
  }, 250);
}
function guild(id) {
  if (!db.guilds[id]) db.guilds[id] = emptyGuild();
  const fresh = emptyGuild();
  for (const k of Object.keys(fresh)) if (!(k in db.guilds[id])) db.guilds[id][k] = fresh[k];
  return db.guilds[id];
}
function persist() {
  save();
}
function resetGuild(id) {
  db.guilds[id] = emptyGuild();
  save();
}
function allGuilds() {
  return db.guilds;
}
function globalStore() {
  if (!db.global) db.global = { bans: [] };
  return db.global;
}

// util.js
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
var COLOR = 2845872;
var ERROR_COLOR = 15023678;
var OK_COLOR = 3711337;
var PREFIX = "u!";
var csv = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
var STAFF_ROLES = csv(process.env.STAFF_ROLE_ID);
var ADMIN_ROLES = csv(process.env.ADMIN_ROLE_ID);
function hasAnyRole(member, ids) {
  return ids.some((id) => member.roles.cache.has(id));
}
function isAdmin(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return ADMIN_ROLES.length > 0 && hasAnyRole(member, ADMIN_ROLES);
}
function isStaff(member) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  return STAFF_ROLES.length > 0 && hasAnyRole(member, STAFF_ROLES);
}
function isSupport(member, cfg14) {
  if (isStaff(member)) return true;
  const roles = csv(cfg14?.supportRoles);
  return roles.length > 0 && hasAnyRole(member, roles);
}
var errEmbed = (msg, title = "\u26A0\uFE0F Error") => new EmbedBuilder().setColor(ERROR_COLOR).setTitle(title).setDescription(String(msg).slice(0, 4e3));
var okEmbed = (msg, title) => {
  const e = new EmbedBuilder().setColor(OK_COLOR).setDescription(String(msg).slice(0, 4e3));
  if (title) e.setTitle(title);
  return e;
};
var infoEmbed = (title, desc) => new EmbedBuilder().setColor(COLOR).setTitle(title).setTimestamp().setDescription(desc ? String(desc).slice(0, 4e3) : null);
function listEmbed(title, lines, { color = COLOR, empty = "Nothing to show." } = {}) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (!lines.length) return e.setDescription(empty);
  let desc = "", shown = 0;
  for (const line of lines) {
    if (desc.length + line.length + 1 > 3900) break;
    desc += line + "\n";
    shown++;
  }
  if (shown < lines.length) desc += `
\u2026and **${lines.length - shown}** more.`;
  return e.setDescription(desc);
}
var ts = (sec) => sec ? `<t:${sec}:R>` : "\u2014";
var now = () => Math.floor(Date.now() / 1e3);
async function resolveChannel(guild2, id) {
  if (!id) return null;
  return guild2.channels.cache.get(id) || guild2.channels.fetch(id).catch(() => null);
}
async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {
  });
  return interaction.reply(payload).catch(() => {
  });
}
function parseDuration(str) {
  const m = /^(\d+)\s*(s|m|h|d|w)?$/i.exec(String(str || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "m").toLowerCase();
  return n * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit];
}

// features/erlc.js
var erlc_exports = {};
__export(erlc_exports, {
  ERLC_COMMANDS: () => ERLC_COMMANDS,
  VIEWS: () => VIEWS,
  buildErlcEmbed: () => buildErlcEmbed,
  handlePrefix: () => handlePrefix,
  handleSlash: () => handleSlash,
  owns: () => owns,
  prefixOwns: () => prefixOwns,
  runErlcCommand: () => runErlcCommand,
  slash: () => slash
});
import { SlashCommandBuilder, EmbedBuilder as EmbedBuilder2 } from "discord.js";

// erlcApi.js
var BASE_URL = process.env.ERLC_API_URL || "https://api.erlc.gg/v1";
function serverKey() {
  const key = process.env.ERLC_SERVER_KEY;
  if (!key) throw new Error("ERLC_SERVER_KEY is not set in .env");
  return key;
}
async function erlcRequest(endpoint, { method = "GET", body } = {}) {
  const bust = method === "GET" ? `${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}` : "";
  const res = await fetch(`${BASE_URL}${endpoint}${bust}`, {
    method,
    headers: {
      "Server-Key": serverKey(),
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      ...body ? { "Content-Type": "application/json" } : {}
    },
    ...body ? { body: JSON.stringify(body) } : {}
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.message ? ` \u2014 ${data.message}` : "";
    } catch {
    }
    throw new Error(`ERLC API ${res.status}${detail}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
var getServerInfo = () => erlcRequest("/server");
var getPlayers = () => erlcRequest("/server/players");
var getJoinLogs = () => erlcRequest("/server/joinlogs");
var getKillLogs = () => erlcRequest("/server/killlogs");
var getCommandLogs = () => erlcRequest("/server/commandlogs");
var getBans = () => erlcRequest("/server/bans");
var getVehicles = () => erlcRequest("/server/vehicles");
var getQueue = () => erlcRequest("/server/queue");
var sendCommand = (command) => erlcRequest("/server/command", { method: "POST", body: { command } });
async function getRobloxUsername(userId) {
  if (!userId) return "N/A";
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return String(userId);
    const data = await res.json();
    return data.displayName || data.name || String(userId);
  } catch {
    return String(userId);
  }
}

// features/erlc.js
var ERLC_COMMANDS = {
  heal: { ingame: "heal", usage: "u!heal <player|all>", desc: 'Heal a player (or "all").' },
  kill: { ingame: "kill", usage: "u!kill <player|all>", desc: "Kill a player." },
  respawn: { ingame: "respawn", usage: "u!respawn <player|all>", desc: "Respawn a player." },
  refresh: { ingame: "refresh", usage: "u!refresh <player>", desc: "Refresh (re-load) a player." },
  mod: { ingame: "mod", usage: "u!mod <player>", desc: "Give a player in-game mod." },
  unmod: { ingame: "unmod", usage: "u!unmod <player>", desc: "Remove a player's in-game mod." },
  admin: { ingame: "admin", usage: "u!admin <player>", desc: "Give a player in-game admin." },
  unadmin: { ingame: "unadmin", usage: "u!unadmin <player>", desc: "Remove a player's in-game admin." },
  jail: { ingame: "jail", usage: "u!jail <player>", desc: "Jail a player." },
  unjail: { ingame: "unjail", usage: "u!unjail <player>", desc: "Release a player from jail." },
  kick: { ingame: "kick", usage: "u!kick <player>", desc: "Kick a player." },
  ban: { ingame: "ban", usage: "u!ban <player>", desc: "Ban a player." },
  unban: { ingame: "unban", usage: "u!unban <player>", desc: "Unban a player." },
  wanted: { ingame: "wanted", usage: "u!wanted <player>", desc: "Mark a player wanted." },
  unwanted: { ingame: "unwanted", usage: "u!unwanted <player>", desc: "Clear wanted status." },
  pm: { ingame: "pm", usage: "u!pm <player> <message>", desc: "Private-message a player." },
  h: { ingame: "h", usage: "u!h <message>", desc: "Send a hint to everyone." },
  hint: { ingame: "h", usage: "u!hint <message>", desc: "Send a hint to everyone." },
  msg: { ingame: "m", usage: "u!msg <message>", desc: "Send a server message." },
  priority: { ingame: "pt", usage: "u!priority <seconds>", desc: "Start a priority timer." },
  weather: { ingame: "weather", usage: "u!weather <clear|rain|...>", desc: "Set the weather." },
  time: { ingame: "time", usage: "u!time <0-23>", desc: "Set the in-game time." },
  startfire: { ingame: "startfire", usage: "u!startfire", desc: "Start a random fire." },
  stopfire: { ingame: "stopfire", usage: "u!stopfire", desc: "Stop all fires." }
};
var NO_ARG = /* @__PURE__ */ new Set(["startfire", "stopfire"]);
var splitNameId = (s) => {
  const [name, id] = String(s ?? "").split(":");
  return { name: name || "Unknown", id: id || "" };
};
async function runErlcCommand(raw) {
  const command = raw.startsWith(":") ? raw : `:${raw}`;
  await sendCommand(command);
  return command;
}
async function buildErlcEmbed(view) {
  switch (view) {
    case "server": {
      const s = await getServerInfo();
      return new EmbedBuilder2().setColor(COLOR).setTitle(`${s.Name || "ER:LC Server"}`).setTimestamp().addFields(
        { name: "Players", value: `${s.CurrentPlayers ?? "?"} / ${s.MaxPlayers ?? "?"}`, inline: true },
        { name: "Queue", value: `${s.Queue ?? 0}`, inline: true },
        { name: "Join Key", value: `\`${s.JoinKey ?? "\u2014"}\``, inline: true },
        { name: "Owner ID", value: `${s.OwnerId ?? "\u2014"}`, inline: true },
        { name: "Verified Reqd", value: `${s.AccVerifiedReq ?? "\u2014"}`, inline: true },
        { name: "Team Balance", value: `${s.TeamBalance ? "On" : "Off"}`, inline: true }
      );
    }
    case "players": {
      const players = await getPlayers();
      const lines = (players || []).map((p) => {
        const { name, id } = splitNameId(p.Player);
        return `\u2022 **${name}** \`${id}\` \u2014 ${p.Team || "?"}${p.Callsign ? ` \xB7 ${p.Callsign}` : ""}${p.Permission && p.Permission !== "Normal" ? ` \xB7 ${p.Permission}` : ""}`;
      });
      return listEmbed(`Online Players \u2014 ${lines.length}`, lines, { empty: "No players online." });
    }
    case "joinlogs": {
      const logs = await getJoinLogs();
      const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map((l) => `${l.Join ? "\u{1F7E2} Joined" : "\u{1F534} Left"} **${splitNameId(l.Player).name}** ${ts(l.Timestamp)}`);
      return listEmbed("Join Logs", lines, { empty: "No join logs." });
    }
    case "killlogs": {
      const logs = await getKillLogs();
      const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map((l) => `\u{1F480} **${splitNameId(l.Killer).name}** \u2192 **${splitNameId(l.Killed).name}** ${ts(l.Timestamp)}`);
      return listEmbed("Kill Logs", lines, { empty: "No kill logs." });
    }
    case "commandlogs": {
      const logs = await getCommandLogs();
      const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map((l) => `**${splitNameId(l.Player).name}**: \`${l.Command}\` ${ts(l.Timestamp)}`);
      return listEmbed("Command Logs", lines, { empty: "No command logs." });
    }
    case "bans": {
      const bans = await getBans();
      const entries = Object.entries(bans || {});
      return listEmbed(`Bans \u2014 ${entries.length}`, entries.map(([id, name]) => `\u2022 **${name}** \`${id}\``), { empty: "No bans." });
    }
    case "vehicles": {
      const v = await getVehicles();
      return listEmbed(`Spawned Vehicles \u2014 ${(v || []).length}`, (v || []).map((x) => `\u2022 **${x.Name}** \u2014 ${x.Owner}${x.Texture ? ` (${x.Texture})` : ""}`), { empty: "No vehicles spawned." });
    }
    case "queue": {
      const ids = await getQueue() || [];
      const names = await Promise.all(ids.slice(0, 25).map((id) => getRobloxUsername(id)));
      return listEmbed(`Queue \u2014 ${ids.length}`, names.map((n, i) => `${i + 1}. **${n}**`), { empty: "Queue is empty." });
    }
    default:
      return errEmbed(`Unknown view: ${view}`);
  }
}
var VIEWS = ["server", "players", "joinlogs", "killlogs", "commandlogs", "bans", "vehicles", "queue"];
var slash = [
  new SlashCommandBuilder().setName("erlc").setDescription("ER:LC server management").addSubcommand((s) => s.setName("server").setDescription("Get server info")).addSubcommand((s) => s.setName("players").setDescription("Get online players")).addSubcommand((s) => s.setName("joinlogs").setDescription("Get join logs")).addSubcommand((s) => s.setName("killlogs").setDescription("Get kill logs")).addSubcommand((s) => s.setName("commandlogs").setDescription("Get command logs")).addSubcommand((s) => s.setName("bans").setDescription("Get bans")).addSubcommand((s) => s.setName("vehicles").setDescription("Get spawned vehicles")).addSubcommand((s) => s.setName("queue").setDescription("Get the join queue")).addSubcommand((s) => s.setName("command").setDescription("Execute an in-game ERLC command").addStringOption((o) => o.setName("command").setDescription('e.g. ":heal John" or "heal John"').setRequired(true)))
];
var owns = ["erlc"];
var prefixOwns = ["erlc", "run", "cmd", "command", ...Object.keys(ERLC_COMMANDS)];
async function handleSlash(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "command") {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("You lack permission to run ERLC commands.")], ephemeral: true });
    await interaction.deferReply();
    const sent = await runErlcCommand(interaction.options.getString("command"));
    return interaction.editReply({ embeds: [okEmbed(`\u2705 Executed \`${sent}\``)] });
  }
  await interaction.deferReply();
  return interaction.editReply({ embeds: [await buildErlcEmbed(sub)] });
}
async function handlePrefix(cmd, message, args, rest) {
  const reply = (e) => message.reply({ embeds: [e] }).catch(() => {
  });
  if (cmd === "erlc") {
    const view = (args[0] || "").toLowerCase();
    if (!VIEWS.includes(view)) return reply(errEmbed(`Usage: \`u!erlc <${VIEWS.join("|")}>\``));
    try {
      return reply(await buildErlcEmbed(view));
    } catch (e) {
      return reply(errEmbed(e.message));
    }
  }
  if (cmd === "run" || cmd === "cmd" || cmd === "command") {
    if (!isAdmin(message.member)) return reply(errEmbed("You need the admin role to run raw commands."));
    if (!rest) return reply(errEmbed("Usage: `u!run :<command> <args>`"));
    try {
      return reply(okEmbed(`\u2705 Executed \`${await runErlcCommand(rest)}\``));
    } catch (e) {
      return reply(errEmbed(e.message));
    }
  }
  const spec = ERLC_COMMANDS[cmd];
  if (spec) {
    if (!isStaff(message.member)) return reply(errEmbed("You lack permission to run ERLC commands."));
    if (!NO_ARG.has(spec.ingame) && !rest) return reply(errEmbed(`Usage: \`${spec.usage}\``));
    try {
      return reply(okEmbed(`\u2705 Executed \`${await runErlcCommand(`${spec.ingame} ${rest}`.trim())}\``));
    } catch (e) {
      return reply(errEmbed(e.message));
    }
  }
}

// features/sessions.js
var sessions_exports = {};
__export(sessions_exports, {
  componentNs: () => componentNs,
  handleComponent: () => handleComponent,
  handlePrefix: () => handlePrefix2,
  handleSlash: () => handleSlash2,
  owns: () => owns2,
  prefixOwns: () => prefixOwns2,
  slash: () => slash2
});
import {
  SlashCommandBuilder as SlashCommandBuilder2,
  ActionRowBuilder as ActionRowBuilder2,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// theme.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  MessageFlags
} from "discord.js";
var V2 = MessageFlags.IsComponentsV2;
var ENV = {
  logo: process.env.BRAND_LOGO_URL || "",
  separator: process.env.BRAND_SEPARATOR_URL || "",
  color: process.env.BRAND_COLOR ? parseInt(process.env.BRAND_COLOR.replace("#", ""), 16) : 2845872,
  name: process.env.BRAND_NAME || "",
  footer: process.env.BRAND_FOOTER || "",
  pingRole: process.env.COMMUNITY_ROLE_ID || "",
  joinUrl: process.env.JOIN_URL || "",
  emoji: process.env.BRAND_EMOJI || ""
};
var BANNER_SLOTS = [
  "default",
  "infractions",
  "promotions",
  "sessionStart",
  "sessionShutdown",
  "sessionBoost",
  "sessionFull",
  "sessionVote",
  "dashboard",
  "guidelines",
  "information",
  "regulations",
  "marketplace",
  "welcome",
  "verify",
  "status",
  "applications",
  "suggestions",
  "reviews",
  "training",
  "tickets",
  "giveaways"
];
function branding(guildId) {
  const b = guildId && guild(guildId).config.branding || {};
  return {
    banners: b.banners || {},
    logo: b.logo || ENV.logo,
    separator: b.separator || ENV.separator,
    color: b.color ?? ENV.color,
    name: b.name || ENV.name,
    footer: b.footer || ENV.footer,
    pingRole: b.pingRole || ENV.pingRole,
    joinUrl: b.joinUrl || ENV.joinUrl,
    emoji: b.emoji || ENV.emoji
  };
}
var isUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);
function panel({ guildId, kind = "default", title, body, fields, buttons, ping, footer, bannerUrl, color, noBanner, here, mentionUsers } = {}) {
  const b = branding(guildId);
  const c = new ContainerBuilder();
  const accent = color ?? b.color;
  if (accent) c.setAccentColor(accent);
  const pingId = ping === true ? b.pingRole : typeof ping === "string" ? ping : "";
  const pingLine = `${pingId ? `<@&${pingId}>` : ""}${here ? " @here" : ""}`.trim();
  if (pingLine) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(pingLine));
  const isBannerRef = (s) => typeof s === "string" && /^(https?|attachment):\/\//i.test(s);
  const banner = noBanner ? null : isBannerRef(bannerUrl) ? bannerUrl : b.banners[kind] || b.banners.default;
  if (isUrl(banner)) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner))
    );
  }
  const blocks = [];
  if (title) blocks.push(`## ${title}`);
  if (body) blocks.push(body);
  if (fields?.length) blocks.push(fields.map((f) => `> **${f.name}:** ${f.value}`).join("\n"));
  const content = blocks.join("\n\n") || "\u200B";
  if (isUrl(b.logo)) {
    c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content.slice(0, 4e3))).setThumbnailAccessory(new ThumbnailBuilder().setURL(b.logo)));
  } else {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content.slice(0, 4e3)));
  }
  if (buttons?.length) {
    c.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
  }
  if (isUrl(b.separator)) {
    c.addSeparatorComponents(new SeparatorBuilder());
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(b.separator))
    );
  } else {
    c.addSeparatorComponents(new SeparatorBuilder());
  }
  const foot = footer ?? b.footer ?? "";
  const stamp = `<t:${Math.floor(Date.now() / 1e3)}:f>`;
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${foot ? foot + " \u2022 " : ""}${stamp}`));
  return {
    components: [c],
    flags: V2,
    allowedMentions: { roles: pingId ? [pingId] : [], parse: here ? ["everyone"] : [], users: mentionUsers || [] }
  };
}
function ephemeralPanel(opts) {
  const p = panel(opts);
  return { ...p, flags: V2 | MessageFlags.Ephemeral };
}

// features/sessions.js
var votes = /* @__PURE__ */ new Map();
var cfg = (gid) => guild(gid).config;
async function targetChannel(g, fallback) {
  return await resolveChannel(g, cfg(g.id).sessionChannel) || fallback;
}
var PANELS = {
  ssu: { slot: "sessionStart", title: "Session Startup", body: "A session startup has been initiated and is now live. If you participated in the vote, you are expected to join within the next 15 minutes." },
  ssd: { slot: "sessionShutdown", title: "Session Shutdown", body: "This session has now concluded. Thank you all for playing \u2014 keep an eye out for the next startup vote!" },
  boost: { slot: "sessionBoost", title: "Session Boost", body: "There are many open spots in our server! Join up! Our roleplays are still going strong and the server is still actively moderated!" },
  full: { slot: "sessionFull", title: "Session Full", body: "The server is currently **full**! Join the queue and you'll get in as slots open up." }
};
async function liveServerInfo() {
  try {
    return await getServerInfo();
  } catch {
    return null;
  }
}
function joinButton(gid, s) {
  const b = branding(gid);
  const url = b.joinUrl || (s?.JoinKey ? `https://policeroleplay.community/join?code=${s.JoinKey}` : "");
  if (!/^https?:\/\//i.test(url)) return null;
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Join Server").setURL(url);
}
async function buildSessionPanel(g, kind, host) {
  const p = PANELS[kind];
  const s = await liveServerInfo();
  const fields = [];
  if (s) {
    const ownerName = await getRobloxUsername(s.OwnerId);
    fields.push(
      { name: "Server Name", value: s.Name ?? "\u2014" },
      { name: "Owner", value: ownerName },
      { name: "Server Code", value: s.JoinKey ? `\`${s.JoinKey}\`` : "\u2014" },
      { name: "Players", value: `${s.CurrentPlayers ?? "?"}/${s.MaxPlayers ?? "?"}` },
      { name: "In Queue", value: `${s.Queue ?? 0}` }
    );
  }
  let body = `> ${p.body}

**${branding(g.id).name || "Server"}**`;
  if (fields.length) body += `

**Server Information**`;
  if (kind === "ssu" && host) fields.push({ name: "Hosted by", value: `<@${host.id}>` });
  fields.push({ name: "Last updated", value: ts(now()) });
  const btn = joinButton(g.id, s);
  return panel({
    guildId: g.id,
    kind: p.slot,
    title: p.title,
    body,
    fields,
    ping: cfg(g.id).sessionPingRole || void 0,
    here: true,
    mentionUsers: host ? [host.id] : [],
    buttons: btn ? [btn] : void 0,
    footer: `Session Powered by ${branding(g.id).name || "the server"}.`
  });
}
var slash2 = [
  new SlashCommandBuilder2().setName("session").setDescription("Session management").addSubcommand((s) => s.setName("info").setDescription("Session information panel")).addSubcommand((s) => s.setName("ssu").setDescription("Announce server startup")).addSubcommand((s) => s.setName("ssd").setDescription("Announce server shutdown")).addSubcommand((s) => s.setName("boost").setDescription("Call for server boosts")).addSubcommand((s) => s.setName("full").setDescription("Announce the server is full")).addSubcommand((s) => s.setName("vote").setDescription("Start a session vote").addIntegerOption((o) => o.setName("needed").setDescription("Votes needed (default 5)").setMinValue(1)))
];
var owns2 = ["session"];
var prefixOwns2 = ["session", "shutdown"];
var componentNs = ["sessionvote"];
function votePanel(gid, needed, count, reached) {
  return panel({
    guildId: gid,
    kind: "sessionVote",
    title: "Session Vote",
    body: reached ? `**Reached ${count}/${needed} votes!** Time to start.` : "Click **Vote** below to call for a session start!",
    fields: [{ name: "Votes", value: `**${count} / ${needed}**` }],
    ping: cfg(gid).sessionPingRole || void 0,
    here: true,
    footer: `Powered by ${branding(gid).name || "the server"}.`
  });
}
var voteRow = () => new ActionRowBuilder2().addComponents(
  new ButtonBuilder().setCustomId("sessionvote:add").setLabel("Vote").setStyle(ButtonStyle.Success)
);
async function postVote(g, channel, needed) {
  const payload = votePanel(g.id, needed, 0, false);
  payload.components.push(voteRow());
  const msg = await channel.send(payload);
  votes.set(msg.id, { voters: /* @__PURE__ */ new Set(), needed });
  return msg;
}
async function handleSlash2(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const g = interaction.guild;
  if (sub === "info") {
    const c = cfg(g.id);
    return interaction.reply({ embeds: [okEmbed(
      `**Session Channel:** ${c.sessionChannel ? `<#${c.sessionChannel}>` : "current channel"}
**Session Ping Role:** ${c.sessionPingRole ? `<@&${c.sessionPingRole}>` : "none (set with /setup session-ping-role)"}
**Also pings:** @here

Use \`/session ssu|ssd|boost|full|vote\`.`,
      "Session Info"
    )], ephemeral: true });
  }
  if (sub === "vote") {
    await interaction.deferReply({ ephemeral: true });
    const ch2 = await targetChannel(g, interaction.channel);
    await postVote(g, ch2, interaction.options.getInteger("needed") || 5);
    return interaction.editReply({ embeds: [okEmbed(`\u2705 Vote posted in ${ch2}.`)] });
  }
  await interaction.deferReply({ ephemeral: true });
  const ch = await targetChannel(g, interaction.channel);
  await ch.send(await buildSessionPanel(g, sub, interaction.user));
  return interaction.editReply({ embeds: [okEmbed(`\u2705 Announced in ${ch}.`)] });
}
async function handleComponent(interaction) {
  const v = votes.get(interaction.message.id);
  if (!v) return interaction.reply({ embeds: [errEmbed("This vote has expired.")], ephemeral: true });
  if (v.voters.has(interaction.user.id)) v.voters.delete(interaction.user.id);
  else v.voters.add(interaction.user.id);
  const count = v.voters.size;
  const payload = votePanel(interaction.guild.id, v.needed, count, count >= v.needed);
  payload.components.push(voteRow());
  await interaction.update(payload);
}
async function handlePrefix2(cmd, message, args) {
  if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
  });
  const reply = (e) => message.reply({ embeds: [e] }).catch(() => {
  });
  const g = message.guild;
  if (cmd === "shutdown") {
    const ch = await targetChannel(g, message.channel);
    await ch.send(await buildSessionPanel(g, "ssd", message.author));
    return reply(okEmbed(`Emergency shutdown announced in ${ch}.`));
  }
  if (cmd === "session") {
    const sub = (args[0] || "").toLowerCase();
    if (sub === "vote") {
      const ch = await targetChannel(g, message.channel);
      await postVote(g, ch, 5);
      return reply(okEmbed(`\u2705 Vote posted in ${ch}.`));
    }
    if (["ssu", "ssd", "boost", "full"].includes(sub)) {
      const ch = await targetChannel(g, message.channel);
      await ch.send(await buildSessionPanel(g, sub, message.author));
      return reply(okEmbed(`\u2705 Announced in ${ch}.`));
    }
    return reply(errEmbed("Usage: `u!session <ssu|ssd|boost|full|vote>`"));
  }
}

// features/giveaways.js
var giveaways_exports = {};
__export(giveaways_exports, {
  componentNs: () => componentNs2,
  handleComponent: () => handleComponent2,
  handlePrefix: () => handlePrefix3,
  handleSlash: () => handleSlash3,
  init: () => init,
  owns: () => owns3,
  prefixOwns: () => prefixOwns3,
  slash: () => slash3
});
import {
  SlashCommandBuilder as SlashCommandBuilder3,
  ActionRowBuilder as ActionRowBuilder3,
  ButtonBuilder as ButtonBuilder2,
  ButtonStyle as ButtonStyle2
} from "discord.js";
var clientRef = null;
var timers = /* @__PURE__ */ new Map();
var enterRow = (disabled = false) => new ActionRowBuilder3().addComponents(
  new ButtonBuilder2().setCustomId("giveaway:enter").setLabel("Enter \u{1F389}").setStyle(ButtonStyle2.Success).setDisabled(disabled)
);
function gwPayload(gid, gw, { ended = false } = {}) {
  const p = panel({
    guildId: gid,
    kind: "giveaways",
    title: gw.prize,
    body: ended ? "This giveaway has **ended**." : "Click **Enter** below to join the giveaway!",
    fields: ended ? [{ name: "Entries", value: `${gw.entries.length}` }] : [{ name: "Winners", value: `${gw.winners}` }, { name: "Ends", value: `<t:${gw.endsAt}:R>` }, { name: "Entries", value: `${gw.entries.length}` }],
    footer: `Hosted by ${gw.host}`
  });
  p.components.push(enterRow(ended));
  return p;
}
function pickWinners(entries, n) {
  const pool = [...entries], winners = [];
  while (winners.length < n && pool.length) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return winners;
}
async function endGiveaway(gid, messageId) {
  clearTimeout(timers.get(messageId));
  timers.delete(messageId);
  const gw = guild(gid).giveaways[messageId];
  if (!gw || gw.ended) return null;
  gw.ended = true;
  persist();
  const guildObj = clientRef?.guilds.cache.get(gid);
  const channel = guildObj && await guildObj.channels.fetch(gw.channelId).catch(() => null);
  const msg = channel && await channel.messages.fetch(messageId).catch(() => null);
  const winners = pickWinners(gw.entries, gw.winners);
  if (msg) await msg.edit(gwPayload(gid, gw, { ended: true })).catch(() => {
  });
  if (channel) await channel.send(winners.length ? `\u{1F389} Congratulations ${winners.map((w) => `<@${w}>`).join(", ")}! You won **${gw.prize}**.` : `No valid entries for **${gw.prize}** \u2014 no winner.`).catch(() => {
  });
  return winners;
}
function schedule(gid, messageId, endsAt) {
  timers.set(messageId, setTimeout(() => endGiveaway(gid, messageId).catch(() => {
  }), Math.max(0, (endsAt - now()) * 1e3)));
}
function init(ctx) {
  clientRef = ctx.client;
  for (const [gid, data] of Object.entries(ctx.allGuilds())) {
    for (const [mid, gw] of Object.entries(data.giveaways || {})) {
      if (!gw.ended) schedule(gid, mid, gw.endsAt);
    }
  }
}
var slash3 = [
  new SlashCommandBuilder3().setName("giveaway").setDescription("Giveaways").addSubcommand((s) => s.setName("start").setDescription("Start a giveaway").addStringOption((o) => o.setName("prize").setDescription("Prize").setRequired(true)).addStringOption((o) => o.setName("duration").setDescription("e.g. 10m, 2h, 1d").setRequired(true)).addIntegerOption((o) => o.setName("winners").setDescription("Number of winners (default 1)").setMinValue(1))).addSubcommand((s) => s.setName("end").setDescription("End a giveaway now").addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true))).addSubcommand((s) => s.setName("reroll").setDescription("Reroll a giveaway").addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)))
];
var owns3 = ["giveaway"];
var prefixOwns3 = ["giveaway"];
var componentNs2 = ["giveaway"];
async function startGiveaway(channel, prize, durationStr, winners, host) {
  const secs = parseDuration(durationStr);
  if (!secs) return { error: "Invalid duration. Use e.g. `10m`, `2h`, `1d`." };
  const endsAt = now() + secs;
  const gw = { channelId: channel.id, prize, winners, endsAt, host, entries: [], ended: false };
  const msg = await channel.send(gwPayload(channel.guild.id, gw));
  guild(channel.guild.id).giveaways[msg.id] = gw;
  persist();
  schedule(channel.guild.id, msg.id, endsAt);
  return { msg };
}
async function handleSlash3(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === "start") {
    const { msg, error } = await startGiveaway(
      interaction.channel,
      interaction.options.getString("prize"),
      interaction.options.getString("duration"),
      interaction.options.getInteger("winners") || 1,
      interaction.user.tag
    );
    if (error) return interaction.reply({ embeds: [errEmbed(error)], ephemeral: true });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Giveaway started \u2014 message ID \`${msg.id}\`.`)], ephemeral: true });
  }
  const mid = interaction.options.getString("message_id");
  const gw = guild(interaction.guild.id).giveaways[mid];
  if (!gw) return interaction.reply({ embeds: [errEmbed("No giveaway with that message ID.")], ephemeral: true });
  if (sub === "end") {
    const winners2 = await endGiveaway(interaction.guild.id, mid);
    return interaction.reply({ embeds: [okEmbed(winners2?.length ? `\u2705 Ended. Winners: ${winners2.map((w) => `<@${w}>`).join(", ")}` : "\u2705 Ended \u2014 no valid entries.")], ephemeral: true });
  }
  const winners = pickWinners(gw.entries, gw.winners);
  if (!winners.length) return interaction.reply({ embeds: [errEmbed("No entries to reroll.")], ephemeral: true });
  await interaction.channel.send(`\u{1F389} Reroll! New winner(s) for **${gw.prize}**: ${winners.map((w) => `<@${w}>`).join(", ")}`);
  return interaction.reply({ embeds: [okEmbed("\u2705 Rerolled.")], ephemeral: true });
}
async function handleComponent2(interaction) {
  const gw = guild(interaction.guild.id).giveaways[interaction.message.id];
  if (!gw || gw.ended) return interaction.reply({ embeds: [errEmbed("This giveaway has ended.")], ephemeral: true });
  const id = interaction.user.id;
  let msg;
  if (gw.entries.includes(id)) {
    gw.entries = gw.entries.filter((e) => e !== id);
    msg = "You left the giveaway.";
  } else {
    gw.entries.push(id);
    msg = "\u{1F389} You entered the giveaway! Good luck.";
  }
  persist();
  await interaction.message.edit(gwPayload(interaction.guild.id, gw)).catch(() => {
  });
  return interaction.reply({ embeds: [okEmbed(msg)], ephemeral: true });
}
async function handlePrefix3(cmd, message, args) {
  if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
  });
  const reply = (e) => message.reply({ embeds: [e] }).catch(() => {
  });
  const sub = (args.shift() || "").toLowerCase();
  if (sub === "create") {
    const duration = args.shift();
    const winners = parseInt(args[0], 10);
    if (Number.isInteger(winners)) args.shift();
    const prize = args.join(" ");
    if (!duration || !prize) return reply(errEmbed("Usage: `u!giveaway create <duration> [winners] <prize>`"));
    const { msg, error } = await startGiveaway(message.channel, prize, duration, Number.isInteger(winners) ? winners : 1, message.author.tag);
    if (error) return reply(errEmbed(error));
    return reply(okEmbed(`\u2705 Giveaway started \u2014 message ID \`${msg.id}\`.`));
  }
  if (sub === "end" || sub === "reroll") {
    const mid = args[0];
    const gw = guild(message.guild.id).giveaways[mid];
    if (!gw) return reply(errEmbed("No giveaway with that message ID."));
    if (sub === "end") {
      await endGiveaway(message.guild.id, mid);
      return reply(okEmbed("\u2705 Ended."));
    }
    const winners = pickWinners(gw.entries, gw.winners);
    if (!winners.length) return reply(errEmbed("No entries to reroll."));
    await message.channel.send(`\u{1F389} Reroll! New winner(s) for **${gw.prize}**: ${winners.map((w) => `<@${w}>`).join(", ")}`);
    return reply(okEmbed("\u2705 Rerolled."));
  }
  return reply(errEmbed("Usage: `u!giveaway <create|end|reroll>`"));
}

// features/infractions.js
var infractions_exports = {};
__export(infractions_exports, {
  handlePrefix: () => handlePrefix4,
  handleSlash: () => handleSlash4,
  owns: () => owns4,
  prefixOwns: () => prefixOwns4,
  slash: () => slash4
});
import { SlashCommandBuilder as SlashCommandBuilder4 } from "discord.js";
var cfg2 = (gid) => guild(gid).config;
async function logPanel(g, payload) {
  const ch = await resolveChannel(g, cfg2(g.id).infractionLogChannel);
  if (ch) await ch.send(payload).catch(() => {
  });
  return ch;
}
function addInfraction(g, { userId, type, reason, modId }) {
  const data = guild(g.id);
  data.infractionSeq = (data.infractionSeq || 0) + 1;
  const rec = { id: data.infractionSeq, userId, type, reason, mod: modId, ts: now() };
  data.infractions.push(rec);
  persist();
  return rec;
}
function infractionPanel(g, rec, { removed = false } = {}) {
  return panel({
    guildId: g.id,
    kind: "infractions",
    title: removed ? "Infraction Removed" : "Infraction Added",
    fields: [
      { name: "ID", value: `#${rec.id}` },
      { name: "Type", value: rec.type },
      { name: "User", value: `<@${rec.userId}> (${rec.userId})` },
      { name: "Moderator", value: `<@${rec.mod}> (${rec.mod})` },
      { name: "Reason", value: rec.reason || "\u2014" }
    ]
  });
}
var slash4 = [
  new SlashCommandBuilder4().setName("infraction").setDescription("Manage infractions").addSubcommand((s) => s.setName("add").setDescription("Add an infraction").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)).addStringOption((o) => o.setName("type").setDescription("e.g. Strike, Warning, Suspension").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))).addSubcommand((s) => s.setName("remove").setDescription("Remove an infraction by ID").addIntegerOption((o) => o.setName("id").setDescription("Infraction ID").setRequired(true))).addSubcommand((s) => s.setName("list").setDescription("List infractions for a user").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
];
var owns4 = ["infraction"];
var prefixOwns4 = ["infraction"];
async function handleSlash4(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const g = interaction.guild;
  if (sub === "add") {
    const user2 = interaction.options.getUser("user");
    const rec = addInfraction(g, { userId: user2.id, type: interaction.options.getString("type"), reason: interaction.options.getString("reason"), modId: interaction.user.id });
    const ch = await logPanel(g, infractionPanel(g, rec));
    user2.send(`You received an infraction in **${g.name}** \u2014 **${rec.type}**: ${rec.reason}`).catch(() => {
    });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Infraction **#${rec.id}** added${ch ? ` (logged in ${ch})` : ""}.`)], ephemeral: true });
  }
  if (sub === "remove") {
    const id = interaction.options.getInteger("id");
    const arr = guild(g.id).infractions;
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No infraction with ID #${id}.`)], ephemeral: true });
    const [rec] = arr.splice(idx, 1);
    persist();
    await logPanel(g, infractionPanel(g, rec, { removed: true }));
    return interaction.reply({ embeds: [okEmbed(`\u2705 Infraction **#${id}** removed.`)], ephemeral: true });
  }
  const user = interaction.options.getUser("user");
  const recs = guild(g.id).infractions.filter((r) => r.userId === user.id);
  const lines = recs.map((r) => `**#${r.id}** \xB7 ${r.type} \u2014 ${r.reason} \xB7 by <@${r.mod}> ${ts(r.ts)}`);
  return interaction.reply({ embeds: [listEmbed(`Infractions \u2014 ${user.tag} (${recs.length})`, lines, { empty: "No infractions." })], ephemeral: true });
}
async function handlePrefix4(cmd, message, args, rest) {
  if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
  });
  const user = message.mentions.users.first();
  const rest2 = rest.replace(/<@!?\d+>/, "").trim().split(/\s+/);
  const type = rest2.shift();
  const reason = rest2.join(" ");
  if (!user || !type || !reason) return message.reply({ embeds: [errEmbed("Usage: `u!infraction @user <type> <reason>`")] }).catch(() => {
  });
  const rec = addInfraction(message.guild, { userId: user.id, type, reason, modId: message.author.id });
  const ch = await logPanel(message.guild, infractionPanel(message.guild, rec));
  user.send(`You received an infraction in **${message.guild.name}** \u2014 **${type}**: ${reason}`).catch(() => {
  });
  return message.reply({ embeds: [okEmbed(`\u2705 Infraction **#${rec.id}** added${ch ? ` (logged in ${ch})` : ""}.`)] }).catch(() => {
  });
}

// features/promotions.js
var promotions_exports = {};
__export(promotions_exports, {
  handlePrefix: () => handlePrefix5,
  handleSlash: () => handleSlash5,
  owns: () => owns5,
  prefixOwns: () => prefixOwns5,
  slash: () => slash5
});
import { SlashCommandBuilder as SlashCommandBuilder5 } from "discord.js";
var cfg3 = (gid) => guild(gid).config;
function promotionPanel(g, rec, userTag) {
  return panel({
    guildId: g.id,
    kind: "promotions",
    title: "Promotion!",
    body: `<@${rec.userId}> has been promoted!`,
    fields: [
      { name: "User", value: `<@${rec.userId}>` },
      { name: "Promoted By", value: `<@${rec.mod}>` },
      { name: "Old Rank", value: rec.fromRank || "N/A" },
      { name: "New Rank", value: rec.toRank },
      { name: "Reason", value: rec.reason || "\u2014" }
    ]
  });
}
var slash5 = [
  new SlashCommandBuilder5().setName("promotion").setDescription("Staff promotions").addSubcommand((s) => s.setName("add").setDescription("Promote a staff member").addUserOption((o) => o.setName("user").setDescription("Staff member").setRequired(true)).addStringOption((o) => o.setName("new_rank").setDescription("New rank").setRequired(true)).addStringOption((o) => o.setName("old_rank").setDescription("Old rank (default N/A)")).addStringOption((o) => o.setName("reason").setDescription("Reason"))).addSubcommand((s) => s.setName("history").setDescription("View promotion history for a user").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
];
var owns5 = ["promotion"];
var prefixOwns5 = ["promotion"];
async function record(g, { userId, toRank, fromRank, reason, modId }) {
  const data = guild(g.id);
  data.promotionSeq = (data.promotionSeq || 0) + 1;
  const rec = { id: data.promotionSeq, userId, toRank, fromRank: fromRank || "N/A", reason, mod: modId, ts: now() };
  data.promotions.push(rec);
  persist();
  return rec;
}
async function handleSlash5(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const g = interaction.guild;
  if (sub === "add") {
    const user2 = interaction.options.getUser("user");
    const rec = await record(g, {
      userId: user2.id,
      toRank: interaction.options.getString("new_rank"),
      fromRank: interaction.options.getString("old_rank"),
      reason: interaction.options.getString("reason"),
      modId: interaction.user.id
    });
    const ch = await resolveChannel(g, cfg3(g.id).promoChannel);
    if (ch) await ch.send(promotionPanel(g, rec, user2.tag)).catch(() => {
    });
    user2.send(`\u{1F389} You were promoted to **${rec.toRank}** in **${g.name}**!`).catch(() => {
    });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Promotion logged${ch ? ` in ${ch}` : ""}.`)], ephemeral: true });
  }
  const user = interaction.options.getUser("user");
  const recs = guild(g.id).promotions.filter((r) => r.userId === user.id);
  const lines = recs.map((r) => `**${r.fromRank} \u2192 ${r.toRank}** \xB7 by <@${r.mod}> ${ts(r.ts)}${r.reason ? ` \u2014 ${r.reason}` : ""}`);
  return interaction.reply({ embeds: [listEmbed(`Promotions \u2014 ${user.tag} (${recs.length})`, lines, { empty: "No promotions." })], ephemeral: true });
}
async function handlePrefix5(cmd, message, args, rest) {
  if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
  });
  const user = message.mentions.users.first();
  let body = rest.replace(/<@!?\d+>/, "").trim();
  if (!user || !body) return message.reply({ embeds: [errEmbed("Usage: `u!promotion @user <new rank> | <reason>`")] }).catch(() => {
  });
  const [toRank, reason] = body.split("|").map((s) => s.trim());
  const rec = await record(message.guild, { userId: user.id, toRank, reason, modId: message.author.id });
  const ch = await resolveChannel(message.guild, cfg3(message.guild.id).promoChannel);
  if (ch) await ch.send(promotionPanel(message.guild, rec, user.tag)).catch(() => {
  });
  return message.reply({ embeds: [okEmbed(`\u2705 Promotion logged${ch ? ` in ${ch}` : ""}.`)] }).catch(() => {
  });
}

// features/tickets.js
var tickets_exports = {};
__export(tickets_exports, {
  componentNs: () => componentNs3,
  handleComponent: () => handleComponent3,
  handlePrefix: () => handlePrefix6,
  handleSlash: () => handleSlash6,
  owns: () => owns6,
  prefixOwns: () => prefixOwns6,
  slash: () => slash6
});
import {
  SlashCommandBuilder as SlashCommandBuilder6,
  ActionRowBuilder as ActionRowBuilder4,
  ButtonBuilder as ButtonBuilder3,
  ButtonStyle as ButtonStyle3,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits as PermissionFlagsBits2,
  AttachmentBuilder
} from "discord.js";
var cfg4 = (gid) => guild(gid).config;
function defaultTypes(gid) {
  const emoji = branding(gid).emoji || null;
  return [
    { id: "general", label: "General", emoji, description: "General support", category: null, pingRole: "1513548811434463292", supportRoles: null },
    { id: "staff-report", label: "Staff Report", emoji, description: "Report a staff member", category: null, pingRole: "1513548811492921474", supportRoles: null },
    { id: "staff-fastpass", label: "Staff Fastpass", emoji, description: "Staff fastpass requests", category: null, pingRole: "1513548811526602758", supportRoles: null },
    { id: "high-rank", label: "High Rank", emoji, description: "High rank enquiries", category: null, pingRole: "1513548811492921472", supportRoles: null },
    { id: "ownership", label: "Ownership", emoji, description: "Ownership / management", category: null, pingRole: "1513548811572613154", supportRoles: null }
  ];
}
function types(gid) {
  const c = cfg4(gid);
  if (!c.ticketTypes) c.ticketTypes = [];
  if (!c.ticketTypesSeeded) {
    c.ticketTypes = defaultTypes(gid);
    c.ticketTypesSeeded = true;
    persist();
  }
  return c.ticketTypes;
}
var slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "ticket";
function safeEmoji(e) {
  if (!e || typeof e !== "string") return void 0;
  if (/^<a?:[A-Za-z0-9_]+:\d+>$/.test(e)) return e;
  if (!e.includes(":") && !/[A-Za-z]/.test(e)) return e;
  return void 0;
}
function panelControls(gid) {
  const list = types(gid);
  if (!list.length) {
    return [new ButtonBuilder3().setCustomId("ticket:open").setLabel("\u{1F3AB} Open Ticket").setStyle(ButtonStyle3.Primary)];
  }
  const menu = new StringSelectMenuBuilder().setCustomId("ticket:open").setPlaceholder("Select a ticket type\u2026");
  for (const t of list.slice(0, 25)) {
    const opt = { label: t.label.slice(0, 100), value: t.id, description: (t.description || "").slice(0, 100) || void 0 };
    const em = safeEmoji(t.emoji);
    if (em) opt.emoji = em;
    menu.addOptions(opt);
  }
  return [menu];
}
function ticketChannelName(claimed, username) {
  return `${claimed ? "\u{1F7E2}" : "\u{1F534}"}-${slugify(username)}`;
}
function typeLabel(gid, id) {
  const ty = types(gid).find((t) => t.id === id);
  return ty ? ty.label : "Ticket";
}
function controlButtons(t) {
  const claimed = !!t.claimedBy;
  return [
    new ButtonBuilder3().setCustomId("ticket:claim").setLabel(claimed ? "Unclaim" : "Claim").setStyle(claimed ? ButtonStyle3.Success : ButtonStyle3.Secondary),
    new ButtonBuilder3().setCustomId("ticket:close").setLabel("Close").setStyle(ButtonStyle3.Danger)
  ];
}
function ticketPanel(gid, t) {
  const status = t.claimedBy ? `**Claimed** by <@${t.claimedBy}>` : "**Unclaimed** \u2014 waiting for staff";
  return panel({
    guildId: gid,
    kind: "tickets",
    title: `${typeLabel(gid, t.type)} #${t.number}`,
    body: `Welcome <@${t.userId}>! Describe your issue and a staff member will assist.

**Status:** ${status}`,
    footer: branding(gid).name || void 0,
    buttons: controlButtons(t)
  });
}
function viewerRoleIds(g, type) {
  const own = [];
  if (type?.pingRole) own.push(type.pingRole);
  own.push(...csv(type?.supportRoles));
  const unique = [...new Set(own)];
  return unique.length ? unique : csv(cfg4(g.id).supportRoles);
}
async function ensureCategory(g, type) {
  const explicit = type?.category && g.channels.cache.get(type.category);
  if (explicit && explicit.type === ChannelType.GuildCategory) return type.category;
  const name = type ? type.label : "Tickets";
  let cat = g.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase());
  if (!cat) {
    const overwrites = [
      { id: g.roles.everyone.id, deny: [PermissionFlagsBits2.ViewChannel] },
      { id: g.members.me.id, allow: [PermissionFlagsBits2.ViewChannel, PermissionFlagsBits2.ManageChannels] }
    ];
    for (const rid of viewerRoleIds(g, type)) {
      if (g.roles.cache.has(rid)) overwrites.push({ id: rid, allow: [PermissionFlagsBits2.ViewChannel] });
    }
    cat = await g.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites }).catch(() => null);
  }
  if (cat && type) {
    type.category = cat.id;
    persist();
  }
  return cat?.id || cfg4(g.id).ticketCategory || void 0;
}
async function createTicket(g, member, type) {
  const data = guild(g.id);
  data.ticketCounter = (data.ticketCounter || 0) + 1;
  const num = data.ticketCounter;
  const overwrites = [
    { id: g.roles.everyone.id, deny: [PermissionFlagsBits2.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits2.ViewChannel, PermissionFlagsBits2.SendMessages, PermissionFlagsBits2.ReadMessageHistory] },
    { id: g.members.me.id, allow: [PermissionFlagsBits2.ViewChannel, PermissionFlagsBits2.SendMessages, PermissionFlagsBits2.ManageChannels] }
  ];
  for (const rid of viewerRoleIds(g, type)) {
    if (g.roles.cache.has(rid)) overwrites.push({ id: rid, allow: [PermissionFlagsBits2.ViewChannel, PermissionFlagsBits2.SendMessages, PermissionFlagsBits2.ReadMessageHistory] });
  }
  const ch = await g.channels.create({
    name: ticketChannelName(false, member.user.username),
    type: ChannelType.GuildText,
    parent: await ensureCategory(g, type),
    permissionOverwrites: overwrites
  });
  const t = { userId: member.id, username: member.user.username, claimedBy: null, openedAt: Date.now(), number: num, type: type?.id || null, panelMessageId: null };
  data.tickets[ch.id] = t;
  persist();
  const sent = await ch.send(ticketPanel(g.id, t));
  t.panelMessageId = sent.id;
  persist();
  const ping = [`<@${member.id}>`];
  if (type?.pingRole) ping.push(`<@&${type.pingRole}>`);
  await ch.send({ content: ping.join(" "), allowedMentions: { users: [member.id], roles: type?.pingRole ? [type.pingRole] : [] } }).catch(() => {
  });
  return ch;
}
async function closeTicket(g, channel, closedBy) {
  const t = guild(g.id).tickets[channel.id];
  if (!t) return false;
  let transcript = `Ticket #${t.number} (${t.type || "general"}) \u2014 opened by ${t.userId}
Closed by ${closedBy.tag} at ${(/* @__PURE__ */ new Date()).toISOString()}

`;
  try {
    const msgs = await channel.messages.fetch({ limit: 100 });
    transcript += [...msgs.values()].reverse().map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`).join("\n");
  } catch {
  }
  const logCh = await resolveChannel(g, cfg4(g.id).ticketLogChannel);
  if (logCh) {
    const file = new AttachmentBuilder(Buffer.from(transcript, "utf8"), { name: `ticket-${t.number}.txt` });
    await logCh.send({ embeds: [okEmbed(`\u{1F3AB} **Ticket #${t.number}** (${t.type || "general"}) closed by ${closedBy} \u2014 opened by <@${t.userId}>.`)], files: [file] }).catch(() => {
    });
  }
  delete guild(g.id).tickets[channel.id];
  persist();
  await channel.delete(`Ticket closed by ${closedBy.tag}`).catch(() => {
  });
  return true;
}
var slash6 = [
  new SlashCommandBuilder6().setName("ticket").setDescription("Tickets").addSubcommand((s) => s.setName("setup").setDescription("Post the open-ticket panel").addChannelOption((o) => o.setName("channel").setDescription("Channel to post the panel in (default: here)"))).addSubcommand((s) => s.setName("close").setDescription("Close the current ticket")).addSubcommand((s) => s.setName("forceclose").setDescription("Force close the current ticket (staff)")).addSubcommand((s) => s.setName("type-add").setDescription("Add a ticket type to the panel").addStringOption((o) => o.setName("name").setDescription("Type name, e.g. General Support").setRequired(true)).addStringOption((o) => o.setName("emoji").setDescription("Emoji shown in the dropdown")).addStringOption((o) => o.setName("description").setDescription("Short description in the dropdown")).addChannelOption((o) => o.setName("category").setDescription("Category to create these tickets under").addChannelTypes(ChannelType.GuildCategory)).addRoleOption((o) => o.setName("ping_role").setDescription("Role pinged when this type opens")).addStringOption((o) => o.setName("support_roles").setDescription("Extra support role IDs (comma-separated)"))).addSubcommand((s) => s.setName("type-remove").setDescription("Remove a ticket type").addStringOption((o) => o.setName("id").setDescription("Type id (see /ticket type-list)").setRequired(true))).addSubcommand((s) => s.setName("type-edit").setDescription("Edit a ticket type (e.g. set its ping role)").addStringOption((o) => o.setName("id").setDescription("Type id (see /ticket type-list)").setRequired(true)).addStringOption((o) => o.setName("label").setDescription("New label")).addStringOption((o) => o.setName("emoji").setDescription("New emoji")).addStringOption((o) => o.setName("description").setDescription("New description")).addChannelOption((o) => o.setName("category").setDescription("Category for this type").addChannelTypes(ChannelType.GuildCategory)).addRoleOption((o) => o.setName("ping_role").setDescription("Role pinged when this type opens")).addStringOption((o) => o.setName("support_roles").setDescription("Extra support role IDs (comma-separated)"))).addSubcommand((s) => s.setName("type-list").setDescription("List configured ticket types")).addSubcommand((s) => s.setName("reset-types").setDescription("Wipe ticket types and restore the defaults")),
  new SlashCommandBuilder6().setName("forward").setDescription("Forward this ticket to another team"),
  new SlashCommandBuilder6().setName("transfer").setDescription("Transfer this ticket to another team (pick from a dropdown)"),
  new SlashCommandBuilder6().setName("close-all-tickets").setDescription("Force close all tickets"),
  new SlashCommandBuilder6().setName("adduser").setDescription("Add a user to this ticket").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder6().setName("removeuser").setDescription("Remove a user from this ticket").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
];
var owns6 = ["ticket", "forward", "transfer", "close-all-tickets", "adduser", "removeuser"];
var prefixOwns6 = ["ticket"];
var componentNs3 = ["ticket"];
async function handleSlash6(interaction) {
  const g = interaction.guild;
  const name = interaction.commandName;
  if (name === "ticket") {
    const sub = interaction.options.getSubcommand();
    if (sub === "setup") {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
      const b = branding(g.id);
      const emoji = b.emoji ? `${b.emoji} ` : "";
      const name2 = b.name || "our server";
      const body = cfg4(g.id).ticketPanelText || `At ${emoji}**${name2}**, we provide support to ensure the best possible experience for all members. Please review each category carefully and select the one that best fits your inquiry. All tickets must follow community regulations; abusing the ticket system or disrespecting staff may result in disciplinary action.`;
      const p = panel({ guildId: g.id, kind: "tickets", title: "Support Tickets", body, footer: b.name || void 0, buttons: panelControls(g.id) });
      const ch = interaction.options.getChannel("channel") || await resolveChannel(g, cfg4(g.id).ticketPanelChannel) || interaction.channel;
      try {
        await ch.send(p);
      } catch (e) {
        return interaction.reply({ embeds: [errEmbed(`Couldn't post the panel in ${ch}: ${e.message}`)], ephemeral: true });
      }
      return interaction.reply({ embeds: [okEmbed(`\u2705 Ticket panel posted in ${ch}.`)], ephemeral: true });
    }
    if (sub === "type-add") {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
      const label = interaction.options.getString("name");
      let id = slugify(label), n = 1;
      while (types(g.id).some((t3) => t3.id === id)) id = `${slugify(label)}-${++n}`;
      const t2 = {
        id,
        label,
        emoji: interaction.options.getString("emoji") || null,
        description: interaction.options.getString("description") || null,
        category: interaction.options.getChannel("category")?.id || null,
        pingRole: interaction.options.getRole("ping_role")?.id || null,
        supportRoles: interaction.options.getString("support_roles") || null
      };
      types(g.id).push(t2);
      persist();
      return interaction.reply({ embeds: [okEmbed(`\u2705 Added ticket type **${label}** (id \`${id}\`). Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
    }
    if (sub === "type-remove") {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
      const id = interaction.options.getString("id");
      const arr = types(g.id);
      const idx = arr.findIndex((t2) => t2.id === id);
      if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No ticket type with id \`${id}\`.`)], ephemeral: true });
      arr.splice(idx, 1);
      persist();
      return interaction.reply({ embeds: [okEmbed(`\u2705 Removed ticket type \`${id}\`. Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
    }
    if (sub === "type-edit") {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
      const id = interaction.options.getString("id");
      const ty = types(g.id).find((t2) => t2.id === id);
      if (!ty) return interaction.reply({ embeds: [errEmbed(`No ticket type \`${id}\`. See /ticket type-list.`)], ephemeral: true });
      const label = interaction.options.getString("label");
      const emoji = interaction.options.getString("emoji");
      const description = interaction.options.getString("description");
      const category = interaction.options.getChannel("category");
      const ping = interaction.options.getRole("ping_role");
      const support = interaction.options.getString("support_roles");
      if (label !== null) ty.label = label;
      if (emoji !== null) ty.emoji = emoji;
      if (description !== null) ty.description = description;
      if (category !== null) ty.category = category.id;
      if (ping !== null) ty.pingRole = ping.id;
      if (support !== null) ty.supportRoles = support;
      persist();
      return interaction.reply({ embeds: [okEmbed(`\u2705 Updated ticket type **${ty.label}**. Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
    }
    if (sub === "reset-types") {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
      cfg4(g.id).ticketTypes = defaultTypes(g.id);
      cfg4(g.id).ticketTypesSeeded = true;
      persist();
      return interaction.reply({ embeds: [okEmbed("\u2705 Ticket types reset to: **General, Staff Report, Staff Fastpass, High Rank, Ownership**. Re-run `/ticket setup` to refresh the panel.")], ephemeral: true });
    }
    if (sub === "type-list") {
      const arr = types(g.id);
      const lines = arr.map((t2) => `${t2.emoji ? t2.emoji + " " : ""}**${t2.label}** \`${t2.id}\`${t2.category ? ` \u2192 <#${t2.category}>` : ""}${t2.pingRole ? ` \xB7 pings <@&${t2.pingRole}>` : ""}`);
      return interaction.reply({ embeds: [okEmbed(lines.join("\n") || 'No ticket types configured \u2014 the panel shows a single "Open Ticket" button.', "\u{1F3AB} Ticket Types")], ephemeral: true });
    }
    const t = guild(g.id).tickets[interaction.channel.id];
    if (!t) return interaction.reply({ embeds: [errEmbed("This is not a ticket channel.")], ephemeral: true });
    if (sub === "forceclose" && !isSupport(interaction.member, cfg4(g.id))) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    if (sub === "close" && !isSupport(interaction.member, cfg4(g.id)) && interaction.user.id !== t.userId)
      return interaction.reply({ embeds: [errEmbed("Only staff or the ticket owner can close.")], ephemeral: true });
    await interaction.reply({ embeds: [okEmbed("Closing ticket\u2026")], ephemeral: true });
    return closeTicket(g, interaction.channel, interaction.user);
  }
  if (name === "forward" || name === "transfer") {
    const t = guild(g.id).tickets[interaction.channel.id];
    if (!t) return interaction.reply({ embeds: [errEmbed("Run this inside a ticket channel.")], ephemeral: true });
    if (!isSupport(interaction.member, cfg4(g.id))) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const list = types(g.id);
    if (!list.length) return interaction.reply({ embeds: [errEmbed("No ticket types to transfer to.")], ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId("ticket:forward").setPlaceholder("Transfer to\u2026");
    for (const ty of list.slice(0, 25)) {
      const opt = { label: ty.label.slice(0, 100), value: ty.id, description: (ty.description || "").slice(0, 100) || void 0 };
      const em = safeEmoji(ty.emoji);
      if (em) opt.emoji = em;
      menu.addOptions(opt);
    }
    return interaction.reply({ embeds: [infoEmbed("Transfer Ticket", "Choose which team to transfer this ticket to:")], components: [new ActionRowBuilder4().addComponents(menu)], ephemeral: true });
  }
  if (name === "close-all-tickets") {
    if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed("Admin only.")], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    let n = 0;
    for (const cid of Object.keys(guild(g.id).tickets)) {
      const ch = g.channels.cache.get(cid);
      if (ch && await closeTicket(g, ch, interaction.user)) n++;
      else {
        delete guild(g.id).tickets[cid];
        persist();
      }
    }
    return interaction.editReply({ embeds: [okEmbed(`\u2705 Closed ${n} ticket(s).`)] });
  }
  if (name === "adduser" || name === "removeuser") {
    const t = guild(g.id).tickets[interaction.channel.id];
    if (!t) return interaction.reply({ embeds: [errEmbed("This is not a ticket channel.")], ephemeral: true });
    if (!isSupport(interaction.member, cfg4(g.id)) && interaction.user.id !== t.userId)
      return interaction.reply({ embeds: [errEmbed("Only staff or the ticket owner can do that.")], ephemeral: true });
    const user = interaction.options.getUser("user");
    if (name === "adduser") {
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ embeds: [okEmbed(`\u2705 Added ${user} to the ticket.`)] });
    }
    await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {
    });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Removed ${user} from the ticket.`)] });
  }
}
async function handleComponent3(interaction) {
  const [, action] = interaction.customId.split(":");
  const g = interaction.guild;
  if (action === "open") {
    const existing = Object.entries(guild(g.id).tickets).find(([, t2]) => t2.userId === interaction.user.id);
    if (existing) return interaction.reply({ embeds: [errEmbed(`You already have an open ticket: <#${existing[0]}>`)], ephemeral: true });
    const type = interaction.isStringSelectMenu() ? types(g.id).find((t2) => t2.id === interaction.values[0]) || null : null;
    await interaction.deferReply({ ephemeral: true });
    const ch = await createTicket(g, interaction.member, type);
    return interaction.editReply({ embeds: [okEmbed(`\u2705 Ticket created: ${ch}`)] });
  }
  const t = guild(g.id).tickets[interaction.channel.id];
  if (!t) return interaction.reply({ embeds: [errEmbed("This is not a ticket channel.")], ephemeral: true });
  if (action === "claim") {
    if (!isSupport(interaction.member, cfg4(g.id))) return interaction.reply({ embeds: [errEmbed("Only staff can claim tickets.")], ephemeral: true });
    const uid = interaction.user.id;
    let notice;
    if (!t.claimedBy) {
      t.claimedBy = uid;
      notice = `\u{1F7E2} Ticket claimed by ${interaction.user}.`;
    } else if (t.claimedBy === uid) {
      t.claimedBy = null;
      notice = `\u{1F534} Ticket unclaimed by ${interaction.user}.`;
    } else if (isAdmin(interaction.member)) {
      t.claimedBy = uid;
      notice = `\u{1F7E2} Ticket reassigned to ${interaction.user} (admin).`;
    } else {
      return interaction.reply({ embeds: [errEmbed(`Already claimed by <@${t.claimedBy}>. Only they or an admin can change it.`)], ephemeral: true });
    }
    persist();
    await interaction.channel.setName(ticketChannelName(!!t.claimedBy, t.username || interaction.channel.name)).catch(() => {
    });
    await interaction.update(ticketPanel(g.id, t));
    return interaction.channel.send({ embeds: [okEmbed(notice)] }).catch(() => {
    });
  }
  if (action === "close") {
    if (!isSupport(interaction.member, cfg4(g.id)) && interaction.user.id !== t.userId)
      return interaction.reply({ embeds: [errEmbed("Only staff or the ticket owner can close.")], ephemeral: true });
    await interaction.reply({ embeds: [okEmbed("Closing ticket\u2026")], ephemeral: true });
    return closeTicket(g, interaction.channel, interaction.user);
  }
  if (action === "forward") {
    if (!isSupport(interaction.member, cfg4(g.id))) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const target = types(g.id).find((x) => x.id === interaction.values[0]);
    if (!target) return interaction.reply({ embeds: [errEmbed("That ticket type no longer exists.")], ephemeral: true });
    const oldType = types(g.id).find((x) => x.id === t.type);
    const oldViewers = viewerRoleIds(g, oldType);
    const newViewers = viewerRoleIds(g, target);
    const parent = await ensureCategory(g, target);
    if (parent) await interaction.channel.setParent(parent, { lockPermissions: false }).catch(() => {
    });
    for (const rid of oldViewers) {
      if (!newViewers.includes(rid) && g.roles.cache.has(rid)) await interaction.channel.permissionOverwrites.delete(rid).catch(() => {
      });
    }
    for (const rid of newViewers) {
      if (g.roles.cache.has(rid)) await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {
      });
    }
    t.type = target.id;
    persist();
    const pm = t.panelMessageId && await interaction.channel.messages.fetch(t.panelMessageId).catch(() => null);
    if (pm) await pm.edit(ticketPanel(g.id, t)).catch(() => {
    });
    await interaction.update({ embeds: [okEmbed(`\u2705 Forwarded to **${target.label}**.`)], components: [] });
    const ping = target.pingRole ? `<@&${target.pingRole}>` : "";
    return interaction.channel.send({ content: ping || void 0, embeds: [infoEmbed("Ticket Forwarded", `This ticket was forwarded to **${target.label}** by ${interaction.user}.`)], allowedMentions: { roles: target.pingRole ? [target.pingRole] : [] } }).catch(() => {
    });
  }
}
async function handlePrefix6(cmd, message, args) {
  if ((args[0] || "").toLowerCase() !== "close") return message.reply({ embeds: [errEmbed("Usage: `u!ticket close`")] }).catch(() => {
  });
  const t = guild(message.guild.id).tickets[message.channel.id];
  if (!t) return message.reply({ embeds: [errEmbed("This is not a ticket channel.")] }).catch(() => {
  });
  if (!isSupport(message.member, cfg4(message.guild.id)) && message.author.id !== t.userId)
    return message.reply({ embeds: [errEmbed("Only staff or the ticket owner can close.")] }).catch(() => {
    });
  return closeTicket(message.guild, message.channel, message.author);
}

// features/afk.js
var afk_exports = {};
__export(afk_exports, {
  handlePrefix: () => handlePrefix7,
  handleSlash: () => handleSlash7,
  onMessage: () => onMessage,
  owns: () => owns7,
  prefixOwns: () => prefixOwns7,
  slash: () => slash7
});
import { SlashCommandBuilder as SlashCommandBuilder7 } from "discord.js";
var afkMap = (gid) => guild(gid).afk;
var slash7 = [
  new SlashCommandBuilder7().setName("afk-set").setDescription("Set your AFK status").addStringOption((o) => o.setName("reason").setDescription("Why you are AFK")),
  new SlashCommandBuilder7().setName("afk-remove").setDescription("Remove your AFK status")
];
var owns7 = ["afk-set", "afk-remove"];
var prefixOwns7 = ["afk", "afk-remove"];
function setAfk(gid, userId, reason) {
  afkMap(gid)[userId] = { reason: reason || "AFK", since: now() };
  persist();
}
function clearAfk(gid, userId) {
  if (afkMap(gid)[userId]) {
    delete afkMap(gid)[userId];
    persist();
    return true;
  }
  return false;
}
async function handleSlash7(interaction) {
  const gid = interaction.guild.id;
  if (interaction.commandName === "afk-set") {
    setAfk(gid, interaction.user.id, interaction.options.getString("reason"));
    return interaction.reply({ embeds: [okEmbed(`\u2705 You're now AFK: ${afkMap(gid)[interaction.user.id].reason}`)], ephemeral: true });
  }
  clearAfk(gid, interaction.user.id);
  return interaction.reply({ embeds: [okEmbed("\u2705 AFK status removed.")], ephemeral: true });
}
async function handlePrefix7(cmd, message, args, rest) {
  const gid = message.guild.id;
  if (cmd === "afk-remove") {
    clearAfk(gid, message.author.id);
    return message.reply({ embeds: [okEmbed("\u2705 AFK status removed.")] }).catch(() => {
    });
  }
  setAfk(gid, message.author.id, rest);
  return message.reply({ embeds: [okEmbed(`\u2705 You're now AFK: ${afkMap(gid)[message.author.id].reason}`)] }).catch(() => {
  });
}
async function onMessage(message) {
  const gid = message.guild.id;
  const map = afkMap(gid);
  if (map[message.author.id] && !/^u!afk(\s|$)/i.test(message.content)) {
    clearAfk(gid, message.author.id);
    message.reply({ embeds: [okEmbed(`\u{1F44B} Welcome back ${message.author}, I removed your AFK.`)] }).then((m) => setTimeout(() => m.delete().catch(() => {
    }), 8e3)).catch(() => {
    });
  }
  const pinged = message.mentions.users.filter((u) => map[u.id]);
  if (pinged.size) {
    const lines = pinged.map((u) => `\u{1F4A4} ${u} is AFK: ${map[u.id].reason} (since ${ts(map[u.id].since)})`).join("\n");
    message.reply({ embeds: [okEmbed(lines)] }).catch(() => {
    });
  }
}

// features/reviews.js
var reviews_exports = {};
__export(reviews_exports, {
  handleSlash: () => handleSlash8,
  owns: () => owns8,
  slash: () => slash8
});
import { SlashCommandBuilder as SlashCommandBuilder8 } from "discord.js";
var cfg5 = (gid) => guild(gid).config;
var slash8 = [
  new SlashCommandBuilder8().setName("review").setDescription("Submit a staff review").addUserOption((o) => o.setName("staff").setDescription("Staff member").setRequired(true)).addIntegerOption((o) => o.setName("stars").setDescription("1-5").setRequired(true).setMinValue(1).setMaxValue(5)).addStringOption((o) => o.setName("comment").setDescription("Your feedback"))
];
var owns8 = ["review"];
async function handleSlash8(interaction) {
  const g = interaction.guild;
  const staff = interaction.options.getUser("staff");
  const n = interaction.options.getInteger("stars");
  const comment = interaction.options.getString("comment") || "\u2014";
  const data = guild(g.id);
  data.reviews.push({ id: data.reviewSeq = (data.reviewSeq || 0) + 1, staffId: staff.id, stars: n, comment, author: interaction.user.id, ts: now() });
  persist();
  const p = panel({
    guildId: g.id,
    kind: "reviews",
    title: "Staff Review",
    fields: [
      { name: "Staff", value: `<@${staff.id}>` },
      { name: "Rating", value: `${n}/5` },
      { name: "Feedback", value: comment },
      { name: "By", value: `<@${interaction.user.id}>` }
    ]
  });
  const ch = await resolveChannel(g, cfg5(g.id).reviewChannel) || interaction.channel;
  await ch.send(p);
  return interaction.reply({ embeds: [okEmbed(`\u2705 Review submitted in ${ch}.`)], ephemeral: true });
}

// features/training.js
var training_exports = {};
__export(training_exports, {
  handleSlash: () => handleSlash9,
  owns: () => owns9,
  slash: () => slash9
});
import { SlashCommandBuilder as SlashCommandBuilder9 } from "discord.js";
var cfg6 = (gid) => guild(gid).config;
var slash9 = [
  new SlashCommandBuilder9().setName("training").setDescription("Trainings").addSubcommand((s) => s.setName("request").setDescription("Request a training").addStringOption((o) => o.setName("type").setDescription("Training type").setRequired(true)).addStringOption((o) => o.setName("when").setDescription('When (e.g. "Today 5PM EST")').setRequired(true)).addStringOption((o) => o.setName("timezone").setDescription("Your timezone (e.g. EST, GMT, CET)").setRequired(true)).addStringOption((o) => o.setName("roblox_age").setDescription("Your Roblox age group").setRequired(true).addChoices(
    { name: "Under 13", value: "Under 13" },
    { name: "13+", value: "13+" },
    { name: "17+", value: "17+" },
    { name: "18+", value: "18+" }
  ))).addSubcommand((s) => s.setName("results").setDescription("Post training results").addStringOption((o) => o.setName("type").setDescription("Training type").setRequired(true)).addStringOption((o) => o.setName("passed").setDescription("Who passed (mention or names)").setRequired(true)).addStringOption((o) => o.setName("notes").setDescription("Notes")))
];
var owns9 = ["training"];
async function handleSlash9(interaction) {
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  const c = cfg6(g.id);
  const data = guild(g.id);
  if (sub === "request") {
    const ch2 = await resolveChannel(g, c.trainingRequestChannel) || await resolveChannel(g, c.trainingChannel) || interaction.channel;
    const type = interaction.options.getString("type");
    const when = interaction.options.getString("when");
    const timezone = interaction.options.getString("timezone");
    const robloxAge = interaction.options.getString("roblox_age");
    data.trainings.push({ id: data.trainingSeq = (data.trainingSeq || 0) + 1, type, when, timezone, robloxAge, host: interaction.user.id, status: "requested", ts: now() });
    persist();
    await ch2.send(panel({
      guildId: g.id,
      kind: "training",
      title: "Training Requested",
      body: "A training has been requested. React/attend if interested!",
      fields: [
        { name: "Type", value: type },
        { name: "When", value: when },
        { name: "Timezone", value: timezone },
        { name: "Roblox Age Group", value: robloxAge },
        { name: "Requested by", value: `<@${interaction.user.id}>` }
      ],
      // Prefer the dedicated training ping role; fall back to the community role.
      ping: c.trainingPingRole || (branding(g.id).pingRole ? true : void 0)
    }));
    return interaction.reply({ embeds: [okEmbed(`Training request posted in ${ch2}.`)], ephemeral: true });
  }
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const ch = await resolveChannel(g, c.trainingResultsChannel) || await resolveChannel(g, c.trainingChannel) || interaction.channel;
  await ch.send(panel({
    guildId: g.id,
    kind: "training",
    title: "Training Results",
    fields: [
      { name: "Type", value: interaction.options.getString("type") },
      { name: "Passed", value: interaction.options.getString("passed") },
      { name: "Notes", value: interaction.options.getString("notes") || "\u2014" },
      { name: "Host", value: `<@${interaction.user.id}>` }
    ]
  }));
  return interaction.reply({ embeds: [okEmbed(`Results posted in ${ch}.`)], ephemeral: true });
}

// features/suggestions.js
var suggestions_exports = {};
__export(suggestions_exports, {
  componentNs: () => componentNs4,
  handleComponent: () => handleComponent4,
  handlePrefix: () => handlePrefix8,
  handleSlash: () => handleSlash10,
  owns: () => owns10,
  prefixOwns: () => prefixOwns8,
  slash: () => slash10
});
import { SlashCommandBuilder as SlashCommandBuilder10, ActionRowBuilder as ActionRowBuilder5, ButtonBuilder as ButtonBuilder4, ButtonStyle as ButtonStyle4 } from "discord.js";
var cfg7 = (gid) => guild(gid).config;
function voteRow2(up = 0, down = 0) {
  return new ActionRowBuilder5().addComponents(
    new ButtonBuilder4().setCustomId("suggest:up").setLabel(`\u{1F44D} ${up}`).setStyle(ButtonStyle4.Success),
    new ButtonBuilder4().setCustomId("suggest:down").setLabel(`\u{1F44E} ${down}`).setStyle(ButtonStyle4.Danger)
  );
}
var slash10 = [
  new SlashCommandBuilder10().setName("suggest").setDescription("Submit a suggestion").addStringOption((o) => o.setName("suggestion").setDescription("Your suggestion").setRequired(true))
];
var owns10 = ["suggest"];
var prefixOwns8 = ["suggestion"];
var componentNs4 = ["suggest"];
async function post(g, authorId, text) {
  const data = guild(g.id);
  data.suggestionSeq = (data.suggestionSeq || 0) + 1;
  const id = data.suggestionSeq;
  const ch = await resolveChannel(g, cfg7(g.id).suggestionChannel) || null;
  const p = panel({ guildId: g.id, kind: "suggestions", title: `Suggestion #${id}`, body: text, fields: [{ name: "Submitted by", value: `<@${authorId}>` }] });
  p.components.push(voteRow2());
  const target = ch || g.systemChannel;
  const msg = target ? await target.send(p) : null;
  data.suggestions.push({ id, messageId: msg?.id, authorId, text, up: [], down: [], ts: now() });
  persist();
  return { id, ch: target };
}
async function handleSlash10(interaction) {
  const { id, ch } = await post(interaction.guild, interaction.user.id, interaction.options.getString("suggestion"));
  return interaction.reply({ embeds: [okEmbed(`\u2705 Suggestion **#${id}** submitted${ch ? ` in ${ch}` : ""}.`)], ephemeral: true });
}
async function handlePrefix8(cmd, message, args, rest) {
  if (!rest) return message.reply({ embeds: [errEmbed("Usage: `u!suggestion <text>`")] }).catch(() => {
  });
  const { id, ch } = await post(message.guild, message.author.id, rest);
  return message.reply({ embeds: [okEmbed(`\u2705 Suggestion **#${id}** submitted${ch ? ` in ${ch}` : ""}.`)] }).catch(() => {
  });
}
async function handleComponent4(interaction) {
  const [, dir] = interaction.customId.split(":");
  const rec = guild(interaction.guild.id).suggestions.find((s) => s.messageId === interaction.message.id);
  if (!rec) return interaction.reply({ embeds: [errEmbed("This suggestion is no longer tracked.")], ephemeral: true });
  const uid = interaction.user.id;
  rec.up = (rec.up || []).filter((x) => x !== uid);
  rec.down = (rec.down || []).filter((x) => x !== uid);
  if (dir === "up") rec.up.push(uid);
  else rec.down.push(uid);
  persist();
  const p = panel({ guildId: interaction.guild.id, kind: "suggestions", title: `Suggestion #${rec.id}`, body: rec.text, fields: [{ name: "Submitted by", value: `<@${rec.authorId}>` }] });
  p.components.push(voteRow2(rec.up.length, rec.down.length));
  await interaction.update(p);
}

// features/roleplay.js
var roleplay_exports = {};
__export(roleplay_exports, {
  handleSlash: () => handleSlash11,
  owns: () => owns11,
  slash: () => slash11
});
import { SlashCommandBuilder as SlashCommandBuilder11 } from "discord.js";
var cfg8 = (gid) => guild(gid).config;
var slash11 = [
  new SlashCommandBuilder11().setName("roleplay").setDescription("Roleplay scene logging").addSubcommand((s) => s.setName("log").setDescription("Log an active roleplay scene").addStringOption((o) => o.setName("title").setDescription("Scene title").setRequired(true)).addStringOption((o) => o.setName("players").setDescription("Players involved").setRequired(true)).addStringOption((o) => o.setName("details").setDescription("Details"))).addSubcommand((s) => s.setName("revoke").setDescription("Revoke an active roleplay log").addIntegerOption((o) => o.setName("id").setDescription("Roleplay log ID").setRequired(true)))
];
var owns11 = ["roleplay"];
async function handleSlash11(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  const data = guild(g.id);
  if (sub === "log") {
    const id2 = data.roleplaySeq = (data.roleplaySeq || 0) + 1;
    const title = interaction.options.getString("title");
    const players = interaction.options.getString("players");
    const details = interaction.options.getString("details") || "\u2014";
    const ch2 = await resolveChannel(g, cfg8(g.id).roleplayChannel) || interaction.channel;
    const msg2 = await ch2.send(panel({
      guildId: g.id,
      kind: "default",
      title: `Roleplay Log #${id2}`,
      fields: [{ name: "Scene", value: title }, { name: "Players", value: players }, { name: "Details", value: details }, { name: "Logged by", value: `<@${interaction.user.id}>` }]
    }));
    data.roleplays.push({ id: id2, title, players, details, host: interaction.user.id, messageId: msg2.id, channelId: ch2.id, ts: now(), revoked: false });
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Roleplay logged as **#${id2}** in ${ch2}.`)], ephemeral: true });
  }
  const id = interaction.options.getInteger("id");
  const rec = data.roleplays.find((r) => r.id === id);
  if (!rec) return interaction.reply({ embeds: [errEmbed(`No roleplay log #${id}.`)], ephemeral: true });
  rec.revoked = true;
  persist();
  const ch = await resolveChannel(g, rec.channelId);
  const msg = ch && await ch.messages.fetch(rec.messageId).catch(() => null);
  if (msg) await msg.edit(panel({ guildId: g.id, kind: "default", title: `Roleplay Log #${id} (REVOKED)`, body: "~~This roleplay log has been revoked.~~", fields: [{ name: "Scene", value: rec.title }] })).catch(() => {
  });
  return interaction.reply({ embeds: [okEmbed(`\u2705 Roleplay log **#${id}** revoked.`)], ephemeral: true });
}

// features/misc.js
var misc_exports = {};
__export(misc_exports, {
  handlePrefix: () => handlePrefix9,
  handleSlash: () => handleSlash12,
  owns: () => owns12,
  prefixOwns: () => prefixOwns9,
  slash: () => slash12
});
import { SlashCommandBuilder as SlashCommandBuilder12, EmbedBuilder as EmbedBuilder3 } from "discord.js";
var parseColor = (s) => {
  if (!s) return void 0;
  const n = parseInt(String(s).replace("#", ""), 16);
  return Number.isNaN(n) ? void 0 : n;
};
var slash12 = [
  new SlashCommandBuilder12().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder12().setName("membercount").setDescription("Member, online & boost counts"),
  new SlashCommandBuilder12().setName("say").setDescription("Make the bot say something").addStringOption((o) => o.setName("message").setDescription("What to say").setRequired(true)).addChannelOption((o) => o.setName("channel").setDescription("Target channel")),
  new SlashCommandBuilder12().setName("dm").setDescription("Send a DM to a user or role").addMentionableOption((o) => o.setName("target").setDescription("User or role").setRequired(true)).addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true)),
  new SlashCommandBuilder12().setName("embed").setDescription("Create a custom V2 formatted embed").addStringOption((o) => o.setName("title").setDescription("Title")).addStringOption((o) => o.setName("description").setDescription("Body text")).addStringOption((o) => o.setName("banner").setDescription("Banner image URL")).addStringOption((o) => o.setName("color").setDescription("Hex color e.g. #2b6cb0")).addChannelOption((o) => o.setName("channel").setDescription("Target channel (default: here)")).addBooleanOption((o) => o.setName("ping").setDescription("Ping the community role")),
  new SlashCommandBuilder12().setName("embedsender").setDescription("Send an embed message to a channel").addChannelOption((o) => o.setName("channel").setDescription("Target channel").setRequired(true)).addStringOption((o) => o.setName("title").setDescription("Title")).addStringOption((o) => o.setName("description").setDescription("Body text")).addStringOption((o) => o.setName("banner").setDescription("Banner image URL")),
  new SlashCommandBuilder12().setName("purge").setDescription("Delete a number of recent messages").addIntegerOption((o) => o.setName("amount").setDescription("How many messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)).addUserOption((o) => o.setName("user").setDescription("Only delete this user's messages")),
  new SlashCommandBuilder12().setName("channel").setDescription("Channel tools").addSubcommand((s) => s.setName("rename").setDescription("Rename a channel").addStringOption((o) => o.setName("name").setDescription("New name").setRequired(true)).addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)"))),
  new SlashCommandBuilder12().setName("help").setDescription("View all slash & prefix commands")
];
var owns12 = ["ping", "membercount", "say", "dm", "embed", "embedsender", "channel", "purge", "help"];
var prefixOwns9 = ["ping", "membercount", "say", "dm", "purge", "help"];
async function handleSlash12(interaction) {
  const name = interaction.commandName;
  const g = interaction.guild;
  if (name === "ping") return interaction.reply({ embeds: [okEmbed(`\u{1F3D3} Pong! \`${Math.round(interaction.client.ws.ping)}ms\` websocket.`)] });
  if (name === "membercount") {
    await g.members.fetch().catch(() => {
    });
    const online = g.members.cache.filter((m) => m.presence && m.presence.status !== "offline").size;
    return interaction.reply({ embeds: [infoEmbed(`${g.name}`).addFields(
      { name: "Total Members", value: `${g.memberCount}`, inline: true },
      { name: "Online", value: `${online}`, inline: true },
      { name: "Boosts", value: `${g.premiumSubscriptionCount ?? 0}`, inline: true }
    )] });
  }
  if (name === "say") {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    await ch.send({ content: interaction.options.getString("message"), allowedMentions: { parse: [] } });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Sent in ${ch}.`)], ephemeral: true });
  }
  if (name === "dm") {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const target = interaction.options.getMentionable("target");
    const msg = interaction.options.getString("message");
    await interaction.deferReply({ ephemeral: true });
    const embed = infoEmbed(`\u{1F4E9} Message from ${g.name}`, msg);
    if (target.user) {
      await target.send({ embeds: [embed] }).catch(() => {
      });
      return interaction.editReply({ embeds: [okEmbed(`\u2705 DM sent to ${target}.`)] });
    }
    const members = [...target.members.values()].slice(0, 50);
    let n = 0;
    for (const m of members) {
      if (!m.user.bot && await m.send({ embeds: [embed] }).then(() => true).catch(() => false)) n++;
    }
    return interaction.editReply({ embeds: [okEmbed(`\u2705 DM sent to ${n}/${members.length} members of ${target}.`)] });
  }
  if (name === "embed" || name === "embedsender") {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const banner = interaction.options.getString("banner");
    const ping = name === "embed" ? interaction.options.getBoolean("ping") : false;
    const color = name === "embed" ? parseColor(interaction.options.getString("color")) : void 0;
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    if (!title && !description && !banner) return interaction.reply({ embeds: [errEmbed("Provide at least a title, description, or banner.")], ephemeral: true });
    await ch.send(panel({ guildId: g.id, kind: "default", title, body: description, bannerUrl: banner, color, ping: ping ? true : void 0 }));
    return interaction.reply({ embeds: [okEmbed(`\u2705 Embed sent in ${ch}.`)], ephemeral: true });
  }
  if (name === "purge") {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
    const amount = interaction.options.getInteger("amount");
    const user = interaction.options.getUser("user");
    await interaction.deferReply({ ephemeral: true });
    let toDelete = amount;
    if (user) {
      const fetched = await interaction.channel.messages.fetch({ limit: 100 });
      toDelete = [...fetched.filter((m) => m.author.id === user.id).values()].slice(0, amount);
      if (!toDelete.length) return interaction.editReply({ embeds: [errEmbed(`No recent messages from ${user} found.`)] });
    }
    const deleted = await interaction.channel.bulkDelete(toDelete, true);
    return interaction.editReply({ embeds: [okEmbed(`\u{1F9F9} Deleted **${deleted.size}** message(s)${user ? ` from ${user}` : ""}.`)] });
  }
  if (name === "channel") {
    if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed("Admin only.")], ephemeral: true });
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    const newName = interaction.options.getString("name");
    await ch.setName(newName).catch(() => {
    });
    return interaction.reply({ embeds: [okEmbed(`\u2705 Renamed to **${newName}**.`)], ephemeral: true });
  }
  if (name === "help") {
    const groups = chunkEmbeds(detailedHelp());
    await interaction.reply({ embeds: groups[0], ephemeral: true });
    for (let i = 1; i < groups.length; i++) await interaction.followUp({ embeds: groups[i], ephemeral: true });
    return;
  }
}
function chunkEmbeds(embeds, max = 5500) {
  const len = (e) => {
    const d = e.data || {};
    return (d.title || "").length + (d.description || "").length + (d.fields || []).reduce((a, f) => a + f.name.length + f.value.length, 0) + (d.footer?.text || "").length;
  };
  const groups = [];
  let cur = [], total = 0;
  for (const e of embeds) {
    const l = len(e);
    if (cur.length && (total + l > max || cur.length >= 10)) {
      groups.push(cur);
      cur = [];
      total = 0;
    }
    cur.push(e);
    total += l;
  }
  if (cur.length) groups.push(cur);
  return groups;
}
function detailedHelp() {
  const e = (title, desc) => new EmbedBuilder3().setColor(COLOR).setTitle(title).setDescription(desc.slice(0, 4096));
  return [
    e(
      "\u{1F4D8} ERLC Bot \u2014 Full Guide (1/10): Getting Started",
      "**How commands work**\n\u2022 **Slash commands** (`/\u2026`) \u2014 type `/` and pick from the list.\n\u2022 **Prefix commands** (`u!\u2026`) \u2014 type them as a normal message, e.g. `u!heal John`.\n\n**Permissions**\n\u2022 *Staff* = roles in `STAFF_ROLE_ID` (or anyone with Discord Administrator). Can run ERLC, sessions, tickets, infractions, etc.\n\u2022 *Admin* = `ADMIN_ROLE_ID` or Administrator. Can run `/setup`, `/reset-config`, `/close-all-tickets`, raw `u!run`.\n\n**See your whole config any time:** `/setup view`\n**Full data dump:** `/debug`  \u2022  **Wipe everything:** `/reset-config`"
    ),
    e(
      "\u{1F3A8} ERLC Bot \u2014 Full Guide (2/10): Names, Branding & Banners",
      '**Change the server name shown in panels** (fixes "Flordia" \u2192 "Florida"):\n`/setup branding field:name value:Florida State Roleplay`\n\n**Other branding fields** (`/setup branding field:<x> value:<y>`):\n\u2022 `name` \u2014 bold name in panels/welcome\n\u2022 `footer` \u2014 small grey footer line\n\u2022 `color` \u2014 accent stripe, hex e.g. `1e90d6`\n\u2022 `logo` \u2014 top-right thumbnail image URL\n\u2022 `separator` \u2014 the gradient bar image URL\n\u2022 `emoji` \u2014 your custom emoji, e.g. `<:Florida:123456789>` (get the code by sending `\\:Florida:`)\n\u2022 `join-url` \u2014 the "Join Server" button link\n\n**Community ping role** (sessions/training): `/setup ping-role role:@Member`\n\n**Banners** (the big header image per panel type):\n`/setup banner slot:<type> url:<image>` \u2014 slots: information, regulations, guidelines, marketplace, dashboard, sessionStart, sessionBoost, sessionFull, sessionShutdown, tickets, welcome, giveaways, infractions, promotions, training, reviews, suggestions, default.'
    ),
    e(
      "\u{1F3AB} ERLC Bot \u2014 Full Guide (3/10): Tickets",
      "**1. Wire it up:**\n`/setup set-channel purpose:ticket-log channel:#ticket-logs`\n`/setup support-roles role_ids:<staffRoleID,otherID>`\n\n**2. Ticket types** (each gets its own auto-created category):\n`/ticket type-list` \u2014 view them\n`/ticket type-add name:<x> emoji:<:e:id> category:<cat> ping_role:@role support_roles:<ids>`\n`/ticket type-remove id:<id>`  \u2022  `/ticket reset-types` (restore defaults)\n\n**3. Post the panel:** `/ticket setup channel:#open-a-ticket`\n\n**Inside a ticket:**\n\u2022 **Claim/Unclaim** button \u2014 staff & admins; channel turns \u{1F7E2} claimed / \u{1F534} unclaimed.\n\u2022 **Close** button or `u!ticket close` \u2014 logs a transcript.\n\u2022 `/forward` \u2014 re-route the ticket to another team (e.g. Management).\n\u2022 `/adduser` / `/removeuser` \u2014 manage who can see it.\n\u2022 `/close-all-tickets` (admin)."
    ),
    e(
      "\u{1F5C2}\uFE0F ERLC Bot \u2014 Full Guide (4/10): Dashboards (Information / Regulations / Guidelines / Marketplace)",
      "Dashboards are dropdown info panels. Build as many as you like.\n\n**1. Create one:**\n`/dashboard create name:information title:Information banner:information placeholder:View our Key Information! description:Welcome! Use the dropdown below.`\n\n**2. Add dropdown options** (each reveals its own content when picked):\n`/dashboard add-option dashboard:information label:Key Links emoji:<:e:id> content:\u2022 [Staff App](url)\u23CE\u2022 [Roblox Group](url)`\n*(paste real line breaks and markdown links into `content`)*\n\n**3. Post it:** `/dashboard post dashboard:information channel:#information`\n\n**Edit later (no rebuild):**\n`/dashboard edit dashboard:information banner:guidelines title:\u2026`\n`/dashboard edit-option dashboard:information option:key-links content:\u2026 banner:dashboard`\n`/dashboard list` \xB7 `/dashboard remove-option` \xB7 `/dashboard delete`\n\nEach option can have its **own banner** (`banner:` slot or `banner_url:`); leave blank for a clean card."
    ),
    e(
      "\u{1F4C5} ERLC Bot \u2014 Full Guide (5/10): Sessions & Giveaways",
      "**Sessions** (post to the configured session channel):\n`/setup set-channel purpose:session channel:#sessions`\n`/session ssu` startup \xB7 `/session ssd` shutdown \xB7 `/session boost` \xB7 `/session full` \xB7 `/session vote needed:5` \xB7 `/session info`\nPrefix: `u!session ssu|ssd|boost|full|vote` \xB7 `u!shutdown` (emergency).\nSession panels pull **live ER:LC stats** and show a **Join Server** button.\n\n**Giveaways:**\n`/giveaway start prize:<x> duration:10m winners:1` \u2014 button entry, auto-ends, survives restarts.\n`/giveaway end message_id:<id>` \xB7 `/giveaway reroll message_id:<id>`\nPrefix: `u!giveaway create <duration> [winners] <prize>` \xB7 `u!giveaway end|reroll <id>`."
    ),
    e(
      "\u{1F6E1}\uFE0F ERLC Bot \u2014 Full Guide (6/10): Staff Tools",
      "**Infractions:** `/infraction add user:@x type:Strike reason:\u2026` (logs to the infraction channel + DMs the user)\n`/infraction remove id:<n>` \xB7 `/infraction list user:@x` \xB7 prefix `u!infraction @x <type> <reason>`\n`/setup set-channel purpose:infraction-log channel:#infractions`\n\n**Promotions:** `/promotion add user:@x new_rank:SIA old_rank:N/A reason:\u2026`\n`/promotion history user:@x` \xB7 prefix `u!promotion @x <new rank> | <reason>`\n`/setup set-channel purpose:promotions channel:#promotions`\n\n**Reviews:** `/review staff:@x stars:5 comment:\u2026` \u2192 `/setup set-channel purpose:reviews channel:#reviews`\n\n**Training:**\n`/training request type:\u2026 when:\u2026 timezone:EST roblox_age:13+` (asks timezone + Roblox age group)\n`/training results type:\u2026 passed:@a @b notes:\u2026`\n`/setup set-channel purpose:training-request channel:#requests`\n`/setup set-channel purpose:training-results channel:#results`\n`/setup training-ping-role role:@Trainer` (who gets pinged on a request)."
    ),
    e(
      "\u{1F4AC} ERLC Bot \u2014 Full Guide (7/10): Community & Welcome",
      "**Welcome messages:** `/setup set-channel purpose:welcome channel:#welcome` \u2014 posts a panel + pings new members on join. Uses your brand name + emoji.\n\n**Suggestions:** `/suggest suggestion:\u2026` (vote buttons) \xB7 prefix `u!suggestion <text>` \u2192 `/setup set-channel purpose:suggestions channel:#suggestions`\n\n**AFK:** `/afk-set reason:\u2026` \xB7 `/afk-remove` \xB7 prefix `u!afk [reason]` / `u!afk-remove`. Pinging an AFK user shows their status; they auto-return on next message.\n\n**Roleplay logs:** `/roleplay log title:\u2026 players:\u2026 details:\u2026` \xB7 `/roleplay revoke id:<n>` \u2192 `/setup set-channel purpose:roleplay channel:#rp-logs`.\n\n**Applications** (Staff/HR/Trainer/etc. \u2014 DM-based):\n`/application create name:Staff results_channel:#app-review questions:Q1 | Q2 | Q3`\n`/application add-question` \xB7 `remove-question` \xB7 `questions` \u2014 manage questions (max 20)\n`/application post application:staff channel:#applications` \u2014 panel with an **Apply** button\nClicking Apply \u2192 the bot **DMs the questions one at a time**; finished answers post to the results channel with **Accept/Deny** buttons, and the applicant is **DMed the outcome**.\n`/application edit` (title/text/banner/button/channel) \xB7 `toggle` (open/close) \xB7 `list` \xB7 `delete`"
    ),
    e(
      "\u{1F693} ERLC Bot \u2014 Full Guide (8/10): ER:LC Commands & Live Status",
      "**Remote in-game commands** (staff) \u2014 `u!<cmd> <args>` runs `:<cmd>` on the server:\n`u!heal` `u!kill` `u!respawn` `u!mod` `u!unmod` `u!admin` `u!unadmin` `u!jail` `u!unjail` `u!kick` `u!ban` `u!unban` `u!wanted` `u!unwanted` `u!pm` `u!h` `u!msg` `u!priority` `u!weather` `u!time` `u!startfire` `u!stopfire`\n`u!run :<anything>` \u2014 raw command (admin). `/erlc command command:<x>` \u2014 slash version.\n\n**Server data:** `/erlc server|players|joinlogs|killlogs|commandlogs|bans|vehicles|queue` \xB7 prefix `u!erlc <view>`\n*(Needs `ERLC_SERVER_KEY` set, and your bot's IP allowlisted at api.erlc.gg/server-owners.)*\n\n**Live status panel:** `/erlc-status start channel:#status interval:5` \u2014 posts a panel with players/queue/code + Join button that **auto-refreshes**. `/erlc-status stop` to end. Banner: `/setup banner slot:status url:\u2026`"
    ),
    e(
      "\u{1F6E0}\uFE0F ERLC Bot \u2014 Full Guide (9/10): Moderation & Verification",
      "**Discord moderation** (staff; logged to the mod-log if set):\n`/ban user reason [delete_days]` \xB7 `/kick` \xB7 `/mute user duration:10m|2h|1d` \xB7 `/unmute`\n`/lock` / `/unlock [channel]` \xB7 `/slowmode seconds [channel]` \xB7 `/nick user [nickname]`\n`/role user role [action:add|remove|toggle]` \xB7 `/purge amount [user]`\n`/setup set-channel purpose:mod-log channel:#mod-logs` \u2014 log every action.\n\n**Global bans** (across every server the bot is in): `/globalban user_id reason` \xB7 `/globalunban` \xB7 `/globalbans`. Re-bans on rejoin automatically. Authorized via `GLOBAL_BAN_ROLE_ID` or Administrator.\n\n**Verification:** `/verify setup role:@Member channel:#verify [banner:url] [text:\u2026]` \u2014 members click Verify to get the role. `/verify role` to change it \xB7 `/verify stats`.\n**Auto-role:** `/setup autorole role:@Member` \u2014 given automatically on join (no click needed)."
    ),
    e(
      "\u{1F9F0} ERLC Bot \u2014 Full Guide (10/10): Utility & Fun",
      "**Polls:** `/poll question:\u2026 option1:\u2026 option2:\u2026 [option3] [option4]` \u2014 button voting, one vote per person, live counts.\n**Reminders:** `/remind in:10m|2h|1d text:\u2026` \u2014 DMs you when time's up (survives restarts).\n**Info:** `/userinfo [user]` (roles, join date, infraction count) \xB7 `/serverinfo` \xB7 `/avatar [user]` \xB7 `/botinfo` (uptime/servers/ping) \xB7 `/membercount` \xB7 `/ping`\n**Media:** `/media-request image:<upload>` \u2014 submit in-game shots; high ranks Accept/Deny; accepted posts to the media channel.\n**Messaging:** `/say` \xB7 `/dm target:@x|@role message:\u2026` \xB7 `/embed` \xB7 `/embedsender` \xB7 `/channel rename`\nPrefix: `u!ping` `u!say` `u!dm` `u!membercount` `u!purge <n>` `u!help`."
    )
  ];
}
async function handlePrefix9(cmd, message, args, rest) {
  const g = message.guild;
  if (cmd === "ping") return message.reply({ embeds: [okEmbed(`\u{1F3D3} Pong! \`${Math.round(message.client.ws.ping)}ms\``)] }).catch(() => {
  });
  if (cmd === "help") {
    const groups = chunkEmbeds(detailedHelp());
    for (const g2 of groups) await message.channel.send({ embeds: g2 }).catch(() => {
    });
    return;
  }
  if (cmd === "membercount") return message.reply({ embeds: [infoEmbed(`${g.name}`, `**Total:** ${g.memberCount}
**Boosts:** ${g.premiumSubscriptionCount ?? 0}`)] }).catch(() => {
  });
  if (cmd === "purge") {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
    });
    const amount = parseInt(args[0], 10);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) return message.reply({ embeds: [errEmbed("Usage: `u!purge <1-100>`")] }).catch(() => {
    });
    await message.delete().catch(() => {
    });
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) return;
    const m = await message.channel.send({ embeds: [okEmbed(`\u{1F9F9} Deleted **${deleted.size}** message(s).`)] }).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {
    }), 5e3);
    return;
  }
  if (cmd === "say") {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
    });
    if (!rest) return message.reply({ embeds: [errEmbed("Usage: `u!say <message>`")] }).catch(() => {
    });
    await message.delete().catch(() => {
    });
    return message.channel.send({ content: rest, allowedMentions: { parse: [] } }).catch(() => {
    });
  }
  if (cmd === "dm") {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed("Staff only.")] }).catch(() => {
    });
    const user = message.mentions.users.first();
    const body = rest.replace(/<@!?\d+>/, "").trim();
    if (!user || !body) return message.reply({ embeds: [errEmbed("Usage: `u!dm @user <message>`")] }).catch(() => {
    });
    const ok = await user.send({ embeds: [infoEmbed(`\u{1F4E9} Message from ${g.name}`, body)] }).then(() => true).catch(() => false);
    return message.reply({ embeds: [ok ? okEmbed(`\u2705 DM sent to ${user}.`) : errEmbed("Could not DM that user.")] }).catch(() => {
    });
  }
}

// features/setup.js
var setup_exports = {};
__export(setup_exports, {
  componentNs: () => componentNs5,
  handleComponent: () => handleComponent5,
  handleSlash: () => handleSlash13,
  owns: () => owns13,
  slash: () => slash13
});
import { SlashCommandBuilder as SlashCommandBuilder13, ActionRowBuilder as ActionRowBuilder6, ButtonBuilder as ButtonBuilder5, ButtonStyle as ButtonStyle5, AttachmentBuilder as AttachmentBuilder2 } from "discord.js";
var CHANNEL_KEYS = {
  session: "sessionChannel",
  "infraction-log": "infractionLogChannel",
  promotions: "promoChannel",
  "ticket-panel": "ticketPanelChannel",
  "ticket-category": "ticketCategory",
  "ticket-log": "ticketLogChannel",
  suggestions: "suggestionChannel",
  reviews: "reviewChannel",
  roleplay: "roleplayChannel",
  welcome: "welcomeChannel",
  media: "mediaChannel",
  training: "trainingChannel",
  "training-request": "trainingRequestChannel",
  "training-results": "trainingResultsChannel",
  "group-request": "groupRequestChannel",
  "mod-log": "modLogChannel"
};
var BRANDING_FIELDS = { logo: "logo", separator: "separator", color: "color", name: "name", footer: "footer", "join-url": "joinUrl", emoji: "emoji" };
var choices = (obj) => Object.keys(obj).map((k) => ({ name: k, value: k }));
var slash13 = [
  new SlashCommandBuilder13().setName("setup").setDescription("Complete bot configuration system").addSubcommand((s) => s.setName("view").setDescription("View current configuration")).addSubcommand((s) => s.setName("set-channel").setDescription("Assign a channel to a purpose").addStringOption((o) => o.setName("purpose").setDescription("What it's for").setRequired(true).addChoices(...choices(CHANNEL_KEYS))).addChannelOption((o) => o.setName("channel").setDescription("Channel (omit to clear)"))).addSubcommand((s) => s.setName("support-roles").setDescription("Set ticket support roles (comma-separated IDs, or blank to clear)").addStringOption((o) => o.setName("role_ids").setDescription("Role IDs, comma-separated"))).addSubcommand((s) => s.setName("ping-role").setDescription("Set the community ping role").addRoleOption((o) => o.setName("role").setDescription("Role (omit to clear)"))).addSubcommand((s) => s.setName("training-ping-role").setDescription("Role pinged by /training request").addRoleOption((o) => o.setName("role").setDescription("Role (omit to clear)"))).addSubcommand((s) => s.setName("media-roles").setDescription("Roles (high ranks) that can accept/deny media requests").addStringOption((o) => o.setName("role_ids").setDescription("Role IDs, comma-separated (blank to clear)"))).addSubcommand((s) => s.setName("session-ping-role").setDescription("Role pinged by every /session command (alongside @here)").addRoleOption((o) => o.setName("role").setDescription("Role (omit to clear)"))).addSubcommand((s) => s.setName("autorole").setDescription("Role automatically given to every new member on join").addRoleOption((o) => o.setName("role").setDescription("Role (omit to clear)"))).addSubcommand((s) => s.setName("branding").setDescription("Set a branding field").addStringOption((o) => o.setName("field").setDescription("Field").setRequired(true).addChoices(...choices(BRANDING_FIELDS))).addStringOption((o) => o.setName("value").setDescription("Value (URL/text/hex; blank to clear)"))).addSubcommand((s) => s.setName("banner").setDescription("Set a banner image URL for a panel type").addStringOption((o) => o.setName("slot").setDescription("Panel type").setRequired(true).addChoices(...BANNER_SLOTS.slice(0, 25).map((s2) => ({ name: s2, value: s2 })))).addStringOption((o) => o.setName("url").setDescription("Image URL (blank to clear)"))),
  new SlashCommandBuilder13().setName("reset-config").setDescription("Wipe all saved settings for this server"),
  new SlashCommandBuilder13().setName("debug").setDescription("View every saved piece of data for this server")
];
var owns13 = ["setup", "reset-config", "debug"];
var componentNs5 = ["resetcfg"];
function ensureBranding(gid) {
  const c = guild(gid).config;
  if (!c.branding) c.branding = {};
  if (!c.branding.banners) c.branding.banners = {};
  return c.branding;
}
async function handleSlash13(interaction) {
  if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed("Admin only.")], ephemeral: true });
  const g = interaction.guild;
  const name = interaction.commandName;
  if (name === "reset-config") {
    const row = new ActionRowBuilder6().addComponents(
      new ButtonBuilder5().setCustomId("resetcfg:yes").setLabel("Yes, wipe everything").setStyle(ButtonStyle5.Danger),
      new ButtonBuilder5().setCustomId("resetcfg:no").setLabel("Cancel").setStyle(ButtonStyle5.Secondary)
    );
    return interaction.reply({ embeds: [errEmbed("This wipes **all** settings, branding, infractions, promotions, giveaways, tickets, etc. for this server. Are you sure?", "\u26A0\uFE0F Confirm reset")], components: [row], ephemeral: true });
  }
  if (name === "debug") {
    const data = guild(g.id);
    const summary = {
      config: data.config,
      counts: {
        infractions: data.infractions.length,
        promotions: data.promotions.length,
        giveaways: Object.keys(data.giveaways).length,
        tickets: Object.keys(data.tickets).length,
        afk: Object.keys(data.afk).length,
        reviews: data.reviews.length,
        trainings: data.trainings.length,
        suggestions: data.suggestions.length,
        roleplays: data.roleplays.length
      }
    };
    const file = new AttachmentBuilder2(Buffer.from(JSON.stringify(data, null, 2), "utf8"), { name: `debug-${g.id}.json` });
    return interaction.reply({ embeds: [infoEmbed("\u{1F41B} Server Data", "```json\n" + JSON.stringify(summary, null, 2).slice(0, 3800) + "\n```")], files: [file], ephemeral: true });
  }
  const sub = interaction.options.getSubcommand();
  if (sub === "view") {
    const c = guild(g.id).config;
    const b = c.branding || {};
    const lines = Object.entries(CHANNEL_KEYS).map(([p, k]) => `**${p}:** ${c[k] ? `<#${c[k]}>` : "\u2014"}`);
    lines.push(`**support-roles:** ${c.supportRoles || "\u2014"}`);
    lines.push(`**ping-role:** ${b.pingRole ? `<@&${b.pingRole}>` : "\u2014"}`);
    lines.push(`**branding:** name=${b.name || "\u2014"}, logo=${b.logo ? "\u2713" : "\u2014"}, separator=${b.separator ? "\u2713" : "\u2014"}, color=${b.color ?? "\u2014"}, join=${b.joinUrl ? "\u2713" : "\u2014"}`);
    const setBanners = Object.keys(b.banners || {}).filter((k) => b.banners[k]);
    lines.push(`**banners set:** ${setBanners.length ? setBanners.join(", ") : "\u2014"}`);
    return interaction.reply({ embeds: [infoEmbed(`\u2699\uFE0F ${g.name} \u2014 Configuration`, lines.join("\n"))], ephemeral: true });
  }
  if (sub === "set-channel") {
    const key = CHANNEL_KEYS[interaction.options.getString("purpose")];
    const ch = interaction.options.getChannel("channel");
    if (ch) guild(g.id).config[key] = ch.id;
    else delete guild(g.id).config[key];
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 \`${interaction.options.getString("purpose")}\` ${ch ? `set to ${ch}` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "support-roles") {
    const ids = (interaction.options.getString("role_ids") || "").trim();
    if (ids) guild(g.id).config.supportRoles = ids;
    else delete guild(g.id).config.supportRoles;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Support roles ${ids ? `set to \`${ids}\`` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "ping-role") {
    const role = interaction.options.getRole("role");
    const b = ensureBranding(g.id);
    if (role) b.pingRole = role.id;
    else delete b.pingRole;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Ping role ${role ? `set to ${role}` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "training-ping-role") {
    const role = interaction.options.getRole("role");
    if (role) guild(g.id).config.trainingPingRole = role.id;
    else delete guild(g.id).config.trainingPingRole;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Training ping role ${role ? `set to ${role}` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "media-roles") {
    const ids = (interaction.options.getString("role_ids") || "").trim();
    if (ids) guild(g.id).config.mediaReviewRoles = ids;
    else delete guild(g.id).config.mediaReviewRoles;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Media reviewer roles ${ids ? `set to \`${ids}\`` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "session-ping-role") {
    const role = interaction.options.getRole("role");
    if (role) guild(g.id).config.sessionPingRole = role.id;
    else delete guild(g.id).config.sessionPingRole;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Session ping role ${role ? `set to ${role}` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "autorole") {
    const role = interaction.options.getRole("role");
    if (role && role.position >= g.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errEmbed(`I can't assign ${role} \u2014 move my bot role above it first.`)], ephemeral: true });
    }
    if (role) guild(g.id).config.autoRole = role.id;
    else delete guild(g.id).config.autoRole;
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Auto-role ${role ? `set to ${role} \u2014 new members get it on join` : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "branding") {
    const field = BRANDING_FIELDS[interaction.options.getString("field")];
    const raw = interaction.options.getString("value");
    const b = ensureBranding(g.id);
    if (!raw) {
      delete b[field];
    } else if (field === "color") {
      b.color = parseInt(raw.replace("#", ""), 16) || void 0;
    } else {
      b[field] = raw;
    }
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Branding \`${interaction.options.getString("field")}\` ${raw ? "updated" : "cleared"}.`)], ephemeral: true });
  }
  if (sub === "banner") {
    const slot = interaction.options.getString("slot");
    const url = interaction.options.getString("url");
    const b = ensureBranding(g.id);
    if (url) b.banners[slot] = url;
    else delete b.banners[slot];
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Banner \`${slot}\` ${url ? "set" : "cleared"}.`)], ephemeral: true });
  }
}
async function handleComponent5(interaction) {
  if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed("Admin only.")], ephemeral: true });
  const [, action] = interaction.customId.split(":");
  if (action === "yes") {
    resetGuild(interaction.guild.id);
    return interaction.update({ embeds: [okEmbed("\u2705 All settings wiped.")], components: [] });
  }
  return interaction.update({ embeds: [okEmbed("Cancelled.")], components: [] });
}

// features/dashboard.js
var dashboard_exports = {};
__export(dashboard_exports, {
  componentNs: () => componentNs6,
  handleComponent: () => handleComponent6,
  handleSlash: () => handleSlash14,
  owns: () => owns14,
  slash: () => slash14
});
import { SlashCommandBuilder as SlashCommandBuilder14, ActionRowBuilder as ActionRowBuilder7, StringSelectMenuBuilder as StringSelectMenuBuilder2 } from "discord.js";
var dashes = (gid) => guild(gid).dashboards ||= {};
var bannerChoices = BANNER_SLOTS.slice(0, 25).map((s) => ({ name: s, value: s }));
var slugify2 = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "dash";
function safeEmoji2(e) {
  if (!e || typeof e !== "string") return void 0;
  if (/^<a?:[A-Za-z0-9_]+:\d+>$/.test(e)) return e;
  if (!e.includes(":") && !/[A-Za-z]/.test(e)) return e;
  return void 0;
}
function dashboardPanel(gid, d) {
  const menu = new StringSelectMenuBuilder2().setCustomId(`dash:${d.id}`).setPlaceholder(d.placeholder || "Select an option\u2026");
  for (const o of d.options.slice(0, 25)) {
    const opt = { label: o.label.slice(0, 100), value: o.id, description: (o.description || "").slice(0, 100) || void 0 };
    const em = safeEmoji2(o.emoji);
    if (em) opt.emoji = em;
    menu.addOptions(opt);
  }
  return panel({
    guildId: gid,
    kind: d.bannerSlot || "dashboard",
    bannerUrl: d.bannerUrl || void 0,
    title: d.title,
    body: d.body,
    footer: branding(gid).name || void 0,
    buttons: d.options.length ? [menu] : void 0
  });
}
var slash14 = [
  new SlashCommandBuilder14().setName("dashboard").setDescription("Build dropdown info panels (dashboards, guidelines, etc.)").addSubcommand((s) => s.setName("create").setDescription("Create a new dashboard panel").addStringOption((o) => o.setName("name").setDescription('Short id to reference it later, e.g. "main"').setRequired(true)).addStringOption((o) => o.setName("title").setDescription("Heading shown under the banner").setRequired(true)).addStringOption((o) => o.setName("description").setDescription("Intro text")).addStringOption((o) => o.setName("banner").setDescription("Banner slot to use").addChoices(...BANNER_SLOTS.slice(0, 25).map((s2) => ({ name: s2, value: s2 })))).addStringOption((o) => o.setName("banner_url").setDescription("Custom banner image URL (overrides slot)")).addStringOption((o) => o.setName("placeholder").setDescription("Dropdown placeholder text"))).addSubcommand((s) => s.setName("add-option").setDescription("Add a dropdown option to a dashboard").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)).addStringOption((o) => o.setName("label").setDescription("Option label in the dropdown").setRequired(true)).addStringOption((o) => o.setName("content").setDescription("Text shown when selected (supports markdown/links, paste line breaks)").setRequired(true)).addStringOption((o) => o.setName("emoji").setDescription("Emoji for the option")).addStringOption((o) => o.setName("description").setDescription("Small description under the label")).addStringOption((o) => o.setName("banner").setDescription("Banner slot for this section").addChoices(...bannerChoices)).addStringOption((o) => o.setName("banner_url").setDescription("Custom banner image URL for this section"))).addSubcommand((s) => s.setName("edit").setDescription("Edit a dashboard panel (banner, title, etc.)").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)).addStringOption((o) => o.setName("title").setDescription("New title")).addStringOption((o) => o.setName("description").setDescription("New intro text")).addStringOption((o) => o.setName("banner").setDescription("Banner slot").addChoices(...bannerChoices)).addStringOption((o) => o.setName("banner_url").setDescription('Custom banner image URL (use "none" to clear)')).addStringOption((o) => o.setName("placeholder").setDescription("Dropdown placeholder text"))).addSubcommand((s) => s.setName("edit-option").setDescription("Edit a dropdown option (incl. its banner)").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)).addStringOption((o) => o.setName("option").setDescription("Option id/label").setRequired(true)).addStringOption((o) => o.setName("label").setDescription("New label")).addStringOption((o) => o.setName("content").setDescription("New content")).addStringOption((o) => o.setName("emoji").setDescription("New emoji")).addStringOption((o) => o.setName("description").setDescription("New description")).addStringOption((o) => o.setName("banner").setDescription("Banner slot for this section").addChoices(...bannerChoices)).addStringOption((o) => o.setName("banner_url").setDescription('Custom banner image URL (use "none" to clear)'))).addSubcommand((s) => s.setName("remove-option").setDescription("Remove a dropdown option").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)).addStringOption((o) => o.setName("option").setDescription("Option id/label").setRequired(true))).addSubcommand((s) => s.setName("post").setDescription("Post a dashboard to a channel").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)).addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)"))).addSubcommand((s) => s.setName("list").setDescription("List dashboards and their options")).addSubcommand((s) => s.setName("delete").setDescription("Delete a dashboard").addStringOption((o) => o.setName("dashboard").setDescription("Dashboard id").setRequired(true)))
];
var owns14 = ["dashboard"];
var componentNs6 = ["dash"];
async function handleSlash14(interaction) {
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  const all = dashes(g.id);
  if (sub === "create") {
    const id = slugify2(interaction.options.getString("name"));
    if (all[id]) return interaction.reply({ embeds: [errEmbed(`A dashboard with id \`${id}\` already exists.`)], ephemeral: true });
    all[id] = {
      id,
      title: interaction.options.getString("title"),
      body: interaction.options.getString("description") || "",
      bannerSlot: interaction.options.getString("banner") || "dashboard",
      bannerUrl: interaction.options.getString("banner_url") || "",
      placeholder: interaction.options.getString("placeholder") || "",
      options: []
    };
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Dashboard \`${id}\` created. Add options with \`/dashboard add-option dashboard:${id} \u2026\`, then \`/dashboard post dashboard:${id}\`.`)], ephemeral: true });
  }
  if (sub === "list") {
    const lines = Object.values(all).map((d2) => `**\`${d2.id}\`** \u2014 ${d2.title} \xB7 ${d2.options.length} option(s): ${d2.options.map((o) => o.id).join(", ") || "\u2014"}`);
    return interaction.reply({ embeds: [listEmbed("Dashboards", lines, { empty: "No dashboards yet. Create one with `/dashboard create`." })], ephemeral: true });
  }
  const d = all[interaction.options.getString("dashboard")];
  if (!d) return interaction.reply({ embeds: [errEmbed("No dashboard with that id. See `/dashboard list`.")], ephemeral: true });
  if (sub === "add-option") {
    if (d.options.length >= 25) return interaction.reply({ embeds: [errEmbed("A dropdown can have at most 25 options.")], ephemeral: true });
    const label = interaction.options.getString("label");
    let oid = slugify2(label), n = 1;
    while (d.options.some((o) => o.id === oid)) oid = `${slugify2(label)}-${++n}`;
    d.options.push({
      id: oid,
      label,
      content: interaction.options.getString("content"),
      emoji: interaction.options.getString("emoji") || null,
      description: interaction.options.getString("description") || null,
      bannerSlot: interaction.options.getString("banner") || null,
      bannerUrl: interaction.options.getString("banner_url") || null
    });
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Added option **${label}** (\`${oid}\`) to \`${d.id}\`. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
  }
  if (sub === "edit") {
    const set = (k, v) => {
      if (v !== null && v !== void 0) d[k] = v === "none" ? "" : v;
    };
    set("title", interaction.options.getString("title"));
    set("body", interaction.options.getString("description"));
    set("bannerSlot", interaction.options.getString("banner"));
    set("bannerUrl", interaction.options.getString("banner_url"));
    set("placeholder", interaction.options.getString("placeholder"));
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Updated \`${d.id}\`. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
  }
  if (sub === "edit-option") {
    const key = interaction.options.getString("option");
    const o = d.options.find((x) => x.id === key || x.label.toLowerCase() === key.toLowerCase());
    if (!o) return interaction.reply({ embeds: [errEmbed(`No option \`${key}\` in \`${d.id}\`.`)], ephemeral: true });
    const set = (k, v) => {
      if (v !== null && v !== void 0) o[k] = v === "none" ? null : v;
    };
    set("label", interaction.options.getString("label"));
    set("content", interaction.options.getString("content"));
    set("emoji", interaction.options.getString("emoji"));
    set("description", interaction.options.getString("description"));
    set("bannerSlot", interaction.options.getString("banner"));
    set("bannerUrl", interaction.options.getString("banner_url"));
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Updated option **${o.label}**. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
  }
  if (sub === "remove-option") {
    const key = interaction.options.getString("option");
    const idx = d.options.findIndex((o) => o.id === key || o.label.toLowerCase() === key.toLowerCase());
    if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No option \`${key}\` in \`${d.id}\`.`)], ephemeral: true });
    const [removed] = d.options.splice(idx, 1);
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Removed **${removed.label}**. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
  }
  if (sub === "post") {
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    await ch.send(dashboardPanel(g.id, d));
    return interaction.reply({ embeds: [okEmbed(`\u2705 Posted dashboard \`${d.id}\` in ${ch}.`)], ephemeral: true });
  }
  if (sub === "delete") {
    delete all[d.id];
    persist();
    return interaction.reply({ embeds: [okEmbed(`\u2705 Deleted dashboard \`${d.id}\`.`)], ephemeral: true });
  }
}
async function handleComponent6(interaction) {
  const dashId = interaction.customId.split(":")[1];
  const d = dashes(interaction.guild.id)[dashId];
  if (!d) return interaction.reply({ embeds: [errEmbed("This dashboard no longer exists.")], ephemeral: true });
  const o = d.options.find((x) => x.id === interaction.values[0]);
  if (!o) return interaction.reply({ embeds: [errEmbed("That option is no longer available.")], ephemeral: true });
  const hasBanner = o.bannerSlot || o.bannerUrl;
  return interaction.reply(ephemeralPanel({
    guildId: interaction.guild.id,
    kind: o.bannerSlot || "default",
    bannerUrl: o.bannerUrl || void 0,
    noBanner: !hasBanner,
    title: `${o.emoji ? o.emoji + " " : ""}${o.label}`,
    body: o.content,
    footer: branding(interaction.guild.id).name || void 0
  }));
}

// features/welcome.js
var welcome_exports = {};
__export(welcome_exports, {
  init: () => init2,
  owns: () => owns15,
  slash: () => slash15
});
var cfg9 = (gid) => guild(gid).config;
var slash15 = [];
var owns15 = [];
function init2(ctx) {
  ctx.client.on("guildMemberAdd", async (member) => {
    try {
      if (member.user.bot) return;
      const c = cfg9(member.guild.id);
      if (c.autoRole && member.guild.roles.cache.has(c.autoRole)) {
        member.roles.add(c.autoRole, "Auto-role on join").catch(() => {
        });
      }
      const ch = await resolveChannel(member.guild, c.welcomeChannel);
      if (!ch) return;
      const b = branding(member.guild.id);
      const emoji = b.emoji ? `${b.emoji} ` : "";
      const name = b.name || member.guild.name;
      const payload = panel({
        guildId: member.guild.id,
        kind: "welcome",
        title: "Welcome",
        body: `${emoji}Welcome <@${member.id}> to **${name}**! We're glad to have you. Please take a moment to read our information and guidelines, then enjoy your stay.`,
        footer: b.name || void 0
      });
      payload.allowedMentions = { users: [member.id] };
      await ch.send(payload);
    } catch (e) {
      console.error("welcome error:", e);
    }
  });
}

// features/media.js
var media_exports = {};
__export(media_exports, {
  componentNs: () => componentNs7,
  handleComponent: () => handleComponent7,
  handleSlash: () => handleSlash15,
  owns: () => owns16,
  slash: () => slash16
});
import {
  SlashCommandBuilder as SlashCommandBuilder15,
  ActionRowBuilder as ActionRowBuilder8,
  ButtonBuilder as ButtonBuilder6,
  ButtonStyle as ButtonStyle6,
  ChannelType as ChannelType2,
  PermissionFlagsBits as PermissionFlagsBits3,
  AttachmentBuilder as AttachmentBuilder3
} from "discord.js";
var cfg10 = (gid) => guild(gid).config;
var reqs = (gid) => guild(gid).mediaRequests ||= {};
function isReviewer(member) {
  if (isAdmin(member)) return true;
  const roles = csv(cfg10(member.guild.id).mediaReviewRoles);
  return roles.length > 0 && roles.some((r) => member.roles.cache.has(r));
}
async function ensureCategory2(g) {
  const explicit = cfg10(g.id).mediaCategory && g.channels.cache.get(cfg10(g.id).mediaCategory);
  if (explicit && explicit.type === ChannelType2.GuildCategory) return cfg10(g.id).mediaCategory;
  let cat = g.channels.cache.find((c) => c.type === ChannelType2.GuildCategory && c.name.toLowerCase() === "media requests");
  if (!cat) {
    const ow = [
      { id: g.roles.everyone.id, deny: [PermissionFlagsBits3.ViewChannel] },
      { id: g.members.me.id, allow: [PermissionFlagsBits3.ViewChannel, PermissionFlagsBits3.ManageChannels] }
    ];
    for (const r of csv(cfg10(g.id).mediaReviewRoles)) if (g.roles.cache.has(r)) ow.push({ id: r, allow: [PermissionFlagsBits3.ViewChannel] });
    cat = await g.channels.create({ name: "Media Requests", type: ChannelType2.GuildCategory, permissionOverwrites: ow }).catch(() => null);
  }
  return cat?.id || void 0;
}
var reviewRow = (done = false) => new ActionRowBuilder8().addComponents(
  new ButtonBuilder6().setCustomId("media:accept").setLabel("Accept").setStyle(ButtonStyle6.Success).setDisabled(done),
  new ButtonBuilder6().setCustomId("media:deny").setLabel("Deny").setStyle(ButtonStyle6.Danger).setDisabled(done)
);
function reviewPanel(gid, req, statusLine) {
  const p = panel({
    guildId: gid,
    kind: "media",
    bannerUrl: req.imageUrl,
    title: `Official Media Request #${req.num}`,
    body: `Submitted by <@${req.submitterId}>${req.note ? `

**Note:** ${req.note}` : ""}${statusLine ? `

${statusLine}` : "\n\nHigh ranks: review and **Accept** or **Deny** below."}`,
    footer: branding(gid).name || void 0
  });
  p.components.push(reviewRow(!!statusLine));
  return p;
}
var slash16 = [
  new SlashCommandBuilder15().setName("media-request").setDescription("Submit an official media request (upload an in-game image)").addAttachmentOption((o) => o.setName("image").setDescription("The image to submit").setRequired(true)).addStringOption((o) => o.setName("note").setDescription("Optional note for reviewers"))
];
var owns16 = ["media-request"];
var componentNs7 = ["media"];
async function handleSlash15(interaction) {
  const g = interaction.guild;
  const att = interaction.options.getAttachment("image");
  if (!att || !(att.contentType || "").startsWith("image/")) {
    return interaction.reply({ embeds: [errEmbed("Please attach an image file.")], ephemeral: true });
  }
  const note = interaction.options.getString("note") || null;
  await interaction.deferReply({ ephemeral: true });
  const data = guild(g.id);
  data.mediaCounter = (data.mediaCounter || 0) + 1;
  const num = data.mediaCounter;
  const ow = [
    { id: g.roles.everyone.id, deny: [PermissionFlagsBits3.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits3.ViewChannel, PermissionFlagsBits3.ReadMessageHistory] },
    { id: g.members.me.id, allow: [PermissionFlagsBits3.ViewChannel, PermissionFlagsBits3.SendMessages, PermissionFlagsBits3.ManageChannels] }
  ];
  for (const r of csv(cfg10(g.id).mediaReviewRoles)) if (g.roles.cache.has(r)) ow.push({ id: r, allow: [PermissionFlagsBits3.ViewChannel, PermissionFlagsBits3.SendMessages, PermissionFlagsBits3.ReadMessageHistory] });
  const ch = await g.channels.create({
    name: `media-${num}`,
    type: ChannelType2.GuildText,
    parent: await ensureCategory2(g),
    permissionOverwrites: ow
  });
  const req = { num, submitterId: interaction.user.id, imageUrl: att.url, note, status: "pending" };
  reqs(g.id)[ch.id] = req;
  persist();
  await ch.send(reviewPanel(g.id, req));
  return interaction.editReply({ embeds: [okEmbed(`Your media request was submitted: ${ch}`)] });
}
async function handleComponent7(interaction) {
  const [, action] = interaction.customId.split(":");
  const g = interaction.guild;
  const req = reqs(g.id)[interaction.channel.id];
  if (!req) return interaction.reply({ embeds: [errEmbed("This media request is no longer tracked.")], ephemeral: true });
  if (!isReviewer(interaction.member)) return interaction.reply({ embeds: [errEmbed("Only high ranks can review media requests.")], ephemeral: true });
  if (req.status !== "pending") return interaction.reply({ embeds: [errEmbed("This request was already handled.")], ephemeral: true });
  if (action === "accept") {
    req.status = "accepted";
    persist();
    await interaction.update(reviewPanel(g.id, req, `Accepted by <@${interaction.user.id}>`));
    const out = await resolveChannel(g, cfg10(g.id).mediaChannel);
    if (out) {
      const file = new AttachmentBuilder3(req.imageUrl, { name: "media.png" });
      const post2 = panel({
        guildId: g.id,
        kind: "media",
        bannerUrl: "attachment://media.png",
        title: "Official Media",
        body: `Submitted by <@${req.submitterId}>
Accepted by <@${interaction.user.id}>`,
        footer: branding(g.id).name || void 0
      });
      await out.send({ ...post2, files: [file] }).catch(() => {
      });
    }
    await interaction.channel.send({ embeds: [okEmbed(`Accepted by ${interaction.user}. ${out ? `Posted in ${out}.` : "No media channel configured (set /setup set-channel purpose:media)."} This channel closes shortly.`)] }).catch(() => {
    });
  } else {
    req.status = "denied";
    persist();
    await interaction.update(reviewPanel(g.id, req, `Denied by <@${interaction.user.id}>`));
    await interaction.channel.send({ embeds: [okEmbed(`Denied by ${interaction.user}. This channel closes shortly.`)] }).catch(() => {
    });
  }
  delete reqs(g.id)[interaction.channel.id];
  persist();
  setTimeout(() => interaction.channel.delete().catch(() => {
  }), 8e3);
}

// features/moderation.js
var moderation_exports = {};
__export(moderation_exports, {
  handleSlash: () => handleSlash16,
  owns: () => owns17,
  slash: () => slash17
});
import { SlashCommandBuilder as SlashCommandBuilder16, PermissionFlagsBits as PermissionFlagsBits4 } from "discord.js";
var cfg11 = (gid) => guild(gid).config;
async function modLog(g, text) {
  const ch = await resolveChannel(g, cfg11(g.id).modLogChannel);
  if (ch) ch.send({ embeds: [infoEmbed("Moderation Log", text)] }).catch(() => {
  });
}
var slash17 = [
  new SlashCommandBuilder16().setName("role").setDescription("Add or remove a role from a member").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)).addStringOption((o) => o.setName("action").setDescription("Add, remove, or toggle (default toggle)").addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "toggle", value: "toggle" })),
  new SlashCommandBuilder16().setName("ban").setDescription("Ban a member from the Discord server").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason")).addIntegerOption((o) => o.setName("delete_days").setDescription("Delete this many days of their messages (0-7)").setMinValue(0).setMaxValue(7)),
  new SlashCommandBuilder16().setName("kick").setDescription("Kick a member from the Discord server").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder16().setName("mute").setDescription("Timeout a member").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("duration").setDescription("e.g. 10m, 2h, 1d (max 28d)").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder16().setName("unmute").setDescription("Remove a member's timeout").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)),
  new SlashCommandBuilder16().setName("lock").setDescription("Lock a channel (deny @everyone sending)").addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)")),
  new SlashCommandBuilder16().setName("unlock").setDescription("Unlock a channel").addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)")),
  new SlashCommandBuilder16().setName("slowmode").setDescription("Set channel slowmode").addIntegerOption((o) => o.setName("seconds").setDescription("Seconds between messages (0 = off, max 21600)").setRequired(true).setMinValue(0).setMaxValue(21600)).addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)")),
  new SlashCommandBuilder16().setName("nick").setDescription("Change a member's nickname").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("nickname").setDescription("New nickname (blank to reset)")),
  new SlashCommandBuilder16().setName("group").setDescription("Group tools").addSubcommand((s) => s.setName("request").setDescription("Request to join the Roblox group").addStringOption((o) => o.setName("roblox_username").setDescription("Your Roblox username").setRequired(true)).addStringOption((o) => o.setName("note").setDescription("Anything staff should know")))
];
var owns17 = ["role", "ban", "kick", "mute", "unmute", "lock", "unlock", "slowmode", "nick", "group"];
async function setLock(channel, locked) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: locked ? false : null });
}
async function handleSlash16(interaction) {
  const g = interaction.guild;
  const name = interaction.commandName;
  if (name === "group") {
    const ch = await resolveChannel(g, cfg11(g.id).groupRequestChannel) || interaction.channel;
    const robloxName = interaction.options.getString("roblox_username");
    const note = interaction.options.getString("note");
    await ch.send(panel({
      guildId: g.id,
      kind: "default",
      title: "Group Request",
      body: `<@${interaction.user.id}> has requested to join the group.`,
      fields: [{ name: "Roblox Username", value: robloxName }, ...note ? [{ name: "Note", value: note }] : []],
      footer: branding(g.id).name || void 0
    }));
    return interaction.reply({ embeds: [okEmbed(`Group request submitted in ${ch}.`)], ephemeral: true });
  }
  if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed("Staff only.")], ephemeral: true });
  if (name === "lock" || name === "unlock") {
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    try {
      await setLock(ch, name === "lock");
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true });
    }
    modLog(g, `${ch} ${name === "lock" ? "locked" : "unlocked"} by ${interaction.user}.`);
    return interaction.reply({ embeds: [okEmbed(`${ch} ${name === "lock" ? "locked" : "unlocked"}.`)] });
  }
  if (name === "slowmode") {
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    const secs = interaction.options.getInteger("seconds");
    try {
      await ch.setRateLimitPerUser(secs);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true });
    }
    modLog(g, `Slowmode in ${ch} set to **${secs}s** by ${interaction.user}.`);
    return interaction.reply({ embeds: [okEmbed(secs ? `Slowmode in ${ch} set to **${secs}s**.` : `Slowmode in ${ch} disabled.`)] });
  }
  if (name === "nick") {
    const user2 = interaction.options.getUser("user");
    const member2 = await g.members.fetch(user2.id).catch(() => null);
    if (!member2) return interaction.reply({ embeds: [errEmbed("That user is not in the server.")], ephemeral: true });
    const nickname = interaction.options.getString("nickname") || null;
    try {
      await member2.setNickname(nickname);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed (check role hierarchy): ${e.message}`)], ephemeral: true });
    }
    modLog(g, `Nickname of ${user2} ${nickname ? `set to **${nickname}**` : "reset"} by ${interaction.user}.`);
    return interaction.reply({ embeds: [okEmbed(nickname ? `Nickname of ${user2} set to **${nickname}**.` : `Nickname of ${user2} reset.`)], ephemeral: true });
  }
  const user = interaction.options.getUser("user");
  const member = await g.members.fetch(user.id).catch(() => null);
  if (name === "role") {
    if (!member) return interaction.reply({ embeds: [errEmbed("That user is not in the server.")], ephemeral: true });
    const role = interaction.options.getRole("role");
    const action = interaction.options.getString("action") || "toggle";
    const has = member.roles.cache.has(role.id);
    const add = action === "add" ? true : action === "remove" ? false : !has;
    try {
      if (add) await member.roles.add(role);
      else await member.roles.remove(role);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed (check my role is above ${role}): ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`${add ? "Added" : "Removed"} ${role} ${add ? "to" : "from"} ${user}.`)], ephemeral: true });
  }
  const reason = interaction.options.getString("reason") || "No reason provided";
  if (name === "ban") {
    try {
      await g.members.ban(user.id, { reason, deleteMessageSeconds: (interaction.options.getInteger("delete_days") || 0) * 86400 });
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed to ban: ${e.message}`)], ephemeral: true });
    }
    modLog(g, `**Ban** \u2014 ${user} (${user.id}) by ${interaction.user}. Reason: ${reason}`);
    return interaction.reply({ embeds: [okEmbed(`Banned **${user.tag}** \u2014 ${reason}`)] });
  }
  if (name === "kick") {
    if (!member) return interaction.reply({ embeds: [errEmbed("That user is not in the server.")], ephemeral: true });
    try {
      await member.kick(reason);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed to kick: ${e.message}`)], ephemeral: true });
    }
    modLog(g, `**Kick** \u2014 ${user} (${user.id}) by ${interaction.user}. Reason: ${reason}`);
    return interaction.reply({ embeds: [okEmbed(`Kicked **${user.tag}** \u2014 ${reason}`)] });
  }
  if (name === "mute") {
    if (!member) return interaction.reply({ embeds: [errEmbed("That user is not in the server.")], ephemeral: true });
    const secs = parseDuration(interaction.options.getString("duration"));
    if (!secs || secs > 28 * 86400) return interaction.reply({ embeds: [errEmbed("Invalid duration (max 28d). Use e.g. `10m`, `2h`, `1d`.")], ephemeral: true });
    try {
      await member.timeout(secs * 1e3, reason);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed to mute: ${e.message}`)], ephemeral: true });
    }
    modLog(g, `**Mute** \u2014 ${user} (${user.id}) for ${interaction.options.getString("duration")} by ${interaction.user}. Reason: ${reason}`);
    return interaction.reply({ embeds: [okEmbed(`Muted **${user.tag}** for ${interaction.options.getString("duration")} \u2014 ${reason}`)] });
  }
  if (name === "unmute") {
    if (!member) return interaction.reply({ embeds: [errEmbed("That user is not in the server.")], ephemeral: true });
    try {
      await member.timeout(null);
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`Unmuted **${user.tag}**.`)] });
  }
}

// features/globalban.js
var globalban_exports = {};
__export(globalban_exports, {
  handleSlash: () => handleSlash17,
  init: () => init3,
  owns: () => owns18,
  slash: () => slash18
});
import { SlashCommandBuilder as SlashCommandBuilder17 } from "discord.js";
var GLOBAL_BAN_ROLES = csv(process.env.GLOBAL_BAN_ROLE_ID);
var clientRef2 = null;
function canGlobalBan(member) {
  if (isAdmin(member)) return true;
  return GLOBAL_BAN_ROLES.length > 0 && GLOBAL_BAN_ROLES.some((r) => member.roles.cache.has(r));
}
function init3(ctx) {
  clientRef2 = ctx.client;
  ctx.client.on("guildMemberAdd", (member) => {
    const ban = globalStore().bans.find((b) => b.userId === member.id);
    if (ban) member.guild.members.ban(member.id, { reason: `Global ban: ${ban.reason}` }).catch(() => {
    });
  });
}
var slash18 = [
  new SlashCommandBuilder17().setName("globalban").setDescription("Ban a user across every server this bot is in").addStringOption((o) => o.setName("user_id").setDescription("Discord user ID to ban").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  new SlashCommandBuilder17().setName("globalunban").setDescription("Lift a global ban everywhere").addStringOption((o) => o.setName("user_id").setDescription("Discord user ID").setRequired(true)),
  new SlashCommandBuilder17().setName("globalbans").setDescription("List active global bans")
];
var owns18 = ["globalban", "globalunban", "globalbans"];
async function handleSlash17(interaction) {
  if (!canGlobalBan(interaction.member)) return interaction.reply({ embeds: [errEmbed("You are not authorized to use global bans.")], ephemeral: true });
  const name = interaction.commandName;
  const store = globalStore();
  if (name === "globalbans") {
    const lines = store.bans.map((b) => `\u2022 <@${b.userId}> (\`${b.userId}\`) \u2014 ${b.reason} \xB7 by <@${b.by}>`);
    return interaction.reply({ embeds: [listEmbed(`Global Bans \u2014 ${store.bans.length}`, lines, { empty: "No global bans." })], ephemeral: true });
  }
  const userId = interaction.options.getString("user_id").trim();
  if (!/^\d{15,20}$/.test(userId)) return interaction.reply({ embeds: [errEmbed("Enter a valid Discord user ID (numbers only).")], ephemeral: true });
  if (name === "globalban") {
    const reason = interaction.options.getString("reason");
    if (store.bans.some((b) => b.userId === userId)) return interaction.reply({ embeds: [errEmbed("That user is already globally banned.")], ephemeral: true });
    store.bans.push({ userId, reason, by: interaction.user.id, ts: now() });
    persist();
    await interaction.deferReply({ ephemeral: true });
    let ok2 = 0, fail = 0;
    for (const g of clientRef2.guilds.cache.values()) {
      try {
        await g.members.ban(userId, { reason: `Global ban by ${interaction.user.tag}: ${reason}` });
        ok2++;
      } catch {
        fail++;
      }
    }
    return interaction.editReply({ embeds: [okEmbed(`Globally banned <@${userId}> across **${ok2}** server(s)${fail ? ` \u2014 ${fail} failed (missing Ban permission, or already banned).` : "."}`)] });
  }
  const idx = store.bans.findIndex((b) => b.userId === userId);
  if (idx === -1) return interaction.reply({ embeds: [errEmbed("That user is not globally banned.")], ephemeral: true });
  store.bans.splice(idx, 1);
  persist();
  await interaction.deferReply({ ephemeral: true });
  let ok = 0;
  for (const g of clientRef2.guilds.cache.values()) {
    try {
      await g.bans.remove(userId, "Global unban");
      ok++;
    } catch {
    }
  }
  return interaction.editReply({ embeds: [okEmbed(`Lifted global ban for <@${userId}> across **${ok}** server(s).`)] });
}

// features/verify.js
var verify_exports = {};
__export(verify_exports, {
  componentNs: () => componentNs8,
  handleComponent: () => handleComponent8,
  handleSlash: () => handleSlash18,
  owns: () => owns19,
  slash: () => slash19
});
import { SlashCommandBuilder as SlashCommandBuilder18, ButtonBuilder as ButtonBuilder7, ButtonStyle as ButtonStyle7 } from "discord.js";
var cfg12 = (gid) => guild(gid).config;
function verifyPanel(gid) {
  const b = branding(gid);
  const emoji = b.emoji ? `${b.emoji} ` : "";
  const name = b.name || "the server";
  const body = cfg12(gid).verifyText || `${emoji}Welcome to **${name}**! To gain access to the rest of the server, click the **Verify** button below. By verifying you agree to follow our rules and guidelines.`;
  return panel({
    guildId: gid,
    kind: "verify",
    title: "Verification",
    body,
    footer: b.name || void 0,
    buttons: [new ButtonBuilder7().setCustomId("verify:go").setLabel("Verify").setStyle(ButtonStyle7.Success)]
  });
}
var slash19 = [
  new SlashCommandBuilder18().setName("verify").setDescription("Verification system").addSubcommand((s) => s.setName("setup").setDescription("Post the verification panel").addRoleOption((o) => o.setName("role").setDescription("Role granted on verify (e.g. @Florida Member)").setRequired(true)).addChannelOption((o) => o.setName("channel").setDescription("Channel to post the panel in (default: here)")).addStringOption((o) => o.setName("text").setDescription("Custom panel text (optional)")).addStringOption((o) => o.setName("banner").setDescription("Banner image URL shown at the top of the panel"))).addSubcommand((s) => s.setName("role").setDescription("Change the role granted on verify").addRoleOption((o) => o.setName("role").setDescription("Role (e.g. @Florida Member)").setRequired(true))).addSubcommand((s) => s.setName("stats").setDescription("See how many members have verified"))
];
var owns19 = ["verify"];
var componentNs8 = ["verify"];
async function handleSlash18(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  if (sub === "setup") {
    const role2 = interaction.options.getRole("role");
    if (role2.position >= g.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errEmbed(`I can't assign ${role2} \u2014 move my bot role **above** it in Server Settings \u2192 Roles, then re-run.`)], ephemeral: true });
    }
    cfg12(g.id).verifyRole = role2.id;
    const text = interaction.options.getString("text");
    if (text) cfg12(g.id).verifyText = text;
    const bannerUrl = interaction.options.getString("banner");
    if (bannerUrl && /^https?:\/\//i.test(bannerUrl)) {
      const b = cfg12(g.id).branding ||= {};
      (b.banners ||= {}).verify = bannerUrl;
    }
    persist();
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    try {
      await ch.send(verifyPanel(g.id));
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Couldn't post in ${ch}: ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`Verification panel posted in ${ch}. Verifying grants ${role2}.`)], ephemeral: true });
  }
  if (sub === "role") {
    const role2 = interaction.options.getRole("role");
    if (role2.position >= g.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errEmbed(`I can't assign ${role2} \u2014 move my bot role above it first.`)], ephemeral: true });
    }
    cfg12(g.id).verifyRole = role2.id;
    persist();
    return interaction.reply({ embeds: [okEmbed(`Verify role set to ${role2}.`)], ephemeral: true });
  }
  const rid = cfg12(g.id).verifyRole;
  if (!rid) return interaction.reply({ embeds: [errEmbed("No verify role configured. Run `/verify setup` first.")], ephemeral: true });
  await g.members.fetch().catch(() => {
  });
  const role = g.roles.cache.get(rid);
  const count = role ? role.members.size : 0;
  return interaction.reply({ embeds: [okEmbed(`**${count}** member(s) hold ${role ?? "the verify role"} out of **${g.memberCount}** total.`)], ephemeral: true });
}
async function handleComponent8(interaction) {
  const g = interaction.guild;
  const rid = cfg12(g.id).verifyRole;
  const role = rid && g.roles.cache.get(rid);
  if (!role) return interaction.reply({ embeds: [errEmbed("Verification is not configured \u2014 ask staff to run `/verify setup`.")], ephemeral: true });
  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({ embeds: [okEmbed("You are already verified.")], ephemeral: true });
  }
  try {
    await interaction.member.roles.add(role, "Verified via verification panel");
  } catch {
    return interaction.reply({ embeds: [errEmbed("I could not assign the role \u2014 staff: check my bot role sits above the verify role.")], ephemeral: true });
  }
  const name = branding(g.id).name || g.name;
  return interaction.reply({ embeds: [okEmbed(`You have been verified \u2014 welcome to **${name}**!`)], ephemeral: true });
}

// features/status.js
var status_exports = {};
__export(status_exports, {
  handleSlash: () => handleSlash19,
  init: () => init4,
  owns: () => owns20,
  slash: () => slash20
});
import { SlashCommandBuilder as SlashCommandBuilder19, ButtonBuilder as ButtonBuilder8, ButtonStyle as ButtonStyle8 } from "discord.js";
var cfg13 = (gid) => guild(gid).config;
var timers2 = /* @__PURE__ */ new Map();
var clientRef3 = null;
async function buildStatusPanel(gid) {
  let s = null;
  try {
    s = await getServerInfo();
  } catch {
  }
  const b = branding(gid);
  const fields = [];
  let body;
  if (s) {
    const ownerName = await getRobloxUsername(s.OwnerId);
    body = `> Live status for **${s.Name ?? b.name ?? "the server"}** \u2014 updates automatically.`;
    fields.push(
      { name: "Players", value: `${s.CurrentPlayers ?? "?"}/${s.MaxPlayers ?? "?"}` },
      { name: "In Queue", value: `${s.Queue ?? 0}` },
      { name: "Owner", value: ownerName },
      { name: "Server Code", value: s.JoinKey ? `\`${s.JoinKey}\`` : "\u2014" }
    );
  } else {
    body = "> Could not reach the ER:LC API \u2014 the server may be offline or the key/IP not authorized.";
  }
  fields.push({ name: "Last updated", value: ts(now()) });
  const url = b.joinUrl || (s?.JoinKey ? `https://policeroleplay.community/join?code=${s.JoinKey}` : "");
  const btn = /^https?:\/\//i.test(url) ? [new ButtonBuilder8().setStyle(ButtonStyle8.Link).setLabel("Join Server").setURL(url)] : void 0;
  return panel({
    guildId: gid,
    kind: "status",
    title: "Live Server Status",
    body,
    fields,
    buttons: btn,
    footer: b.name || void 0
  });
}
async function tick(gid) {
  const sp = cfg13(gid).statusPanel;
  if (!sp || !clientRef3) return;
  const g = clientRef3.guilds.cache.get(gid);
  if (!g) return;
  const ch = g.channels.cache.get(sp.channelId) || await g.channels.fetch(sp.channelId).catch(() => null);
  if (!ch) return;
  const payload = await buildStatusPanel(gid);
  const msg = await ch.messages.fetch(sp.messageId).catch(() => null);
  if (msg) {
    await msg.edit(payload).catch(() => {
    });
  } else {
    const fresh = await ch.send(payload).catch(() => null);
    if (fresh) {
      sp.messageId = fresh.id;
      persist();
    }
  }
}
function schedule2(gid) {
  clearInterval(timers2.get(gid));
  const sp = cfg13(gid).statusPanel;
  if (!sp) return;
  timers2.set(gid, setInterval(() => tick(gid).catch(() => {
  }), Math.max(2, sp.interval || 5) * 60 * 1e3));
}
function init4(ctx) {
  clientRef3 = ctx.client;
  for (const gid of Object.keys(ctx.allGuilds())) {
    if (cfg13(gid).statusPanel) {
      schedule2(gid);
      tick(gid).catch(() => {
      });
    }
  }
}
var slash20 = [
  new SlashCommandBuilder19().setName("erlc-status").setDescription("Auto-updating live server status panel").addSubcommand((s) => s.setName("start").setDescription("Post a live status panel that refreshes automatically").addChannelOption((o) => o.setName("channel").setDescription("Channel for the panel (default: here)")).addIntegerOption((o) => o.setName("interval").setDescription("Refresh interval in minutes (default 5, min 2)").setMinValue(2).setMaxValue(60))).addSubcommand((s) => s.setName("stop").setDescription("Stop and forget the live status panel"))
];
var owns20 = ["erlc-status"];
async function handleSlash19(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  if (sub === "stop") {
    clearInterval(timers2.get(g.id));
    timers2.delete(g.id);
    delete cfg13(g.id).statusPanel;
    persist();
    return interaction.reply({ embeds: [okEmbed("Live status panel stopped. (You can delete the old message.)")], ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  const ch = interaction.options.getChannel("channel") || interaction.channel;
  const interval = interaction.options.getInteger("interval") || 5;
  const msg = await ch.send(await buildStatusPanel(g.id)).catch(() => null);
  if (!msg) return interaction.editReply({ embeds: [errEmbed(`Couldn't post in ${ch} \u2014 check my permissions there.`)] });
  cfg13(g.id).statusPanel = { channelId: ch.id, messageId: msg.id, interval };
  persist();
  schedule2(g.id);
  return interaction.editReply({ embeds: [okEmbed(`Live status panel posted in ${ch} \u2014 refreshes every **${interval} min**.`)] });
}

// features/utility.js
var utility_exports = {};
__export(utility_exports, {
  componentNs: () => componentNs9,
  handleComponent: () => handleComponent9,
  handleSlash: () => handleSlash20,
  init: () => init5,
  owns: () => owns21,
  slash: () => slash21
});
import { SlashCommandBuilder as SlashCommandBuilder20, ButtonBuilder as ButtonBuilder9, ButtonStyle as ButtonStyle9, EmbedBuilder as EmbedBuilder4, version as djsVersion } from "discord.js";
var clientRef4 = null;
var reminderTimers = /* @__PURE__ */ new Map();
var polls = (gid) => guild(gid).polls ||= {};
function pollButtons(rec) {
  return rec.options.map((o, i) => new ButtonBuilder9().setCustomId(`poll:${i}`).setLabel(`${o.label} (${o.voters.length})`).setStyle(ButtonStyle9.Secondary));
}
function pollPayload(gid, rec) {
  const total = rec.options.reduce((a, o) => a + o.voters.length, 0);
  return panel({
    guildId: gid,
    kind: "default",
    title: `Poll: ${rec.question}`,
    body: `Cast your vote below \u2014 click again to change it.

**${total}** vote(s) so far.`,
    buttons: pollButtons(rec),
    footer: `Started by ${rec.by}`
  });
}
function scheduleReminder(rec) {
  const ms = Math.max(0, (rec.at - now()) * 1e3);
  if (ms > 20 * 86400 * 1e3) return;
  reminderTimers.set(rec.id, setTimeout(() => fireReminder(rec).catch(() => {
  }), ms));
}
async function fireReminder(rec) {
  reminderTimers.delete(rec.id);
  const store = globalStore();
  store.reminders = (store.reminders || []).filter((r) => r.id !== rec.id);
  persist();
  const user = await clientRef4.users.fetch(rec.userId).catch(() => null);
  const text = `\u23F0 Reminder: ${rec.text}`;
  if (user) {
    const ok = await user.send(text).then(() => true).catch(() => false);
    if (ok) return;
  }
  const ch = await clientRef4.channels.fetch(rec.channelId).catch(() => null);
  if (ch) ch.send(`<@${rec.userId}> ${text}`).catch(() => {
  });
}
function init5(ctx) {
  clientRef4 = ctx.client;
  const store = globalStore();
  for (const rec of store.reminders || []) scheduleReminder(rec);
}
var slash21 = [
  new SlashCommandBuilder20().setName("poll").setDescription("Start a button poll").addStringOption((o) => o.setName("question").setDescription("The question").setRequired(true)).addStringOption((o) => o.setName("option1").setDescription("Option 1").setRequired(true)).addStringOption((o) => o.setName("option2").setDescription("Option 2").setRequired(true)).addStringOption((o) => o.setName("option3").setDescription("Option 3")).addStringOption((o) => o.setName("option4").setDescription("Option 4")),
  new SlashCommandBuilder20().setName("remind").setDescription("Set a reminder (DMed to you)").addStringOption((o) => o.setName("in").setDescription("When, e.g. 10m, 2h, 1d (max 14d)").setRequired(true)).addStringOption((o) => o.setName("text").setDescription("What to remind you about").setRequired(true)),
  new SlashCommandBuilder20().setName("userinfo").setDescription("Info about a member").addUserOption((o) => o.setName("user").setDescription("Member (default: you)")),
  new SlashCommandBuilder20().setName("serverinfo").setDescription("Info about this server"),
  new SlashCommandBuilder20().setName("avatar").setDescription("Show a user's avatar full-size").addUserOption((o) => o.setName("user").setDescription("User (default: you)")),
  new SlashCommandBuilder20().setName("botinfo").setDescription("Bot stats: uptime, servers, ping")
];
var owns21 = ["poll", "remind", "userinfo", "serverinfo", "avatar", "botinfo"];
var componentNs9 = ["poll"];
var fmtUptime = (secs) => {
  const d = Math.floor(secs / 86400), h = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60;
  return `${d ? d + "d " : ""}${h}h ${m}m`;
};
async function handleSlash20(interaction) {
  const g = interaction.guild;
  const name = interaction.commandName;
  if (name === "poll") {
    const question = interaction.options.getString("question");
    const opts = ["option1", "option2", "option3", "option4"].map((k) => interaction.options.getString(k)).filter(Boolean);
    const rec = { question, by: interaction.user.tag, options: opts.map((label) => ({ label: label.slice(0, 60), voters: [] })) };
    await interaction.deferReply({ ephemeral: true });
    const msg = await interaction.channel.send(pollPayload(g.id, rec)).catch(() => null);
    if (!msg) return interaction.editReply({ embeds: [errEmbed("Couldn't post the poll here.")] });
    polls(g.id)[msg.id] = rec;
    persist();
    return interaction.editReply({ embeds: [okEmbed("Poll posted.")] });
  }
  if (name === "remind") {
    const secs = parseDuration(interaction.options.getString("in"));
    if (!secs || secs > 14 * 86400) return interaction.reply({ embeds: [errEmbed("Invalid time (max 14d). Use e.g. `10m`, `2h`, `1d`.")], ephemeral: true });
    const store = globalStore();
    store.reminders ||= [];
    const rec = {
      id: `${interaction.user.id}-${Date.now()}`,
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      text: interaction.options.getString("text"),
      at: now() + secs
    };
    store.reminders.push(rec);
    persist();
    scheduleReminder(rec);
    return interaction.reply({ embeds: [okEmbed(`I'll remind you ${ts(rec.at)}: ${rec.text}`)], ephemeral: true });
  }
  if (name === "userinfo") {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await g.members.fetch(user.id).catch(() => null);
    const infractions = guild(g.id).infractions.filter((r) => r.userId === user.id).length;
    const e = new EmbedBuilder4().setColor(COLOR).setTitle(user.tag).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields(
      { name: "User ID", value: user.id, inline: true },
      { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1e3)}:R>`, inline: true },
      ...member ? [
        { name: "Joined server", value: `<t:${Math.floor(member.joinedTimestamp / 1e3)}:R>`, inline: true },
        { name: "Roles", value: member.roles.cache.filter((r) => r.id !== g.id).map((r) => `${r}`).slice(0, 10).join(" ") || "\u2014" }
      ] : [],
      { name: "Infractions", value: `${infractions}`, inline: true }
    );
    return interaction.reply({ embeds: [e] });
  }
  if (name === "serverinfo") {
    const owner = await g.fetchOwner().catch(() => null);
    const e = new EmbedBuilder4().setColor(COLOR).setTitle(g.name).setThumbnail(g.iconURL({ size: 256 })).addFields(
      { name: "Members", value: `${g.memberCount}`, inline: true },
      { name: "Boosts", value: `${g.premiumSubscriptionCount ?? 0}`, inline: true },
      { name: "Owner", value: owner ? `${owner.user}` : "\u2014", inline: true },
      { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
      { name: "Roles", value: `${g.roles.cache.size}`, inline: true },
      { name: "Created", value: `<t:${Math.floor(g.createdTimestamp / 1e3)}:R>`, inline: true }
    );
    return interaction.reply({ embeds: [e] });
  }
  if (name === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    return interaction.reply({ embeds: [infoEmbed(`${user.tag} \u2014 Avatar`).setImage(user.displayAvatarURL({ size: 1024 }))] });
  }
  if (name === "botinfo") {
    const totalMembers = interaction.client.guilds.cache.reduce((a, x) => a + (x.memberCount || 0), 0);
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    return interaction.reply({ embeds: [infoEmbed("Bot Info").addFields(
      { name: "Uptime", value: fmtUptime(process.uptime()), inline: true },
      { name: "Servers", value: `${interaction.client.guilds.cache.size}`, inline: true },
      { name: "Members", value: `${totalMembers}`, inline: true },
      { name: "Ping", value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
      { name: "Memory", value: `${mem} MB`, inline: true },
      { name: "discord.js", value: `v${djsVersion}`, inline: true }
    )] });
  }
}
async function handleComponent9(interaction) {
  const idx = parseInt(interaction.customId.split(":")[1], 10);
  const rec = polls(interaction.guild.id)[interaction.message.id];
  if (!rec || !rec.options[idx]) return interaction.reply({ embeds: [errEmbed("This poll is no longer tracked.")], ephemeral: true });
  const uid = interaction.user.id;
  const had = rec.options[idx].voters.includes(uid);
  for (const o of rec.options) o.voters = o.voters.filter((v) => v !== uid);
  if (!had) rec.options[idx].voters.push(uid);
  persist();
  return interaction.update(pollPayload(interaction.guild.id, rec));
}

// features/applications.js
var applications_exports = {};
__export(applications_exports, {
  componentNs: () => componentNs10,
  handleComponent: () => handleComponent10,
  handleSlash: () => handleSlash21,
  owns: () => owns22,
  slash: () => slash22
});
import {
  SlashCommandBuilder as SlashCommandBuilder21,
  ButtonBuilder as ButtonBuilder10,
  ButtonStyle as ButtonStyle10,
  ActionRowBuilder as ActionRowBuilder9,
  EmbedBuilder as EmbedBuilder5
} from "discord.js";
var apps = (gid) => guild(gid).applications ||= {};
var subs = (gid) => guild(gid).appSubmissions ||= {};
var activeSessions = /* @__PURE__ */ new Map();
var slugify3 = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "app";
var MAX_QUESTIONS = 20;
var ANSWER_TIME = 15 * 60 * 1e3;
function defaultBody(gid, name) {
  const b = branding(gid);
  const emoji = b.emoji ? `${b.emoji} ` : "";
  return `> If you're interested in becoming a **${name}** for ${emoji}**${b.name || "our server"}**, please click the button below to begin your application.

> Make sure you provide accurate and complete information. All applications are reviewed by the high-ranking team. You will be notified of the outcome via DM.

> Trolling or submitting false information will result in a permanent blacklist.`;
}
function appPanel(gid, app) {
  return panel({
    guildId: gid,
    kind: "applications",
    bannerUrl: app.bannerUrl || void 0,
    title: app.title || "Applications",
    body: app.body || defaultBody(gid, app.name),
    footer: branding(gid).name || void 0,
    buttons: [new ButtonBuilder10().setCustomId(`app:${app.id}`).setLabel(app.buttonLabel || `Apply for ${app.name}`).setStyle(ButtonStyle10.Primary).setDisabled(app.open === false)]
  });
}
var reviewRow2 = (disabled = false) => new ActionRowBuilder9().addComponents(
  new ButtonBuilder10().setCustomId("appreview:accept").setLabel("Accept").setStyle(ButtonStyle10.Success).setDisabled(disabled),
  new ButtonBuilder10().setCustomId("appreview:deny").setLabel("Deny").setStyle(ButtonStyle10.Danger).setDisabled(disabled)
);
function submissionEmbed(app, user, answers, status) {
  const e = new EmbedBuilder5().setColor(status === "accepted" ? OK_COLOR : status === "denied" ? ERROR_COLOR : COLOR).setTitle(`${app.name} Application`).setDescription(`Applicant: ${user} (\`${user.id ?? user}\`)`).setTimestamp();
  app.questions.forEach((q, i) => {
    e.addFields({ name: `${i + 1}. ${q}`.slice(0, 256), value: (answers[i] || "\u2014").slice(0, 1024) });
  });
  if (status) e.addFields({ name: "Status", value: status === "accepted" ? "Accepted" : "Denied" });
  return e;
}
async function runApplication(interaction, app) {
  const user = interaction.user;
  const g = interaction.guild;
  activeSessions.set(user.id, true);
  try {
    const dm = await user.createDM();
    await dm.send({ embeds: [infoEmbed(
      `${app.name} Application \u2014 ${branding(g.id).name || g.name}`,
      `You're starting the **${app.name}** application (**${app.questions.length}** questions).
Answer each question in a single message. You have 15 minutes per question.
Type \`cancel\` at any time to abort.`
    )] });
    const answers = [];
    for (let i = 0; i < app.questions.length; i++) {
      await dm.send({ embeds: [infoEmbed(`Question ${i + 1} of ${app.questions.length}`, app.questions[i])] });
      const collected = await dm.awaitMessages({
        max: 1,
        time: ANSWER_TIME,
        errors: ["time"],
        filter: (m) => m.author.id === user.id
      }).catch(() => null);
      if (!collected) {
        await dm.send({ embeds: [errEmbed("Application timed out (no answer in 15 minutes). Run it again from the panel when ready.")] }).catch(() => {
        });
        return;
      }
      const ans = collected.first().content.trim();
      if (ans.toLowerCase() === "cancel") {
        await dm.send({ embeds: [okEmbed("Application cancelled. You can restart it from the panel any time.")] }).catch(() => {
        });
        return;
      }
      answers.push(ans.slice(0, 1024));
    }
    const ch = g.channels.cache.get(app.resultsChannel) || await g.channels.fetch(app.resultsChannel).catch(() => null);
    if (!ch) {
      await dm.send({ embeds: [errEmbed("Your answers could not be delivered (review channel missing). Please contact staff.")] }).catch(() => {
      });
      return;
    }
    const msg = await ch.send({ embeds: [submissionEmbed(app, user, answers)], components: [reviewRow2()] });
    subs(g.id)[msg.id] = { userId: user.id, appId: app.id, answers, ts: Date.now() };
    persist();
    await dm.send({ embeds: [okEmbed(`Your **${app.name}** application has been submitted. The team will review it and you'll hear back via DM.`)] }).catch(() => {
    });
  } catch (e) {
    console.error("application flow error:", e.message);
  } finally {
    activeSessions.delete(user.id);
  }
}
var slash22 = [
  new SlashCommandBuilder21().setName("application").setDescription("Application system").addSubcommand((s) => s.setName("create").setDescription("Create an application type").addStringOption((o) => o.setName("name").setDescription("e.g. Staff, HR, Trainer").setRequired(true)).addChannelOption((o) => o.setName("results_channel").setDescription("Where finished applications are sent").setRequired(true)).addStringOption((o) => o.setName("questions").setDescription("Questions separated by | (you can add more later)")).addStringOption((o) => o.setName("title").setDescription("Panel title (default: Applications)")).addStringOption((o) => o.setName("description").setDescription("Panel text (default: standard application notice)")).addStringOption((o) => o.setName("banner").setDescription("Banner image URL")).addStringOption((o) => o.setName("button_label").setDescription("Button text (default: Apply for <name>)"))).addSubcommand((s) => s.setName("edit").setDescription("Edit an application type").addStringOption((o) => o.setName("application").setDescription("Application id (see /application list)").setRequired(true)).addStringOption((o) => o.setName("name").setDescription("New name")).addChannelOption((o) => o.setName("results_channel").setDescription("New results channel")).addStringOption((o) => o.setName("title").setDescription("New panel title")).addStringOption((o) => o.setName("description").setDescription("New panel text")).addStringOption((o) => o.setName("banner").setDescription('New banner URL ("none" to clear)')).addStringOption((o) => o.setName("button_label").setDescription("New button text"))).addSubcommand((s) => s.setName("add-question").setDescription("Add a question").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true)).addStringOption((o) => o.setName("question").setDescription("The question").setRequired(true))).addSubcommand((s) => s.setName("remove-question").setDescription("Remove a question by number").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true)).addIntegerOption((o) => o.setName("number").setDescription("Question number (see /application questions)").setRequired(true).setMinValue(1))).addSubcommand((s) => s.setName("questions").setDescription("List an application's questions").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true))).addSubcommand((s) => s.setName("post").setDescription("Post the application panel").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true)).addChannelOption((o) => o.setName("channel").setDescription("Channel (default: here)"))).addSubcommand((s) => s.setName("toggle").setDescription("Open/close an application (closed = button disabled)").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true))).addSubcommand((s) => s.setName("list").setDescription("List application types")).addSubcommand((s) => s.setName("delete").setDescription("Delete an application type").addStringOption((o) => o.setName("application").setDescription("Application id").setRequired(true)))
];
var owns22 = ["application"];
var componentNs10 = ["app", "appreview"];
async function handleSlash21(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Staff only.")], ephemeral: true });
  const g = interaction.guild;
  const sub = interaction.options.getSubcommand();
  const all = apps(g.id);
  if (sub === "create") {
    const name = interaction.options.getString("name");
    let id = slugify3(name), n = 1;
    while (all[id]) id = `${slugify3(name)}-${++n}`;
    const questions = (interaction.options.getString("questions") || "").split("|").map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUESTIONS);
    all[id] = {
      id,
      name,
      resultsChannel: interaction.options.getChannel("results_channel").id,
      title: interaction.options.getString("title") || "",
      body: interaction.options.getString("description") || "",
      bannerUrl: interaction.options.getString("banner") || "",
      buttonLabel: interaction.options.getString("button_label") || "",
      questions,
      open: true
    };
    persist();
    return interaction.reply({ embeds: [okEmbed(
      `Application **${name}** created (id \`${id}\`) with **${questions.length}** question(s).
` + (questions.length ? "" : "Add questions with `/application add-question`, then ") + `post it with \`/application post application:${id}\`.`
    )], ephemeral: true });
  }
  if (sub === "list") {
    const lines = Object.values(all).map((a) => `**\`${a.id}\`** \u2014 ${a.name} \xB7 ${a.questions.length} question(s) \xB7 results \u2192 <#${a.resultsChannel}> \xB7 ${a.open === false ? "CLOSED" : "open"}`);
    return interaction.reply({ embeds: [listEmbed("Application Types", lines, { empty: "None yet \u2014 `/application create`." })], ephemeral: true });
  }
  const app = all[interaction.options.getString("application")];
  if (!app) return interaction.reply({ embeds: [errEmbed("No application with that id. See `/application list`.")], ephemeral: true });
  if (sub === "edit") {
    const set = (k, v) => {
      if (v !== null && v !== void 0) app[k] = v === "none" ? "" : v;
    };
    set("name", interaction.options.getString("name"));
    set("title", interaction.options.getString("title"));
    set("body", interaction.options.getString("description"));
    set("bannerUrl", interaction.options.getString("banner"));
    set("buttonLabel", interaction.options.getString("button_label"));
    const rc = interaction.options.getChannel("results_channel");
    if (rc) app.resultsChannel = rc.id;
    persist();
    return interaction.reply({ embeds: [okEmbed(`Updated **${app.name}**. Re-run \`/application post\` to refresh the panel.`)], ephemeral: true });
  }
  if (sub === "add-question") {
    if (app.questions.length >= MAX_QUESTIONS) return interaction.reply({ embeds: [errEmbed(`Max ${MAX_QUESTIONS} questions.`)], ephemeral: true });
    app.questions.push(interaction.options.getString("question"));
    persist();
    return interaction.reply({ embeds: [okEmbed(`Question **${app.questions.length}** added to **${app.name}**.`)], ephemeral: true });
  }
  if (sub === "remove-question") {
    const i = interaction.options.getInteger("number") - 1;
    if (!app.questions[i]) return interaction.reply({ embeds: [errEmbed("No question with that number.")], ephemeral: true });
    const [removed] = app.questions.splice(i, 1);
    persist();
    return interaction.reply({ embeds: [okEmbed(`Removed question: "${removed.slice(0, 100)}"`)], ephemeral: true });
  }
  if (sub === "questions") {
    const lines = app.questions.map((q, i) => `**${i + 1}.** ${q}`);
    return interaction.reply({ embeds: [listEmbed(`${app.name} \u2014 Questions (${lines.length})`, lines, { empty: "No questions yet." })], ephemeral: true });
  }
  if (sub === "post") {
    if (!app.questions.length) return interaction.reply({ embeds: [errEmbed("Add at least one question before posting the panel.")], ephemeral: true });
    const ch = interaction.options.getChannel("channel") || interaction.channel;
    try {
      await ch.send(appPanel(g.id, app));
    } catch (e) {
      return interaction.reply({ embeds: [errEmbed(`Couldn't post in ${ch}: ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`Application panel for **${app.name}** posted in ${ch}.`)], ephemeral: true });
  }
  if (sub === "toggle") {
    app.open = app.open === false;
    persist();
    return interaction.reply({ embeds: [okEmbed(`**${app.name}** is now **${app.open ? "OPEN" : "CLOSED"}**. Re-run \`/application post\` to refresh the panel button.`)], ephemeral: true });
  }
  if (sub === "delete") {
    delete all[app.id];
    persist();
    return interaction.reply({ embeds: [okEmbed(`Deleted application **${app.name}**.`)], ephemeral: true });
  }
}
async function handleComponent10(interaction) {
  const [ns, arg] = interaction.customId.split(":");
  const g = interaction.guild;
  if (ns === "app") {
    const app2 = apps(g.id)[arg];
    if (!app2 || app2.open === false) return interaction.reply({ embeds: [errEmbed("This application is currently closed.")], ephemeral: true });
    if (!app2.questions.length) return interaction.reply({ embeds: [errEmbed("This application has no questions configured.")], ephemeral: true });
    if (activeSessions.has(interaction.user.id)) return interaction.reply({ embeds: [errEmbed("Finish your current application first (check your DMs).")], ephemeral: true });
    const dm = await interaction.user.createDM().catch(() => null);
    const probe = dm && await dm.send({ embeds: [okEmbed(`Starting your **${app2.name}** application\u2026`)] }).then(() => true).catch(() => false);
    if (!probe) return interaction.reply({ embeds: [errEmbed("I couldn't DM you. Enable **Direct Messages** from server members (Privacy Settings) and try again.")], ephemeral: true });
    await interaction.reply({ embeds: [okEmbed("Check your DMs \u2014 your application has started.")], ephemeral: true });
    runApplication(interaction, app2);
    return;
  }
  if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed("Only staff can review applications.")], ephemeral: true });
  const rec = subs(g.id)[interaction.message.id];
  if (!rec) return interaction.reply({ embeds: [errEmbed("This submission is no longer tracked.")], ephemeral: true });
  const app = apps(g.id)[rec.appId] || { name: "Application", questions: [] };
  const accepted = arg === "accept";
  const user = await interaction.client.users.fetch(rec.userId).catch(() => null);
  const e = submissionEmbed(app, user || `<@${rec.userId}>`, rec.answers, accepted ? "accepted" : "denied").addFields({ name: "Reviewed by", value: `${interaction.user}` });
  await interaction.update({ embeds: [e], components: [reviewRow2(true)] });
  if (user) {
    const b = branding(g.id);
    await user.send(
      accepted ? `Congratulations! Your **${app.name}** application in **${b.name || g.name}** has been **accepted**. A team member will follow up with next steps.` : `Thank you for applying. Unfortunately your **${app.name}** application in **${b.name || g.name}** has been **denied**. You may re-apply in the future.`
    ).catch(() => {
    });
  }
  delete subs(g.id)[interaction.message.id];
  persist();
}

// bot.js
var MODULES = [erlc_exports, sessions_exports, giveaways_exports, infractions_exports, promotions_exports, tickets_exports, afk_exports, reviews_exports, training_exports, suggestions_exports, roleplay_exports, misc_exports, setup_exports, dashboard_exports, welcome_exports, media_exports, moderation_exports, globalban_exports, verify_exports, status_exports, utility_exports, applications_exports];
var { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("\u2717 DISCORD_TOKEN and CLIENT_ID are required in .env");
  process.exit(1);
}
var slashByName = /* @__PURE__ */ new Map();
var prefixByCmd = /* @__PURE__ */ new Map();
var componentByNs = /* @__PURE__ */ new Map();
var messageHooks = [];
var commandJSON = [];
for (const m of MODULES) {
  for (const name of m.owns || []) slashByName.set(name, m);
  for (const cmd of m.prefixOwns || []) prefixByCmd.set(cmd, m);
  for (const ns of m.componentNs || []) componentByNs.set(ns, m);
  if (typeof m.onMessage === "function") messageHooks.push(m);
  for (const b of m.slash || []) commandJSON.push(b.toJSON());
}
var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // privileged — enable in portal
    GatewayIntentBits.GuildMembers,
    // privileged — enable in portal
    GatewayIntentBits.DirectMessages
    // application answers arrive via DM
  ],
  partials: [Partials.Channel, Partials.Message]
});
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const m = slashByName.get(interaction.commandName);
      if (m) return await m.handleSlash(interaction);
    } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      const ns = interaction.customId.split(":")[0];
      const m = componentByNs.get(ns);
      if (m?.handleComponent) return await m.handleComponent(interaction);
    }
  } catch (err) {
    console.error("Interaction error:", err);
    const payload = { embeds: [errEmbed(err.message || "Something went wrong.")], ephemeral: true };
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) interaction.editReply(payload).catch(() => {
      });
      else interaction.reply(payload).catch(() => {
      });
    }
  }
});
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  for (const m2 of messageHooks) m2.onMessage(message).catch?.(() => {
  });
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();
  const m = prefixByCmd.get(cmd);
  if (!m?.handlePrefix) return;
  try {
    await m.handlePrefix(cmd, message, args, args.join(" "));
  } catch (err) {
    console.error("Prefix error:", err);
    message.reply({ embeds: [errEmbed(err.message || "Something went wrong.")] }).catch(() => {
    });
  }
});
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const guildIds = (GUILD_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (guildIds.length) {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }).then(() => console.log("\u2713 Cleared global commands (guild mode)")).catch(() => {
    });
    for (const gid of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commandJSON });
        console.log(`\u2713 Registered ${commandJSON.length} guild commands to ${gid}`);
      } catch (e) {
        console.error(`\u2717 Failed to register to guild ${gid}: ${e.message} (is the bot in that server?)`);
      }
    }
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandJSON });
    console.log(`\u2713 Registered ${commandJSON.length} global commands (may take up to 1h to appear)`);
  }
}
async function logPublicIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=text");
    const ip = (await res.text()).trim();
    console.log(`\u{1F310} Outbound IP: ${ip}  \u2192 allowlist this at https://api.erlc.gg/server-owners`);
  } catch {
  }
}
function updatePresence(c) {
  const total = c.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
  c.user.setActivity(`Watching over ${total.toLocaleString("en-US")} members`, { type: ActivityType.Custom });
}
client.once(Events.ClientReady, (c) => {
  const ctx = { client: c, allGuilds };
  for (const m of MODULES) if (typeof m.init === "function") {
    try {
      m.init(ctx);
    } catch (e) {
      console.error("init error:", e);
    }
  }
  console.log(`\u{1F916} Logged in as ${c.user.tag} \u2014 ${MODULES.length} feature modules, ${commandJSON.length} commands.`);
  logPublicIp();
  updatePresence(c);
  setInterval(() => updatePresence(c), 10 * 60 * 1e3);
});
client.on(Events.GuildMemberAdd, () => updatePresence(client));
client.on(Events.GuildMemberRemove, () => updatePresence(client));
registerCommands().then(() => client.login(DISCORD_TOKEN)).catch((err) => {
  console.error("\u2717 Startup failed:", err);
  process.exit(1);
});
