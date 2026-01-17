import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextBasedChannel, TextChannel } from 'discord.js';
import { getDocIds, checkSuperdocHealth } from '../../utils/superdocApi';
import { checkChannelName} from "../../utils/discordUtils";

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-display')
    .setDescription('Display the document IDs for a course'),

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

      await interaction.editReply({
        content: 'Retrieving document IDs...',
      });

      const result = await getDocIds(courseId, SUPERDOC_INDEX);

      if (result.status === 'success') {
        if (result.ids && Object.keys(result.ids).length > 0) {
          const docCount = Object.keys(result.ids).length;
          let message = `**Documents for ${courseId}**\n`;
          message += `Found ${docCount} document${docCount !== 1 ? 's' : ''}:\n\n`;
          
          // Format each document nicely
          const entries = Object.entries(result.ids);
          const maxLength = 1900; // Leave some buffer for Discord's 2000 char limit
          
          for (let index = 0; index < entries.length; index++) {
            const [docName, docId] = entries[index];
            const docEntry = `**${index + 1}. ${docName}**\n   ID: \`${docId}\`\n   Link: https://docs.google.com/document/d/${docId}\n\n`;
            
            // Check if adding this entry would exceed the limit
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
          content: `Error: ${result.error || 'Unknown error occurred'}`,
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

