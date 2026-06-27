import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, listEmbed, resolveChannel, safeReply, now, ts } from '../util.js';
import { panel } from '../theme.js';

const cfg = (gid) => guild(gid).config;

export const slash = [
    new SlashCommandBuilder().setName('roleplay').setDescription('Roleplay scene logging')
        .addSubcommand(s => s.setName('log').setDescription('Log an active roleplay scene')
            .addStringOption(o => o.setName('title').setDescription('Scene title').setRequired(true))
            .addStringOption(o => o.setName('players').setDescription('Players involved').setRequired(true))
            .addStringOption(o => o.setName('details').setDescription('Details')))
        .addSubcommand(s => s.setName('revoke').setDescription('Revoke an active roleplay log')
            .addIntegerOption(o => o.setName('id').setDescription('Roleplay log ID').setRequired(true)))
];
export const owns = ['roleplay'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const data = guild(g.id);

    if (sub === 'log') {
        const id = (data.roleplaySeq = (data.roleplaySeq || 0) + 1);
        const title = interaction.options.getString('title');
        const players = interaction.options.getString('players');
        const details = interaction.options.getString('details') || '—';
        const ch = (await resolveChannel(g, cfg(g.id).roleplayChannel)) || interaction.channel;
        const msg = await ch.send(panel({
            guildId: g.id, kind: 'default', title: `Roleplay Log #${id}`,
            fields: [{ name: 'Scene', value: title }, { name: 'Players', value: players }, { name: 'Details', value: details }, { name: 'Logged by', value: `<@${interaction.user.id}>` }]
        }));
        data.roleplays.push({ id, title, players, details, host: interaction.user.id, messageId: msg.id, channelId: ch.id, ts: now(), revoked: false });
        persist();
        return interaction.reply({ embeds: [okEmbed(`✅ Roleplay logged as **#${id}** in ${ch}.`)], ephemeral: true });
    }

    // revoke
    const id = interaction.options.getInteger('id');
    const rec = data.roleplays.find(r => r.id === id);
    if (!rec) return interaction.reply({ embeds: [errEmbed(`No roleplay log #${id}.`)], ephemeral: true });
    rec.revoked = true; persist();
    const ch = await resolveChannel(g, rec.channelId);
    const msg = ch && await ch.messages.fetch(rec.messageId).catch(() => null);
    if (msg) await msg.edit(panel({ guildId: g.id, kind: 'default', title: `Roleplay Log #${id} (REVOKED)`, body: '~~This roleplay log has been revoked.~~', fields: [{ name: 'Scene', value: rec.title }] })).catch(() => {});
    return interaction.reply({ embeds: [okEmbed(`✅ Roleplay log **#${id}** revoked.`)], ephemeral: true });
}
