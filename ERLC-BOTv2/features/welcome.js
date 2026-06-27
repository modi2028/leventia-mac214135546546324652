import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { guild } from '../store.js';
import { resolveChannel } from '../util.js';
import { branding } from '../theme.js';

// Posts a welcome message when a member joins. Channel is set via
// /setup set-channel purpose:welcome. Requires the Server Members intent.
const cfg = (gid) => guild(gid).config;

export const slash = [];
export const owns = [];

// Plain (non-V2) message so nothing adds container/footer padding below it.
// One paragraph + a button row, matching the "Thanks for joining …" design.
const GIVEAWAY_CHANNEL_ID = '1503029371307557037';

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function welcomePayload(member) {
    const b = branding(member.guild.id);
    const emoji = b.emoji ? `${b.emoji} ` : '';
    const name = b.name || member.guild.name;
    const count = member.guild.memberCount;

    const row = new ActionRowBuilder().addComponents(
        // Join-position chip — disabled so it's a label, not a real button.
        new ButtonBuilder()
            .setCustomId('welcome:count')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(ordinal(count))
            .setDisabled(true)
    );
    // "Dashboard" link only renders when a URL is configured (.env JOIN_URL or
    // /setup branding join-url) — Link buttons require a URL.
    if (/^https?:\/\//i.test(b.joinUrl || '')) {
        row.addComponents(new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Dashboard')
            .setURL(b.joinUrl));
    }

    return {
        content: `👋 Thanks for joining **${emoji}${name}**, <@${member.id}>! We are so glad to have you apart of this ` +
                 `community. Make sure to join our **250k R$** giveaway in <#${GIVEAWAY_CHANNEL_ID}> and possibly win this awesome prize!`,
        components: [row],
        allowedMentions: { users: [member.id] } // ping just the new member
    };
}

export function init(ctx) {
    ctx.client.on('guildMemberAdd', async (member) => {
        try {
            if (member.user.bot) return;
            const c = cfg(member.guild.id);
            // Auto-role: hand out the configured role the moment someone joins.
            if (c.autoRole && member.guild.roles.cache.has(c.autoRole)) {
                member.roles.add(c.autoRole, 'Auto-role on join').catch(() => {});
            }
            const ch = await resolveChannel(member.guild, c.welcomeChannel);
            if (!ch) return;
            await ch.send(welcomePayload(member));
        } catch (e) {
            console.error('welcome error:', e);
        }
    });
}
