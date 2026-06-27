import {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder
} from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, isSupport, isAdmin, errEmbed, okEmbed, infoEmbed, resolveChannel, csv } from '../util.js';
import { panel, branding } from '../theme.js';

const cfg = (gid) => guild(gid).config;

// SEED DEFAULTS ONLY. These ship a sensible out-of-the-box setup on first use;
// after that everything is editable per server and the SAVED config wins. Nothing
// here is force-applied at runtime any more — admins fully control each type's
// ping role and access roles via the /ticket commands below.
//
// TYPE_TEAM_ROLES: roles that can SEE, CHAT and CLAIM each default type (comma
// separated ids), seeded into each type's `supportRoles`.
const TYPE_TEAM_ROLES = {
    'general-support': '1502525208064688200,1486184857376784394,1514749210602508348,1514749210027626608,1484628461258674390,1484628463879983208,1484628466975641641',
    'internal-report': '1502525208064688200,1486184857376784394,1514749210602508348,1514749210027626608,1484628461258674390,1484628463879983208',
    'management':      '1502525208064688200,1486184857376784394,1514749210602508348,1514749210027626608,1484628461258674390'
};

// TYPE_PING_ROLES: the role pinged when each default type opens, seeded into each
// type's `pingRole`. Editable per type via /ticket set-ping.
const TYPE_PING_ROLES = {
    'general-support': '1484628466975641641',
    'internal-report': '1484628463879983208',
    'management':      '1484628461258674390'
};

function defaultTypes(gid) {
    const emoji = branding(gid).emoji || null;
    return [
        { id: 'general-support', label: 'General Support', emoji, description: 'General help and questions', category: null, pingRole: TYPE_PING_ROLES['general-support'], supportRoles: TYPE_TEAM_ROLES['general-support'] },
        { id: 'internal-report', label: 'Internal Report', emoji, description: 'Report a staff member', category: null, pingRole: TYPE_PING_ROLES['internal-report'], supportRoles: TYPE_TEAM_ROLES['internal-report'] },
        { id: 'management',      label: 'Management',      emoji, description: 'Management enquiries', category: null, pingRole: TYPE_PING_ROLES['management'], supportRoles: TYPE_TEAM_ROLES['management'] }
    ];
}

