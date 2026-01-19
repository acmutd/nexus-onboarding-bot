import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { updateHeading, checkSuperdocHealth, getDocIds } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';

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

      // 2. Fetch Document IDs via the GET endpoint
      const docIdsResult = await getDocIds(courseId);
      
      let documentId: string | undefined = undefined;

      // Logic to match documentName against the returned list or record
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
        content: `Updating heading from "${oldHeading}" to "${newHeading}" in document ${documentId}...`,
      });

      // 3. Execute Heading Update
      // Matches Python: @app.put("/headings/update") -> {"status": "heading updated", ...}
      const result = await updateHeading(courseId, oldHeading, newHeading, documentId, SUPERDOC_INDEX);

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
    } catch (error) {
      console.error('Error in superdoc-update-heading command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to update heading: ${errorMessage}`,
      });
    }
  },
};