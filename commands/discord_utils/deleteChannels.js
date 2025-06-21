const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clean')
        .setDescription('Deletes all course-related text channels and the Teacher Sections category'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const deleted = [];
        const failed = [];

        // Delete matching text channels (like cs-4485, ceee-3377-smith)
        const textChannels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        for (const channel of textChannels.values()) {
            if (/^[a-z]+(-[a-z]+)*-\d{4}(-[a-z]+)*$/.test(channel.name)) {
                try {
                    await channel.delete();
                    deleted.push(channel.name);
                } catch (err) {
                    failed.push(channel.name);
                }
            }
        }

        // Delete Teacher Sections category if it exists
        const teacherCategory = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'teacher sections'
        );
        if (teacherCategory) {
            try {
                await teacherCategory.delete();
                deleted.push('Teacher Sections (category)');
            } catch (err) {
                failed.push('Teacher Sections (category)');
            }
        }

        // Prepare safe-length reply
        let summary = `🧹 Deleted ${deleted.length} item(s).\n`;
        if (failed.length > 0) summary += `⚠️ Failed to delete: ${failed.join(', ')}`;
        if (summary.length > 2000) {
            summary = `🧹 Deleted ${deleted.length} item(s).\n⚠️ Some names were omitted from reply due to length.`;
        }

        await interaction.editReply(summary);
    }
}