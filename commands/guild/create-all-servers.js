const { SlashCommandBuilder, PermissionsBitField, MessageFlags, ChannelType } = require('discord.js');
const { makeTextChannel } = require('../../discord_utils/discordUtils');
const path = require("path");
const fs = require("fs");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-all-servers')
        .setDescription("Create all servers and courses"),
    async execute(interaction) {
        if (!interaction.guild.members.me.permissions.has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
        ])) {
            return await interaction.reply({
                content: "❌ I don't have permission to manage channels or roles!",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const folderPath = "data/ecs_only";
        const files = fs.readdirSync(folderPath);
        const guildManager = interaction.client.guilds;

        for (const file of files) {
            const serverName = file.split('_')[0];
            console.log("Server name:", serverName);

            // Create the server (no initial channels)
            const guild = await guildManager.create({
                name: serverName
            });

            // Delete any default channels (just in case)
            for (const channel of guild.channels.cache.values()) {
                await channel.delete().catch(console.error);
            }

            // Create #welcome first
            const welcomeChannel = await guild.channels.create({
                name: "welcome",
                type: ChannelType.GuildText
            });

            // Create #general second
            const generalChannel = await guild.channels.create({
                name: "general",
                type: ChannelType.GuildText
            });

            // Create invite that lands in #welcome
            const invite = await welcomeChannel.createInvite({
                maxAge: 0,
                unique: true,
                reason: "Landing in #welcome"
            });

            await interaction.followUp({
                content: `✅ Created **${serverName}**. Invite: ${invite.url}`,
                flags: MessageFlags.Ephemeral
            });

            // Read file and create course channels
            const filePath = path.join(folderPath, file);
            try {
                const data = fs.readFileSync(filePath, 'utf-8');
                const courses = JSON.parse(data);

                for (const course of courses) {
                    let courseName = course.course_number;
                    course.instructors.forEach(instructor => {
                        const splitName = instructor.split(" ");
                        courseName += '-' + splitName[splitName.length - 1];
                    });

                    await makeTextChannel(courseName, guild, interaction.user);
                }

            } catch (err) {
                console.error(`❌ Failed to process ${file}:`, err);
            }

            console.log(`Finished setting up: ${serverName}`);
        }

        await interaction.editReply({
            content: "✅ Successfully created all servers with proper channel order!"
        });
    }
};
