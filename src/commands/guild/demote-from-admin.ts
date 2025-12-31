import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildMember, Guild, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { removeAdminJson, AdminError, findAdminJson } from '../../utils/discordUtils'

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote-from-admin')
        .addMentionableOption(option =>
            option
                .setName('target')
                .setDescription('select a user to demote from admin')
                .setRequired(true)
        )
        .setDescription("Remove admin privileges from a user")
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

            if (!target || !(target instanceof GuildMember)) {
                return await interaction.reply({
                    content: "Please mention a valid user to demote",
                    flags: MessageFlags.Ephemeral
                })
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const userId = target.id;
            const userName = target.displayName;
            
            // Remove from admin JSON first
            await removeAdminJson(userId);
            
            // Get all guilds and remove admin role
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
                    
                    // Find admin role
                    const adminRole = fullGuild.roles.cache.find(role => role.name.toLowerCase() === "admin");
                    
                    if (adminRole && member.roles.cache.has(adminRole.id)) {
                        await member.roles.remove(adminRole);
                        successCount++;
                    }
                } catch (err) {
                    failedGuilds.push(guild.name);
                }
            }
            
            let message = `Successfully demoted ${userName} from admin across ${successCount} server(s).`;
            if (failedGuilds.length > 0) {
                message += `\n\nFailed in: ${failedGuilds.join(', ')}`;
            }
            
            await interaction.editReply({ content: message });
        } catch (error) {
            if (error instanceof AdminError) {
                return await interaction.reply({
                    content: error.message,
                    flags: MessageFlags.Ephemeral
                })
            }
            if (error instanceof Error) {
                console.error(`Error when demoting from admin: ${error}`)
                return await interaction.reply({
                    content: "There was an error during demotion",
                    flags: MessageFlags.Ephemeral
                })
            }
        }
    },
}