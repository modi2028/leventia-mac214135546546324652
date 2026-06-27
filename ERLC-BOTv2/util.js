import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const COLOR = 0x2b6cb0;
export const ERROR_COLOR = 0xe53e3e;
export const OK_COLOR = 0x38a169;
export const PREFIX = 'u!';

export const csv = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

const STAFF_ROLES = csv(process.env.STAFF_ROLE_ID);
const ADMIN_ROLES = csv(process.env.ADMIN_ROLE_ID);

function hasAnyRole(member, ids) {
    return ids.some(id => member.roles.cache.has(id));
}
export function isAdmin(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return ADMIN_ROLES.length > 0 && hasAnyRole(member, ADMIN_ROLES);
}
export function isStaff(member) {
    if (!member) return false;
    if (isAdmin(member)) return true;
    return STAFF_ROLES.length > 0 && hasAnyRole(member, STAFF_ROLES);
}
// Support staff = configured support roles, else any staff.
export function isSupport(member, cfg) {
    if (isStaff(member)) return true;
    const roles = csv(cfg?.supportRoles);
    return roles.length > 0 && hasAnyRole(member, roles);
}

export const errEmbed = (msg, title = '⚠️ Error') =>
    new EmbedBuilder().setColor(ERROR_COLOR).setTitle(title).setDescription(String(msg).slice(0, 4000));
export const okEmbed = (msg, title) => {
    const e = new EmbedBuilder().setColor(OK_COLOR).setDescription(String(msg).slice(0, 4000));
    if (title) e.setTitle(title);
    return e;
};
export const infoEmbed = (title, desc) =>
    new EmbedBuilder().setColor(COLOR).setTitle(title).setTimestamp()
        .setDescription(desc ? String(desc).slice(0, 4000) : null);

// Build a description from lines, truncating to Discord's limit.
export function listEmbed(title, lines, { color = COLOR, empty = 'Nothing to show.' } = {}) {
    const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
    if (!lines.length) return e.setDescription(empty);
    let desc = '', shown = 0;
    for (const line of lines) {
        if (desc.length + line.length + 1 > 3900) break;
        desc += line + '\n';
        shown++;
    }
    if (shown < lines.length) desc += `\n…and **${lines.length - shown}** more.`;
    return e.setDescription(desc);
}

export const ts = (sec) => sec ? `<t:${sec}:R>` : '—';
export const now = () => Math.floor(Date.now() / 1000);

// Resolve a configured channel id to a sendable channel, or null.
export async function resolveChannel(guild, id) {
    if (!id) return null;
    return guild.channels.cache.get(id) || guild.channels.fetch(id).catch(() => null);
}

// Reply helper that works whether or not the interaction was deferred.
export async function safeReply(interaction, payload) {
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
    return interaction.reply(payload).catch(() => {});
}

// Parse a human duration like "10m", "2h", "1d", "30s" → seconds. null if invalid.
export function parseDuration(str) {
    const m = /^(\d+)\s*(s|m|h|d|w)?$/i.exec(String(str || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 'm').toLowerCase();
    return n * ({ s: 1, m: 60, h: 3600, d: 86400, w: 604800 })[unit];
}
