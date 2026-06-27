import {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, safeReply, parseDuration, now } from '../util.js';
import { panel, branding } from '../theme.js';

let clientRef = null;
const timers = new Map();

const enterRow = (disabled = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway:enter').setLabel('Enter 🎉').setStyle(ButtonStyle.Success).setDisabled(disabled));

function gwPayload(gid, gw, { ended = false } = {}) {
    const p = panel({
        guildId: gid, kind: 'giveaways', title: gw.prize,
        body: ended ? 'This giveaway has **ended**.' : 'Click **Enter** below to join the giveaway!',
        fields: ended
            ? [{ name: 'Entries', value: `${gw.entries.length}` }]
            : [{ name: 'Winners', value: `${gw.winners}` }, { name: 'Ends', value: `<t:${gw.endsAt}:R>` }, { name: 'Entries', value: `${gw.entries.length}` }],
        footer: `Hosted by ${gw.host}`
    });
    p.components.push(enterRow(ended));
    return p;
}

function pickWinners(entries, n) {
    const pool = [...entries], winners = [];
    while (winners.length < n && pool.length) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return winners;
}

async function endGiveaway(gid, messageId) {
    clearTimeout(timers.get(messageId));
    timers.delete(messageId);
    const gw = guild(gid).giveaways[messageId];
    if (!gw || gw.ended) return null;
    gw.ended = true;
    persist();

    const guildObj = clientRef?.guilds.cache.get(gid);
    const channel = guildObj && await guildObj.channels.fetch(gw.channelId).catch(() => null);
    const msg = channel && await channel.messages.fetch(messageId).catch(() => null);
    const winners = pickWinners(gw.entries, gw.winners);
    if (msg) await msg.edit(gwPayload(gid, gw, { ended: true })).catch(() => {});
    if (channel) await channel.send(winners.length
        ? `🎉 Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won **${gw.prize}**.`
        : `No valid entries for **${gw.prize}** — no winner.`).catch(() => {});
    return winners;
}

function schedule(gid, messageId, endsAt) {
    timers.set(messageId, setTimeout(() => endGiveaway(gid, messageId).catch(() => {}), Math.max(0, (endsAt - now()) * 1000)));
}

export function init(ctx) {
    clientRef = ctx.client;
    for (const [gid, data] of Object.entries(ctx.allGuilds())) {
        for (const [mid, gw] of Object.entries(data.giveaways || {})) {
            if (!gw.ended) schedule(gid, mid, gw.endsAt);
        }
    }
}

export const slash = [
    new SlashCommandBuilder().setName('giveaway').setDescription('Giveaways')
        .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
            .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('e.g. 10m, 2h, 1d').setRequired(true))
            .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1)))
        .addSubcommand(s => s.setName('end').setDescription('End a giveaway now')
            .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand(s => s.setName('reroll').setDescription('Reroll a giveaway')
            .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
];
export const owns = ['giveaway'];
export const prefixOwns = ['giveaway'];
export const componentNs = ['giveaway'];

async function startGiveaway(channel, prize, durationStr, winners, host) {
    const secs = parseDuration(durationStr);
    if (!secs) return { error: 'Invalid duration. Use e.g. `10m`, `2h`, `1d`.' };
    const endsAt = now() + secs;
    const gw = { channelId: channel.id, prize, winners, endsAt, host, entries: [], ended: false };
    const msg = await channel.send(gwPayload(channel.guild.id, gw));
    guild(channel.guild.id).giveaways[msg.id] = gw;
    persist();
    schedule(channel.guild.id, msg.id, endsAt);
    return { msg };
}

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
        const { msg, error } = await startGiveaway(interaction.channel,
            interaction.options.getString('prize'), interaction.options.getString('duration'),
            interaction.options.getInteger('winners') || 1, interaction.user.tag);
        if (error) return interaction.reply({ embeds: [errEmbed(error)], ephemeral: true });
        return interaction.reply({ embeds: [okEmbed(`✅ Giveaway started — message ID \`${msg.id}\`.`)], ephemeral: true });
    }

    const mid = interaction.options.getString('message_id');
    const gw = guild(interaction.guild.id).giveaways[mid];
    if (!gw) return interaction.reply({ embeds: [errEmbed('No giveaway with that message ID.')], ephemeral: true });

    if (sub === 'end') {
        const winners = await endGiveaway(interaction.guild.id, mid);
        return interaction.reply({ embeds: [okEmbed(winners?.length ? `✅ Ended. Winners: ${winners.map(w => `<@${w}>`).join(', ')}` : '✅ Ended — no valid entries.')], ephemeral: true });
    }
    // reroll
    const winners = pickWinners(gw.entries, gw.winners);
    if (!winners.length) return interaction.reply({ embeds: [errEmbed('No entries to reroll.')], ephemeral: true });
    await interaction.channel.send(`🎉 Reroll! New winner(s) for **${gw.prize}**: ${winners.map(w => `<@${w}>`).join(', ')}`);
    return interaction.reply({ embeds: [okEmbed('✅ Rerolled.')], ephemeral: true });
}

export async function handleComponent(interaction) {
    const gw = guild(interaction.guild.id).giveaways[interaction.message.id];
    if (!gw || gw.ended) return interaction.reply({ embeds: [errEmbed('This giveaway has ended.')], ephemeral: true });
    const id = interaction.user.id;
    let msg;
    if (gw.entries.includes(id)) { gw.entries = gw.entries.filter(e => e !== id); msg = 'You left the giveaway.'; }
    else { gw.entries.push(id); msg = '🎉 You entered the giveaway! Good luck.'; }
    persist();
    await interaction.message.edit(gwPayload(interaction.guild.id, gw)).catch(() => {});
    return interaction.reply({ embeds: [okEmbed(msg)], ephemeral: true });
}

export async function handlePrefix(cmd, message, args) {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
    const reply = (e) => message.reply({ embeds: [e] }).catch(() => {});
    const sub = (args.shift() || '').toLowerCase();

    if (sub === 'create') {
        const duration = args.shift();
        const winners = parseInt(args[0], 10);
        if (Number.isInteger(winners)) args.shift();
        const prize = args.join(' ');
        if (!duration || !prize) return reply(errEmbed('Usage: `u!giveaway create <duration> [winners] <prize>`'));
        const { msg, error } = await startGiveaway(message.channel, prize, duration, Number.isInteger(winners) ? winners : 1, message.author.tag);
        if (error) return reply(errEmbed(error));
        return reply(okEmbed(`✅ Giveaway started — message ID \`${msg.id}\`.`));
    }
    if (sub === 'end' || sub === 'reroll') {
        const mid = args[0];
        const gw = guild(message.guild.id).giveaways[mid];
        if (!gw) return reply(errEmbed('No giveaway with that message ID.'));
        if (sub === 'end') { await endGiveaway(message.guild.id, mid); return reply(okEmbed('✅ Ended.')); }
        const winners = pickWinners(gw.entries, gw.winners);
        if (!winners.length) return reply(errEmbed('No entries to reroll.'));
        await message.channel.send(`🎉 Reroll! New winner(s) for **${gw.prize}**: ${winners.map(w => `<@${w}>`).join(', ')}`);
        return reply(okEmbed('✅ Rerolled.'));
    }
    return reply(errEmbed('Usage: `u!giveaway <create|end|reroll>`'));
}
