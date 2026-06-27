import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as erlc from '../erlcApi.js';
import { COLOR, isStaff, isAdmin, errEmbed, okEmbed, listEmbed, ts, safeReply } from '../util.js';

// u!<alias> <args>  →  :<ingame> <args>. Whitelisted for staff.
export const ERLC_COMMANDS = {
    heal:     { ingame: 'heal',     usage: 'u!heal <player|all>',        desc: 'Heal a player (or "all").' },
    kill:     { ingame: 'kill',     usage: 'u!kill <player|all>',        desc: 'Kill a player.' },
    respawn:  { ingame: 'respawn',  usage: 'u!respawn <player|all>',     desc: 'Respawn a player.' },
    refresh:  { ingame: 'refresh',  usage: 'u!refresh <player>',         desc: 'Refresh (re-load) a player.' },
    mod:      { ingame: 'mod',      usage: 'u!mod <player>',             desc: 'Give a player in-game mod.' },
    unmod:    { ingame: 'unmod',    usage: 'u!unmod <player>',           desc: 'Remove a player\'s in-game mod.' },
    admin:    { ingame: 'admin',    usage: 'u!admin <player>',           desc: 'Give a player in-game admin.' },
    unadmin:  { ingame: 'unadmin',  usage: 'u!unadmin <player>',         desc: 'Remove a player\'s in-game admin.' },
    jail:     { ingame: 'jail',     usage: 'u!jail <player>',            desc: 'Jail a player.' },
    unjail:   { ingame: 'unjail',   usage: 'u!unjail <player>',          desc: 'Release a player from jail.' },
    kick:     { ingame: 'kick',     usage: 'u!kick <player>',            desc: 'Kick a player.' },
    ban:      { ingame: 'ban',      usage: 'u!ban <player>',             desc: 'Ban a player.' },
    unban:    { ingame: 'unban',    usage: 'u!unban <player>',           desc: 'Unban a player.' },
    wanted:   { ingame: 'wanted',   usage: 'u!wanted <player>',          desc: 'Mark a player wanted.' },
    unwanted: { ingame: 'unwanted', usage: 'u!unwanted <player>',        desc: 'Clear wanted status.' },
    pm:       { ingame: 'pm',       usage: 'u!pm <player> <message>',    desc: 'Private-message a player.' },
    h:        { ingame: 'h',        usage: 'u!h <message>',              desc: 'Send a hint to everyone.' },
    hint:     { ingame: 'h',        usage: 'u!hint <message>',           desc: 'Send a hint to everyone.' },
    msg:      { ingame: 'm',        usage: 'u!msg <message>',            desc: 'Send a server message.' },
    priority: { ingame: 'pt',       usage: 'u!priority <seconds>',       desc: 'Start a priority timer.' },
    weather:  { ingame: 'weather',  usage: 'u!weather <clear|rain|...>', desc: 'Set the weather.' },
    time:     { ingame: 'time',     usage: 'u!time <0-23>',              desc: 'Set the in-game time.' },
    startfire:{ ingame: 'startfire',usage: 'u!startfire',                desc: 'Start a random fire.' },
    stopfire: { ingame: 'stopfire', usage: 'u!stopfire',                 desc: 'Stop all fires.' }
};
const NO_ARG = new Set(['startfire', 'stopfire']);

const splitNameId = (s) => {
    const [name, id] = String(s ?? '').split(':');
    return { name: name || 'Unknown', id: id || '' };
};

export async function runErlcCommand(raw) {
    const command = raw.startsWith(':') ? raw : `:${raw}`;
    await erlc.sendCommand(command);
    return command;
}

