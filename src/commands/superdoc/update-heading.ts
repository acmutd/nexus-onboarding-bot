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
        .setDescription('Name of the document (optional, creates new if not provided)')
        .setRequired(false)
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
      const oldHeading = interaction.options.getString('old_heading', true);
      const newHeading = interaction.options.getString('new_heading', true);
      const documentName = interaction.options.getString('document_name') || undefined;

      // Look up document ID from document name if provided
      let documentId: string | undefined = undefined;
      if (documentName) {
        const docIdsResult = await getDocIds(courseId, SUPERDOC_INDEX);
        if (docIdsResult.ids && docIdsResult.ids[documentName]) {
          documentId = docIdsResult.ids[documentName];
        } else {
          return interaction.editReply({
            content: `Document "${documentName}" not found for course ${courseId}`,
          });
        }
      }

      await interaction.editReply({
        content: 'Updating heading...',
      });

      const result = await updateHeading(courseId, oldHeading, newHeading, documentId, SUPERDOC_INDEX);

      if (result.status === 'success') {
        let message = `Heading "${oldHeading}" updated to "${newHeading}" successfully!\n`;
        if (result.document_id) {
          message += `Document ID: ${result.document_id}\n`;
        }
        if (result.message) {
          message += `${result.message}`;
        }
        await interaction.editReply({ content: message });
      } else {
        await interaction.editReply({
          content: `Error: ${result.error || 'Unknown error occurred'}`,
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

