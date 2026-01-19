import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { createHeading, checkSuperdocHealth, getDocIds, SuperdocApiResponse } from '../../utils/superdocApi';
import { checkChannelName } from "../../utils/discordUtils";
import { superdocQueue } from '../../utils/superdocQueue';

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-create-heading')
    .setDescription('Create a new heading in a Superdoc document')
    .addStringOption(option =>
      option
        .setName('heading')
        .setDescription('Name of the new heading to create')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('document_name')
        .setDescription('Name of the document to add the heading to')
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
      // 1. Verify API Health
      const isHealthy = await checkSuperdocHealth();
      if (!isHealthy) {
        return interaction.editReply({
          content: 'Superdoc API is not available. Please check if the server is running on port 8000.',
        });
      }

      const courseId = channelName;
      const newHeading = interaction.options.getString('heading', true);
      const documentName = interaction.options.getString('document_name', true);

      // 2. Fetch Document IDs
      const docIdsResult = await getDocIds(courseId);
      
      let documentId: string | undefined = undefined;
      
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
        content: `Queuing request to create heading "${newHeading}" in document ${documentId}...`,
      });

      // 3. Execute Heading Creation via Queue
      // We pass SuperdocApiResponse as the generic type to fix the 'unknown' issue
      const result = await superdocQueue.enqueue<SuperdocApiResponse>(documentId, async () => {
        return await createHeading(courseId, newHeading, documentId, SUPERDOC_INDEX);
      });

      // Now 'result' is correctly typed
      if (result.status === 'heading created') {
        let message = `Heading "${newHeading}" created successfully!\n`;
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
      console.error('Error in superdoc-create-heading command:', error);
      
      // Specific check for the queue timeout
      const errorMessage = error.message?.includes('timed out') 
        ? 'The operation timed out after 30 seconds. The document might be busy or the server is unresponsive.'
        : (error instanceof Error ? error.message : 'Unknown error occurred');

      await interaction.editReply({
        content: `Failed to create heading: ${errorMessage}`,
      });
    }
  },
};