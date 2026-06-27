import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, version as djsVersion } from 'discord.js';
import { guild, globalStore, persist } from '../store.js';
import { errEmbed, okEmbed, infoEmbed, parseDuration, now, ts, COLOR } from '../util.js';
import { panel } from '../theme.js';

let clientRef = null;
const reminderTimers = new Map(); // id -> timeout

// ── Polls ─────────────────────────────────────────────────────────────────────
const polls = (gid) => (guild(gid).polls ||= {});

function pollButtons(rec) {
    return rec.options.map((o, i) =>
        new ButtonBuilder().setCustomId(`poll:${i}`).setLabel(`${o.label} (${o.voters.length})`).setStyle(ButtonStyle.Secondary));
}
function pollPayload(gid, rec) {
    const total = rec.options.reduce((a, o) => a + o.voters.length, 0);
    return panel({
        guildId: gid, kind: 'default', title: `Poll: ${rec.question}`,
        body: `Cast your vote below — click again to change it.\n\n**${total}** vote(s) so far.`,
        buttons: pollButtons(rec), footer: `Started by ${rec.by}`
    });
}

// ── Reminders ─────────────────────────────────────────────────────────────────
function scheduleReminder(rec) {
    const ms = Math.max(0, (rec.at - now()) * 1000);
    if (ms > 20 * 86400 * 1000) return; // beyond timer range; init() reschedules on later restarts
    reminderTimers.set(rec.id, setTimeout(() => fireReminder(rec).catch(() => {}), ms));
}
async function fireReminder(rec) {
    reminderTimers.delete(rec.id);
    const store = globalStore();
    store.reminders = (store.reminders || []).filter(r => r.id !== rec.id);
    persist();
    const user = await clientRef.users.fetch(rec.userId).catch(() => null);
    const text = `⏰ Reminder: ${rec.text}`;
    if (user) {
        const ok = await user.send(text).then(() => true).catch(() => false);
        if (ok) return;
    }
    // DM closed — fall back to the channel it was created in.
    const ch = await clientRef.channels.fetch(rec.channelId).catch(() => null);
    if (ch) ch.send(`<@${rec.userId}> ${text}`).catch(() => {});
}

export function init(ctx) {
    clientRef = ctx.client;
    const store = globalStore();
    for (const rec of store.reminders || []) scheduleReminder(rec);
}

