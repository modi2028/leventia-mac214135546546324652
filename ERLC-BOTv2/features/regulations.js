import {
    SlashCommandBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
    TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags
} from 'discord.js';
import { isStaff, errEmbed, okEmbed, resolveChannel } from '../util.js';
import { guild } from '../store.js';

const cfg = (gid) => guild(gid).config;
const V2 = MessageFlags.IsComponentsV2;

// Rebuilt 1:1 from the provided Discohook designs (Components V2):
//   banner → text → separator → [dropdown, main only] → separator → footer banner.
// NOTE: these are signed Discord CDN URLs and will eventually expire; re-export
// fresh links from Discohook and update them here if the images stop rendering.
const REG_BANNER = 'https://media.discordapp.net/attachments/1484634986178154626/1485675634217713664/regulations.png?ex=6a356d41&is=6a341bc1&hm=224ba61826bffd4bb0146cc6ee572d816335f6ca3209a9c28b78f92d26a8b47e&format=webp&quality=lossless&';
const FOOTER_BANNER = 'https://media.discordapp.net/attachments/1484634986178154626/1485675632246390986/Footer_banner.png?ex=6a356d41&is=6a341bc1&hm=8e06cc12ba4a03b5e9110eea559471688dcd915a07496e085fd6ef182d97602b&format=webp&quality=lossless&width=1760&height=99&';

const MAIN_TEXT =
    "Welcome to <:Florida:1485730645643886663> **Florida State Roleplay's** regulation channel! " +
    "Here you can find all the rules for our server, this includes in-game rules and discord.";

const DISCORD_RULES_TEXT =
    "All of our discord guidelines are expected to be followed, any moderations against you for not reading it will be on you.\n\n" +
    "` 1  Be Respectful:`\n - Treat everyone with kindness and respect. No bullying, harassment, or excessive negativity. We're all here to have fun!\n\n" +
    "` 2  No Spamming:`\n - Don't flood channels with unnecessary messages, images, or emojis. Keep conversations relevant and organized.\n\n" +
    "` 3  Appropriate Content:`\n - Keep all content (messages, images, links) safe for work and family-friendly. No NSFW, gore, or similarly offensive material.\n\n" +
    "` 4  No Hate `\n- Speech/Discrimination: Absolutely no racism, sexism, homophobia, or any other form of discrimination. This is a zero-tolerance rule.\n\n" +
    "` 5  No Advertising:`\n - You are not allowed to advertise your own server, friends server, or any other sorts of things that is not on topic to FSRP.\n\n" +
    "` 6  Staff Respect`\n - Admins and mods are here to help and keep things running smoothly. Their decisions are final, so please follow their \ninstructions.\n\n" +
    "` 7  Use Channels Correctly:`\n- Please make sure to use channels correctly, for example chats should only be used for talking, media for photos, commands for commands.\n\n" +
    "` 8  No Doxing/Personal Info:`\n - Do not share anyone's private information (real names, addresses, phone numbers, etc.), including your own. Protect your privacy and others'.\n\n" +
    "` 9  No Exploiting Discussions:`\n - Do not discuss, share, or promote any methods of cheating, exploiting, or glitching in ERLC or other games.\n\n" +
    "` 10  No Impersonation:`\n - Don't pretend to be another user, staff member, or any official ERLC account.\n\n" +
    "` 11  Language:`\n - Keep chat primarily in English so everyone can understand and participate. Keep in mind to also be aware of what you're chatting before you send a message.\n\n" +
    "` 12  Constructive Criticism Only:`\n - If you have feedback or complaints, keep them constructive and send them privately to staff or use designated feedback channels. No public rants or drama.\n Common sense within chatting in public channels is also expected from members to follow these guidelines.\n\n" +
    "`13 Pinging:`\n- Do not ping any of our ownership members, if you really need to ping someone follow the chain of command, over 1 ping of HR will result in\n\n" +
    "`14 Terms of Service`\n- You are required to follow all discord terms of service otherwise you will be banned from our discord community.";

