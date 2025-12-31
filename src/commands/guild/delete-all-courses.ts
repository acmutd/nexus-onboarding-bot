
import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { findAdminJson } from '../../utils/discordUtils'

import fs from 'fs'
module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-courses')
        .setDescription("delete all courses")
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
                if (channel.name.toLowerCase() != "general")
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
