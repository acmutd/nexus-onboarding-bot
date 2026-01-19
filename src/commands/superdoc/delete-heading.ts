import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { deleteHeading, checkSuperdocHealth, getDocIds } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-delete-heading')
    .setDescription('Delete a heading from a Superdoc document')
    .addStringOption(option =>
      option
        .setName('heading')
        .setDescription('Name of the heading to delete')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('document_name')
        .setDescription('Name of the document to delete the heading from')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const channel = interaction.channel as TextChannel;
    const channelName = channel.name;
    const check = await checkChannelName(channelName); 
    
    if (!check) {
      return interaction.editReply({
        content: 'Please use superdoc commands in course channels only',
      });
    }

    try {
      // 1. Verify API Connectivity
      const isHealthy = await checkSuperdocHealth();
      if (!isHealthy) {
        return interaction.editReply({
          content: 'Superdoc API is not available. Please check if the server is running on port 8000.',
        });
      }

      const courseId = channelName;
      const heading = interaction.options.getString('heading', true);
      const documentName = interaction.options.getString('document_name', true);

      // 2. Fetch Document IDs via the GET endpoint
      const docIdsResult = await getDocIds(courseId);
      
      let documentId: string | undefined = undefined;

      // Handle matching based on the array/record returned by get_course_documents
      if (docIdsResult.documentIds && Array.isArray(docIdsResult.documentIds)) {
        const foundId = docIdsResult.documentIds.find(id => id === documentName);
        if (foundId) {
          documentId = foundId;
        }
      } else if (docIdsResult.ids && docIdsResult.ids[documentName]) {
        documentId = docIdsResult.ids[documentName];
      }

      if (!documentId) {
        return interaction.editReply({
          content: `Document "${documentName}" not found for course ${courseId}.`,
        });
      }

      await interaction.editReply({
        content: `Deleting heading "${heading}" from document ${documentId}...`,
      });

      // 3. Execute Heading Deletion
      // Matches Python: @app.delete("/headings/delete") -> {"status": "heading deleted", ...}
      const result = await deleteHeading(courseId, heading, documentId, SUPERDOC_INDEX);

      if (result.status === 'heading deleted') {
        let message = `Heading "${heading}" deleted successfully!\n`;
        if (result.documentId) {
          message += `Document ID: ${result.documentId}`;
        }
        await interaction.editReply({ content: message });
      } else {
        await interaction.editReply({
          content: `Error: ${result.detail || result.error || 'The server returned an unsuccessful status.'}`,
        });
      }
    } catch (error) {
      console.error('Error in superdoc-delete-heading command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to delete heading: ${errorMessage}`,
      });
    }
  },
};