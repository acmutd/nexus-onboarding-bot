import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { getDocIds, checkSuperdocHealth } from '../../utils/superdocApi';
import { checkChannelName } from "../../utils/discordUtils";

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-display')
    .setDescription('Display the document IDs for a course'),

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

      await interaction.editReply({
        content: `Retrieving documents for course ${courseId}...`,
      });

      // 2. Fetch Document IDs
      // Matches Python: @app.get("/documents/{course_id}") -> {"courseId": "...", "documentIds": [...]}
      const result = await getDocIds(courseId);

      // Your backend does not explicitly send a status: "success" for the GET route, 
      // but the helper throws an error if !response.ok, so we check for documentIds.
      if (result.documentIds && Array.isArray(result.documentIds)) {
        const docCount = result.documentIds.length;

        if (docCount > 0) {
          let message = `**Documents for ${courseId}**\n`;
          message += `Found ${docCount} document${docCount !== 1 ? 's' : ''}:\n\n`;
          
          const maxLength = 1900; 
          
          for (let index = 0; index < result.documentIds.length; index++) {
            const docId = result.documentIds[index];
            // Since your current backend returns a list of IDs, we use the ID as the name reference
            const docEntry = `**${index + 1}. Document**\n   ID: \`${docId}\`\n   Link: https://docs.google.com/document/d/${docId}\n\n`;
            
            if (message.length + docEntry.length > maxLength) {
              message += `\n... and ${docCount - index} more document${docCount - index !== 1 ? 's' : ''}`;
              break;
            }
            
            message += docEntry;
          }
          
          await interaction.editReply({ content: message });
        } else {
          await interaction.editReply({
            content: `No documents found for course ${courseId}.`,
          });
        }
      } else {
        await interaction.editReply({
          content: `Error: ${result.detail || result.error || 'The server returned an unexpected response format.'}`,
        });
      }
    } catch (error) {
      console.error('Error in superdoc-display-docs command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to display document IDs: ${errorMessage}`,
      });
    }
  },
};