export async function buildErlcEmbed(view) {
    switch (view) {
        case 'server': {
            const s = await erlc.getServerInfo();
            return new EmbedBuilder().setColor(COLOR).setTitle(`${s.Name || 'ER:LC Server'}`).setTimestamp().addFields(
                { name: 'Players', value: `${s.CurrentPlayers ?? '?'} / ${s.MaxPlayers ?? '?'}`, inline: true },
                { name: 'Queue', value: `${s.Queue ?? 0}`, inline: true },
                { name: 'Join Key', value: `\`${s.JoinKey ?? '—'}\``, inline: true },
                { name: 'Owner ID', value: `${s.OwnerId ?? '—'}`, inline: true },
                { name: 'Verified Reqd', value: `${s.AccVerifiedReq ?? '—'}`, inline: true },
                { name: 'Team Balance', value: `${s.TeamBalance ? 'On' : 'Off'}`, inline: true }
            );
        }
        case 'players': {
            const players = await erlc.getPlayers();
            const lines = (players || []).map(p => {
                const { name, id } = splitNameId(p.Player);
                return `• **${name}** \`${id}\` — ${p.Team || '?'}${p.Callsign ? ` · ${p.Callsign}` : ''}${p.Permission && p.Permission !== 'Normal' ? ` · ${p.Permission}` : ''}`;
            });
            return listEmbed(`Online Players — ${lines.length}`, lines, { empty: 'No players online.' });
        }
        case 'joinlogs': {
            const logs = await erlc.getJoinLogs();
            const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map(l =>
                `${l.Join ? '🟢 Joined' : '🔴 Left'} **${splitNameId(l.Player).name}** ${ts(l.Timestamp)}`);
            return listEmbed('Join Logs', lines, { empty: 'No join logs.' });
        }
        case 'killlogs': {
            const logs = await erlc.getKillLogs();
            const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map(l =>
                `💀 **${splitNameId(l.Killer).name}** → **${splitNameId(l.Killed).name}** ${ts(l.Timestamp)}`);
            return listEmbed('Kill Logs', lines, { empty: 'No kill logs.' });
        }
        case 'commandlogs': {
            const logs = await erlc.getCommandLogs();
            const lines = (logs || []).sort((a, b) => b.Timestamp - a.Timestamp).map(l =>
                `**${splitNameId(l.Player).name}**: \`${l.Command}\` ${ts(l.Timestamp)}`);
            return listEmbed('Command Logs', lines, { empty: 'No command logs.' });
        }
        case 'bans': {
            const bans = await erlc.getBans();
            const entries = Object.entries(bans || {});
            return listEmbed(`Bans — ${entries.length}`, entries.map(([id, name]) => `• **${name}** \`${id}\``), { empty: 'No bans.' });
        }
        case 'vehicles': {
            const v = await erlc.getVehicles();
            return listEmbed(`Spawned Vehicles — ${(v || []).length}`, (v || []).map(x => `• **${x.Name}** — ${x.Owner}${x.Texture ? ` (${x.Texture})` : ''}`), { empty: 'No vehicles spawned.' });
        }
        case 'queue': {
            const ids = (await erlc.getQueue()) || [];
            const names = await Promise.all(ids.slice(0, 25).map(id => erlc.getRobloxUsername(id)));
            return listEmbed(`Queue — ${ids.length}`, names.map((n, i) => `${i + 1}. **${n}**`), { empty: 'Queue is empty.' });
        }
        default:
            return errEmbed(`Unknown view: ${view}`);
    }
}

export const VIEWS = ['server', 'players', 'joinlogs', 'killlogs', 'commandlogs', 'bans', 'vehicles', 'queue'];

export const slash = [
    new SlashCommandBuilder().setName('erlc').setDescription('ER:LC server management')
        .addSubcommand(s => s.setName('server').setDescription('Get server info'))
        .addSubcommand(s => s.setName('players').setDescription('Get online players'))
        .addSubcommand(s => s.setName('joinlogs').setDescription('Get join logs'))
        .addSubcommand(s => s.setName('killlogs').setDescription('Get kill logs'))
        .addSubcommand(s => s.setName('commandlogs').setDescription('Get command logs'))
        .addSubcommand(s => s.setName('bans').setDescription('Get bans'))
        .addSubcommand(s => s.setName('vehicles').setDescription('Get spawned vehicles'))
        .addSubcommand(s => s.setName('queue').setDescription('Get the join queue'))
        .addSubcommand(s => s.setName('command').setDescription('Execute an in-game ERLC command')
            .addStringOption(o => o.setName('command').setDescription('e.g. ":heal John" or "heal John"').setRequired(true)))
];
export const owns = ['erlc'];
export const prefixOwns = ['erlc', 'run', 'cmd', 'command', ...Object.keys(ERLC_COMMANDS)];

export async function handleSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'command') {
        if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('You lack permission to run ERLC commands.')], ephemeral: true });
        await interaction.deferReply();
        const sent = await runErlcCommand(interaction.options.getString('command'));
        return interaction.editReply({ embeds: [okEmbed(`✅ Executed \`${sent}\``)] });
    }
    await interaction.deferReply();
    return interaction.editReply({ embeds: [await buildErlcEmbed(sub)] });
}

export async function handlePrefix(cmd, message, args, rest) {
    const reply = (e) => message.reply({ embeds: [e] }).catch(() => {});

    if (cmd === 'erlc') {
        const view = (args[0] || '').toLowerCase();
        if (!VIEWS.includes(view)) return reply(errEmbed(`Usage: \`u!erlc <${VIEWS.join('|')}>\``));
        try { return reply(await buildErlcEmbed(view)); } catch (e) { return reply(errEmbed(e.message)); }
    }
    if (cmd === 'run' || cmd === 'cmd' || cmd === 'command') {
        if (!isAdmin(message.member)) return reply(errEmbed('You need the admin role to run raw commands.'));
        if (!rest) return reply(errEmbed('Usage: `u!run :<command> <args>`'));
        try { return reply(okEmbed(`✅ Executed \`${await runErlcCommand(rest)}\``)); } catch (e) { return reply(errEmbed(e.message)); }
    }
    const spec = ERLC_COMMANDS[cmd];
    if (spec) {
        if (!isStaff(message.member)) return reply(errEmbed('You lack permission to run ERLC commands.'));
        if (!NO_ARG.has(spec.ingame) && !rest) return reply(errEmbed(`Usage: \`${spec.usage}\``));
        try { return reply(okEmbed(`✅ Executed \`${await runErlcCommand(`${spec.ingame} ${rest}`.trim())}\``)); }
        catch (e) { return reply(errEmbed(e.message)); }
    }
}
