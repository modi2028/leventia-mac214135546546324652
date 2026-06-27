import { SlashCommandBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, ts, now } from '../util.js';
import { panel, branding } from '../theme.js';
import * as erlc from '../erlcApi.js';

// Live ER:LC status panel: one pinned message per guild, edited on an interval.
const cfg = (gid) => guild(gid).config;
const timers = new Map(); // gid -> interval handle
let clientRef = null;

async function buildStatusPanel(gid) {
    let s = null;
    try { s = await erlc.getServerInfo(); } catch { /* API down/unauthorized */ }
    const b = branding(gid);
    const fields = [];
    let body;
    if (s) {
        const ownerName = await erlc.getRobloxUsername(s.OwnerId);
        body = `> Live status for **${s.Name ?? b.name ?? 'the server'}** — updates automatically.`;
        fields.push(
            { name: 'Players', value: `${s.CurrentPlayers ?? '?'}/${s.MaxPlayers ?? '?'}` },
            { name: 'In Queue', value: `${s.Queue ?? 0}` },
            { name: 'Owner', value: ownerName },
            { name: 'Server Code', value: s.JoinKey ? `\`${s.JoinKey}\`` : '—' }
        );
    } else {
        body = '> Could not reach the ER:LC API — the server may be offline or the key/IP not authorized.';
    }
    fields.push({ name: 'Last updated', value: ts(now()) });

    const url = b.joinUrl || (s?.JoinKey ? `https://policeroleplay.community/join?code=${s.JoinKey}` : '');
    const btn = /^https?:\/\//i.test(url)
        ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Server').setURL(url)]
        : undefined;

    return panel({
        guildId: gid, kind: 'status', title: 'Live Server Status', body, fields,
        buttons: btn, footer: b.name || undefined
    });
}

async function tick(gid) {
    const sp = cfg(gid).statusPanel;
    if (!sp || !clientRef) return;
    const g = clientRef.guilds.cache.get(gid);
    if (!g) return;
    const ch = g.channels.cache.get(sp.channelId) || await g.channels.fetch(sp.channelId).catch(() => null);
    if (!ch) return;
    const payload = await buildStatusPanel(gid);
    const msg = await ch.messages.fetch(sp.messageId).catch(() => null);
    if (msg) {
        await msg.edit(payload).catch(() => {});
    } else {
        // Panel message was deleted — repost and remember the new one.
        const fresh = await ch.send(payload).catch(() => null);
        if (fresh) { sp.messageId = fresh.id; persist(); }
    }
}

function schedule(gid) {
    clearInterval(timers.get(gid));
    const sp = cfg(gid).statusPanel;
    if (!sp) return;
    timers.set(gid, setInterval(() => tick(gid).catch(() => {}), Math.max(2, sp.interval || 5) * 60 * 1000));
}

export function init(ctx) {
    clientRef = ctx.client;
    for (const gid of Object.keys(ctx.allGuilds())) {
        if (cfg(gid).statusPanel) { schedule(gid); tick(gid).catch(() => {}); }
    }
}

export const slash = [
    new SlashCommandBuilder().setName('erlc-status').setDescription('Auto-updating live server status panel')
        .addSubcommand(s => s.setName('start').setDescription('Post a live status panel that refreshes automatically')
            .addChannelOption(o => o.setName('channel').setDescription('Channel for the panel (default: here)'))
            .addIntegerOption(o => o.setName('interval').setDescription('Refresh interval in minutes (default 5, min 2)').setMinValue(2).setMaxValue(60)))
        .addSubcommand(s => s.setName('stop').setDescription('Stop and forget the live status panel'))
];
export const owns = ['erlc-status'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'stop') {
        clearInterval(timers.get(g.id));
        timers.delete(g.id);
        delete cfg(g.id).statusPanel;
        persist();
        return interaction.reply({ embeds: [okEmbed('Live status panel stopped. (You can delete the old message.)')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    const interval = interaction.options.getInteger('interval') || 5;
    const msg = await ch.send(await buildStatusPanel(g.id)).catch(() => null);
    if (!msg) return interaction.editReply({ embeds: [errEmbed(`Couldn't post in ${ch} — check my permissions there.`)] });
    cfg(g.id).statusPanel = { channelId: ch.id, messageId: msg.id, interval };
    persist();
    schedule(g.id);
    return interaction.editReply({ embeds: [okEmbed(`Live status panel posted in ${ch} — refreshes every **${interval} min**.`)] });
}
