const { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate } = require('discord.js');
const { makeTextChannel } = require('../../discord_utils/makeTextChannel');
const { makeTextThread } = require('../../discord_utils/makeTextThread');
const path = require("path")
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


        const files = fs.readdirSync("data/alternate_schools")
        const guildManager = interaction.client.guilds

        files.forEach(async (file) => {
            const serverName = file.split('_')[0]
            console.log("Server name:", serverName)
            const guild = await guildManager.create({
                name: serverName,
                channels: [
                    {
                        name: "general",
                    }
                ]
            })
            const guildChannel = await guild.channels.cache.find(channel => channel.name == "general");
            const Invite = await guildChannel.createInvite({maxAge: 0, unique: true, reason: "Testing."});
            await interaction.channel.send(`Created guild. Here's the invite code: ${Invite.url}`)
            await fs.readFile(path.join("data/alternate_schools", file), "utf-8", async (err, data) => {
                if (err) {
                    console.log("File read failed:", err)
                    return;
                }
                const courses = JSON.parse(data);
                courses.forEach(async (course) => {

                    let courseName = course.course_number;
                    course.instructors.forEach(instructor => {
                        const splitName = instructor.split(" ")
                        courseName += '-' + splitName[splitName.length - 1];
                    });
                    const channel = await makeTextChannel(courseName, guild, interaction.user);
                    
                    /*await channel.channel.permissionOverwrites.edit(userId, {
                        ViewChannel: true,
                        SendMessages: true,
                    });*/
                  
                })

            })

        })
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully logged into all courses",
            flags: MessageFlags.Ephemeral,
        });

    },

}
