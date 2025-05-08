const { ChannelType, PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const makeTextChannel = async (interaction, coursePrefixes, courseNumber, courseTeachers) => {
    const channelName = `${coursePrefixes}-${courseNumber}-${courseTeachers}`;

    const existingChannel = interaction.guild.channels.cache.find(
        c => c.name === channelName
    );

    if (existingChannel) return existingChannel;

    try {
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permission_overwrites: [  // <-- corrected here
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ],
                },
                {
                    id: interaction.guild.members.me.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.ManageRoles,
                    ],
                },
            ],
        });

        return channel;
    } catch (error) {
        console.error('Error creating channel:', error);
        throw new Error('Failed to create the channel.');
    }
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('make')
        .setDescription('Create a text channel for each course on coursebook'),
    async execute(interaction) {
        try {
            const coursesPath = path.join(__dirname, '../../data/ecs_courses.json');

            const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));


            const createdChannels = [];
            const skippedChannels = [];

            const existingChannels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);

            for (const course of courses) {
                const coursePrefixes = Array.isArray(course.course_prefixes)
                    ? course.course_prefixes.map(prefix => prefix.toLowerCase()).join('/')
                    : course.course_prefixes.toLowerCase();

                const courseNumber = course.course_number.toLowerCase();

                if(length(course.instructors) >= 2){
                    for (let i = 0; i < course.instructors.length; i++){
                }
            }

                const courseTeachers = Array.isArray(course.instructors)
                    ? course.instructors.map(teacher => teacher.toLowerCase()).join('/')
                    : course.instructors
                    ? course.instructors.toLowerCase()
                    : 'unknown';

                const channelName = `${coursePrefixes}-${courseNumber}-${courseTeachers}`;

                if (existingChannels.find(c => c.name === channelName)) {
                    skippedChannels.push(channelName);
                    continue;
                }

                const channel = await makeTextChannel(interaction, coursePrefixes, courseNumber, courseTeachers);
                if (channel) {
                    createdChannels.push(channel.name);
                }
            }

            let response = '';
            if (createdChannels.length > 0) {
                response += `✅ Created channels: ${createdChannels.join(', ')}\n`;
            }
            if (skippedChannels.length > 0) {
                response += `⚠️ Skipped (already exist): ${skippedChannels.join(', ')}`;
            }
            if (response === '') {
                response = 'No channels were created or found.';
            }

            await interaction.reply(response);
        } catch (error) {
            console.error('Error creating channels:', error);
            await interaction.reply('An error occurred while creating the channels.');
        }
    },
};
