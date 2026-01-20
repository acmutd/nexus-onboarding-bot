import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { updateHeading, checkSuperdocHealth, getDocIds, SuperdocApiResponse } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';
import { superdocQueue } from '../../utils/superdocQueue';

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-update-heading')
    .setDescription('Update an existing heading in a Superdoc document')
    .addStringOption(option =>
      option
        .setName('old_heading')
        .setDescription('Current name of the heading to update')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('new_heading')
        .setDescription('New name for the heading')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('document_name')
        .setDescription('Name of the document containing the heading')
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
      const oldHeading = interaction.options.getString('old_heading', true);
      const newHeading = interaction.options.getString('new_heading', true);
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
        content: `Queuing update for heading "${oldHeading}" in document ${documentId}...`,
      });

      // 3. Execute Heading Update via Queue
      // Using generic <SuperdocApiResponse> ensures 'result' has correct properties
      const result = await superdocQueue.enqueue<SuperdocApiResponse>(documentId, async () => {
        return await updateHeading(courseId, oldHeading, newHeading, documentId, SUPERDOC_INDEX);
      });

      if (result.status === 'heading updated') {
        let message = `Heading "${oldHeading}" updated to "${newHeading}" successfully!\n`;
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
      console.error('Error in superdoc-update-heading command:', error);
      
      // Handle queue timeout or standard error
      const errorMessage = error.message?.includes('timed out') 
        ? 'The update operation timed out. The document might be busy with another request.'
        : (error instanceof Error ? error.message : 'Unknown error occurred');

      await interaction.editReply({
        content: `Failed to update heading: ${errorMessage}`,
      });
    }
  },
};