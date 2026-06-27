import {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelType, PermissionFlagsBits, AttachmentBuilder
} from 'discord.js';
import { guild, persist } from '../store.js';
import { isAdmin, errEmbed, okEmbed, resolveChannel, csv } from '../util.js';
import { panel, branding } from '../theme.js';

const cfg = (gid) => guild(gid).config;
const reqs = (gid) => (guild(gid).mediaRequests ||= {});

function isReviewer(member) {
    if (isAdmin(member)) return true;
    const roles = csv(cfg(member.guild.id).mediaReviewRoles);
    return roles.length > 0 && roles.some(r => member.roles.cache.has(r));
}

async function ensureCategory(g) {
    const explicit = cfg(g.id).mediaCategory && g.channels.cache.get(cfg(g.id).mediaCategory);
    if (explicit && explicit.type === ChannelType.GuildCategory) return cfg(g.id).mediaCategory;
    let cat = g.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'media requests');
    if (!cat) {
        const ow = [
            { id: g.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: g.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
        ];
        for (const r of csv(cfg(g.id).mediaReviewRoles)) if (g.roles.cache.has(r)) ow.push({ id: r, allow: [PermissionFlagsBits.ViewChannel] });
        cat = await g.channels.create({ name: 'Media Requests', type: ChannelType.GuildCategory, permissionOverwrites: ow }).catch(() => null);
    }
    return cat?.id || undefined;
}

const reviewRow = (done = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('media:accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId('media:deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(done));

function reviewPanel(gid, req, statusLine) {
    const p = panel({
        guildId: gid, kind: 'media', bannerUrl: req.imageUrl,
        title: `Official Media Request #${req.num}`,
        body: `Submitted by <@${req.submitterId}>${req.note ? `\n\n**Note:** ${req.note}` : ''}` +
              `${statusLine ? `\n\n${statusLine}` : '\n\nHigh ranks: review and **Accept** or **Deny** below.'}`,
        footer: branding(gid).name || undefined
    });
    p.components.push(reviewRow(!!statusLine));
    return p;
}

export const slash = [
    new SlashCommandBuilder().setName('media-request').setDescription('Submit an official media request (upload an in-game image)')
        .addAttachmentOption(o => o.setName('image').setDescription('The image to submit').setRequired(true))
        .addStringOption(o => o.setName('note').setDescription('Optional note for reviewers'))
];
export const owns = ['media-request'];
export const componentNs = ['media'];

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const att = interaction.options.getAttachment('image');
    if (!att || !(att.contentType || '').startsWith('image/')) {
        return interaction.reply({ embeds: [errEmbed('Please attach an image file.')], ephemeral: true });
    }
    const note = interaction.options.getString('note') || null;
    await interaction.deferReply({ ephemeral: true });

    const data = guild(g.id);
    data.mediaCounter = (data.mediaCounter || 0) + 1;
    const num = data.mediaCounter;

    const ow = [
        { id: g.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
        { id: g.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];
    for (const r of csv(cfg(g.id).mediaReviewRoles)) if (g.roles.cache.has(r)) ow.push({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

    const ch = await g.channels.create({
        name: `media-${num}`, type: ChannelType.GuildText,
        parent: await ensureCategory(g), permissionOverwrites: ow
    });
    const req = { num, submitterId: interaction.user.id, imageUrl: att.url, note, status: 'pending' };
    reqs(g.id)[ch.id] = req;
    persist();

    await ch.send(reviewPanel(g.id, req));
    return interaction.editReply({ embeds: [okEmbed(`Your media request was submitted: ${ch}`)] });
}

export async function handleComponent(interaction) {
    const [, action] = interaction.customId.split(':');
    const g = interaction.guild;
    const req = reqs(g.id)[interaction.channel.id];
    if (!req) return interaction.reply({ embeds: [errEmbed('This media request is no longer tracked.')], ephemeral: true });
    if (!isReviewer(interaction.member)) return interaction.reply({ embeds: [errEmbed('Only high ranks can review media requests.')], ephemeral: true });
    if (req.status !== 'pending') return interaction.reply({ embeds: [errEmbed('This request was already handled.')], ephemeral: true });

    if (action === 'accept') {
        req.status = 'accepted'; persist();
        await interaction.update(reviewPanel(g.id, req, `Accepted by <@${interaction.user.id}>`));

        const out = await resolveChannel(g, cfg(g.id).mediaChannel);
        if (out) {
            // Re-host the image on the output message so it never expires.
            const file = new AttachmentBuilder(req.imageUrl, { name: 'media.png' });
            const post = panel({
                guildId: g.id, kind: 'media', bannerUrl: 'attachment://media.png',
                title: 'Official Media',
                body: `Submitted by <@${req.submitterId}>\nAccepted by <@${interaction.user.id}>`,
                footer: branding(g.id).name || undefined
            });
            await out.send({ ...post, files: [file] }).catch(() => {});
        }
        await interaction.channel.send({ embeds: [okEmbed(`Accepted by ${interaction.user}. ${out ? `Posted in ${out}.` : 'No media channel configured (set /setup set-channel purpose:media).'} This channel closes shortly.`)] }).catch(() => {});
    } else {
        req.status = 'denied'; persist();
        await interaction.update(reviewPanel(g.id, req, `Denied by <@${interaction.user.id}>`));
        await interaction.channel.send({ embeds: [okEmbed(`Denied by ${interaction.user}. This channel closes shortly.`)] }).catch(() => {});
    }
    delete reqs(g.id)[interaction.channel.id];
    persist();
    setTimeout(() => interaction.channel.delete().catch(() => {}), 8000);
}
