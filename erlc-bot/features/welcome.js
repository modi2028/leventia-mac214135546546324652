import { guild } from '../store.js';
import { resolveChannel } from '../util.js';
import { panel, branding } from '../theme.js';

// Posts a welcome panel when a member joins. Channel is set via
// /setup set-channel purpose:welcome. Requires the Server Members intent.
const cfg = (gid) => guild(gid).config;

export const slash = [];
export const owns = [];

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
            const b = branding(member.guild.id);
            const emoji = b.emoji ? `${b.emoji} ` : '';
            const name = b.name || member.guild.name;
            const payload = panel({
                guildId: member.guild.id, kind: 'welcome', title: 'Welcome',
                body: `${emoji}Welcome <@${member.id}> to **${name}**! We're glad to have you. ` +
                      `Please take a moment to read our information and guidelines, then enjoy your stay.`,
                footer: b.name || undefined
            });
            payload.allowedMentions = { users: [member.id] }; // ping just the new member
            await ch.send(payload);
        } catch (e) {
            console.error('welcome error:', e);
        }
    });
}
