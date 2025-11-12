import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave-guild')
    .setDescription('Leave a specific guild by ID')
    .addStringOption(option =>
      option.setName('guild-id')
        .setDescription('The ID of the guild to leave')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.options.getString('guild-id', true);
      
      // Get the guild
      const guildToLeave = await interaction.client.guilds.fetch(guildId);
      
      if (!guildToLeave) {
        await interaction.reply({
          content: ` Could not find guild with ID: ${guildId}`,
          ephemeral: true
        });
        return;
      }

      const guildName = guildToLeave.name;
      
      // Leave the guild
      await guildToLeave.leave();
      
      await interaction.reply({
        content: ` Successfully left guild "${guildName}" (${guildId})`,
        ephemeral: true
      });
      
      console.log(` Left guild "${guildName}" (${guildId}) via command`);
      
    } catch (error) {
      console.error('Error leaving guild:', error);
      await interaction.reply({
        content: ` Error leaving guild: ${error}`,
        ephemeral: true
      });
    }
  },
};