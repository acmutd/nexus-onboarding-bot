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

      const result = await getDocIds(courseId);

      // Check if documentIds exists and is an object (the dictionary from Python)
      if (result.documentIds && typeof result.documentIds === 'object' && !Array.isArray(result.documentIds)) {
        
        // Convert the dictionary into an array of [name, id] pairs
        const entries = Object.entries(result.documentIds);
        const docCount = entries.length;

        if (docCount > 0) {
          let message = `**Documents for ${courseId}**\n`;
          message += `Found ${docCount} document${docCount !== 1 ? 's' : ''}:\n\n`;
          
          const maxLength = 1900; 
          
          // Iterate over the [name, id] pairs
          for (let i = 0; i < entries.length; i++) {
            const [docName, docId] = entries[i];
            
            const docEntry = `**${i + 1}. ${docName}**\n   ID: \`${docId}\`\n   [Open Document](https://docs.google.com/document/d/${docId})\n\n`;
            
            if (message.length + docEntry.length > maxLength) {
              message += `\n... and ${docCount - i} more documents.`;
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