// Bump when the default seed changes. New servers get the full default set; servers
// seeded under an older version are MIGRATED IN PLACE (customizations preserved) —
// we never wipe an admin's saved types just because the seed moved on.
const TICKET_TYPES_VERSION = 3;
function types(gid) {
    const c = cfg(gid);
    if (c.ticketTypesSeedVersion === undefined) {
        // Never seeded → install the defaults.
        c.ticketTypes = defaultTypes(gid);
        c.ticketTypesSeeded = true;
        c.ticketTypesSeedVersion = TICKET_TYPES_VERSION;
        persist();
    } else if (c.ticketTypesSeedVersion < TICKET_TYPES_VERSION) {
        // Non-destructive migration: backfill a default ping role for any stock
        // type that predates per-type pings, leaving all other customizations alone.
        if (!Array.isArray(c.ticketTypes)) c.ticketTypes = [];
        for (const t of c.ticketTypes) {
            if (!t.pingRole && TYPE_PING_ROLES[t.id]) t.pingRole = TYPE_PING_ROLES[t.id];
        }
        c.ticketTypesSeedVersion = TICKET_TYPES_VERSION;
        persist();
    }
    if (!Array.isArray(c.ticketTypes)) c.ticketTypes = [];
    return c.ticketTypes;
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ticket';

// Only accept a valid emoji: a custom <:name:id> / <a:name:id>, or a unicode emoji.
// Anything else (e.g. the literal ":Flordia:" without an id) is dropped so it can't
// break the whole message with an "Invalid emoji" rejection.
function safeEmoji(e) {
    if (!e || typeof e !== 'string') return undefined;
    if (/^<a?:[A-Za-z0-9_]+:\d+>$/.test(e)) return e;   // custom emoji
    if (!e.includes(':') && !/[A-Za-z]/.test(e)) return e; // unicode (no colons, no letters)
    return undefined;
}

// Interactive control(s) for the open panel: a dropdown if types are configured,
// else a single button. Returned as a component array to live inside the container.
function panelControls(gid) {
    const list = types(gid);
    if (!list.length) {
        return [new ButtonBuilder().setCustomId('ticket:open').setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary)];
    }
    const menu = new StringSelectMenuBuilder().setCustomId('ticket:open').setPlaceholder('Select a ticket type…');
    for (const t of list.slice(0, 25)) {
        const opt = { label: t.label.slice(0, 100), value: t.id, description: (t.description || '').slice(0, 100) || undefined };
        const em = safeEmoji(t.emoji);
        if (em) opt.emoji = em;
        menu.addOptions(opt);
    }
    return [menu];
}
// 🔴 unclaimed / 🟢 claimed, followed by the opener's username.
function ticketChannelName(claimed, username) {
    return `${claimed ? '🟢' : '🔴'}-${slugify(username)}`;
}
function typeLabel(gid, id) {
    const ty = types(gid).find(t => t.id === id);
    return ty ? ty.label : 'Ticket';
}
function controlButtons(t) {
    const claimed = !!t.claimedBy;
    return [
        new ButtonBuilder().setCustomId('ticket:claim').setLabel(claimed ? 'Unclaim' : 'Claim').setStyle(claimed ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setStyle(ButtonStyle.Danger)
    ];
}
// The pinned status/control panel inside a ticket. Buttons live INSIDE the
// container so they render reliably under Components V2.
function ticketPanel(gid, t) {
    const status = t.claimedBy ? `**Claimed** by <@${t.claimedBy}>` : '**Unclaimed** — waiting for staff';
    return panel({
        guildId: gid, kind: 'tickets', title: `${typeLabel(gid, t.type)} #${t.number}`,
        body: `Welcome <@${t.userId}>! Describe your issue and a staff member will assist.\n\n**Status:** ${status}`,
        footer: branding(gid).name || undefined,
        buttons: controlButtons(t)
    });
}

// Roles allowed to SEE, CHAT and CLAIM a ticket of this type — driven entirely by
// the type's SAVED config (its ping role + configured access/support roles), so
// admins fully control it via /ticket access-add / access-remove. This isolates
// each type — e.g. only the management team sees management tickets. Falls back to
// the global support roles only when a type defines no roles of its own.
// (Server admins always see everything — Administrator bypasses channel overwrites.)
function viewerRoleIds(g, type) {
    const own = [];
    if (type?.pingRole) own.push(type.pingRole);
    own.push(...csv(type?.supportRoles));
    const unique = [...new Set(own)];
    return unique.length ? unique : csv(cfg(g.id).supportRoles);
}

// Role to ping when a ticket of this type opens: the configured ping role if it
// still exists in the server, else the first configured access role. Never returns
// a non-existent id, so the open/forward messages never render "@unknown-role".
function ticketPingRoleId(g, type) {
    if (type?.pingRole && g.roles.cache.has(type.pingRole)) return type.pingRole;
    const access = csv(type?.supportRoles).filter(rid => g.roles.cache.has(rid));
    return access[0] || null;
}

// Who can claim/close/forward/forceclose a ticket: global support staff, OR a
// member of THIS ticket type's own team (its ping + support roles). This lets the
// same roles that can see a type's tickets also handle them, while keeping each
// type isolated (e.g. Ownership roles can't handle General tickets).
function canHandleTicket(member, g, t) {
    if (isSupport(member, cfg(g.id))) return true;
    const ty = types(g.id).find(x => x.id === t?.type);
    return viewerRoleIds(g, ty).some(id => member.roles.cache.has(id));
}

// Re-apply a type's current access roles to every ALREADY-OPEN ticket of that
// type, so changing who can see/claim a type takes effect on existing tickets too
// (channel overwrites are otherwise frozen at creation). Optionally revoke a role
// that was just removed. Returns the number of open tickets touched.
async function resyncOpenTickets(g, typeId, revokeRoleId = null) {
    const ty = types(g.id).find(t => t.id === typeId);
    const viewers = viewerRoleIds(g, ty);
    let n = 0;
    for (const [chId, t] of Object.entries(guild(g.id).tickets)) {
        if (t.type !== typeId) continue;
        const ch = g.channels.cache.get(chId) || await g.channels.fetch(chId).catch(() => null);
        if (!ch) continue;
        for (const rid of viewers) {
            if (g.roles.cache.has(rid)) {
                await ch.permissionOverwrites.edit(rid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
            }
        }
        if (revokeRoleId && !viewers.includes(revokeRoleId)) {
            await ch.permissionOverwrites.delete(revokeRoleId).catch(() => {});
        }
        n++;
    }
    return n;
}

// Ensure a category exists for this ticket type (so tickets are grouped by type),
// creating it once and remembering its id. Falls back to the global category.
async function ensureCategory(g, type) {
    // Honour an explicit, still-existing category first.
    const explicit = type?.category && g.channels.cache.get(type.category);
    if (explicit && explicit.type === ChannelType.GuildCategory) return type.category;

    const name = type ? type.label : 'Tickets';
    let cat = g.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
        // Category visible only to staff; openers still see their own channel via
        // the channel-level allow that overrides this category deny.
        const overwrites = [
            { id: g.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: g.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
        ];
        for (const rid of viewerRoleIds(g, type)) {
            if (g.roles.cache.has(rid)) overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel] });
        }
        cat = await g.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites }).catch(() => null);
    }
    if (cat && type) { type.category = cat.id; persist(); }
    return cat?.id || cfg(g.id).ticketCategory || undefined;
}

