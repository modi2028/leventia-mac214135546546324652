import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isStaff, isAdmin, errEmbed, okEmbed, infoEmbed, COLOR } from '../util.js';
import { panel } from '../theme.js';

const parseColor = (s) => {
    if (!s) return undefined;
    const n = parseInt(String(s).replace('#', ''), 16);
    return Number.isNaN(n) ? undefined : n;
};

export const slash = [
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('membercount').setDescription('Member, online & boost counts'),
    new SlashCommandBuilder().setName('say').setDescription('Make the bot say something')
        .addStringOption(o => o.setName('message').setDescription('What to say').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Target channel')),
    new SlashCommandBuilder().setName('dm').setDescription('Send a DM to a user or role')
        .addMentionableOption(o => o.setName('target').setDescription('User or role').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),
    new SlashCommandBuilder().setName('embed').setDescription('Create a custom V2 formatted embed')
        .addStringOption(o => o.setName('title').setDescription('Title'))
        .addStringOption(o => o.setName('description').setDescription('Body text'))
        .addStringOption(o => o.setName('banner').setDescription('Banner image URL'))
        .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #2b6cb0'))
        .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: here)'))
        .addBooleanOption(o => o.setName('ping').setDescription('Ping the community role')),
    new SlashCommandBuilder().setName('embedsender').setDescription('Send an embed message to a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addStringOption(o => o.setName('title').setDescription('Title'))
        .addStringOption(o => o.setName('description').setDescription('Body text'))
        .addStringOption(o => o.setName('banner').setDescription('Banner image URL')),
    new SlashCommandBuilder().setName('purge').setDescription('Delete a number of recent messages')
        .addIntegerOption(o => o.setName('amount').setDescription('How many messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('user').setDescription('Only delete this user\'s messages')),
    new SlashCommandBuilder().setName('channel').setDescription('Channel tools')
        .addSubcommand(s => s.setName('rename').setDescription('Rename a channel')
            .addStringOption(o => o.setName('name').setDescription('New name').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)'))),
    new SlashCommandBuilder().setName('help').setDescription('View all slash & prefix commands')
];
export const owns = ['ping', 'membercount', 'say', 'dm', 'embed', 'embedsender', 'channel', 'purge', 'help'];
export const prefixOwns = ['ping', 'membercount', 'say', 'dm', 'purge', 'help'];

export async function handleSlash(interaction) {
    const name = interaction.commandName;
    const g = interaction.guild;

    if (name === 'ping') return interaction.reply({ embeds: [okEmbed(`🏓 Pong! \`${Math.round(interaction.client.ws.ping)}ms\` websocket.`)] });

    if (name === 'membercount') {
        await g.members.fetch().catch(() => {});
        const online = g.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
        return interaction.reply({ embeds: [infoEmbed(`${g.name}`).addFields(
            { name: 'Total Members', value: `${g.memberCount}`, inline: true },
            { name: 'Online', value: `${online}`, inline: true },
            { name: 'Boosts', value: `${g.premiumSubscriptionCount ?? 0}`, inline: true })] });
    }

    if (name === 'say') {
        if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        await ch.send({ content: interaction.options.getString('message'), allowedMentions: { parse: [] } });
        return interaction.reply({ embeds: [okEmbed(`✅ Sent in ${ch}.`)], ephemeral: true });
    }

    if (name === 'dm') {
        if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const target = interaction.options.getMentionable('target');
        const msg = interaction.options.getString('message');
        await interaction.deferReply({ ephemeral: true });
        const embed = infoEmbed(`📩 Message from ${g.name}`, msg);
        if (target.user) { // a member
            await target.send({ embeds: [embed] }).catch(() => {});
            return interaction.editReply({ embeds: [okEmbed(`✅ DM sent to ${target}.`)] });
        }
        // a role → DM each member (capped)
        const members = [...target.members.values()].slice(0, 50);
        let n = 0;
        for (const m of members) { if (!m.user.bot && await m.send({ embeds: [embed] }).then(() => true).catch(() => false)) n++; }
        return interaction.editReply({ embeds: [okEmbed(`✅ DM sent to ${n}/${members.length} members of ${target}.`)] });
    }

    if (name === 'embed' || name === 'embedsender') {
        if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const banner = interaction.options.getString('banner');
        const ping = name === 'embed' ? interaction.options.getBoolean('ping') : false;
        const color = name === 'embed' ? parseColor(interaction.options.getString('color')) : undefined;
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        if (!title && !description && !banner) return interaction.reply({ embeds: [errEmbed('Provide at least a title, description, or banner.')], ephemeral: true });

        await ch.send(panel({ guildId: g.id, kind: 'default', title, body: description, bannerUrl: banner, color, ping: ping ? true : undefined }));
        return interaction.reply({ embeds: [okEmbed(`✅ Embed sent in ${ch}.`)], ephemeral: true });
    }

    if (name === 'purge') {
        if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        await interaction.deferReply({ ephemeral: true });
        let toDelete = amount;
        if (user) {
            const fetched = await interaction.channel.messages.fetch({ limit: 100 });
            toDelete = [...fetched.filter(m => m.author.id === user.id).values()].slice(0, amount);
            if (!toDelete.length) return interaction.editReply({ embeds: [errEmbed(`No recent messages from ${user} found.`)] });
        }
        // filterOld=true skips messages older than 14 days instead of erroring.
        const deleted = await interaction.channel.bulkDelete(toDelete, true);
        return interaction.editReply({ embeds: [okEmbed(`🧹 Deleted **${deleted.size}** message(s)${user ? ` from ${user}` : ''}.`)] });
    }

    if (name === 'channel') {
        if (!isAdmin(interaction.member)) return interaction.reply({ embeds: [errEmbed('Admin only.')], ephemeral: true });
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        const newName = interaction.options.getString('name');
        await ch.setName(newName).catch(() => {});
        return interaction.reply({ embeds: [okEmbed(`✅ Renamed to **${newName}**.`)], ephemeral: true });
    }

    if (name === 'help') {
        const groups = chunkEmbeds(detailedHelp());
        await interaction.reply({ embeds: groups[0], ephemeral: true });
        for (let i = 1; i < groups.length; i++) await interaction.followUp({ embeds: groups[i], ephemeral: true });
        return;
    }
}

// Discord caps a message at 6000 chars across ALL its embeds — batch them so
// each message stays under that, otherwise the whole send is rejected.
function chunkEmbeds(embeds, max = 5500) {
    const len = (e) => {
        const d = e.data || {};
        return (d.title || '').length + (d.description || '').length +
            (d.fields || []).reduce((a, f) => a + f.name.length + f.value.length, 0) +
            (d.footer?.text || '').length;
    };
    const groups = [];
    let cur = [], total = 0;
    for (const e of embeds) {
        const l = len(e);
        if (cur.length && (total + l > max || cur.length >= 10)) { groups.push(cur); cur = []; total = 0; }
        cur.push(e); total += l;
    }
    if (cur.length) groups.push(cur);
    return groups;
}

// A full, multi-section guide. Returned as an array of embeds (Discord allows
// up to 10 per message), each section walking through real examples.
function detailedHelp() {
    const e = (title, desc) => new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(desc.slice(0, 4096));
    return [
        e('📘 ERLC Bot — Full Guide (1/10): Getting Started',
            '**How commands work**\n' +
            '• **Slash commands** (`/…`) — type `/` and pick from the list.\n' +
            '• **Prefix commands** (`u!…`) — type them as a normal message, e.g. `u!heal John`.\n\n' +
            '**Permissions**\n' +
            '• *Staff* = roles in `STAFF_ROLE_ID` (or anyone with Discord Administrator). Can run ERLC, sessions, tickets, infractions, etc.\n' +
            '• *Admin* = `ADMIN_ROLE_ID` or Administrator. Can run `/setup`, `/reset-config`, `/close-all-tickets`, raw `u!run`.\n\n' +
            '**See your whole config any time:** `/setup view`\n' +
            '**Full data dump:** `/debug`  •  **Wipe everything:** `/reset-config`'),

        e('🎨 ERLC Bot — Full Guide (2/10): Names, Branding & Banners',
            '**Change the server name shown in panels** (fixes "Flordia" → "Florida"):\n' +
            '`/setup branding field:name value:Florida State Roleplay`\n\n' +
            '**Other branding fields** (`/setup branding field:<x> value:<y>`):\n' +
            '• `name` — bold name in panels/welcome\n' +
            '• `footer` — small grey footer line\n' +
            '• `color` — accent stripe, hex e.g. `1e90d6`\n' +
            '• `logo` — top-right thumbnail image URL\n' +
            '• `separator` — the gradient bar image URL\n' +
            '• `emoji` — your custom emoji, e.g. `<:Florida:123456789>` (get the code by sending `\\:Florida:`)\n' +
            '• `join-url` — the "Join Server" button link\n\n' +
            '**Community ping role** (sessions/training): `/setup ping-role role:@Member`\n\n' +
            '**Banners** (the big header image per panel type):\n' +
            '`/setup banner slot:<type> url:<image>` — slots: information, regulations, guidelines, marketplace, dashboard, sessionStart, sessionBoost, sessionFull, sessionShutdown, tickets, welcome, giveaways, infractions, promotions, training, reviews, suggestions, default.'),

        e('🎫 ERLC Bot — Full Guide (3/10): Tickets',
            '**1. Wire it up:**\n' +
            '`/setup set-channel purpose:ticket-log channel:#ticket-logs`\n' +
            '`/setup support-roles role_ids:<staffRoleID,otherID>`\n\n' +
            '**2. Ticket types** (each gets its own auto-created category):\n' +
            '`/ticket type-list` — view them\n' +
            '`/ticket type-add name:<x> emoji:<:e:id> category:<cat> ping_role:@role support_roles:<ids>`\n' +
            '`/ticket type-remove id:<id>`  •  `/ticket reset-types` (restore defaults)\n\n' +
            '**3. Post the panel:** `/ticket setup channel:#open-a-ticket`\n\n' +
            '**Inside a ticket:**\n' +
            '• **Claim/Unclaim** button — staff & admins; channel turns 🟢 claimed / 🔴 unclaimed.\n' +
            '• **Close** button or `u!ticket close` — logs a transcript.\n' +
            '• `/forward` — re-route the ticket to another team (e.g. Management).\n' +
            '• `/adduser` / `/removeuser` — manage who can see it.\n' +
            '• `/close-all-tickets` (admin).'),

        e('🗂️ ERLC Bot — Full Guide (4/10): Dashboards (Information / Regulations / Guidelines / Marketplace)',
            'Dashboards are dropdown info panels. Build as many as you like.\n\n' +
            '**1. Create one:**\n' +
            '`/dashboard create name:information title:Information banner:information placeholder:View our Key Information! description:Welcome! Use the dropdown below.`\n\n' +
            '**2. Add dropdown options** (each reveals its own content when picked):\n' +
            '`/dashboard add-option dashboard:information label:Key Links emoji:<:e:id> content:• [Staff App](url)⏎• [Roblox Group](url)`\n' +
            '*(paste real line breaks and markdown links into `content`)*\n\n' +
            '**3. Post it:** `/dashboard post dashboard:information channel:#information`\n\n' +
            '**Edit later (no rebuild):**\n' +
            '`/dashboard edit dashboard:information banner:guidelines title:…`\n' +
            '`/dashboard edit-option dashboard:information option:key-links content:… banner:dashboard`\n' +
            '`/dashboard list` · `/dashboard remove-option` · `/dashboard delete`\n\n' +
            'Each option can have its **own banner** (`banner:` slot or `banner_url:`); leave blank for a clean card.'),

        e('📅 ERLC Bot — Full Guide (5/10): Sessions & Giveaways',
            '**Sessions** (post to the configured session channel):\n' +
            '`/setup set-channel purpose:session channel:#sessions`\n' +
            '`/session ssu` startup · `/session ssd` shutdown · `/session boost` · `/session full` · `/session vote needed:5` · `/session info`\n' +
            'Prefix: `u!session ssu|ssd|boost|full|vote` · `u!shutdown` (emergency).\n' +
            'Session panels pull **live ER:LC stats** and show a **Join Server** button.\n\n' +
            '**Giveaways:**\n' +
            '`/giveaway start prize:<x> duration:10m winners:1` — button entry, auto-ends, survives restarts.\n' +
            '`/giveaway end message_id:<id>` · `/giveaway reroll message_id:<id>`\n' +
            'Prefix: `u!giveaway create <duration> [winners] <prize>` · `u!giveaway end|reroll <id>`.'),

        e('🛡️ ERLC Bot — Full Guide (6/10): Staff Tools',
            '**Infractions:** `/infraction add user:@x type:Strike reason:…` (logs to the infraction channel + DMs the user)\n' +
            '`/infraction remove id:<n>` · `/infraction list user:@x` · prefix `u!infraction @x <type> <reason>`\n' +
            '`/setup set-channel purpose:infraction-log channel:#infractions`\n\n' +
            '**Promotions:** `/promotion add user:@x new_rank:SIA old_rank:N/A reason:…`\n' +
            '`/promotion history user:@x` · prefix `u!promotion @x <new rank> | <reason>`\n' +
            '`/setup set-channel purpose:promotions channel:#promotions`\n\n' +
            '**Reviews:** `/review staff:@x stars:5 comment:…` → `/setup set-channel purpose:reviews channel:#reviews`\n\n' +
            '**Training:**\n' +
            '`/training request type:… when:… timezone:EST roblox_age:13+` (asks timezone + Roblox age group)\n' +
            '`/training results type:… passed:@a @b notes:…`\n' +
            '`/setup set-channel purpose:training-request channel:#requests`\n' +
            '`/setup set-channel purpose:training-results channel:#results`\n' +
            '`/setup training-ping-role role:@Trainer` (who gets pinged on a request).'),

        e('💬 ERLC Bot — Full Guide (7/10): Community & Welcome',
            '**Welcome messages:** `/setup set-channel purpose:welcome channel:#welcome` — posts a panel + pings new members on join. Uses your brand name + emoji.\n\n' +
            '**Suggestions:** `/suggest suggestion:…` (vote buttons) · prefix `u!suggestion <text>` → `/setup set-channel purpose:suggestions channel:#suggestions`\n\n' +
            '**AFK:** `/afk-set reason:…` · `/afk-remove` · prefix `u!afk [reason]` / `u!afk-remove`. Pinging an AFK user shows their status; they auto-return on next message.\n\n' +
            '**Roleplay logs:** `/roleplay log title:… players:… details:…` · `/roleplay revoke id:<n>` → `/setup set-channel purpose:roleplay channel:#rp-logs`.\n\n' +
            '**Applications** (Staff/HR/Trainer/etc. — DM-based):\n' +
            '`/application create name:Staff results_channel:#app-review questions:Q1 | Q2 | Q3`\n' +
            '`/application add-question` · `remove-question` · `questions` — manage questions (max 20)\n' +
            '`/application post application:staff channel:#applications` — panel with an **Apply** button\n' +
            'Clicking Apply → the bot **DMs the questions one at a time**; finished answers post to the results channel with **Accept/Deny** buttons, and the applicant is **DMed the outcome**.\n' +
            '`/application edit` (title/text/banner/button/channel) · `toggle` (open/close) · `list` · `delete`'),

        e('🚓 ERLC Bot — Full Guide (8/10): ER:LC Commands & Live Status',
            '**Remote in-game commands** (staff) — `u!<cmd> <args>` runs `:<cmd>` on the server:\n' +
            '`u!heal` `u!kill` `u!respawn` `u!mod` `u!unmod` `u!admin` `u!unadmin` `u!jail` `u!unjail` `u!kick` `u!ban` `u!unban` `u!wanted` `u!unwanted` `u!pm` `u!h` `u!msg` `u!priority` `u!weather` `u!time` `u!startfire` `u!stopfire`\n' +
            '`u!run :<anything>` — raw command (admin). `/erlc command command:<x>` — slash version.\n\n' +
            '**Server data:** `/erlc server|players|joinlogs|killlogs|commandlogs|bans|vehicles|queue` · prefix `u!erlc <view>`\n' +
            '*(Needs `ERLC_SERVER_KEY` set, and your bot\'s IP allowlisted at api.erlc.gg/server-owners.)*\n\n' +
            '**Live status panel:** `/erlc-status start channel:#status interval:5` — posts a panel with players/queue/code + Join button that **auto-refreshes**. `/erlc-status stop` to end. Banner: `/setup banner slot:status url:…`'),

        e('🛠️ ERLC Bot — Full Guide (9/10): Moderation & Verification',
            '**Discord moderation** (staff; logged to the mod-log if set):\n' +
            '`/ban user reason [delete_days]` · `/kick` · `/mute user duration:10m|2h|1d` · `/unmute`\n' +
            '`/lock` / `/unlock [channel]` · `/slowmode seconds [channel]` · `/nick user [nickname]`\n' +
            '`/role user role [action:add|remove|toggle]` · `/purge amount [user]`\n' +
            '`/setup set-channel purpose:mod-log channel:#mod-logs` — log every action.\n\n' +
            '**Global bans** (across every server the bot is in): `/globalban user_id reason` · `/globalunban` · `/globalbans`. Re-bans on rejoin automatically. Authorized via `GLOBAL_BAN_ROLE_ID` or Administrator.\n\n' +
            '**Verification:** `/verify setup role:@Member channel:#verify [banner:url] [text:…]` — members click Verify to get the role. `/verify role` to change it · `/verify stats`.\n' +
            '**Auto-role:** `/setup autorole role:@Member` — given automatically on join (no click needed).'),

        e('🧰 ERLC Bot — Full Guide (10/10): Utility & Fun',
            '**Polls:** `/poll question:… option1:… option2:… [option3] [option4]` — button voting, one vote per person, live counts.\n' +
            '**Reminders:** `/remind in:10m|2h|1d text:…` — DMs you when time\'s up (survives restarts).\n' +
            '**Info:** `/userinfo [user]` (roles, join date, infraction count) · `/serverinfo` · `/avatar [user]` · `/botinfo` (uptime/servers/ping) · `/membercount` · `/ping`\n' +
            '**Media:** `/media-request image:<upload>` — submit in-game shots; high ranks Accept/Deny; accepted posts to the media channel.\n' +
            '**Messaging:** `/say` · `/dm target:@x|@role message:…` · `/embed` · `/embedsender` · `/channel rename`\n' +
            'Prefix: `u!ping` `u!say` `u!dm` `u!membercount` `u!purge <n>` `u!help`.')
    ];
}

export async function handlePrefix(cmd, message, args, rest) {
    const g = message.guild;
    if (cmd === 'ping') return message.reply({ embeds: [okEmbed(`🏓 Pong! \`${Math.round(message.client.ws.ping)}ms\``)] }).catch(() => {});
    if (cmd === 'help') {
        const groups = chunkEmbeds(detailedHelp());
        for (const g of groups) await message.channel.send({ embeds: g }).catch(() => {});
        return;
    }
    if (cmd === 'membercount') return message.reply({ embeds: [infoEmbed(`${g.name}`, `**Total:** ${g.memberCount}\n**Boosts:** ${g.premiumSubscriptionCount ?? 0}`)] }).catch(() => {});

    if (cmd === 'purge') {
        if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
        const amount = parseInt(args[0], 10);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) return message.reply({ embeds: [errEmbed('Usage: `u!purge <1-100>`')] }).catch(() => {});
        await message.delete().catch(() => {});
        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
        if (!deleted) return;
        const m = await message.channel.send({ embeds: [okEmbed(`🧹 Deleted **${deleted.size}** message(s).`)] }).catch(() => null);
        if (m) setTimeout(() => m.delete().catch(() => {}), 5000);
        return;
    }

    if (cmd === 'say') {
        if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
        if (!rest) return message.reply({ embeds: [errEmbed('Usage: `u!say <message>`')] }).catch(() => {});
        await message.delete().catch(() => {});
        return message.channel.send({ content: rest, allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (cmd === 'dm') {
        if (!isStaff(message.member)) return message.reply({ embeds: [errEmbed('Staff only.')] }).catch(() => {});
        const user = message.mentions.users.first();
        const body = rest.replace(/<@!?\d+>/, '').trim();
        if (!user || !body) return message.reply({ embeds: [errEmbed('Usage: `u!dm @user <message>`')] }).catch(() => {});
        const ok = await user.send({ embeds: [infoEmbed(`📩 Message from ${g.name}`, body)] }).then(() => true).catch(() => false);
        return message.reply({ embeds: [ok ? okEmbed(`✅ DM sent to ${user}.`) : errEmbed('Could not DM that user.')] }).catch(() => {});
    }
}
