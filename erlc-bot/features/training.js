import { SlashCommandBuilder } from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, resolveChannel, safeReply, now } from '../util.js';
import { panel, branding } from '../theme.js';

const cfg = (gid) => guild(gid).config;

export const slash = [
    new SlashCommandBuilder().setName('training').setDescription('Trainings')
        .addSubcommand(s => s.setName('request').setDescription('Request a training')
            .addStringOption(o => o.setName('type').setDescription('Training type').setRequired(true))
            .addStringOption(o => o.setName('when').setDescription('When (e.g. "Today 5PM EST")').setRequired(true))
            .addStringOption(o => o.setName('timezone').setDescription('Your timezone (e.g. EST, GMT, CET)').setRequired(true))
            .addStringOption(o => o.setName('roblox_age').setDescription('Your Roblox age group').setRequired(true)
                .addChoices(
                    { name: 'Under 13', value: 'Under 13' },
                    { name: '13+', value: '13+' },
                    { name: '17+', value: '17+' },
                    { name: '18+', value: '18+' }
                )))
        .addSubcommand(s => s.setName('results').setDescription('Post training results')
            .addStringOption(o => o.setName('type').setDescription('Training type').setRequired(true))
            .addStringOption(o => o.setName('passed').setDescription('Who passed (mention or names)').setRequired(true))
            .addStringOption(o => o.setName('notes').setDescription('Notes')))
];
export const owns = ['training'];

export async function handleSlash(interaction) {
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const c = cfg(g.id);
    const data = guild(g.id);

    if (sub === 'request') {
        // Requests → trainingRequestChannel (falls back to the generic training channel).
        const ch = (await resolveChannel(g, c.trainingRequestChannel)) || (await resolveChannel(g, c.trainingChannel)) || interaction.channel;
        const type = interaction.options.getString('type');
        const when = interaction.options.getString('when');
        const timezone = interaction.options.getString('timezone');
        const robloxAge = interaction.options.getString('roblox_age');
        data.trainings.push({ id: (data.trainingSeq = (data.trainingSeq || 0) + 1), type, when, timezone, robloxAge, host: interaction.user.id, status: 'requested', ts: now() });
        persist();
        await ch.send(panel({
            guildId: g.id, kind: 'training', title: 'Training Requested',
            body: 'A training has been requested. React/attend if interested!',
            fields: [
                { name: 'Type', value: type },
                { name: 'When', value: when },
                { name: 'Timezone', value: timezone },
                { name: 'Roblox Age Group', value: robloxAge },
                { name: 'Requested by', value: `<@${interaction.user.id}>` }
            ],
            // Prefer the dedicated training ping role; fall back to the community role.
            ping: c.trainingPingRole || (branding(g.id).pingRole ? true : undefined)
        }));
        return interaction.reply({ embeds: [okEmbed(`Training request posted in ${ch}.`)], ephemeral: true });
    }

    // results — staff only → trainingResultsChannel (falls back to generic).
    if (!isStaff(interaction.member)) return safeReply(interaction, { embeds: [errEmbed('Staff only.')], ephemeral: true });
    const ch = (await resolveChannel(g, c.trainingResultsChannel)) || (await resolveChannel(g, c.trainingChannel)) || interaction.channel;
    await ch.send(panel({
        guildId: g.id, kind: 'training', title: 'Training Results',
        fields: [
            { name: 'Type', value: interaction.options.getString('type') },
            { name: 'Passed', value: interaction.options.getString('passed') },
            { name: 'Notes', value: interaction.options.getString('notes') || '—' },
            { name: 'Host', value: `<@${interaction.user.id}>` }
        ]
    }));
    return interaction.reply({ embeds: [okEmbed(`Results posted in ${ch}.`)], ephemeral: true });
}
