const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-servers')
        .setDescription("Delete all servers the bot can delete"),
    async execute(interaction) {
        // Defer reply with ephemeral flag (no deprecated warning)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guild.members.me.permissions.has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
        ])) {
            try {
                await interaction.editReply({
                    content: "❌ I don't have permission to manage channels or roles!",
                });
            } catch (err) {
                console.error('❌ Failed to send permission error reply:', err);
            }
            return;
        }

        const guilds = interaction.client.guilds.cache;
        let deletedCount = 0;
        let failedCount = 0;

        for (const guild of guilds.values()) {
            if (!guild.name.includes('server')) {
                try {
                    if (guild.ownerId !== interaction.client.user.id) {
                        console.warn(`Cannot delete ${guild.name} — bot is not the owner.`);
                        failedCount++;
                        continue;
                    }

                    await guild.delete();
                    console.log(`Deleted guild: ${guild.name}`);
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete guild ${guild.name}:`, err);
                    failedCount++;
                }
            }
        }

        try {
            await interaction.editReply({
                content: `✅ Deleted ${deletedCount} servers.\n❌ Failed to delete ${failedCount} servers.`,
            });
        } catch (err) {
            console.error('❌ Failed to send final interaction reply:', err);
        }
    }
};
