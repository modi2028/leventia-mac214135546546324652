import {
    SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder
} from 'discord.js';
import { guild, persist } from '../store.js';
import { isStaff, errEmbed, okEmbed, infoEmbed, listEmbed, COLOR, OK_COLOR, ERROR_COLOR } from '../util.js';
import { panel, branding } from '../theme.js';

// Application system: configurable types, each with its own panel, questions,
// and results channel. Applying = the bot DMs the questions one at a time and
// posts the answers for review with Accept/Deny buttons that DM the outcome.
const apps = (gid) => (guild(gid).applications ||= {});
const subs = (gid) => (guild(gid).appSubmissions ||= {});
const activeSessions = new Map(); // userId -> true (one application at a time)

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'app';
const MAX_QUESTIONS = 20;
const ANSWER_TIME = 15 * 60 * 1000; // per question

function defaultBody(gid, name) {
    const b = branding(gid);
    const emoji = b.emoji ? `${b.emoji} ` : '';
    return `> If you're interested in becoming a **${name}** for ${emoji}**${b.name || 'our server'}**, please click the button below to begin your application.\n\n` +
        `> Make sure you provide accurate and complete information. All applications are reviewed by the high-ranking team. You will be notified of the outcome via DM.\n\n` +
        `> Trolling or submitting false information will result in a permanent blacklist.`;
}

function appPanel(gid, app) {
    return panel({
        guildId: gid, kind: 'applications', bannerUrl: app.bannerUrl || undefined,
        title: app.title || 'Applications',
        body: app.body || defaultBody(gid, app.name),
        footer: branding(gid).name || undefined,
        buttons: [new ButtonBuilder().setCustomId(`app:${app.id}`)
            .setLabel(app.buttonLabel || `Apply for ${app.name}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(app.open === false)]
    });
}

const reviewRow = (disabled = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('appreview:accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('appreview:deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(disabled));

function submissionEmbed(app, user, answers, status) {
    const e = new EmbedBuilder()
        .setColor(status === 'accepted' ? OK_COLOR : status === 'denied' ? ERROR_COLOR : COLOR)
        .setTitle(`${app.name} Application`)
        .setDescription(`Applicant: ${user} (\`${user.id ?? user}\`)`)
        .setTimestamp();
    app.questions.forEach((q, i) => {
        e.addFields({ name: `${i + 1}. ${q}`.slice(0, 256), value: (answers[i] || '—').slice(0, 1024) });
    });
    if (status) e.addFields({ name: 'Status', value: status === 'accepted' ? 'Accepted' : 'Denied' });
    return e;
}

// The DM question loop. Runs detached after the button interaction is answered.
async function runApplication(interaction, app) {
    const user = interaction.user;
    const g = interaction.guild;
    activeSessions.set(user.id, true);
    try {
        const dm = await user.createDM();
        await dm.send({ embeds: [infoEmbed(`${app.name} Application — ${branding(g.id).name || g.name}`,
            `You're starting the **${app.name}** application (**${app.questions.length}** questions).\n` +
            `Answer each question in a single message. You have 15 minutes per question.\nType \`cancel\` at any time to abort.`)] });

        const answers = [];
        for (let i = 0; i < app.questions.length; i++) {
            await dm.send({ embeds: [infoEmbed(`Question ${i + 1} of ${app.questions.length}`, app.questions[i])] });
            const collected = await dm.awaitMessages({
                max: 1, time: ANSWER_TIME, errors: ['time'],
                filter: (m) => m.author.id === user.id
            }).catch(() => null);
            if (!collected) {
                await dm.send({ embeds: [errEmbed('Application timed out (no answer in 15 minutes). Run it again from the panel when ready.')] }).catch(() => {});
                return;
            }
            const ans = collected.first().content.trim();
            if (ans.toLowerCase() === 'cancel') {
                await dm.send({ embeds: [okEmbed('Application cancelled. You can restart it from the panel any time.')] }).catch(() => {});
                return;
            }
            answers.push(ans.slice(0, 1024));
        }

        // Deliver to the review channel.
        const ch = g.channels.cache.get(app.resultsChannel) || await g.channels.fetch(app.resultsChannel).catch(() => null);
        if (!ch) {
            await dm.send({ embeds: [errEmbed('Your answers could not be delivered (review channel missing). Please contact staff.')] }).catch(() => {});
            return;
        }
        const msg = await ch.send({ embeds: [submissionEmbed(app, user, answers)], components: [reviewRow()] });
        subs(g.id)[msg.id] = { userId: user.id, appId: app.id, answers, ts: Date.now() };
        persist();
        await dm.send({ embeds: [okEmbed(`Your **${app.name}** application has been submitted. The team will review it and you'll hear back via DM.`)] }).catch(() => {});
    } catch (e) {
        console.error('application flow error:', e.message);
    } finally {
        activeSessions.delete(user.id);
    }
}

export const slash = [
    new SlashCommandBuilder().setName('application').setDescription('Application system')
        .addSubcommand(s => s.setName('create').setDescription('Create an application type')
            .addStringOption(o => o.setName('name').setDescription('e.g. Staff, HR, Trainer').setRequired(true))
            .addChannelOption(o => o.setName('results_channel').setDescription('Where finished applications are sent').setRequired(true))
            .addStringOption(o => o.setName('questions').setDescription('Questions separated by | (you can add more later)'))
            .addStringOption(o => o.setName('title').setDescription('Panel title (default: Applications)'))
            .addStringOption(o => o.setName('description').setDescription('Panel text (default: standard application notice)'))
            .addStringOption(o => o.setName('banner').setDescription('Banner image URL'))
            .addStringOption(o => o.setName('button_label').setDescription('Button text (default: Apply for <name>)')))
        .addSubcommand(s => s.setName('edit').setDescription('Edit an application type')
            .addStringOption(o => o.setName('application').setDescription('Application id (see /application list)').setRequired(true))
            .addStringOption(o => o.setName('name').setDescription('New name'))
            .addChannelOption(o => o.setName('results_channel').setDescription('New results channel'))
            .addStringOption(o => o.setName('title').setDescription('New panel title'))
            .addStringOption(o => o.setName('description').setDescription('New panel text'))
            .addStringOption(o => o.setName('banner').setDescription('New banner URL ("none" to clear)'))
            .addStringOption(o => o.setName('button_label').setDescription('New button text')))
        .addSubcommand(s => s.setName('add-question').setDescription('Add a question')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true))
            .addStringOption(o => o.setName('question').setDescription('The question').setRequired(true)))
        .addSubcommand(s => s.setName('remove-question').setDescription('Remove a question by number')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true))
            .addIntegerOption(o => o.setName('number').setDescription('Question number (see /application questions)').setRequired(true).setMinValue(1)))
        .addSubcommand(s => s.setName('questions').setDescription('List an application\'s questions')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true)))
        .addSubcommand(s => s.setName('post').setDescription('Post the application panel')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')))
        .addSubcommand(s => s.setName('toggle').setDescription('Open/close an application (closed = button disabled)')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('List application types'))
        .addSubcommand(s => s.setName('delete').setDescription('Delete an application type')
            .addStringOption(o => o.setName('application').setDescription('Application id').setRequired(true)))
];
export const owns = ['application'];
export const componentNs = ['app', 'appreview'];