async function createTicket(g, member, type) {
    const data = guild(g.id);
    data.ticketCounter = (data.ticketCounter || 0) + 1;
    const num = data.ticketCounter;

    const overwrites = [
        { id: g.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: g.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];
    for (const rid of viewerRoleIds(g, type)) {
        if (g.roles.cache.has(rid)) overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
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

    // V2 messages can't carry `content`, so post the panel first…
    const sent = await ch.send(ticketPanel(g.id, t));
    t.panelMessageId = sent.id;
    persist();
    // …then a separate plain message to actually ping the opener (+ type role).
    const ping = [`<@${member.id}>`];
    const pingRole = ticketPingRoleId(g, type);
    if (pingRole) ping.push(`<@&${pingRole}>`);
    await ch.send({ content: ping.join(' '), allowedMentions: { users: [member.id], roles: pingRole ? [pingRole] : [] } }).catch(() => {});
    return ch;
}

async function closeTicket(g, channel, closedBy) {
    const t = guild(g.id).tickets[channel.id];
    if (!t) return false;
    let transcript = `Ticket #${t.number} (${t.type || 'general'}) — opened by ${t.userId}\nClosed by ${closedBy.tag} at ${new Date().toISOString()}\n\n`;
    try {
        const msgs = await channel.messages.fetch({ limit: 100 });
        transcript += [...msgs.values()].reverse()
            .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[embed/attachment]'}`).join('\n');
    } catch { /* ignore */ }

    const logCh = await resolveChannel(g, cfg(g.id).ticketLogChannel);
    if (logCh) {
        const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `ticket-${t.number}.txt` });
        await logCh.send({ embeds: [okEmbed(`🎫 **Ticket #${t.number}** (${t.type || 'general'}) closed by ${closedBy} — opened by <@${t.userId}>.`)], files: [file] }).catch(() => {});
    }
    delete guild(g.id).tickets[channel.id];
    persist();
    await channel.delete(`Ticket closed by ${closedBy.tag}`).catch(() => {});
    return true;
}

