import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { guild, persist, resetGuild } from '../store.js';
import { isAdmin, errEmbed, okEmbed, infoEmbed } from '../util.js';
import { BANNER_SLOTS } from '../theme.js';

// Friendly purpose → stored config key.
const CHANNEL_KEYS = {
    session: 'sessionChannel', 'infraction-log': 'infractionLogChannel', promotions: 'promoChannel',
    'ticket-panel': 'ticketPanelChannel', 'ticket-category': 'ticketCategory', 'ticket-log': 'ticketLogChannel',
    suggestions: 'suggestionChannel', reviews: 'reviewChannel', roleplay: 'roleplayChannel', welcome: 'welcomeChannel', media: 'mediaChannel',
    training: 'trainingChannel', 'training-request': 'trainingRequestChannel', 'training-results': 'trainingResultsChannel',
    'group-request': 'groupRequestChannel', 'mod-log': 'modLogChannel'
};
const BRANDING_FIELDS = { logo: 'logo', separator: 'separator', color: 'color', name: 'name', footer: 'footer', 'join-url': 'joinUrl', emoji: 'emoji' };

const choices = (obj) => Object.keys(obj).map(k => ({ name: k, value: k }));

export const slash = [
    new SlashCommandBuilder().setName('setup').setDescription('Complete bot configuration system')
        .addSubcommand(s => s.setName('view').setDescription('View current configuration'))
        .addSubcommand(s => s.setName('set-channel').setDescription('Assign a channel to a purpose')
            .addStringOption(o => o.setName('purpose').setDescription('What it\'s for').setRequired(true).addChoices(...choices(CHANNEL_KEYS)))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (omit to clear)')))
        .addSubcommand(s => s.setName('support-roles').setDescription('Set ticket support roles (comma-separated IDs, or blank to clear)')
            .addStringOption(o => o.setName('role_ids').setDescription('Role IDs, comma-separated')))
        .addSubcommand(s => s.setName('ping-role').setDescription('Set the community ping role')
            .addRoleOption(o => o.setName('role').setDescription('Role (omit to clear)')))
        .addSubcommand(s => s.setName('training-ping-role').setDescription('Role pinged by /training request')
            .addRoleOption(o => o.setName('role').setDescription('Role (omit to clear)')))
        .addSubcommand(s => s.setName('media-roles').setDescription('Roles (high ranks) that can accept/deny media requests')
            .addStringOption(o => o.setName('role_ids').setDescription('Role IDs, comma-separated (blank to clear)')))
        .addSubcommand(s => s.setName('session-ping-role').setDescription('Role pinged by every /session command (alongside @here)')
            .addRoleOption(o => o.setName('role').setDescription('Role (omit to clear)')))
        .addSubcommand(s => s.setName('autorole').setDescription('Role automatically given to every new member on join')
            .addRoleOption(o => o.setName('role').setDescription('Role (omit to clear)')))
        .addSubcommand(s => s.setName('branding').setDescription('Set a branding field')
            .addStringOption(o => o.setName('field').setDescription('Field').setRequired(true).addChoices(...choices(BRANDING_FIELDS)))
            .addStringOption(o => o.setName('value').setDescription('Value (URL/text/hex; blank to clear)')))
        .addSubcommand(s => s.setName('banner').setDescription('Set a banner image URL for a panel type')
            .addStringOption(o => o.setName('slot').setDescription('Panel type').setRequired(true).addChoices(...BANNER_SLOTS.slice(0, 25).map(s => ({ name: s, value: s }))))
            .addStringOption(o => o.setName('url').setDescription('Image URL (blank to clear)'))),
    new SlashCommandBuilder().setName('reset-config').setDescription('Wipe all saved settings for this server'),
    new SlashCommandBuilder().setName('debug').setDescription('View every saved piece of data for this server')
];
export const owns = ['setup', 'reset-config', 'debug'];
export const componentNs = ['resetcfg'];

function ensureBranding(gid) {
    const c = guild(gid).config;
    if (!c.branding) c.branding = {};
    if (!c.branding.banners) c.branding.banners = {};
    return c.branding;
}

export async function handleSlash(interaction) {
    if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed('Admin only.')], ephemeral: true });
    const g = interaction.guild;
    const name = interaction.commandName;

    if (name === 'reset-config') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('resetcfg:yes').setLabel('Yes, wipe everything').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('resetcfg:no').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        return interaction.reply({ embeds: [errEmbed('This wipes **all** settings, branding, infractions, promotions, giveaways, tickets, etc. for this server. Are you sure?', '⚠️ Confirm reset')], components: [row], ephemeral: true });
    }

    if (name === 'debug') {
        const data = guild(g.id);
        const summary = {
            config: data.config,
            counts: {
                infractions: data.infractions.length, promotions: data.promotions.length,
                giveaways: Object.keys(data.giveaways).length, tickets: Object.keys(data.tickets).length,
                afk: Object.keys(data.afk).length, reviews: data.reviews.length,
                trainings: data.trainings.length, suggestions: data.suggestions.length, roleplays: data.roleplays.length
            }
        };
        const file = new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2), 'utf8'), { name: `debug-${g.id}.json` });
        return interaction.reply({ embeds: [infoEmbed('🐛 Server Data', '```json\n' + JSON.stringify(summary, null, 2).slice(0, 3800) + '\n```')], files: [file], ephemeral: true });
    }

    // /setup ...
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
        const c = guild(g.id).config;
        const b = c.branding || {};
        const lines = Object.entries(CHANNEL_KEYS).map(([p, k]) => `**${p}:** ${c[k] ? `<#${c[k]}>` : '—'}`);
        lines.push(`**support-roles:** ${c.supportRoles || '—'}`);
        lines.push(`**ping-role:** ${b.pingRole ? `<@&${b.pingRole}>` : '—'}`);
        lines.push(`**branding:** name=${b.name || '—'}, logo=${b.logo ? '✓' : '—'}, separator=${b.separator ? '✓' : '—'}, color=${b.color ?? '—'}, join=${b.joinUrl ? '✓' : '—'}`);
        const setBanners = Object.keys(b.banners || {}).filter(k => b.banners[k]);
        lines.push(`**banners set:** ${setBanners.length ? setBanners.join(', ') : '—'}`);
        return interaction.reply({ embeds: [infoEmbed(`⚙️ ${g.name} — Configuration`, lines.join('\n'))], ephemeral: true });
    }

    if (sub === 'set-channel') {
        const key = CHANNEL_KEYS[interaction.options.getString('purpose')];
        const ch = interaction.options.getChannel('channel');
        if (ch) guild(g.id).config[key] = ch.id; else delete guild(g.id).config[key];
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ \`${interaction.options.getString('purpose')}\` ${ch ? `set to ${ch}` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'support-roles') {
        const ids = (interaction.options.getString('role_ids') || '').trim();
        if (ids) guild(g.id).config.supportRoles = ids; else delete guild(g.id).config.supportRoles;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Support roles ${ids ? `set to \`${ids}\`` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'ping-role') {
        const role = interaction.options.getRole('role');
        const b = ensureBranding(g.id);
        if (role) b.pingRole = role.id; else delete b.pingRole;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Ping role ${role ? `set to ${role}` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'training-ping-role') {
        const role = interaction.options.getRole('role');
        if (role) guild(g.id).config.trainingPingRole = role.id; else delete guild(g.id).config.trainingPingRole;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Training ping role ${role ? `set to ${role}` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'media-roles') {
        const ids = (interaction.options.getString('role_ids') || '').trim();
        if (ids) guild(g.id).config.mediaReviewRoles = ids; else delete guild(g.id).config.mediaReviewRoles;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Media reviewer roles ${ids ? `set to \`${ids}\`` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'session-ping-role') {
        const role = interaction.options.getRole('role');
        if (role) guild(g.id).config.sessionPingRole = role.id; else delete guild(g.id).config.sessionPingRole;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Session ping role ${role ? `set to ${role}` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'autorole') {
        const role = interaction.options.getRole('role');
        if (role && role.position >= g.members.me.roles.highest.position) {
            return interaction.reply({ embeds: [errEmbed(`I can't assign ${role} — move my bot role above it first.`)], ephemeral: true });
        }
        if (role) guild(g.id).config.autoRole = role.id; else delete guild(g.id).config.autoRole;
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Auto-role ${role ? `set to ${role} — new members get it on join` : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'branding') {
        const field = BRANDING_FIELDS[interaction.options.getString('field')];
        const raw = interaction.options.getString('value');
        const b = ensureBranding(g.id);
        if (!raw) { delete b[field]; }
        else if (field === 'color') { b.color = parseInt(raw.replace('#', ''), 16) || undefined; }
        else { b[field] = raw; }
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Branding \`${interaction.options.getString('field')}\` ${raw ? 'updated' : 'cleared'}.`)], ephemeral: true });
    }

    if (sub === 'banner') {
        const slot = interaction.options.getString('slot');
        const url = interaction.options.getString('url');
        const b = ensureBranding(g.id);
        if (url) b.banners[slot] = url; else delete b.banners[slot];
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Banner \`${slot}\` ${url ? 'set' : 'cleared'}.`)], ephemeral: true });
    }
}

export async function handleComponent(interaction) {
    if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed('Admin only.')], ephemeral: true });
    const [, action] = interaction.customId.split(':');
    if (action === 'yes') { resetGuild(interaction.guild.id); return interaction.update({ embeds: [okEmbed('✅ All settings wiped.')], components: [] }); }
    return interaction.update({ embeds: [okEmbed('Cancelled.')], components: [] });
}
