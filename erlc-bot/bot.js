import 'dotenv/config';
import {
    Client, GatewayIntentBits, Partials, Events, REST, Routes, MessageFlags, ActivityType
} from 'discord.js';
import { allGuilds } from './store.js';
import { PREFIX, errEmbed } from './util.js';

import * as erlc from './features/erlc.js';
import * as sessions from './features/sessions.js';
import * as giveaways from './features/giveaways.js';
import * as infractions from './features/infractions.js';
import * as promotions from './features/promotions.js';
import * as tickets from './features/tickets.js';
import * as afk from './features/afk.js';
import * as reviews from './features/reviews.js';
import * as training from './features/training.js';
import * as suggestions from './features/suggestions.js';
import * as roleplay from './features/roleplay.js';
import * as misc from './features/misc.js';
import * as setup from './features/setup.js';
import * as dashboard from './features/dashboard.js';
import * as welcome from './features/welcome.js';
import * as media from './features/media.js';
import * as moderation from './features/moderation.js';
import * as globalban from './features/globalban.js';
import * as verify from './features/verify.js';
import * as status from './features/status.js';
import * as utility from './features/utility.js';
import * as applications from './features/applications.js';

const MODULES = [erlc, sessions, giveaways, infractions, promotions, tickets, afk, reviews, training, suggestions, roleplay, misc, setup, dashboard, welcome, media, moderation, globalban, verify, status, utility, applications];

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('✗ DISCORD_TOKEN and CLIENT_ID are required in .env');
    process.exit(1);
}

// ── Build routing tables from module exports ─────────────────────────────────
const slashByName = new Map();   // commandName → module
const prefixByCmd = new Map();   // prefix word → module
const componentByNs = new Map(); // customId namespace → module
const messageHooks = [];         // modules with onMessage
const commandJSON = [];

for (const m of MODULES) {
    for (const name of m.owns || []) slashByName.set(name, m);
    for (const cmd of m.prefixOwns || []) prefixByCmd.set(cmd, m);
    for (const ns of m.componentNs || []) componentByNs.set(ns, m);
    if (typeof m.onMessage === 'function') messageHooks.push(m);
    for (const b of m.slash || []) commandJSON.push(b.toJSON());
}

// ── Client ───────────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,   // privileged — enable in portal
        GatewayIntentBits.GuildMembers,      // privileged — enable in portal
        GatewayIntentBits.DirectMessages     // application answers arrive via DM
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ── Interactions (slash + components) ────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const m = slashByName.get(interaction.commandName);
            if (m) return await m.handleSlash(interaction);
        } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            const ns = interaction.customId.split(':')[0];
            const m = componentByNs.get(ns);
            if (m?.handleComponent) return await m.handleComponent(interaction);
        }
    } catch (err) {
        console.error('Interaction error:', err);
        const payload = { embeds: [errEmbed(err.message || 'Something went wrong.')], ephemeral: true };
        if (interaction.isRepliable()) {
            if (interaction.deferred || interaction.replied) interaction.editReply(payload).catch(() => {});
            else interaction.reply(payload).catch(() => {});
        }
    }
});

// ── Messages (global hooks + prefix commands) ────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    for (const m of messageHooks) m.onMessage(message).catch?.(() => {});

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || '').toLowerCase();
    const m = prefixByCmd.get(cmd);
    if (!m?.handlePrefix) return;
    try {
        await m.handlePrefix(cmd, message, args, args.join(' '));
    } catch (err) {
        console.error('Prefix error:', err);
        message.reply({ embeds: [errEmbed(err.message || 'Something went wrong.')] }).catch(() => {});
    }
});

// ── Register slash commands + login ──────────────────────────────────────────
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    // GUILD_ID accepts one id or a comma-separated list; each guild is a separate API call.
    const guildIds = (GUILD_ID || '').split(',').map(s => s.trim()).filter(Boolean);
    if (guildIds.length) {
        // Clear any GLOBAL registrations so commands don't show up twice
        // (global + guild copies both render in the picker).
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] })
            .then(() => console.log('✓ Cleared global commands (guild mode)'))
            .catch(() => {});
        for (const gid of guildIds) {
            try {
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commandJSON });
                console.log(`✓ Registered ${commandJSON.length} guild commands to ${gid}`);
            } catch (e) {
                console.error(`✗ Failed to register to guild ${gid}: ${e.message} (is the bot in that server?)`);
            }
        }
    } else {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandJSON });
        console.log(`✓ Registered ${commandJSON.length} global commands (may take up to 1h to appear)`);
    }
}

async function logPublicIp() {
    // PRC's API (api.erlc.gg) now blocks unknown IPs. Print ours so the ER:LC
    // server owner can allowlist it at https://api.erlc.gg/server-owners.
    try {
        const res = await fetch('https://api.ipify.org?format=text');
        const ip = (await res.text()).trim();
        console.log(`🌐 Outbound IP: ${ip}  → allowlist this at https://api.erlc.gg/server-owners`);
    } catch { /* ignore */ }
}

// "Watching N members" presence — summed across every server the bot is in.
function updatePresence(c) {
    const total = c.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    // Custom status renders the text verbatim in every Discord view (the
    // "Watching" verb from ActivityType.Watching is dropped in compact lists).
    c.user.setActivity(`Watching over ${total.toLocaleString('en-US')} members`, { type: ActivityType.Custom });
}

client.once(Events.ClientReady, (c) => {
    const ctx = { client: c, allGuilds };
    for (const m of MODULES) if (typeof m.init === 'function') { try { m.init(ctx); } catch (e) { console.error('init error:', e); } }
    console.log(`🤖 Logged in as ${c.user.tag} — ${MODULES.length} feature modules, ${commandJSON.length} commands.`);
    logPublicIp();
    updatePresence(c);
    setInterval(() => updatePresence(c), 10 * 60 * 1000);
});
client.on(Events.GuildMemberAdd, () => updatePresence(client));
client.on(Events.GuildMemberRemove, () => updatePresence(client));

registerCommands()
    .then(() => client.login(DISCORD_TOKEN))
    .catch((err) => { console.error('✗ Startup failed:', err); process.exit(1); });
