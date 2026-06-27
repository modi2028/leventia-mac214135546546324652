import {
    SlashCommandBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
    TextDisplayBuilder, SeparatorBuilder, MessageFlags
} from 'discord.js';
import { isStaff, errEmbed, okEmbed, resolveChannel } from '../util.js';
import { guild } from '../store.js';

const cfg = (gid) => guild(gid).config;

// Static "Information" panel — rebuilt from the provided Discohook design:
// top banner → welcome text + important links → separator → footer banner.
const INFO_BANNER = 'https://cdn.discordapp.com/attachments/1471572008356675585/1514735994451001417/Info.png?ex=6a3067d3&is=6a2f1653&hm=f8aa0049c917eb0b73dadfec56ba759ef6d9aa01f5897dec79571dbd8527c8cc&';
const FOOTER_BANNER = 'https://cdn.discordapp.com/attachments/1471572008356675585/1515321820264529940/Footer_banner.png?ex=6a308f2b&is=6a2f3dab&hm=1b87f2277579ed5e466809c75c4eda608657c214d3ba4a932a7b6b62c37a63ad&';
const INFO_TEXT =
    'Welcome to <:Florida:1485730645643886663> **Florida State Roleplay!** Florida State Roleplay is a ' +
    'realistic and community-focused roleplay server inspired by the diverse landscapes, cities, and culture ' +
    'of the State of Florida. Our goal is to provide an immersive and enjoyable experience for all players, ' +
    'whether you prefer law enforcement, fire and rescue, transportation services, or civilian roleplay.\n\n' +
    '**Important Links**\n' +
    '- [Server Regulations](https://discord.com/channels/1484625566370889740/1503031179782258818)\n' +
    '- [Applications](https://discord.com/channels/1484625566370889740/1484634773967208529)\n' +
    '- [Server Support](https://discord.com/channels/1484625566370889740/1484631976064585879)\n' +
    '- [Community Group](https://www.roblox.com/communities/651302991/Florida-State-Roleplay-NEW-ERLC#!/about)\n' +
    '- [Whitelisted Group](https://www.roblox.com/communities/893298210/Florida-State-Roleplay-Strict-Whitelisted#!/about)';

function informationPanel() {
    const c = new ContainerBuilder();
    c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(INFO_BANNER)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(INFO_TEXT));
    c.addSeparatorComponents(new SeparatorBuilder());
    c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(FOOTER_BANNER)));
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

export const slash = [
    new SlashCommandBuilder().setName('information').setDescription('Post the server information panel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: here)'))
];
export const owns = ['information'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
    const ch = interaction.options.getChannel('channel')
        || await resolveChannel(interaction.guild, cfg(interaction.guild.id).informationChannel)
        || interaction.channel;
    try {
        await ch.send(informationPanel());
    } catch (e) {
        return interaction.reply({ embeds: [errEmbed(`Couldn't post the panel in ${ch}: ${e.message}`)], ephemeral: true });
    }
    return interaction.reply({ embeds: [okEmbed(`✅ Information panel posted in ${ch}.`)], ephemeral: true });
}
