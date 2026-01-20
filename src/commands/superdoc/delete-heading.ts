import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { deleteHeading, checkSuperdocHealth, getDocIds, SuperdocApiResponse } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';
import { superdocQueue } from '../../utils/superdocQueue';

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

      // 2. Look up document ID
      const docIdsResult = await getDocIds(courseId);
      let documentId: string | undefined = undefined;

      // Access the dictionary directly using the documentName key
      if (docIdsResult.documentIds && typeof docIdsResult.documentIds === 'object') {
        documentId = docIdsResult.documentIds[documentName];
      }

      // Handle case where document name wasn't found
      if (!documentId) {
        const availableDocs = Object.keys(docIdsResult.documentIds || {}).join(', ');
        return interaction.editReply({
          content: `Could not find a document named "${documentName}" for this course. \nAvailable documents: ${availableDocs || 'None found'}`,
        });
      }

      await interaction.editReply({
        content: `Queuing deletion of heading "${heading}" from document ${documentId}...`,
      });

      // 3. Execute Heading Deletion via Queue
      // Passing SuperdocApiResponse to enqueue restores type safety for result
      const result = await superdocQueue.enqueue<SuperdocApiResponse>(documentId, async () => {
        return await deleteHeading(courseId, heading, documentId, SUPERDOC_INDEX);
      });

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
    } catch (error: any) {
      console.error('Error in superdoc-delete-heading command:', error);
      
      const errorMessage = error.message?.includes('timed out') 
        ? 'The operation timed out. The request was cancelled to prevent a queue deadlock.'
        : (error instanceof Error ? error.message : 'Unknown error occurred');

      await interaction.editReply({
        content: `Failed to delete heading: ${errorMessage}`,
      });
    }
  },
};