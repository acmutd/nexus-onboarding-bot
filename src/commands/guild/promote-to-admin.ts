
import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, GuildMember, Guild } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { addAdmin,addAdminJson, AdminError  } from '../../utils/discordUtils'
import path from 'path'
import fs from 'fs'
import { readFile, writeFile } from 'fs/promises';




module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote-to-admin')
        .addMentionableOption(option =>
            option
                .setName('target')
                .setDescription('select a user to promote to admin')
        )
        .setDescription("admin"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const target = interaction.options.getMentionable('target');
            const bot = interaction.guild?.members.me
            const guild = interaction.guild


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
            if(!guild)
                return await interaction.reply({
                    content: "Guild is unspecified",
                    flags:  MessageFlags.Ephemeral
                })

            await addAdmin(target,guild);
            await interaction.reply({
                content: `Succseffuly promoted ${(target as GuildMember).displayName} to admin`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            if(error instanceof AdminError)
                return await interaction.reply({
                    content: error.message, 
                    flags: MessageFlags.Ephemeral
                })
            if(error instanceof Error){
                console.error(`Error when promoting to admin:${error}`)
                return await interaction.reply({
                    content: "There was an error during promotion", 
                    flags: MessageFlags.Ephemeral
                })
            }
            
        }


    },

}

