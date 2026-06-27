import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, listEmbed, resolveChannel, safeReply, now, ts } from '../util.js';
import { panel } from '../theme.js';

const cfg = (gid) => guild(gid).config;

// Default channel for promotion announcements when none is set via /setup.
const PROMO_CHANNEL_ID = '1484647040569970959';
async function promoChannel(g) {
    return (await resolveChannel(g, cfg(g.id).promoChannel))
        || (await resolveChannel(g, PROMO_CHANNEL_ID));
}

// Posts the panel to the configured (or default) promotions channel and reports
// the outcome, so a failed send surfaces to the user instead of being swallowed.
async function postPromo(g, payload) {
    const ch = await promoChannel(g);
    if (!ch) return { ch: null, error: 'no-channel' };
    try {
        await ch.send(payload);
        return { ch, error: null };
    } catch (e) {
        return { ch, error: e.message };
    }
}

function logNote({ ch, error }) {
    if (error === 'no-channel') return ' ⚠️ No promotions channel set — use `/setup set-channel promotions`.';
    if (error) return ` ⚠️ Couldn't post to ${ch}: ${error} (check my permissions there).`;
    return ` in ${ch}.`;
}

function promotionPanel(g, rec, userTag) {
    return panel({
        guildId: g.id, kind: 'promotions', title: 'Promotion!',
        body: `<@${rec.userId}> has been promoted!`,
        fields: [
            { name: 'User', value: `<@${rec.userId}>` },
            { name: 'Promoted By', value: `<@${rec.mod}>` },
            { name: 'Old Rank', value: rec.fromRank || 'N/A' },
            { name: 'New Rank', value: rec.toRank },
            { name: 'Reason', value: rec.reason || '—' }
        ]
    });
}

export const slash = [
    new SlashCommandBuilder().setName('promotion').setDescription('Staff promotions')
        .addSubcommand(s => s.setName('add').setDescription('Promote a staff member')
            .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
            .addStringOption(o => o.setName('new_rank').setDescription('New rank').setRequired(true))
            .addStringOption(o => o.setName('old_rank').setDescription('Old rank (default N/A)'))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('history').setDescription('View promotion history for a user')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
];
export const owns = ['promotion'];
export const prefixOwns = ['promotion'];

async function record(g, { userId, toRank, fromRank, reason, modId }) {
    const data = guild(g.id);
    data.promotionSeq = (data.promotionSeq || 0) + 1;
    const rec = { id: data.promotionSeq, userId, toRank, fromRank: fromRank || 'N/A', reason, mod: modId, ts: now() };
    data.promotions.push(rec);
    persist();
    return rec;
}

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const g = interaction.guild;

    if (sub === 'add') {
        const user = interaction.options.getUser('user');
        const rec = await record(g, {
            userId: user.id, toRank: interaction.options.getString('new_rank'),
            fromRank: interaction.options.getString('old_rank'), reason: interaction.options.getString('reason'),
            modId: interaction.user.id
        });
        const res = await postPromo(g, promotionPanel(g, rec, user.tag));
        user.send(`🎉 You were promoted to **${rec.toRank}** in **${g.name}**!`).catch(() => {});
        return interaction.reply({ embeds: [okEmbed(`✅ Promotion logged${logNote(res)}`)], ephemeral: true });
    }
    // history
    const user = interaction.options.getUser('user');
    const recs = guild(g.id).promotions.filter(r => r.userId === user.id);
    const lines = recs.map(r => `**${r.fromRank} → ${r.toRank}** · by <@${r.mod}> ${ts(r.ts)}${r.reason ? ` — ${r.reason}` : ''}`);
    return interaction.reply({ embeds: [listEmbed(`Promotions — ${user.tag} (${recs.length})`, lines, { empty: 'No promotions.' })], ephemeral: true });
}

export async function handlePrefix(cmd, message, args, rest) {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
    // u!promotion @user <new rank> | <reason>
    const user = message.mentions.users.first();
    let body = rest.replace(/<@!?\d+>/, '').trim();
    if (!user || !body) return message.reply({ embeds: [errEmbed('Usage: `u!promotion @user <new rank> | <reason>`')] }).catch(() => {});
    const [toRank, reason] = body.split('|').map(s => s.trim());
    const rec = await record(message.guild, { userId: user.id, toRank, reason, modId: message.author.id });
    const res = await postPromo(message.guild, promotionPanel(message.guild, rec, user.tag));
    return message.reply({ embeds: [okEmbed(`✅ Promotion logged${logNote(res)}`)] }).catch(() => {});
}
