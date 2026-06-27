import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, listEmbed, resolveChannel, safeReply, now, ts } from '../util.js';
import { panel } from '../theme.js';

const cfg = (gid) => guild(gid).config;

async function logPanel(g, payload) {
    const ch = (await resolveChannel(g, cfg(g.id).infractionLogChannel));
    if (ch) await ch.send(payload).catch(() => {});
    return ch;
}

function addInfraction(g, { userId, type, reason, modId }) {
    const data = guild(g.id);
    data.infractionSeq = (data.infractionSeq || 0) + 1;
    const rec = { id: data.infractionSeq, userId, type, reason, mod: modId, ts: now() };
    data.infractions.push(rec);
    persist();
    return rec;
}

function infractionPanel(g, rec, { removed = false } = {}) {
    return panel({
        guildId: g.id, kind: 'infractions',
        title: removed ? 'Infraction Removed' : 'Infraction Added',
        fields: [
            { name: 'ID', value: `#${rec.id}` },
            { name: 'Type', value: rec.type },
            { name: 'User', value: `<@${rec.userId}> (${rec.userId})` },
            { name: 'Moderator', value: `<@${rec.mod}> (${rec.mod})` },
            { name: 'Reason', value: rec.reason || '—' }
        ]
    });
}

export const slash = [
    new SlashCommandBuilder().setName('infraction').setDescription('Manage infractions')
        .addSubcommand(s => s.setName('add').setDescription('Add an infraction')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
            .addStringOption(o => o.setName('type').setDescription('e.g. Strike, Warning, Suspension').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove an infraction by ID')
            .addIntegerOption(o => o.setName('id').setDescription('Infraction ID').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('List infractions for a user')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
];
export const owns = ['infraction'];
export const prefixOwns = ['infraction'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const g = interaction.guild;

    if (sub === 'add') {
        const user = interaction.options.getUser('user');
        const rec = addInfraction(g, { userId: user.id, type: interaction.options.getString('type'), reason: interaction.options.getString('reason'), modId: interaction.user.id });
        const ch = await logPanel(g, infractionPanel(g, rec));
        user.send(`You received an infraction in **${g.name}** — **${rec.type}**: ${rec.reason}`).catch(() => {});
        return interaction.reply({ embeds: [okEmbed(`✅ Infraction **#${rec.id}** added${ch ? ` (logged in ${ch})` : ''}.`)], ephemeral: true });
    }
    if (sub === 'remove') {
        const id = interaction.options.getInteger('id');
        const arr = guild(g.id).infractions;
        const idx = arr.findIndex(r => r.id === id);
        if (idx === -1) return interaction.reply({ embeds: [errEmbed(`No infraction with ID #${id}.`)], ephemeral: true });
        const [rec] = arr.splice(idx, 1);
        persist();
        await logPanel(g, infractionPanel(g, rec, { removed: true }));
        return interaction.reply({ embeds: [okEmbed(`✅ Infraction **#${id}** removed.`)], ephemeral: true });
    }
    // list
    const user = interaction.options.getUser('user');
    const recs = guild(g.id).infractions.filter(r => r.userId === user.id);
    const lines = recs.map(r => `**#${r.id}** · ${r.type} — ${r.reason} · by <@${r.mod}> ${ts(r.ts)}`);
    return interaction.reply({ embeds: [listEmbed(`Infractions — ${user.tag} (${recs.length})`, lines, { empty: 'No infractions.' })], ephemeral: true });
}

export async function handlePrefix(cmd, message, args, rest) {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
    // u!infraction @user <type> <reason...>
    const user = message.mentions.users.first();
    const rest2 = rest.replace(/<@!?\d+>/, '').trim().split(/\s+/);
    const type = rest2.shift();
    const reason = rest2.join(' ');
    if (!user || !type || !reason) return message.reply({ embeds: [errEmbed('Usage: `u!infraction @user <type> <reason>`')] }).catch(() => {});
    const rec = addInfraction(message.guild, { userId: user.id, type, reason, modId: message.author.id });
    const ch = await logPanel(message.guild, infractionPanel(message.guild, rec));
    user.send(`You received an infraction in **${message.guild.name}** — **${type}**: ${reason}`).catch(() => {});
    return message.reply({ embeds: [okEmbed(`✅ Infraction **#${rec.id}** added${ch ? ` (logged in ${ch})` : ''}.`)] }).catch(() => {});
}
