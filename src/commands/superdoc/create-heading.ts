import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { createHeading, checkSuperdocHealth, getDocIds } from '../../utils/superdocApi';
import { checkChannelName } from "../../utils/discordUtils";

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

      // 2. Fetch Document IDs using the updated GET endpoint structure
      // Your Python backend returns {"courseId": "...", "documentIds": [...]}
      const docIdsResult = await getDocIds(courseId);
      
      let documentId: string | undefined = undefined;
      
      // Look for the document ID matching the provided document name
      // This assumes your backend returns a record/map or you are matching against the list
      if (docIdsResult.documentIds && Array.isArray(docIdsResult.documentIds)) {
        // If documentIds is a simple list, we use the name provided as the ID 
        // Or if it's a record/object, we look up the key
        const foundId = docIdsResult.documentIds.find(id => id === documentName);
        if (foundId) {
          documentId = foundId;
        }
      } else if (docIdsResult.ids && docIdsResult.ids[documentName]) {
        // Fallback for record-style response
        documentId = docIdsResult.ids[documentName];
      }

      if (!documentId) {
        return interaction.editReply({
          content: `Document "${documentName}" not found for course ${courseId}.`,
        });
      }

      await interaction.editReply({
        content: `Creating heading "${newHeading}" in document ${documentId}...`,
      });

      // 3. Execute Heading Creation
      // Matches Python: @app.post("/headings/create") -> {"status": "heading created", ...}
      const result = await createHeading(courseId, newHeading, documentId, SUPERDOC_INDEX);

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
    } catch (error) {
      console.error('Error in superdoc-create-heading command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to create heading: ${errorMessage}`,
      });
    }
  },
};