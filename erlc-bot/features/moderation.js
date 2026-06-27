import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, infoEmbed, resolveChannel, safeReply, parseDuration } from '../util.js';
import { panel, branding } from '../theme.js';

const cfg = (gid) => guild(gid).config;

// Post a line to the configured mod-log channel (set with /setup set-channel purpose:mod-log).
async function modLog(g, text) {
    const ch = await resolveChannel(g, cfg(g.id).modLogChannel);
    if (ch) ch.send({ embeds: [infoEmbed('Moderation Log', text)] }).catch(() => {});
}

export const slash = [
    new SlashCommandBuilder().setName('role').setDescription('Add or remove a role from a member')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
        .addStringOption(o => o.setName('action').setDescription('Add, remove, or toggle (default toggle)')
            .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'toggle', value: 'toggle' })),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a member from the Discord server')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .addIntegerOption(o => o.setName('delete_days').setDescription('Delete this many days of their messages (0-7)').setMinValue(0).setMaxValue(7)),
    new SlashCommandBuilder().setName('kick').setDescription('Kick a member from the Discord server')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('mute').setDescription('Timeout a member')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('unmute').setDescription('Remove a member\'s timeout')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
    new SlashCommandBuilder().setName('lock').setDescription('Lock a channel (deny @everyone sending)')
        .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
    new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
    new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode')
        .addIntegerOption(o => o.setName('seconds').setDescription('Seconds between messages (0 = off, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
    new SlashCommandBuilder().setName('nick').setDescription('Change a member\'s nickname')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('nickname').setDescription('New nickname (blank to reset)')),
    new SlashCommandBuilder().setName('group').setDescription('Group tools')
        .addSubcommand(s => s.setName('request').setDescription('Request to join the Roblox group')
            .addStringOption(o => o.setName('roblox_username').setDescription('Your Roblox username').setRequired(true))
            .addStringOption(o => o.setName('note').setDescription('Anything staff should know')))
];
export const owns = ['role', 'ban', 'kick', 'mute', 'unmute', 'lock', 'unlock', 'slowmode', 'nick', 'group'];

async function setLock(channel, locked) {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: locked ? false : null });
}

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const name = interaction.commandName;

    // /group request is open to everyone; everything else is staff-only.
    if (name === 'group') {
        const ch = (await resolveChannel(g, cfg(g.id).groupRequestChannel)) || interaction.channel;
        const robloxName = interaction.options.getString('roblox_username');
        const note = interaction.options.getString('note');
        await ch.send(panel({
            guildId: g.id, kind: 'default', title: 'Group Request',
            body: `<@${interaction.user.id}> has requested to join the group.`,
            fields: [{ name: 'Roblox Username', value: robloxName }, ...(note ? [{ name: 'Note', value: note }] : [])],
            footer: branding(g.id).name || undefined
        }));
        return interaction.reply({ embeds: [okEmbed(`Group request submitted in ${ch}.`)], ephemeral: true });
    }

    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });

    if (name === 'lock' || name === 'unlock') {
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        try { await setLock(ch, name === 'lock'); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true }); }
        modLog(g, `${ch} ${name === 'lock' ? 'locked' : 'unlocked'} by ${interaction.user}.`);
        return interaction.reply({ embeds: [okEmbed(`${ch} ${name === 'lock' ? 'locked' : 'unlocked'}.`)] });
    }

    if (name === 'slowmode') {
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        const secs = interaction.options.getInteger('seconds');
        try { await ch.setRateLimitPerUser(secs); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true }); }
        modLog(g, `Slowmode in ${ch} set to **${secs}s** by ${interaction.user}.`);
        return interaction.reply({ embeds: [okEmbed(secs ? `Slowmode in ${ch} set to **${secs}s**.` : `Slowmode in ${ch} disabled.`)] });
    }

    if (name === 'nick') {
        const user = interaction.options.getUser('user');
        const member = await g.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ embeds: [errEmbed('That user is not in the server.')], ephemeral: true });
        const nickname = interaction.options.getString('nickname') || null;
        try { await member.setNickname(nickname); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed (check role hierarchy): ${e.message}`)], ephemeral: true }); }
        modLog(g, `Nickname of ${user} ${nickname ? `set to **${nickname}**` : 'reset'} by ${interaction.user}.`);
        return interaction.reply({ embeds: [okEmbed(nickname ? `Nickname of ${user} set to **${nickname}**.` : `Nickname of ${user} reset.`)], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const member = await g.members.fetch(user.id).catch(() => null);

    if (name === 'role') {
        if (!member) return interaction.reply({ embeds: [errEmbed('That user is not in the server.')], ephemeral: true });
        const role = interaction.options.getRole('role');
        const action = interaction.options.getString('action') || 'toggle';
        const has = member.roles.cache.has(role.id);
        const add = action === 'add' ? true : action === 'remove' ? false : !has;
        try {
            if (add) await member.roles.add(role); else await member.roles.remove(role);
        } catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed (check my role is above ${role}): ${e.message}`)], ephemeral: true }); }
        return interaction.reply({ embeds: [okEmbed(`${add ? 'Added' : 'Removed'} ${role} ${add ? 'to' : 'from'} ${user}.`)], ephemeral: true });
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (name === 'ban') {
        try { await g.members.ban(user.id, { reason, deleteMessageSeconds: (interaction.options.getInteger('delete_days') || 0) * 86400 }); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed to ban: ${e.message}`)], ephemeral: true }); }
        modLog(g, `**Ban** — ${user} (${user.id}) by ${interaction.user}. Reason: ${reason}`);
        return interaction.reply({ embeds: [okEmbed(`Banned **${user.tag}** — ${reason}`)] });
    }
    if (name === 'kick') {
        if (!member) return interaction.reply({ embeds: [errEmbed('That user is not in the server.')], ephemeral: true });
        try { await member.kick(reason); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed to kick: ${e.message}`)], ephemeral: true }); }
        modLog(g, `**Kick** — ${user} (${user.id}) by ${interaction.user}. Reason: ${reason}`);
        return interaction.reply({ embeds: [okEmbed(`Kicked **${user.tag}** — ${reason}`)] });
    }
    if (name === 'mute') {
        if (!member) return interaction.reply({ embeds: [errEmbed('That user is not in the server.')], ephemeral: true });
        const secs = parseDuration(interaction.options.getString('duration'));
        if (!secs || secs > 28 * 86400) return interaction.reply({ embeds: [errEmbed('Invalid duration (max 28d). Use e.g. `10m`, `2h`, `1d`.')], ephemeral: true });
        try { await member.timeout(secs * 1000, reason); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed to mute: ${e.message}`)], ephemeral: true }); }
        modLog(g, `**Mute** — ${user} (${user.id}) for ${interaction.options.getString('duration')} by ${interaction.user}. Reason: ${reason}`);
        return interaction.reply({ embeds: [okEmbed(`Muted **${user.tag}** for ${interaction.options.getString('duration')} — ${reason}`)] });
    }
    if (name === 'unmute') {
        if (!member) return interaction.reply({ embeds: [errEmbed('That user is not in the server.')], ephemeral: true });
        try { await member.timeout(null); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Failed: ${e.message}`)], ephemeral: true }); }
        return interaction.reply({ embeds: [okEmbed(`Unmuted **${user.tag}**.`)] });
    }
}