// On startup, re-apply each ticket type's team roles to every already-open
// ticket channel, so the role changes also reach OLDER tickets (their channel
// overwrites were frozen at creation time).
export function init(ctx) {
    backfillTicketPerms(ctx).catch(e => console.error('ticket perms backfill error:', e.message));
}
async function backfillTicketPerms(ctx) {
    const guilds = (typeof ctx.allGuilds === 'function') ? ctx.allGuilds() : {};
    for (const [gid, data] of Object.entries(guilds)) {
        const g = ctx.client.guilds.cache.get(gid);
        if (!g || !data.tickets) continue;
        for (const [chId, t] of Object.entries(data.tickets)) {
            const ch = g.channels.cache.get(chId) || await g.channels.fetch(chId).catch(() => null);
            if (!ch) continue;
            const ty = types(gid).find(x => x.id === t.type);
            for (const rid of viewerRoleIds(g, ty)) {
                if (g.roles.cache.has(rid)) {
                    await ch.permissionOverwrites.edit(rid, {
                        ViewChannel: true, SendMessages: true, ReadMessageHistory: true
                    }).catch(() => {});
                }
            }
        }
    }
}

export const slash = [
    new SlashCommandBuilder().setName('ticket').setDescription('Tickets')
        .addSubcommand(s => s.setName('setup').setDescription('Post the open-ticket panel')
            .addChannelOption(o => o.setName('channel').setDescription('Channel to post the panel in (default: here)')))
        .addSubcommand(s => s.setName('close').setDescription('Close the current ticket'))
        .addSubcommand(s => s.setName('forceclose').setDescription('Force close the current ticket (staff)'))
        .addSubcommand(s => s.setName('type-add').setDescription('Add a ticket type to the panel')
            .addStringOption(o => o.setName('name').setDescription('Type name, e.g. General Support').setRequired(true))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji shown in the dropdown'))
            .addStringOption(o => o.setName('description').setDescription('Short description in the dropdown'))
            .addChannelOption(o => o.setName('category').setDescription('Category to create these tickets under').addChannelTypes(ChannelType.GuildCategory))
            .addRoleOption(o => o.setName('ping_role').setDescription('Role pinged when this type opens'))
            .addStringOption(o => o.setName('support_roles').setDescription('Extra support role IDs (comma-separated)')))
        .addSubcommand(s => s.setName('type-remove').setDescription('Remove a ticket type')
            .addStringOption(o => o.setName('id').setDescription('Type id (see /ticket type-list)').setRequired(true)))
        .addSubcommand(s => s.setName('type-edit').setDescription('Edit a ticket type (e.g. set its ping role)')
            .addStringOption(o => o.setName('id').setDescription('Type id (see /ticket type-list)').setRequired(true))
            .addStringOption(o => o.setName('label').setDescription('New label'))
            .addStringOption(o => o.setName('emoji').setDescription('New emoji'))
            .addStringOption(o => o.setName('description').setDescription('New description'))
            .addChannelOption(o => o.setName('category').setDescription('Category for this type').addChannelTypes(ChannelType.GuildCategory))
            .addRoleOption(o => o.setName('ping_role').setDescription('Role pinged when this type opens'))
            .addStringOption(o => o.setName('support_roles').setDescription('Extra support role IDs (comma-separated)')))
        .addSubcommand(s => s.setName('set-ping').setDescription('Set the role pinged when a ticket type opens')
            .addStringOption(o => o.setName('id').setDescription('Type id (see /ticket type-list)').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role to ping (omit to ping no one)')))
        .addSubcommand(s => s.setName('access-add').setDescription('Give a role access to see & claim a ticket type')
            .addStringOption(o => o.setName('id').setDescription('Type id (see /ticket type-list)').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role to grant access').setRequired(true)))
        .addSubcommand(s => s.setName('access-remove').setDescription('Remove a role\'s access to a ticket type')
            .addStringOption(o => o.setName('id').setDescription('Type id (see /ticket type-list)').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role to revoke access from').setRequired(true)))
        .addSubcommand(s => s.setName('type-list').setDescription('List configured ticket types'))
        .addSubcommand(s => s.setName('reset-types').setDescription('Wipe ticket types and restore the defaults')),
    new SlashCommandBuilder().setName('forward').setDescription('Forward this ticket to another team'),
    new SlashCommandBuilder().setName('transfer').setDescription('Transfer this ticket to another team (pick from a dropdown)'),
    new SlashCommandBuilder().setName('close-all-tickets').setDescription('Force close all tickets'),
    new SlashCommandBuilder().setName('adduser').setDescription('Add a user to this ticket')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('removeuser').setDescription('Remove a user from this ticket')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
];
export const owns = ['ticket', 'forward', 'transfer', 'close-all-tickets', 'adduser', 'removeuser'];
export const prefixOwns = ['ticket'];
export const componentNs = ['ticket'];

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const name = interaction.commandName;

    if (name === 'ticket') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const b = branding(g.id);
            const emoji = b.emoji ? `${b.emoji} ` : '';
            const name = b.name || 'our server';
            const body = cfg(g.id).ticketPanelText ||
                `At ${emoji}**${name}**, we provide support to ensure the best possible experience for all members. ` +
                `Please review each category carefully and select the one that best fits your inquiry. ` +
                `All tickets must follow community regulations; abusing the ticket system or disrespecting staff may result in disciplinary action.`;
            const p = panel({ guildId: g.id, kind: 'tickets', title: 'Support Tickets', body, footer: b.name || undefined, buttons: panelControls(g.id) });
            const ch = interaction.options.getChannel('channel') || await resolveChannel(g, cfg(g.id).ticketPanelChannel) || interaction.channel;
            try {
                await ch.send(p);
            } catch (e) {
                return interaction.reply({ embeds: [errEmbed(`Couldn't post the panel in ${ch}: ${e.message}`)], ephemeral: true });
            }
            return interaction.reply({ embeds: [okEmbed(`✅ Ticket panel posted in ${ch}.`)], ephemeral: true });
        }

        if (sub === 'type-add') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const label = interaction.options.getString('name');
            let id = slugify(label), n = 1;
            while (types(g.id).some(t => t.id === id)) id = `${slugify(label)}-${++n}`;
            const t = {
                id, label,
                emoji: interaction.options.getString('emoji') || null,
                description: interaction.options.getString('description') || null,
                category: interaction.options.getChannel('category')?.id || null,
                pingRole: interaction.options.getRole('ping_role')?.id || null,
                supportRoles: interaction.options.getString('support_roles') || null
            };
            types(g.id).push(t); persist();
            return interaction.reply({ embeds: [okEmbed(`✅ Added ticket type **${label}** (id \`${id}\`). Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
        }
        if (sub === 'type-remove') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const id = interaction.options.getString('id');
            const arr = types(g.id);
            const idx = arr.findIndex(t => t.id === id);
            if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No ticket type with id \`${id}\`.`)], ephemeral: true });
            arr.splice(idx, 1); persist();
            return interaction.reply({ embeds: [okEmbed(`✅ Removed ticket type \`${id}\`. Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
        }
        if (sub === 'type-edit') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const id = interaction.options.getString('id');
            const ty = types(g.id).find(t => t.id === id);
            if (!ty) return interaction.reply({ embeds: [errEmbed(`No ticket type \`${id}\`. See /ticket type-list.`)], ephemeral: true });
            const label = interaction.options.getString('label');
            const emoji = interaction.options.getString('emoji');
            const description = interaction.options.getString('description');
            const category = interaction.options.getChannel('category');
            const ping = interaction.options.getRole('ping_role');
            const support = interaction.options.getString('support_roles');
            if (label !== null) ty.label = label;
            if (emoji !== null) ty.emoji = emoji;
            if (description !== null) ty.description = description;
            if (category !== null) ty.category = category.id;
            if (ping !== null) ty.pingRole = ping.id;
            if (support !== null) ty.supportRoles = support;
            persist();
            return interaction.reply({ embeds: [okEmbed(`✅ Updated ticket type **${ty.label}**. Re-run \`/ticket setup\` to refresh the panel.`)], ephemeral: true });
        }
        if (sub === 'reset-types') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            cfg(g.id).ticketTypes = defaultTypes(g.id);
            cfg(g.id).ticketTypesSeeded = true;
            cfg(g.id).ticketTypesSeedVersion = TICKET_TYPES_VERSION;
            persist();
            return interaction.reply({ embeds: [okEmbed('✅ Ticket types reset to: **General Support, Internal Report, Management**. Re-run `/ticket setup` to refresh the panel.')], ephemeral: true });
        }
        if (sub === 'set-ping') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const id = interaction.options.getString('id');
            const ty = types(g.id).find(t => t.id === id);
            if (!ty) return interaction.reply({ embeds: [errEmbed(`No ticket type \`${id}\`. See /ticket type-list.`)], ephemeral: true });
            const role = interaction.options.getRole('role');
            ty.pingRole = role ? role.id : null;
            persist();
            return interaction.reply({ embeds: [okEmbed(`✅ **${ty.label}** tickets will now ${role ? `ping ${role}` : 'ping no role'} when opened.`)], ephemeral: true });
        }
        if (sub === 'access-add') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const id = interaction.options.getString('id');
            const ty = types(g.id).find(t => t.id === id);
            if (!ty) return interaction.reply({ embeds: [errEmbed(`No ticket type \`${id}\`. See /ticket type-list.`)], ephemeral: true });
            const role = interaction.options.getRole('role');
            const ids = csv(ty.supportRoles);
            if (ids.includes(role.id)) return interaction.reply({ embeds: [okEmbed(`${role} already has access to **${ty.label}** tickets.`)], ephemeral: true });
            ids.push(role.id);
            ty.supportRoles = ids.join(','); persist();
            await interaction.deferReply({ ephemeral: true });
            const n = await resyncOpenTickets(g, id);
            return interaction.editReply({ embeds: [okEmbed(`✅ ${role} can now see & claim **${ty.label}** tickets${n ? ` (applied to ${n} open ticket${n === 1 ? '' : 's'})` : ''}.`)] });
        }
        if (sub === 'access-remove') {
            if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
            const id = interaction.options.getString('id');
            const ty = types(g.id).find(t => t.id === id);
            if (!ty) return interaction.reply({ embeds: [errEmbed(`No ticket type \`${id}\`. See /ticket type-list.`)], ephemeral: true });
            const role = interaction.options.getRole('role');
            ty.supportRoles = csv(ty.supportRoles).filter(rid => rid !== role.id).join(',');
            // Don't keep pinging a role that can no longer see the ticket.
            let alsoPing = false;
            if (ty.pingRole === role.id) { ty.pingRole = null; alsoPing = true; }
            persist();
            await interaction.deferReply({ ephemeral: true });
            const n = await resyncOpenTickets(g, id, role.id);
            return interaction.editReply({ embeds: [okEmbed(`✅ ${role} can no longer access **${ty.label}** tickets${alsoPing ? ' (also cleared as its ping role)' : ''}${n ? ` — updated ${n} open ticket${n === 1 ? '' : 's'}` : ''}.`)] });
        }
        if (sub === 'type-list') {
            const arr = types(g.id);
            const lines = arr.map(t => {
                const pr = ticketPingRoleId(g, t);
                const viewers = viewerRoleIds(g, t).filter(rid => g.roles.cache.has(rid));
                const access = viewers.length ? viewers.map(rid => `<@&${rid}>`).join(' ') : '—';
                const head = `${t.emoji ? t.emoji + ' ' : ''}**${t.label}** \`${t.id}\`${t.category ? ` → <#${t.category}>` : ''}`;
                return `${head}\n> Pings: ${pr ? `<@&${pr}>` : '—'}\n> Access: ${access}`;
            });
            return interaction.reply({ embeds: [okEmbed(lines.join('\n\n') || 'No ticket types configured — the panel shows a single "Open Ticket" button.', '🎫 Ticket Types')], ephemeral: true });
        }

        // close / forceclose
        const t = guild(g.id).tickets[interaction.channel.id];
        if (!t) return interaction.reply({ embeds: [errEmbed('This is not a ticket channel.')], ephemeral: true });
        if (sub === 'forceclose' && !canHandleTicket(interaction.member, g, t)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        if (sub === 'close' && !canHandleTicket(interaction.member, g, t) && interaction.user.id !== t.userId)
            return interaction.reply({ embeds: [errEmbed('Only staff or the ticket owner can close.')], ephemeral: true });
        await interaction.reply({ embeds: [okEmbed('Closing ticket…')], ephemeral: true });
        return closeTicket(g, interaction.channel, interaction.user);
    }

    if (name === 'forward' || name === 'transfer') {
        const t = guild(g.id).tickets[interaction.channel.id];
        if (!t) return interaction.reply({ embeds: [errEmbed('Run this inside a ticket channel.')], ephemeral: true });
        if (!canHandleTicket(interaction.member, g, t)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const list = types(g.id);
        if (!list.length) return interaction.reply({ embeds: [errEmbed('No ticket types to transfer to.')], ephemeral: true });
        const menu = new StringSelectMenuBuilder().setCustomId('ticket:forward').setPlaceholder('Transfer to…');
        for (const ty of list.slice(0, 25)) {
            const opt = { label: ty.label.slice(0, 100), value: ty.id, description: (ty.description || '').slice(0, 100) || undefined };
            const em = safeEmoji(ty.emoji);
            if (em) opt.emoji = em;
            menu.addOptions(opt);
        }
        return interaction.reply({ embeds: [infoEmbed('Transfer Ticket', 'Choose which team to transfer this ticket to:')], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (name === 'close-all-tickets') {
        if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed('Admin only.')], ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        let n = 0;
        for (const cid of Object.keys(guild(g.id).tickets)) {
            const ch = g.channels.cache.get(cid);
            if (ch && await closeTicket(g, ch, interaction.user)) n++;
            else { delete guild(g.id).tickets[cid]; persist(); }
        }
        return interaction.editReply({ embeds: [okEmbed(`✅ Closed ${n} ticket(s).`)] });
    }

    if (name === 'adduser' || name === 'removeuser') {
        const t = guild(g.id).tickets[interaction.channel.id];
        if (!t) return interaction.reply({ embeds: [errEmbed('This is not a ticket channel.')], ephemeral: true });
        if (!canHandleTicket(interaction.member, g, t) && interaction.user.id !== t.userId)
            return interaction.reply({ embeds: [errEmbed('Only staff or the ticket owner can do that.')], ephemeral: true });
        const user = interaction.options.getUser('user');
        if (name === 'adduser') {
            await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            return interaction.reply({ embeds: [okEmbed(`✅ Added ${user} to the ticket.`)] });
        }
        await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
        return interaction.reply({ embeds: [okEmbed(`✅ Removed ${user} from the ticket.`)] });
    }
}

export async function handleComponent(interaction) {
    const [, action] = interaction.customId.split(':');
    const g = interaction.guild;

    if (action === 'open') {
        const existing = Object.entries(guild(g.id).tickets).find(([, t]) => t.userId === interaction.user.id);
        if (existing) return interaction.reply({ embeds: [errEmbed(`You already have an open ticket: <#${existing[0]}>`)], ephemeral: true });
        // Dropdown selection carries the type id; the fallback button has none.
        const type = interaction.isStringSelectMenu()
            ? types(g.id).find(t => t.id === interaction.values[0]) || null
            : null;
        await interaction.deferReply({ ephemeral: true });
        const ch = await createTicket(g, interaction.member, type);
        return interaction.editReply({ embeds: [okEmbed(`✅ Ticket created: ${ch}`)] });
    }

    const t = guild(g.id).tickets[interaction.channel.id];
    if (!t) return interaction.reply({ embeds: [errEmbed('This is not a ticket channel.')], ephemeral: true });

    if (action === 'claim') {
        if (!canHandleTicket(interaction.member, g, t)) return interaction.reply({ embeds: [errEmbed('Only staff can claim tickets.')], ephemeral: true });
        const uid = interaction.user.id;
        let notice;
        if (!t.claimedBy) {                                   // claim
            t.claimedBy = uid; notice = `🟢 Ticket claimed by ${interaction.user}.`;
        } else if (t.claimedBy === uid) {                     // unclaim your own
            t.claimedBy = null; notice = `🔴 Ticket unclaimed by ${interaction.user}.`;
        } else if (isAdmin(interaction.member)) {             // admin takeover
            t.claimedBy = uid; notice = `🟢 Ticket reassigned to ${interaction.user} (admin).`;
        } else {
            return interaction.reply({ embeds: [errEmbed(`Already claimed by <@${t.claimedBy}>. Only they or an admin can change it.`)], ephemeral: true });
        }
        persist();
        await interaction.channel.setName(ticketChannelName(!!t.claimedBy, t.username || interaction.channel.name)).catch(() => {});
        await interaction.update(ticketPanel(g.id, t));        // refresh the panel (button + status)
        return interaction.channel.send({ embeds: [okEmbed(notice)] }).catch(() => {});
    }
    if (action === 'close') {
        if (!canHandleTicket(interaction.member, g, t) && interaction.user.id !== t.userId)
            return interaction.reply({ embeds: [errEmbed('Only staff or the ticket owner can close.')], ephemeral: true });
        await interaction.reply({ embeds: [okEmbed('Closing ticket…')], ephemeral: true });
        return closeTicket(g, interaction.channel, interaction.user);
    }
    if (action === 'forward') {
        if (!canHandleTicket(interaction.member, g, t)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const target = types(g.id).find(x => x.id === interaction.values[0]);
        if (!target) return interaction.reply({ embeds: [errEmbed('That ticket type no longer exists.')], ephemeral: true });
        const oldType = types(g.id).find(x => x.id === t.type);
        const oldViewers = viewerRoleIds(g, oldType);
        const newViewers = viewerRoleIds(g, target);
        const parent = await ensureCategory(g, target);
        if (parent) await interaction.channel.setParent(parent, { lockPermissions: false }).catch(() => {});
        // Revoke the previous team's access (unless they're also on the new team)…
        for (const rid of oldViewers) {
            if (!newViewers.includes(rid) && g.roles.cache.has(rid)) await interaction.channel.permissionOverwrites.delete(rid).catch(() => {});
        }
        // …and grant the new team's.
        for (const rid of newViewers) {
            if (g.roles.cache.has(rid)) await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
        }
        t.type = target.id; persist();
        // Refresh the in-ticket panel to show the new team.
        const pm = t.panelMessageId && await interaction.channel.messages.fetch(t.panelMessageId).catch(() => null);
        if (pm) await pm.edit(ticketPanel(g.id, t)).catch(() => {});
        await interaction.update({ embeds: [okEmbed(`✅ Forwarded to **${target.label}**.`)], components: [] });
        const fwdPing = ticketPingRoleId(g, target);
        return interaction.channel.send({ content: fwdPing ? `<@&${fwdPing}>` : undefined, embeds: [infoEmbed('Ticket Forwarded', `This ticket was forwarded to **${target.label}** by ${interaction.user}.`)], allowedMentions: { roles: fwdPing ? [fwdPing] : [] } }).catch(() => {});
    }
}

export async function handlePrefix(cmd, message, args) {
    if ((args[0] || '').toLowerCase() !== 'close') return message.reply({ embeds: [errEmbed('Usage: `u!ticket close`')] }).catch(() => {});
    const t = guild(message.guild.id).tickets[message.channel.id];
    if (!t) return message.reply({ embeds: [errEmbed('This is not a ticket channel.')] }).catch(() => {});
    if (!canHandleTicket(message.member, message.guild, t) && message.author.id !== t.userId)
        return message.reply({ embeds: [errEmbed('Only staff or the ticket owner can close.')] }).catch(() => {});
    return closeTicket(message.guild, message.channel, message.author);
}
