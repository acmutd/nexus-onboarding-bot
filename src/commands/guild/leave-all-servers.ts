import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction, GuildMember, Guild } from 'discord.js'
import { DiscordjsError, DiscordjsErrorCodes } from 'discord.js'
import { findAdminJson } from '../../utils/discordUtils'

import fs from 'fs'

async function waitForMember(guild: Guild, userId: string, timeout: number = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await guild.members.fetch(); // Refresh cache
        } catch (error) {
            if (error instanceof DiscordjsError && error.code == DiscordjsErrorCodes.GuildMembersTimeout)
                continue;
            else
                throw error
        }
        if (guild.members.cache.has(userId)) return true;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
    }
    return false; // Timeout
}
module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave-all-servers')
        .setDescription("leave all servers and transferownership to user created")
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
            const guilds = interaction.client.guilds.cache

            await guilds.forEach(async (guild) => {
                if (guild.name.includes('server'))
                    return;
                console.log(`Transfering ownership from ${guild.name}`)
                try {
                    await waitForMember(guild, userId)
                } catch (error) {
                    if (error instanceof DiscordjsError)
                        throw error
                    if (error instanceof Error && error.message.includes('Timeout'))
                        console.log(`${guild.name} skipped`)
                    else
                        throw error
                }

                //console.log("transfering ownership")
                /*await guild.edit({
                    owner: interaction.user.id
                })
                */
                guild.leave()

            })
            //make and or set permission to course channel
            await interaction.reply({
                content: "Succesfully Left all servers",
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            console.error(`Error when leaving servers:${error}`)
            await interaction.reply({
                content:`Error when leaving servers`, 
                flags: MessageFlags.Ephemeral
            })
        }


    },

}