const ROBLOX_RULES_TEXT =
    "All of our Roblox guidelines are expected to be followed, any moderations against you for not reading it will be on you.\n\n" +
    " `1  RDM (Random Death Match):`\n-  No shooting or attacking other players without a solid roleplay reason. Keep the chaos contained to actual scenarios!\n\n" +
    "` 2  VDM (Vehicle Death Match):`\n - Don't use your car as a weapon. No running people over or ramming vehicles unless it's part of an active pursuit or roleplay situation.\n\n" +
    "` 3  FRP (Fail Roleplay):`\n-  Stay in character! Don't do things that break immersion, like instantly forgetting what just happened or acting super unrealistic.\n\n" +
    "` 4  NLR (New Life Rule):`\n - If you die, you forget everything from your previous life. It's a fresh start for your character, so no holding grudges or remembering past events!\n\n" +
    "` 5  LTAP (Leaving to Avoid Punishment):`\n - Don't ditch the server if you're about to face consequences in a roleplay situation. Stick around and play it out.\n\n" +
    "` 6  FKL (Full Kill):`\n - You can't just declare someone completely dead. If they're downed, EMS needs to be involved, or there needs to be a very clear roleplay reason to declare them out.\n\n" +
    "` 7  Cuff Rushing/Auto-arresting:`\n - LEOs, don't just instantly cuff people. There needs to be a roleplay interaction and a reason before the cuffs come out.\n\n" +
    "` 8  Tow Rushing:`\n - Don't instantly tow vehicles without proper roleplay or interaction. If it's a scene, play it out realistically before towing.\n\n" +
    "` 9  Unrealistic Roleplay`\n - No unrealistic actions that give you an unfair advantage. You can't magically do things your character shouldn't be able to.\n\n" +
    "` 10  Staff Disrespect`\n- Staff disrespect is not permitted and will be moderated.\n\n" +
    "` 11  ELS`\n- ELS and sirens should not be used when it is not needed as it causes a not needed disruption.\n\n" +
    "`12 Staff Disruption`\n- Do not disrupt staff while in a scene, as they are busy.\n\n" +
    "` 13 Abuse of the !mod command`\n- Do not abuse the !mod command as it will result in a moderation.\n\n" +
    "` 14  Breaking Rules On Staff`\n- Breaking rules on staff (for example, RDM, VDM, and others) will result in a kick and possibly a ban.\n\n" +
    "`15 Roblox Terms of Service`\n- Roblox ToS is expected to be followed, and if broken you will recive a unappealable ban.";

// One container with the shared banner on top, the body text, a separator, any
// extra rows (the picker on the main panel), and the footer banner at the bottom.
function regPanel(text, rows = []) {
    const c = new ContainerBuilder();
    c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(REG_BANNER)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.slice(0, 4000)));
    c.addSeparatorComponents(new SeparatorBuilder());
    for (const row of rows) c.addActionRowComponents(row);
    if (rows.length) c.addSeparatorComponents(new SeparatorBuilder());
    c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(FOOTER_BANNER)));
    return { components: [c], flags: V2 };
}

// The main hub: its dropdown is wired to OUR component namespace (regrules:view)
// so selecting an option actually shows that rule set — Discohook's own custom_id
// would just fail with "interaction failed".
function mainPanel() {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('regrules:view').setPlaceholder('Select a regulation category…')
            .addOptions(
                { label: 'Discord Regulations', value: 'discord', description: 'View our Discord rules' },
                { label: 'In-game Rules', value: 'roblox', description: 'View our in-game session rules' }
            )
    );
    return regPanel(MAIN_TEXT, [row]);
}

export const slash = [
    new SlashCommandBuilder().setName('regulations').setDescription('Post the regulations hub (with the rules dropdown)')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: here)')),
    new SlashCommandBuilder().setName('discord-rules').setDescription('Post the Discord regulations')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: here)')),
    new SlashCommandBuilder().setName('roblox-rules').setDescription('Post the in-game (Roblox) regulations')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: here)'))
];
export const owns = ['regulations', 'discord-rules', 'roblox-rules'];
export const componentNs = ['regrules'];

async function postPanel(interaction, payload, label) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    try {
        await ch.send(payload);
    } catch (e) {
        return interaction.reply({ embeds: [errEmbed(`Couldn't post the ${label} in ${ch}: ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`✅ ${label} posted in ${ch}.`)], ephemeral: true });
}

export async function handleSlash(interaction) {
    const name = interaction.commandName;
    if (name === 'regulations') return postPanel(interaction, mainPanel(), 'regulations hub');
    if (name === 'discord-rules') return postPanel(interaction, regPanel(DISCORD_RULES_TEXT), 'Discord regulations');
    if (name === 'roblox-rules') return postPanel(interaction, regPanel(ROBLOX_RULES_TEXT), 'in-game regulations');
}

// Anyone can use the hub dropdown to view a rule set — shown privately to them.
export async function handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const text = interaction.values[0] === 'discord' ? DISCORD_RULES_TEXT : ROBLOX_RULES_TEXT;
    const p = regPanel(text);
    return interaction.reply({ ...p, flags: V2 | MessageFlags.Ephemeral }).catch(() => {});
}
