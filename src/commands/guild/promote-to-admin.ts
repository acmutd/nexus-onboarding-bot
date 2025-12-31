
import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildTemplate, GuildMember, Guild, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { addAdmin,addAdminJson, AdminError, findAdminJson  } from '../../utils/discordUtils'
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
        .setDescription("admin")
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

            const target = interaction.options.getMentionable('target');
            
            if (!(target instanceof GuildMember)) {
                return await interaction.reply({
                    content: "Please mention a valid guild member to promote",
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const userId = target.id;
            const userName = target.displayName;
            
            // Add to admin JSON first
            await addAdminJson(userId);
            
            // Get all guilds and add admin role
            const guilds = interaction.client.guilds.cache;
            let successCount = 0;
            let failedGuilds: string[] = [];
            
            for (const [guildId, guild] of guilds) {
                try {
                    const fullGuild = await interaction.client.guilds.fetch(guildId);
                    const member = await fullGuild.members.fetch(userId).catch(() => null);
                    
                    if (!member) {
                        continue; // User not in this guild
                    }
                    
                    const bot = fullGuild.members.me;
                    if (bot && !bot.permissions.has([
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.ManageRoles,
                    ])) {
                        failedGuilds.push(`${fullGuild.name} (no permissions)`);
                        continue;
                    }
                    
                    // Find or create admin role
                    let adminRole = fullGuild.roles.cache.find(role => role.name.toLowerCase() === "admin");
                    
                    if (!adminRole) {
                        adminRole = await fullGuild.roles.create({
                            name: "Admin",
                            permissions: [PermissionsBitField.Flags.Administrator],
                            color: 0x0052CC,
                            hoist: true,
                            mentionable: true,
                            reason: "Auto-created admin role for promotion command"
                        });
                    }
                    
                    if (!member.roles.cache.has(adminRole.id)) {
                        await member.roles.add(adminRole);
                        successCount++;
                    }
                } catch (err) {
                    failedGuilds.push(guild.name);
                }
            }
            
            let message = `Successfully promoted ${userName} to admin across ${successCount} server(s).`;
            if (failedGuilds.length > 0) {
                message += `\n\nFailed in: ${failedGuilds.join(', ')}`;
            }
            
            await interaction.editReply({ content: message });
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

