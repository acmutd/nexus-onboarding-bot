
import {SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'

import fs from 'fs'
module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-courses')
        .setDescription("delete all courses"),
    async execute(interaction:ChatInputCommandInteraction) {
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
        if(!guild)
            throw Error('Guild not found')
        guild.channels.cache.forEach(async(channel)=>{
            if(channel.name.toLowerCase() != "general")
                await guild.channels.delete(channel.id)
        })
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully logged into all courses",
            flags: MessageFlags.Ephemeral,
        });

    },

}
