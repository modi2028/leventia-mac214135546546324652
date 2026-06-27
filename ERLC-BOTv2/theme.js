// Central branding / rendering layer. Everything user-facing goes through here
// so the whole bot shares one look (Components V2: banner → content → bar → button).
//
// Assets are config-driven. Per-guild branding lives in store config.branding;
// blanks fall back to .env, then to neutral defaults. Missing image URLs are
// simply skipped, so the bot works before you've uploaded any banners.
import {
    ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
    SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, MessageFlags
} from 'discord.js';
import { guild } from './store.js';

const V2 = MessageFlags.IsComponentsV2;

const ENV = {
    logo: process.env.BRAND_LOGO_URL || '',
    separator: process.env.BRAND_SEPARATOR_URL || '',
    color: process.env.BRAND_COLOR ? parseInt(process.env.BRAND_COLOR.replace('#', ''), 16) : 0x2b6cb0,
    name: process.env.BRAND_NAME || '',
    footer: process.env.BRAND_FOOTER || '',
    pingRole: process.env.COMMUNITY_ROLE_ID || '',
    joinUrl: process.env.JOIN_URL || '',
    emoji: process.env.BRAND_EMOJI || ''
};

// Logical banner slots — set a URL per slot via /setup branding.
export const BANNER_SLOTS = [
    'default', 'infractions', 'promotions', 'sessionStart', 'sessionShutdown',
    'sessionBoost', 'sessionFull', 'sessionVote', 'dashboard', 'guidelines',
    'information', 'regulations', 'marketplace', 'welcome', 'verify', 'status', 'applications', 'suggestions', 'reviews', 'training', 'tickets', 'giveaways'
];

export function branding(guildId) {
    const b = (guildId && guild(guildId).config.branding) || {};
    return {
        banners: b.banners || {},
        logo: b.logo || ENV.logo,
        separator: b.separator || ENV.separator,
        color: b.color ?? ENV.color,
        name: b.name || ENV.name,
        footer: b.footer || ENV.footer,
        pingRole: b.pingRole || ENV.pingRole,
        joinUrl: b.joinUrl || ENV.joinUrl,
        emoji: b.emoji || ENV.emoji
    };
}

const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);

// Render a branded Components V2 message.
//   kind     – banner slot key (e.g. 'infractions')
//   title    – bold heading shown under the banner
//   body      – markdown paragraph(s)
//   fields   – [{ name, value }] rendered as the "> chevron" list
//   buttons  – array of ButtonBuilder (e.g. a link "Join Server")
//   ping     – true → ping the community role; or a role id string
//   footer   – override footer text (defaults to branding.footer)
// Returns a payload spreadable into .send() / .reply().
export function panel({ guildId, kind = 'default', title, body, fields, buttons, ping, footer, bannerUrl, color, noBanner, here, mentionUsers } = {}) {
    const b = branding(guildId);
    const c = new ContainerBuilder();
    const accent = color ?? b.color;
    if (accent) c.setAccentColor(accent);

    const pingId = ping === true ? b.pingRole : (typeof ping === 'string' ? ping : '');
    const pingLine = `${pingId ? `<@&${pingId}>` : ''}${here ? ' @here' : ''}`.trim();
    if (pingLine) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(pingLine));

    // Explicit bannerUrl (http(s) or an attachment:// reference) wins, else the
    // per-slot branding banner. noBanner forces a clean, image-less card.
    const isBannerRef = (s) => typeof s === 'string' && /^(https?|attachment):\/\//i.test(s);
    const banner = noBanner ? null : (isBannerRef(bannerUrl) ? bannerUrl : (b.banners[kind] || b.banners.default));
    if (isUrl(banner)) {
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)));
    }

    // Title + body + fields → one text block (optionally beside the logo).
    const blocks = [];
    if (title) blocks.push(`## ${title}`);
    if (body) blocks.push(body);
    if (fields?.length) blocks.push(fields.map(f => `> **${f.name}:** ${f.value}`).join('\n'));
    const content = blocks.join('\n\n') || '​';

    if (isUrl(b.logo)) {
        c.addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content.slice(0, 4000)))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(b.logo)));
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content.slice(0, 4000)));
    }

    if (buttons?.length) {
        c.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
    }

    // Gradient separator bar, then footer line.
    if (isUrl(b.separator)) {
        c.addSeparatorComponents(new SeparatorBuilder());
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(b.separator)));
    } else {
        c.addSeparatorComponents(new SeparatorBuilder());
    }
    const foot = footer ?? b.footer ?? '';
    const stamp = `<t:${Math.floor(Date.now() / 1000)}:f>`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${foot ? foot + ' • ' : ''}${stamp}`));

    return {
        components: [c],
        flags: V2,
        allowedMentions: { roles: pingId ? [pingId] : [], parse: here ? ['everyone'] : [], users: mentionUsers || [] }
    };
}

// Convenience: ephemeral V2 reply payload (note: V2 + ephemeral share the flags field).
export function ephemeralPanel(opts) {
    const p = panel(opts);
    return { ...p, flags: V2 | MessageFlags.Ephemeral };
}

// Server-info field block shared by session panels, from a PRC /server payload.
export function serverInfoFields(s) {
    return [
        { name: 'Server Name', value: s?.Name ?? '—' },
        { name: 'Owner', value: s?.OwnerId ?? '—' },
        { name: 'Server Code', value: s?.JoinKey ? `\`${s.JoinKey}\`` : '—' },
        { name: 'Players', value: `${s?.CurrentPlayers ?? '?'}/${s?.MaxPlayers ?? '?'}` },
        { name: 'In Queue', value: `${s?.Queue ?? 0}` }
    ];
}

export { V2 };
