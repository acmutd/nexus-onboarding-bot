const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const { makeTextChannel } = require('../../discord_utils/makeTextChannel');
const { makeTextThread } = require('../../discord_utils/makeTextThread');
const fs = require("fs");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-all-courses')
        .setDescription("create all courses from jsons"),
    async execute(interaction) {
        const userId = interaction.user.id;
        //const member = await interaction.guild.members.fetch(userId); 
        if (!interaction.guild.members.me.permissions.has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
        ])) {
            return await interaction.reply({
                content: "I don't have permission to create channels or manage roles!",
                flags: MessageFlags.Ephemeral,
            });
        }

        //Reading all courses from json file 
        fs.readFile("data/ecs_courses.json", "utf8", (err, data) => {
            if (err) {
                console.log("File read failed:", err)
                return;
            }
            //creating a channel and a superdoc thread for each course w/professor
            const courses = JSON.parse(data);
            courses.forEach(async (course) => {
                let courseName = course.course_number;
                course.instructors.forEach(instructor => {
                    const splitName = instructor.split(" ")
                    courseName += '-' + splitName[splitName.length - 1];
                });
                const channel = await makeTextChannel(interaction,courseName);
                /** add chanel permission handeling if u wish */
                await channel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    SendMessages: true,
                });

                //make and or set permission to section thread 
                const thread = await makeTextThread(interaction, channel, courseName);
                // Set thread permissions for the user
                console.log("Thread data:", thread);
                await thread.members.add(userId);
                const sdthread = await makeTextThread(interaction, channel, 'superdoc-' + courseName);
                await sdthread.members.add(userId);
            });
        })
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully logged into all courses",
            flags: MessageFlags.Ephemeral,
        });

    },

}
