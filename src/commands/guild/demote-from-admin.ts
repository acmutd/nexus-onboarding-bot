import { SlashCommandBuilder, MessageFlags, PermissionsBitField, GuildMember, Guild } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { removeAdmin, AdminError } from '../../utils/discordUtils'

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote-from-admin')
        .addMentionableOption(option =>
            option
                .setName('target')
                .setDescription('select a user to demote from admin')
                .setRequired(true)
        )
        .setDescription("Remove admin privileges from a user"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const target = interaction.options.getMentionable('target');
            const bot = interaction.guild?.members.me
            const guild = interaction.guild

            // Check bot permissions
            if (bot && !bot.permissions.has([
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ManageRoles,
            ])) {
                return await interaction.reply({
                    content: "I don't have permission to manage roles!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!guild) {
                return await interaction.reply({
                    content: "Guild is unspecified",
                    flags: MessageFlags.Ephemeral
                })
            }

            if (!target || !(target instanceof GuildMember)) {
                return await interaction.reply({
                    content: "Please mention a valid user to demote",
                    flags: MessageFlags.Ephemeral
                })
            }

            await removeAdmin(target, guild);
            await interaction.reply({
                content: `Successfully demoted ${target.displayName} from admin`,
                flags: MessageFlags.Ephemeral,
            });
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