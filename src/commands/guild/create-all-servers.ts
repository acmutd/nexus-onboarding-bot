import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, TextChannel, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction, ChannelType } from 'discord.js'
import { makeTextChannel, findAdminJson } from '../../utils/discordUtils'
import path, { dirname } from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
interface Course {
    course_number: string,
    course_prefixes: string[],
    sections: string[],
    title: string,
    instructors: string[],
    class_numbers: string[],
    enrolled_current: number,
    enrolled_max: number,
    assistants: string[],
    dept: string
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-all-servers')
        .setDescription("Create all servers and courses")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Check if user is admin
            const isAdmin = await findAdminJson(interaction.user.id);
            if (!isAdmin) {
                return await interaction.reply({
                    content: "You must be an admin to use this command.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            const bot = interaction.guild?.members.me
            if (bot && !bot.permissions.has([
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ManageRoles,
            ])) {
                return await interaction.reply({
                    content: "I don't have permission to manage channels or roles!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const folderPath = path.join(__dirname, "../../../data/alternate_schools");
            const files = fs.readdirSync(folderPath);
            const guildManager = interaction.client.guilds;
            console.log(`Num Guilds:${guildManager.cache.size}`)
            console.log("Client user:", interaction.client.user?.tag);
            console.log("Is bot:", interaction.client.user?.bot);
            console.log("Guilds count:", interaction.client.guilds.cache.size);
            console.log("guilds.create type:", typeof interaction.client.guilds.create);
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

                // Send the welcome message from welcomemsg.txt
                try {
                    const welcomeMessagePath = path.join(process.cwd(), 'data', 'welcomemsg.txt');
                    const welcomeMessage = await readFile(welcomeMessagePath, 'utf-8');
                    await welcomeChannel.send(welcomeMessage);
                    console.log(`✅ Sent welcome message to #welcome in ${guild.name}`);
                } catch (err) {
                    console.error(`⚠️ Failed to send welcome message in ${guild.name}:`, err);
                }

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


                //Admin Role Creation: 

                const admin = await guild.roles.create({
                    name: 'Admin', permissions: [
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.KickMembers,
                        PermissionsBitField.Flags.Administrator

                    ]
                });


                //Interaction response 
                await interaction.followUp({
                    content: `Created **${serverName}**. Invite: ${invite.url}`,
                    flags: MessageFlags.Ephemeral
                });

                // Read file and create course channels
                const filePath = path.join(folderPath, file);
                try {
                    const data = fs.readFileSync(filePath, 'utf-8');
                    const courses: Course[] = JSON.parse(data);

                    for (const course of courses) {
                        let courseName = course.course_number;
                        course.instructors.forEach(instructor => {
                            const splitName = instructor.split(" ");
                            courseName += '-' + splitName[splitName.length - 1];
                        });

                        const channel = await makeTextChannel(courseName, interaction.user, interaction.guild);
                        channel.permissionOverwrites.create(admin.id, { ViewChannel: true })
                    }

                } catch (err) {
                    console.error(`Failed to process ${file}:`, err);
                }

                console.log(`Finished setting up: ${serverName}`);
            }

            await interaction.editReply({
                content: "Successfully created all servers with proper channel order!"
            });
        } catch (error) {
            console.error(`Error when creating all servers:${error}`);
            await interaction.editReply({
                content: "Error when creating servers"
            });
        }

    }
};
