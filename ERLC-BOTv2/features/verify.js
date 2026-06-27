import { SlashCommandBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, resolveChannel } from '../util.js';
import { panel, branding } from '../theme.js';

const cfg = (gid) => guild(gid).config;

function verifyPanel(gid) {
    const b = branding(gid);
    const emoji = b.emoji ? `${b.emoji} ` : '';
    const name = b.name || 'the server';
    const body = cfg(gid).verifyText ||
        `${emoji}Welcome to **${name}**! To gain access to the rest of the server, ` +
        `click the **Verify** button below. By verifying you agree to follow our rules and guidelines.`;
    return panel({
        guildId: gid, kind: 'verify', title: 'Verification', body,
        footer: b.name || undefined,
        buttons: [new ButtonBuilder().setCustomId('verify:go').setLabel('Verify').setStyle(ButtonStyle.Success)]
    });
}

export const slash = [
    new SlashCommandBuilder().setName('verify').setDescription('Verification system')
        .addSubcommand(s => s.setName('setup').setDescription('Post the verification panel')
            .addRoleOption(o => o.setName('role').setDescription('Role granted on verify (e.g. @Florida Member)').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to post the panel in (default: here)'))
            .addStringOption(o => o.setName('text').setDescription('Custom panel text (optional)'))
            .addStringOption(o => o.setName('banner').setDescription('Banner image URL shown at the top of the panel')))
        .addSubcommand(s => s.setName('role').setDescription('Change the role granted on verify')
            .addRoleOption(o => o.setName('role').setDescription('Role (e.g. @Florida Member)').setRequired(true)))
        .addSubcommand(s => s.setName('stats').setDescription('See how many members have verified'))
];
export const owns = ['verify'];
export const componentNs = ['verify'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
        const role = interaction.options.getRole('role');
        // Catch the classic failure up front: the bot can only grant roles BELOW its own.
        if (role.position >= g.members.me.roles.highest.position) {
            return interaction.reply({ embeds: [errEmbed(`I can't assign ${role} — move my bot role **above** it in Server Settings → Roles, then re-run.`)], ephemeral: true });
        }
        cfg(g.id).verifyRole = role.id;
        const text = interaction.options.getString('text');
        if (text) cfg(g.id).verifyText = text;
        const bannerUrl = interaction.options.getString('banner');
        if (bannerUrl && /^https?:\/\//i.test(bannerUrl)) {
            // Store in the branding banner slot so the panel (and future reposts) use it.
            const b = (cfg(g.id).branding ||= {});
            (b.banners ||= {}).verify = bannerUrl;
        }
        persist();
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        try {
            await ch.send(verifyPanel(g.id));
        } catch (e) {
            return interaction.reply({ embeds: [errEmbed(`Couldn't post in ${ch}: ${e.message}`)], ephemeral: true });
        }
        return interaction.reply({ embeds: [okEmbed(`Verification panel posted in ${ch}. Verifying grants ${role}.`)], ephemeral: true });
    }

    if (sub === 'role') {
        const role = interaction.options.getRole('role');
        if (role.position >= g.members.me.roles.highest.position) {
            return interaction.reply({ embeds: [errEmbed(`I can't assign ${role} — move my bot role above it first.`)], ephemeral: true });
        }
        cfg(g.id).verifyRole = role.id;
        persist();
        return interaction.reply({ embeds: [okEmbed(`Verify role set to ${role}.`)], ephemeral: true });
    }

    // stats
    const rid = cfg(g.id).verifyRole;
    if (!rid) return interaction.reply({ embeds: [errEmbed('No verify role configured. Run `/verify setup` first.')], ephemeral: true });
    await g.members.fetch().catch(() => {});
    const role = g.roles.cache.get(rid);
    const count = role ? role.members.size : 0;
    return interaction.reply({ embeds: [okEmbed(`**${count}** member(s) hold ${role ?? 'the verify role'} out of **${g.memberCount}** total.`)], ephemeral: true });
}

export async function handleComponent(interaction) {
    const g = interaction.guild;
    const rid = cfg(g.id).verifyRole;
    const role = rid && g.roles.cache.get(rid);
    if (!role) return interaction.reply({ embeds: [errEmbed('Verification is not configured — ask staff to run `/verify setup`.')], ephemeral: true });

    if (interaction.member.roles.cache.has(role.id)) {
        return interaction.reply({ embeds: [okEmbed('You are already verified.')], ephemeral: true });
    }
    try {
        await interaction.member.roles.add(role, 'Verified via verification panel');
    } catch {
        return interaction.reply({ embeds: [errEmbed('I could not assign the role — staff: check my bot role sits above the verify role.')], ephemeral: true });
    }
    const name = branding(g.id).name || g.name;
    return interaction.reply({ embeds: [okEmbed(`You have been verified — welcome to **${name}**!`)], ephemeral: true });
}
