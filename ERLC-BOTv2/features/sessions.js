import {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { guild } from '../store.js';
import { isStaff, errEmbed, okEmbed, resolveChannel, safeReply, ts, now } from '../util.js';
import { panel, branding } from '../theme.js';
import * as erlc from '../erlcApi.js';

// In-memory vote tallies: messageId -> { voters:Set<userId>, needed }
const votes = new Map();
const cfg = (gid) => guild(gid).config;

// Default channel for session announcements when none is set via /setup.
const SESSION_CHANNEL_ID = '1503032169285816341';

async function targetChannel(g, fallback) {
    return (await resolveChannel(g, cfg(g.id).sessionChannel))
        || (await resolveChannel(g, SESSION_CHANNEL_ID))
        || fallback;
}

// kind → { slot, title, body }
const PANELS = {
    ssu:   { slot: 'sessionStart',    title: 'Session Startup', body: 'A session startup has been initiated and is now live. If you participated in the vote, you are expected to join within the next 15 minutes.' },
    ssd:   { slot: 'sessionShutdown', title: 'Session Shutdown', body: 'This session has now concluded. Thank you all for playing — keep an eye out for the next startup vote!' },
    boost: { slot: 'sessionBoost',    title: 'Session Boost',    body: 'There are many open spots in our server! Join up! Our roleplays are still going strong and the server is still actively moderated!' },
    full:  { slot: 'sessionFull',     title: 'Session Full',     body: 'The server is currently **full**! Join the queue and you\'ll get in as slots open up.' }
};

async function liveServerInfo() {
    try { return await erlc.getServerInfo(); } catch { return null; }
}

function joinButton(gid, s) {
    const b = branding(gid);
    const url = b.joinUrl || (s?.JoinKey ? `https://policeroleplay.community/join?code=${s.JoinKey}` : '');
    if (!/^https?:\/\//i.test(url)) return null;
    return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Server').setURL(url);
}

async function buildSessionPanel(g, kind, host) {
    const p = PANELS[kind];
    const s = await liveServerInfo();
    const fields = [];
    if (s) {
        const ownerName = await erlc.getRobloxUsername(s.OwnerId);   // username, not the numeric id
        fields.push(
            { name: 'Server Name', value: s.Name ?? '—' },
            { name: 'Owner', value: ownerName },
            { name: 'Server Code', value: s.JoinKey ? `\`${s.JoinKey}\`` : '—' },
            { name: 'Players', value: `${s.CurrentPlayers ?? '?'}/${s.MaxPlayers ?? '?'}` },
            { name: 'In Queue', value: `${s.Queue ?? 0}` }
        );
    }
    let body = `> ${p.body}\n\n**${branding(g.id).name || 'Server'}**`;
    if (fields.length) body += `\n\n**Server Information**`;
    if (kind === 'ssu' && host) fields.push({ name: 'Hosted by', value: `<@${host.id}>` }); // ping the Discord hoster
    fields.push({ name: 'Last updated', value: ts(now()) });

    const btn = joinButton(g.id, s);
    return panel({
        guildId: g.id, kind: p.slot, title: p.title, body, fields,
        ping: cfg(g.id).sessionPingRole || undefined, mentionUsers: host ? [host.id] : [],
        buttons: btn ? [btn] : undefined,
        footer: `Session Powered by ${branding(g.id).name || 'the server'}.`
    });
}

export const slash = [
    new SlashCommandBuilder().setName('session').setDescription('Session management')
        .addSubcommand(s => s.setName('info').setDescription('Session information panel'))
        .addSubcommand(s => s.setName('ssu').setDescription('Announce server startup'))
        .addSubcommand(s => s.setName('ssd').setDescription('Announce server shutdown'))
        .addSubcommand(s => s.setName('boost').setDescription('Call for server boosts'))
        .addSubcommand(s => s.setName('full').setDescription('Announce the server is full'))
        .addSubcommand(s => s.setName('vote').setDescription('Start a session vote')
            .addIntegerOption(o => o.setName('needed').setDescription('Votes needed (default 5)').setMinValue(1)))
];
export const owns = ['session'];
export const prefixOwns = ['session', 'shutdown'];
export const componentNs = ['sessionvote'];

function votePanel(gid, needed, count, reached) {
    return panel({
        guildId: gid, kind: 'sessionVote', title: 'Session Vote',
        body: reached
            ? `**Reached ${count}/${needed} votes!** Time to start.`
            : 'Click **Vote** below to call for a session start!',
        fields: [{ name: 'Votes', value: `**${count} / ${needed}**` }],
        ping: cfg(gid).sessionPingRole || undefined,
        footer: `Powered by ${branding(gid).name || 'the server'}.`
    });
}
const voteRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sessionvote:add').setLabel('Vote').setStyle(ButtonStyle.Success));

async function postVote(g, channel, needed) {
    const payload = votePanel(g.id, needed, 0, false);
    payload.components.push(voteRow());
    const msg = await channel.send(payload);
    votes.set(msg.id, { voters: new Set(), needed });
    return msg;
}

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const g = interaction.guild;

    if (sub === 'info') {
        const c = cfg(g.id);
        return interaction.reply({ embeds: [okEmbed(
            `**Session Channel:** <#${c.sessionChannel || SESSION_CHANNEL_ID}>\n` +
            `**Session Ping Role:** ${c.sessionPingRole ? `<@&${c.sessionPingRole}>` : 'none (set with /setup session-ping-role)'}\n\n` +
            'Use `/session ssu|ssd|boost|full|vote`.', 'Session Info')], ephemeral: true });
    }
    if (sub === 'vote') {
        await interaction.deferReply({ ephemeral: true });
        const ch = await targetChannel(g, interaction.channel);
        await postVote(g, ch, interaction.options.getInteger('needed') || 5);
        return interaction.editReply({ embeds: [okEmbed(`✅ Vote posted in ${ch}.`)] });
    }

    await interaction.deferReply({ ephemeral: true });
    const ch = await targetChannel(g, interaction.channel);
    await ch.send(await buildSessionPanel(g, sub, interaction.user));
    return interaction.editReply({ embeds: [okEmbed(`✅ Announced in ${ch}.`)] });
}

export async function handleComponent(interaction) {
    const v = votes.get(interaction.message.id);
    if (!v) return interaction.reply({ embeds: [errEmbed('This vote has expired.')], ephemeral: true });
    if (v.voters.has(interaction.user.id)) v.voters.delete(interaction.user.id);
    else v.voters.add(interaction.user.id);
    const count = v.voters.size;
    const payload = votePanel(interaction.guild.id, v.needed, count, count >= v.needed);
    payload.components.push(voteRow());
    await interaction.update(payload);
}

export async function handlePrefix(cmd, message, args) {
    if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
    const reply = (e) => message.reply({ embeds: [e] }).catch(() => {});
    const g = message.guild;

    if (cmd === 'shutdown') {
        const ch = await targetChannel(g, message.channel);
        await ch.send(await buildSessionPanel(g, 'ssd', message.author));
        return reply(okEmbed(`Emergency shutdown announced in ${ch}.`));
    }
    if (cmd === 'session') {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'vote') { const ch = await targetChannel(g, message.channel); await postVote(g, ch, 5); return reply(okEmbed(`✅ Vote posted in ${ch}.`)); }
        if (['ssu', 'ssd', 'boost', 'full'].includes(sub)) {
            const ch = await targetChannel(g, message.channel);
            await ch.send(await buildSessionPanel(g, sub, message.author));
            return reply(okEmbed(`✅ Announced in ${ch}.`));
        }
        return reply(errEmbed('Usage: `u!session <ssu|ssd|boost|full|vote>`'));
    }
}
