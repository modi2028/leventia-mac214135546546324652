import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { okEmbed, ts, now } from '../util.js';

const afkMap = (gid) => guild(gid).afk;

export const slash = [
    new SlashCommandBuilder().setName('afk-set').setDescription('Set your AFK status')
        .addStringOption(o => o.setName('reason').setDescription('Why you are AFK')),
    new SlashCommandBuilder().setName('afk-remove').setDescription('Remove your AFK status')
];
export const owns = ['afk-set', 'afk-remove'];
export const prefixOwns = ['afk', 'afk-remove'];

function setAfk(gid, userId, reason) {
    afkMap(gid)[userId] = { reason: reason || 'AFK', since: now() };
    persist();
}
function clearAfk(gid, userId) {
    if (afkMap(gid)[userId]) { delete afkMap(gid)[userId]; persist(); return true; }
    return false;
}

export async function handleSlash(interaction) {
    const gid = interaction.guild.id;
    if (interaction.commandName === 'afk-set') {
        setAfk(gid, interaction.user.id, interaction.options.getString('reason'));
        return interaction.reply({ embeds: [okEmbed(`✅ You're now AFK: ${afkMap(gid)[interaction.user.id].reason}`)], ephemeral: true });
    }
    clearAfk(gid, interaction.user.id);
    return interaction.reply({ embeds: [okEmbed('✅ AFK status removed.')], ephemeral: true });
}

export async function handlePrefix(cmd, message, args, rest) {
    const gid = message.guild.id;
    if (cmd === 'afk-remove') {
        clearAfk(gid, message.author.id);
        return message.reply({ embeds: [okEmbed('✅ AFK status removed.')] }).catch(() => {});
    }
    // u!afk [reason]
    setAfk(gid, message.author.id, rest);
    return message.reply({ embeds: [okEmbed(`✅ You're now AFK: ${afkMap(gid)[message.author.id].reason}`)] }).catch(() => {});
}

// Runs for every guild message (before prefix routing).
export async function onMessage(message) {
    const gid = message.guild.id;
    const map = afkMap(gid);

    // Author returns from AFK (ignore the command that just set it).
    if (map[message.author.id] && !/^u!afk(\s|$)/i.test(message.content)) {
        clearAfk(gid, message.author.id);
        message.reply({ embeds: [okEmbed(`👋 Welcome back ${message.author}, I removed your AFK.`)] })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    }

    // Someone pinged an AFK user.
    const pinged = message.mentions.users.filter(u => map[u.id]);
    if (pinged.size) {
        const lines = pinged.map(u => `💤 ${u} is AFK: ${map[u.id].reason} (since ${ts(map[u.id].since)})`).join('\n');
        message.reply({ embeds: [okEmbed(lines)] }).catch(() => {});
    }
}
