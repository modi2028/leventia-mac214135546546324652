import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, listEmbed, resolveChannel, safeReply } from '../util.js';
import { panel, ephemeralPanel, branding, BANNER_SLOTS } from '../theme.js';

// Configurable info panels: a branded card + a dropdown whose options each reveal
// their own content (links, rules, etc.) — like the "Orlando Dashboard" panels.
const dashes = (gid) => (guild(gid).dashboards ||= {});
const bannerChoices = BANNER_SLOTS.slice(0, 25).map(s => ({ name: s, value: s }));
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'dash';
function safeEmoji(e) {
    if (!e || typeof e !== 'string') return undefined;
    if (/^<a?:[A-Za-z0-9_]+:\d+>$/.test(e)) return e;
    if (!e.includes(':') && !/[A-Za-z]/.test(e)) return e;
    return undefined;
}

function dashboardPanel(gid, d) {
    const menu = new StringSelectMenuBuilder().setCustomId(`dash:${d.id}`).setPlaceholder(d.placeholder || 'Select an option…');
    for (const o of d.options.slice(0, 25)) {
        const opt = { label: o.label.slice(0, 100), value: o.id, description: (o.description || '').slice(0, 100) || undefined };
        const em = safeEmoji(o.emoji);
        if (em) opt.emoji = em;
        menu.addOptions(opt);
    }
    return panel({
        guildId: gid, kind: d.bannerSlot || 'dashboard', bannerUrl: d.bannerUrl || undefined,
        title: d.title, body: d.body, footer: branding(gid).name || undefined,
        buttons: d.options.length ? [menu] : undefined
    });
}