export async function handleSlash(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Staff only.')], ephemeral: true });
    const g = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const all = apps(g.id);

    if (sub === 'create') {
        const name = interaction.options.getString('name');
        let id = slugify(name), n = 1;
        while (all[id]) id = `${slugify(name)}-${++n}`;
        const questions = (interaction.options.getString('questions') || '')
            .split('|').map(q => q.trim()).filter(Boolean).slice(0, MAX_QUESTIONS);
        all[id] = {
            id, name,
            resultsChannel: interaction.options.getChannel('results_channel').id,
            title: interaction.options.getString('title') || '',
            body: interaction.options.getString('description') || '',
            bannerUrl: interaction.options.getString('banner') || '',
            buttonLabel: interaction.options.getString('button_label') || '',
            questions, open: true
        };
        persist();
        return interaction.reply({ embeds: [okEmbed(
            `Application **${name}** created (id \`${id}\`) with **${questions.length}** question(s).\n` +
            (questions.length ? '' : 'Add questions with `/application add-question`, then ') +
            `post it with \`/application post application:${id}\`.`)], ephemeral: true });
    }

    if (sub === 'list') {
        const lines = Object.values(all).map(a =>
            `**\`${a.id}\`** — ${a.name} · ${a.questions.length} question(s) · results → <#${a.resultsChannel}> · ${a.open === false ? 'CLOSED' : 'open'}`);
        return interaction.reply({ embeds: [listEmbed('Application Types', lines, { empty: 'None yet — `/application create`.' })], ephemeral: true });
    }

    const app = all[interaction.options.getString('application')];
    if (!app) return interaction.reply({ embeds: [errEmbed('No application with that id. See `/application list`.')], ephemeral: true });

    if (sub === 'edit') {
        const set = (k, v) => { if (v !== null && v !== undefined) app[k] = v === 'none' ? '' : v; };
        set('name', interaction.options.getString('name'));
        set('title', interaction.options.getString('title'));
        set('body', interaction.options.getString('description'));
        set('bannerUrl', interaction.options.getString('banner'));
        set('buttonLabel', interaction.options.getString('button_label'));
        const rc = interaction.options.getChannel('results_channel');
        if (rc) app.resultsChannel = rc.id;
        persist();
        return interaction.reply({ embeds: [okEmbed(`Updated **${app.name}**. Re-run \`/application post\` to refresh the panel.`)], ephemeral: true });
    }

    if (sub === 'add-question') {
        if (app.questions.length >= MAX_QUESTIONS) return interaction.reply({ embeds: [errEmbed(`Max ${MAX_QUESTIONS} questions.`)], ephemeral: true });
        app.questions.push(interaction.options.getString('question'));
        persist();
        return interaction.reply({ embeds: [okEmbed(`Question **${app.questions.length}** added to **${app.name}**.`)], ephemeral: true });
    }

    if (sub === 'remove-question') {
        const i = interaction.options.getInteger('number') - 1;
        if (!app.questions[i]) return interaction.reply({ embeds: [errEmbed('No question with that number.')], ephemeral: true });
        const [removed] = app.questions.splice(i, 1);
        persist();
        return interaction.reply({ embeds: [okEmbed(`Removed question: "${removed.slice(0, 100)}"`)], ephemeral: true });
    }

    if (sub === 'questions') {
        const lines = app.questions.map((q, i) => `**${i + 1}.** ${q}`);
        return interaction.reply({ embeds: [listEmbed(`${app.name} — Questions (${lines.length})`, lines, { empty: 'No questions yet.' })], ephemeral: true });
    }

    if (sub === 'post') {
        if (!app.questions.length) return interaction.reply({ embeds: [errEmbed('Add at least one question before posting the panel.')], ephemeral: true });
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        try { await ch.send(appPanel(g.id, app)); }
        catch (e) { return interaction.reply({ embeds: [errEmbed(`Couldn't post in ${ch}: ${e.message}`)], ephemeral: true }); }
        return interaction.reply({ embeds: [okEmbed(`Application panel for **${app.name}** posted in ${ch}.`)], ephemeral: true });
    }

    if (sub === 'toggle') {
        app.open = app.open === false; persist();
        return interaction.reply({ embeds: [okEmbed(`**${app.name}** is now **${app.open ? 'OPEN' : 'CLOSED'}**. Re-run \`/application post\` to refresh the panel button.`)], ephemeral: true });
    }

    if (sub === 'delete') {
        delete all[app.id]; persist();
        return interaction.reply({ embeds: [okEmbed(`Deleted application **${app.name}**.`)], ephemeral: true });
    }
}