// ── Commands ──────────────────────────────────────────────────────────────────
export const slash = [
    new SlashCommandBuilder().setName('poll').setDescription('Start a button poll')
        .addStringOption(o => o.setName('question').setDescription('The question').setRequired(true))
        .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(o => o.setName('option3').setDescription('Option 3'))
        .addStringOption(o => o.setName('option4').setDescription('Option 4')),
    new SlashCommandBuilder().setName('remind').setDescription('Set a reminder (DMed to you)')
        .addStringOption(o => o.setName('in').setDescription('When, e.g. 10m, 2h, 1d (max 14d)').setRequired(true))
        .addStringOption(o => o.setName('text').setDescription('What to remind you about').setRequired(true)),
    new SlashCommandBuilder().setName('userinfo').setDescription('Info about a member')
        .addUserOption(o => o.setName('user').setDescription('Member (default: you)')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Info about this server'),
    new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar full-size')
        .addUserOption(o => o.setName('user').setDescription('User (default: you)')),
    new SlashCommandBuilder().setName('botinfo').setDescription('Bot stats: uptime, servers, ping')
];
export const owns = ['poll', 'remind', 'userinfo', 'serverinfo', 'avatar', 'botinfo'];
export const componentNs = ['poll'];

const fmtUptime = (secs) => {
    const d = Math.floor(secs / 86400), h = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60;
    return `${d ? d + 'd ' : ''}${h}h ${m}m`;
};

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const name = interaction.commandName;

    if (name === 'poll') {
        const question = interaction.options.getString('question');
        const opts = ['option1', 'option2', 'option3', 'option4']
            .map(k => interaction.options.getString(k)).filter(Boolean);
        const rec = { question, by: interaction.user.tag, options: opts.map(label => ({ label: label.slice(0, 60), voters: [] })) };
        await interaction.deferReply({ ephemeral: true });
        const msg = await interaction.channel.send(pollPayload(g.id, rec)).catch(() => null);
        if (!msg) return interaction.editReply({ embeds: [errEmbed('Couldn\'t post the poll here.')] });
        polls(g.id)[msg.id] = rec;
        persist();
        return interaction.editReply({ embeds: [okEmbed('Poll posted.')] });
    }

    if (name === 'remind') {
        const secs = parseDuration(interaction.options.getString('in'));
        if (!secs || secs > 14 * 86400) return interaction.reply({ embeds: [errEmbed('Invalid time (max 14d). Use e.g. `10m`, `2h`, `1d`.')], ephemeral: true });
        const store = globalStore();
        store.reminders ||= [];
        const rec = {
            id: `${interaction.user.id}-${Date.now()}`,
            userId: interaction.user.id, channelId: interaction.channel.id,
            text: interaction.options.getString('text'), at: now() + secs
        };
        store.reminders.push(rec);
        persist();
        scheduleReminder(rec);
        return interaction.reply({ embeds: [okEmbed(`I'll remind you ${ts(rec.at)}: ${rec.text}`)], ephemeral: true });
    }

    if (name === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await g.members.fetch(user.id).catch(() => null);
        const infractions = guild(g.id).infractions.filter(r => r.userId === user.id).length;
        const e = new EmbedBuilder().setColor(COLOR).setTitle(user.tag).setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'User ID', value: user.id, inline: true },
                { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                ...(member ? [
                    { name: 'Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Roles', value: member.roles.cache.filter(r => r.id !== g.id).map(r => `${r}`).slice(0, 10).join(' ') || '—' }
                ] : []),
                { name: 'Infractions', value: `${infractions}`, inline: true }
            );
        return interaction.reply({ embeds: [e] });
    }

    if (name === 'serverinfo') {
        const owner = await g.fetchOwner().catch(() => null);
        const e = new EmbedBuilder().setColor(COLOR).setTitle(g.name).setThumbnail(g.iconURL({ size: 256 }))
            .addFields(
                { name: 'Members', value: `${g.memberCount}`, inline: true },
                { name: 'Boosts', value: `${g.premiumSubscriptionCount ?? 0}`, inline: true },
                { name: 'Owner', value: owner ? `${owner.user}` : '—', inline: true },
                { name: 'Channels', value: `${g.channels.cache.size}`, inline: true },
                { name: 'Roles', value: `${g.roles.cache.size}`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return interaction.reply({ embeds: [e] });
    }

    if (name === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        return interaction.reply({ embeds: [infoEmbed(`${user.tag} — Avatar`).setImage(user.displayAvatarURL({ size: 1024 }))] });
    }

    if (name === 'botinfo') {
        const totalMembers = interaction.client.guilds.cache.reduce((a, x) => a + (x.memberCount || 0), 0);
        const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
        return interaction.reply({ embeds: [infoEmbed('Bot Info').addFields(
            { name: 'Uptime', value: fmtUptime(process.uptime()), inline: true },
            { name: 'Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
            { name: 'Members', value: `${totalMembers}`, inline: true },
            { name: 'Ping', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
            { name: 'Memory', value: `${mem} MB`, inline: true },
            { name: 'discord.js', value: `v${djsVersion}`, inline: true }
        )] });
    }
}

export async function handleComponent(interaction) {
    const idx = parseInt(interaction.customId.split(':')[1], 10);
    const rec = polls(interaction.guild.id)[interaction.message.id];
    if (!rec || !rec.options[idx]) return interaction.reply({ embeds: [errEmbed('This poll is no longer tracked.')], ephemeral: true });
    const uid = interaction.user.id;
    const had = rec.options[idx].voters.includes(uid);
    for (const o of rec.options) o.voters = o.voters.filter(v => v !== uid); // one vote per person
    if (!had) rec.options[idx].voters.push(uid);                            // clicking again removes your vote
    persist();
    return interaction.update(pollPayload(interaction.guild.id, rec));
}