export const slash = [
    new SlashCommandBuilder().setName('dashboard').setDescription('Build dropdown info panels (dashboards, guidelines, etc.)')
        .addSubcommand(s => s.setName('create').setDescription('Create a new dashboard panel')
            .addStringOption(o => o.setName('name').setDescription('Short id to reference it later, e.g. "main"').setRequired(true))
            .addStringOption(o => o.setName('title').setDescription('Heading shown under the banner').setRequired(true))
            .addStringOption(o => o.setName('description').setDescription('Intro text'))
            .addStringOption(o => o.setName('banner').setDescription('Banner slot to use').addChoices(...BANNER_SLOTS.slice(0, 25).map(s => ({ name: s, value: s }))))
            .addStringOption(o => o.setName('banner_url').setDescription('Custom banner image URL (overrides slot)'))
            .addStringOption(o => o.setName('placeholder').setDescription('Dropdown placeholder text')))
        .addSubcommand(s => s.setName('add-option').setDescription('Add a dropdown option to a dashboard')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true))
            .addStringOption(o => o.setName('label').setDescription('Option label in the dropdown').setRequired(true))
            .addStringOption(o => o.setName('content').setDescription('Text shown when selected (supports markdown/links, paste line breaks)').setRequired(true))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji for the option'))
            .addStringOption(o => o.setName('description').setDescription('Small description under the label'))
            .addStringOption(o => o.setName('banner').setDescription('Banner slot for this section').addChoices(...bannerChoices))
            .addStringOption(o => o.setName('banner_url').setDescription('Custom banner image URL for this section')))
        .addSubcommand(s => s.setName('edit').setDescription('Edit a dashboard panel (banner, title, etc.)')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true))
            .addStringOption(o => o.setName('title').setDescription('New title'))
            .addStringOption(o => o.setName('description').setDescription('New intro text'))
            .addStringOption(o => o.setName('banner').setDescription('Banner slot').addChoices(...bannerChoices))
            .addStringOption(o => o.setName('banner_url').setDescription('Custom banner image URL (use "none" to clear)'))
            .addStringOption(o => o.setName('placeholder').setDescription('Dropdown placeholder text')))
        .addSubcommand(s => s.setName('edit-option').setDescription('Edit a dropdown option (incl. its banner)')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true))
            .addStringOption(o => o.setName('option').setDescription('Option id/label').setRequired(true))
            .addStringOption(o => o.setName('label').setDescription('New label'))
            .addStringOption(o => o.setName('content').setDescription('New content'))
            .addStringOption(o => o.setName('emoji').setDescription('New emoji'))
            .addStringOption(o => o.setName('description').setDescription('New description'))
            .addStringOption(o => o.setName('banner').setDescription('Banner slot for this section').addChoices(...bannerChoices))
            .addStringOption(o => o.setName('banner_url').setDescription('Custom banner image URL (use "none" to clear)')))
        .addSubcommand(s => s.setName('remove-option').setDescription('Remove a dropdown option')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true))
            .addStringOption(o => o.setName('option').setDescription('Option id/label').setRequired(true)))
        .addSubcommand(s => s.setName('post').setDescription('Post a dashboard to a channel')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')))
        .addSubcommand(s => s.setName('list').setDescription('List dashboards and their options'))
        .addSubcommand(s => s.setName('delete').setDescription('Delete a dashboard')
            .addStringOption(o => o.setName('dashboard').setDescription('Dashboard id').setRequired(true)))
];
export const owns = ['dashboard'];
export const componentNs = ['dash'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const all = dashes(g.id);

    if (sub === 'create') {
        const id = slugify(interaction.options.getString('name'));
        if (all[id]) return interaction.reply({ embeds: [errEmbed(`A dashboard with id \`${id}\` already exists.`)], ephemeral: true });
        all[id] = {
            id, title: interaction.options.getString('title'),
            body: interaction.options.getString('description') || '',
            bannerSlot: interaction.options.getString('banner') || 'dashboard',
            bannerUrl: interaction.options.getString('banner_url') || '',
            placeholder: interaction.options.getString('placeholder') || '',
            options: []
        };
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Dashboard \`${id}\` created. Add options with \`/dashboard add-option dashboard:${id} …\`, then \`/dashboard post dashboard:${id}\`.`)], ephemeral: true });
    }

    if (sub === 'list') {
        const lines = Object.values(all).map(d => `**\`${d.id}\`** — ${d.title} · ${d.options.length} option(s): ${d.options.map(o => o.id).join(', ') || '—'}`);
        return interaction.reply({ embeds: [listEmbed('Dashboards', lines, { empty: 'No dashboards yet. Create one with `/dashboard create`.' })], ephemeral: true });
    }

    const d = all[interaction.options.getString('dashboard')];
    if (!d) return interaction.reply({ embeds: [errEmbed('No dashboard with that id. See `/dashboard list`.')], ephemeral: true });

    if (sub === 'add-option') {
        if (d.options.length >= 25) return interaction.reply({ embeds: [errEmbed('A dropdown can have at most 25 options.')], ephemeral: true });
        const label = interaction.options.getString('label');
        let oid = slugify(label), n = 1;
        while (d.options.some(o => o.id === oid)) oid = `${slugify(label)}-${++n}`;
        d.options.push({
            id: oid, label, content: interaction.options.getString('content'),
            emoji: interaction.options.getString('emoji') || null,
            description: interaction.options.getString('description') || null,
            bannerSlot: interaction.options.getString('banner') || null,
            bannerUrl: interaction.options.getString('banner_url') || null
        });
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Added option **${label}** (\`${oid}\`) to \`${d.id}\`. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
    }

    if (sub === 'edit') {
        const set = (k, v) => { if (v !== null && v !== undefined) d[k] = v === 'none' ? '' : v; };
        set('title', interaction.options.getString('title'));
        set('body', interaction.options.getString('description'));
        set('bannerSlot', interaction.options.getString('banner'));
        set('bannerUrl', interaction.options.getString('banner_url'));
        set('placeholder', interaction.options.getString('placeholder'));
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Updated \`${d.id}\`. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
    }

    if (sub === 'edit-option') {
        const key = interaction.options.getString('option');
        const o = d.options.find(x => x.id === key || x.label.toLowerCase() === key.toLowerCase());
        if (!o) return interaction.reply({ embeds: [errEmbed(`No option \`${key}\` in \`${d.id}\`.`)], ephemeral: true });
        const set = (k, v) => { if (v !== null && v !== undefined) o[k] = v === 'none' ? null : v; };
        set('label', interaction.options.getString('label'));
        set('content', interaction.options.getString('content'));
        set('emoji', interaction.options.getString('emoji'));
        set('description', interaction.options.getString('description'));
        set('bannerSlot', interaction.options.getString('banner'));
        set('bannerUrl', interaction.options.getString('banner_url'));
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Updated option **${o.label}**. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
    }

    if (sub === 'remove-option') {
        const key = interaction.options.getString('option');
        const idx = d.options.findIndex(o => o.id === key || o.label.toLowerCase() === key.toLowerCase());
        if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No option \`${key}\` in \`${d.id}\`.`)], ephemeral: true });
        const [removed] = d.options.splice(idx, 1);
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Removed **${removed.label}**. Re-run \`/dashboard post\` to refresh.`)], ephemeral: true });
    }

    if (sub === 'post') {
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        await ch.send(dashboardPanel(g.id, d));
        return interaction.reply({ embeds: [okEmbed(`✅ Posted dashboard \`${d.id}\` in ${ch}.`)], ephemeral: true });
    }

    if (sub === 'delete') {
        delete all[d.id]; persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Deleted dashboard \`${d.id}\`.`)], ephemeral: true });
    }
}

export async function handleComponent(interaction) {
    const dashId = interaction.customId.split(':')[1];
    const d = dashes(interaction.guild.id)[dashId];
    if (!d) return interaction.reply({ embeds: [errEmbed('This dashboard no longer exists.')], ephemeral: true });
    const o = d.options.find(x => x.id === interaction.values[0]);
    if (!o) return interaction.reply({ embeds: [errEmbed('That option is no longer available.')], ephemeral: true });
    // Show this section's banner if it has one, else a clean image-less card.
    const hasBanner = o.bannerSlot || o.bannerUrl;
    return interaction.reply(ephemeralPanel({
        guildId: interaction.guild.id,
        kind: o.bannerSlot || 'default', bannerUrl: o.bannerUrl || undefined, noBanner: !hasBanner,
        title: `${o.emoji ? o.emoji + ' ' : ''}${o.label}`,
        body: o.content, footer: branding(interaction.guild.id).name || undefined
    }));
}
