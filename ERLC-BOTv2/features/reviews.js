import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { okEmbed, resolveChannel, now } from '../util.js';
import { panel } from '../theme.js';

const cfg = (gid) => guild(gid).config;
const stars = (n) => `${n}/5`;

export const slash = [
    new SlashCommandBuilder().setName('review').setDescription('Submit a staff review')
        .addUserOption(o => o.setName('staff').setDescription('Staff member').setRequired(true))
        .addIntegerOption(o => o.setName('stars').setDescription('1-5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(o => o.setName('comment').setDescription('Your feedback'))
];
export const owns = ['review'];

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const staff = interaction.options.getUser('staff');
    const n = interaction.options.getInteger('stars');
    const comment = interaction.options.getString('comment') || '—';
    const data = guild(g.id);
    data.reviews.push({ id: (data.reviewSeq = (data.reviewSeq || 0) + 1), staffId: staff.id, stars: n, comment, author: interaction.user.id, ts: now() });
    persist();

    const p = panel({
        guildId: g.id, kind: 'reviews', title: 'Staff Review',
        fields: [
            { name: 'Staff', value: `<@${staff.id}>` },
            { name: 'Rating', value: `${n}/5` },
            { name: 'Feedback', value: comment },
            { name: 'By', value: `<@${interaction.user.id}>` }
        ]
    });
    const ch = (await resolveChannel(g, cfg(g.id).reviewChannel)) || interaction.channel;
    await ch.send(p);
    return interaction.reply({ embeds: [okEmbed(`✅ Review submitted in ${ch}.`)], ephemeral: true });
}
