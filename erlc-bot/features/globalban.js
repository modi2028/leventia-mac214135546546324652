import { SlashCommandBuilder } from 'discord.js';
import { globalStore, persist } from '../store.js';
import { isAdmin, errEmbed, okEmbed, listEmbed, csv, now } from '../util.js';

// Roles allowed to issue global bans (besides server admins). Comma-separated in .env.
const GLOBAL_BAN_ROLES = csv(process.env.GLOBAL_BAN_ROLE_ID);

let clientRef = null;

function canGlobalBan(member) {
    if (isAdmin(member)) return true;
    return GLOBAL_BAN_ROLES.length > 0 && GLOBAL_BAN_ROLES.some(r => member.roles.cache.has(r));
}

export function init(ctx) {
    clientRef = ctx.client;
    // Enforce existing global bans on anyone who joins any server later.
    ctx.client.on('guildMemberAdd', (member) => {
        const ban = globalStore().bans.find(b => b.userId === member.id);
        if (ban) member.guild.members.ban(member.id, { reason: `Global ban: ${ban.reason}` }).catch(() => {});
    });
}

export const slash = [
    new SlashCommandBuilder().setName('globalban').setDescription('Ban a user across every server this bot is in')
        .addStringOption(o => o.setName('user_id').setDescription('Discord user ID to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('globalunban').setDescription('Lift a global ban everywhere')
        .addStringOption(o => o.setName('user_id').setDescription('Discord user ID').setRequired(true)),
    new SlashCommandBuilder().setName('globalbans').setDescription('List active global bans')
];
export const owns = ['globalban', 'globalunban', 'globalbans'];

export async function handleSlash(interaction) {
    if (!canGlobalBan(interaction.member)) return interaction.reply({ embeds: [errEmbed('You are not authorized to use global bans.')], ephemeral: true });
    const name = interaction.commandName;
    const store = globalStore();

    if (name === 'globalbans') {
        const lines = store.bans.map(b => `• <@${b.userId}> (\`${b.userId}\`) — ${b.reason} · by <@${b.by}>`);
        return interaction.reply({ embeds: [listEmbed(`Global Bans — ${store.bans.length}`, lines, { empty: 'No global bans.' })], ephemeral: true });
    }

    const userId = interaction.options.getString('user_id').trim();
    if (!/^\d{15,20}$/.test(userId)) return interaction.reply({ embeds: [errEmbed('Enter a valid Discord user ID (numbers only).')], ephemeral: true });

    if (name === 'globalban') {
        const reason = interaction.options.getString('reason');
        if (store.bans.some(b => b.userId === userId)) return interaction.reply({ embeds: [errEmbed('That user is already globally banned.')], ephemeral: true });
        store.bans.push({ userId, reason, by: interaction.user.id, ts: now() });
        persist();
        await interaction.deferReply({ ephemeral: true });
        let ok = 0, fail = 0;
        for (const g of clientRef.guilds.cache.values()) {
            try { await g.members.ban(userId, { reason: `Global ban by ${interaction.user.tag}: ${reason}` }); ok++; }
            catch { fail++; }
        }
        return interaction.editReply({ embeds: [okEmbed(`Globally banned <@${userId}> across **${ok}** server(s)${fail ? ` — ${fail} failed (missing Ban permission, or already banned).` : '.'}`)] });
    }

    // globalunban
    const idx = store.bans.findIndex(b => b.userId === userId);
    if (idx === -1) return interaction.reply({ embeds: [errEmbed('That user is not globally banned.')], ephemeral: true });
    store.bans.splice(idx, 1);
    persist();
    await interaction.deferReply({ ephemeral: true });
    let ok = 0;
    for (const g of clientRef.guilds.cache.values()) {
        try { await g.bans.remove(userId, 'Global unban'); ok++; } catch { /* not banned there */ }
    }
    return interaction.editReply({ embeds: [okEmbed(`Lifted global ban for <@${userId}> across **${ok}** server(s).`)] });
}
