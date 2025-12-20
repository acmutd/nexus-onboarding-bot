import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { createDocument, checkSuperdocHealth } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-create-document')
    .setDescription('Create a new Superdoc document')
    .addStringOption(option =>
      option
        .setName('document_name')
        .setDescription('Name of the document to create')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel as TextChannel;
    const channelName = channel.name;
    const check = await checkChannelName(channelName); 
    if(!check){
        return interaction.editReply({
          content: 'Please use superdoc commands in course channels only',
        })
      }
    try {
      // Check if API is healthy
      const isHealthy = await checkSuperdocHealth();
      if (!isHealthy) {
        return interaction.editReply({
          content: 'Superdoc API is not available. Please check if the server is running.',
        });
      }

      const courseId = channelName;
      const documentName = interaction.options.getString('document_name', true);

      await interaction.editReply({
        content: 'Creating document...',
      });

      const result = await createDocument(courseId, documentName, SUPERDOC_INDEX);

      if (result.status === 'success') {
        let message = `Document "${documentName}" created successfully!\n`;
        if (result.document_id) {
          message += `Document ID: ${result.document_id}\n`;
        }
        if (result.message) {
          message += `📝 ${result.message}`;
        }
        await interaction.editReply({ content: message });
      } else {
        await interaction.editReply({
          content: `Error: ${result.error || 'Unknown error occurred'}`,
        });
      }
    } catch (error) {
      console.error('Error in superdoc-create-document command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to create document: ${errorMessage}`,
      });
    }
  },
};

