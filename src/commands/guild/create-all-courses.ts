
import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { makeTextChannel } from '../../utils/discordUtils'
import path from 'path'
import fs from 'fs'


module.exports= {
    data: new SlashCommandBuilder()
        .setName('create-all-courses')
        .setDescription("create all courses from jsons"),
    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const bot = interaction.guild?.members.me

        //const member = await interaction.guild.members.fetch(userId); 
        if (bot && !bot.permissions.has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
        ])) {
            return await interaction.reply({
                content: "I don't have permission to create channels or manage roles!",
                flags: MessageFlags.Ephemeral,
            });
        }

        fs.readFile("data/alternate_schools/ecs_courses.json", "utf-8", async (err, data) => {
            if (err) {
                console.log("File read failed:", err)
                return;
            }
            const courses:Course[] = JSON.parse(data);
            courses.forEach(async (course) => {

                let courseName = course.course_number;
                course.instructors.forEach(instructor => {
                    const splitName = instructor.split(" ")
                    courseName += '-' + splitName[splitName.length - 1];
                });
                const channel = await makeTextChannel(courseName,interaction.user, interaction.guild);

                /*await channel.channel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    SendMessages: true,
                });*/

            })
        })
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully logged into all courses",
            flags: MessageFlags.Ephemeral,
        });

    },

}