export async function handleComponent(interaction) {
    const [ns, arg] = interaction.customId.split(':');
    const g = interaction.guild;

    if (ns === 'app') {
        const app = apps(g.id)[arg];
        if (!app || app.open === false) return interaction.reply({ embeds: [errEmbed('This application is currently closed.')], ephemeral: true });
        if (!app.questions.length) return interaction.reply({ embeds: [errEmbed('This application has no questions configured.')], ephemeral: true });
        if (activeSessions.has(interaction.user.id)) return interaction.reply({ embeds: [errEmbed('Finish your current application first (check your DMs).')], ephemeral: true });
        // Verify DMs are open before claiming success.
        const dm = await interaction.user.createDM().catch(() => null);
        const probe = dm && await dm.send({ embeds: [okEmbed(`Starting your **${app.name}** application…`)] }).then(() => true).catch(() => false);
        if (!probe) return interaction.reply({ embeds: [errEmbed('I couldn\'t DM you. Enable **Direct Messages** from server members (Privacy Settings) and try again.')], ephemeral: true });
        await interaction.reply({ embeds: [okEmbed('Check your DMs — your application has started.')], ephemeral: true });
        runApplication(interaction, app); // detached; one question at a time in DMs
        return;
    }

    // appreview:accept / appreview:deny
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errEmbed('Only staff can review applications.')], ephemeral: true });
    const rec = subs(g.id)[interaction.message.id];
    if (!rec) return interaction.reply({ embeds: [errEmbed('This submission is no longer tracked.')], ephemeral: true });
    const app = apps(g.id)[rec.appId] || { name: 'Application', questions: [] };
    const accepted = arg === 'accept';
    const user = await interaction.client.users.fetch(rec.userId).catch(() => null);

    const e = submissionEmbed(app, user || `<@${rec.userId}>`, rec.answers, accepted ? 'accepted' : 'denied')
        .addFields({ name: 'Reviewed by', value: `${interaction.user}` });
    await interaction.update({ embeds: [e], components: [reviewRow(true)] });

    if (user) {
        const b = branding(g.id);
        await user.send(accepted
            ? `Congratulations! Your **${app.name}** application in **${b.name || g.name}** has been **accepted**. A team member will follow up with next steps.`
            : `Thank you for applying. Unfortunately your **${app.name}** application in **${b.name || g.name}** has been **denied**. You may re-apply in the future.`
        ).catch(() => {});
    }
    delete subs(g.id)[interaction.message.id];
    persist();
}
