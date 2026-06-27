import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { guild, persist } from '../store.js';
import { errEmbed, okEmbed, resolveChannel, now } from '../util.js';
import { panel } from '../theme.js';

const cfg = (gid) => guild(gid).config;

function voteRow(up = 0, down = 0) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest:up').setLabel(`👍 ${up}`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggest:down').setLabel(`👎 ${down}`).setStyle(ButtonStyle.Danger));
}

export const slash = [
    new SlashCommandBuilder().setName('suggest').setDescription('Submit a suggestion')
        .addStringOption(o => o.setName('suggestion').setDescription('Your suggestion').setRequired(true))
];
export const owns = ['suggest'];
export const prefixOwns = ['suggestion'];
export const componentNs = ['suggest'];

async function post(g, authorId, text) {
    const data = guild(g.id);
    data.suggestionSeq = (data.suggestionSeq || 0) + 1;
    const id = data.suggestionSeq;
    const ch = (await resolveChannel(g, cfg(g.id).suggestionChannel)) || null;
    const p = panel({ guildId: g.id, kind: 'suggestions', title: `Suggestion #${id}`, body: text, fields: [{ name: 'Submitted by', value: `<@${authorId}>` }] });
    p.components.push(voteRow());
    const target = ch || g.systemChannel;
    const msg = target ? await target.send(p) : null;
    data.suggestions.push({ id, messageId: msg?.id, authorId, text, up: [], down: [], ts: now() });
    persist();
    return { id, ch: target };
}

export async function handleSlash(interaction) {
    const { id, ch } = await post(interaction.guild, interaction.user.id, interaction.options.getString('suggestion'));
    return interaction.reply({ embeds: [okEmbed(`✅ Suggestion **#${id}** submitted${ch ? ` in ${ch}` : ''}.`)], ephemeral: true });
}

export async function handlePrefix(cmd, message, args, rest) {
    if (!rest) return message.reply({ embeds: [errEmbed('Usage: `u!suggestion <text>`')] }).catch(() => {});
    const { id, ch } = await post(message.guild, message.author.id, rest);
    return message.reply({ embeds: [okEmbed(`✅ Suggestion **#${id}** submitted${ch ? ` in ${ch}` : ''}.`)] }).catch(() => {});
}

export async function handleComponent(interaction) {
    const [, dir] = interaction.customId.split(':');
    const rec = guild(interaction.guild.id).suggestions.find(s => s.messageId === interaction.message.id);
    if (!rec) return interaction.reply({ embeds: [errEmbed('This suggestion is no longer tracked.')], ephemeral: true });
    const uid = interaction.user.id;
    rec.up = (rec.up || []).filter(x => x !== uid);
    rec.down = (rec.down || []).filter(x => x !== uid);
    if (dir === 'up') rec.up.push(uid); else rec.down.push(uid);
    persist();
    const p = panel({ guildId: interaction.guild.id, kind: 'suggestions', title: `Suggestion #${rec.id}`, body: rec.text, fields: [{ name: 'Submitted by', value: `<@${rec.authorId}>` }] });
    p.components.push(voteRow(rec.up.length, rec.down.length));
    await interaction.update(p);
}
