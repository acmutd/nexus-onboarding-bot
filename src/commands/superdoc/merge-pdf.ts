import { SlashCommandBuilder, MessageFlags, Attachment, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { mergePdf, checkSuperdocHealth, getDocIds } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';

const SUPERDOC_INDEX = 'sdtest1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('superdoc-merge-pdf')
    .setDescription('Merge a PDF file into a Superdoc document')
    .addAttachmentOption(option =>
      option
        .setName('pdf')
        .setDescription('The PDF file to merge')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('document_name')
        .setDescription('Name of the document (optional, creates new if not provided)')
        .setRequired(true)
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

      const pdfAttachment = interaction.options.getAttachment('pdf', true);
      
      // Validate it's a PDF
      if (!pdfAttachment.contentType?.includes('pdf') && !pdfAttachment.name?.endsWith('.pdf')) {
        return interaction.editReply({
          content: 'The attached file must be a PDF.',
        });
      }

      const courseId = channelName;
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
        content: 'Merging PDF into document...',
      });

      const result = await mergePdf(pdfAttachment as Attachment, courseId, documentId, SUPERDOC_INDEX);

      if (result.status === 'success') {
        let message = `PDF merged successfully!\n`;
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
      console.error('Error in superdoc-merge-pdf command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to merge PDF: ${errorMessage}`,
      });
    }
  },
};

