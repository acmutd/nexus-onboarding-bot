
import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { findAdminJson } from '../../utils/discordUtils'

import fs from 'fs'
module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-courses')
        .setDescription("delete all courses")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('confirmation')
                .setDescription('Type "DELETION CONFIRMED" to confirm deletion')
                .setRequired(true)
        ),
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

            // Check confirmation
            const confirmation = interaction.options.getString('confirmation', true);
            if (confirmation !== 'DELETION CONFIRMED') {
                return await interaction.reply({
                    content: 'You must type "DELETION CONFIRMED" exactly to confirm this action.',
                    flags: MessageFlags.Ephemeral,
                });
            }

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
            const guild = interaction.guild
            if (!guild)
                throw Error('Guild not found')
            guild.channels.cache.forEach(async (channel) => {
                const channelName = channel.name.toLowerCase();
                if (channelName != "general" && channelName != "welcome" && channelName != "announcements")
                    await guild.channels.delete(channel.id)
            })
            //make and or set permission to course channel
            await interaction.reply({
                content: "Succesfully logged into all courses",
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            if(error instanceof Error){
                await interaction.reply({
                    content:error.message, 
                    flags: MessageFlags.Ephemeral
                })
            }
        }


    },

}
