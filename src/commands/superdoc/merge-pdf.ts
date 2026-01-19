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
        .setDescription('Name of the document to merge the PDF into')
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

      const pdfAttachment = interaction.options.getAttachment('pdf', true);
      
      // Validate file type
      if (!pdfAttachment.contentType?.includes('pdf') && !pdfAttachment.name?.toLowerCase().endsWith('.pdf')) {
        return interaction.editReply({
          content: 'The attached file must be a PDF.',
        });
      }

      const courseId = channelName;
      const documentName = interaction.options.getString('document_name', true);

      // 2. Look up document ID
      const docIdsResult = await getDocIds(courseId);
      let documentId: string | undefined = undefined;

      // Handle matching based on the array/list returned by your FastAPI backend
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
        content: `Merging PDF "${pdfAttachment.name}" into document ${documentId}...`,
      });

      // 3. Execute Merge
      // Matches Python: @app.post("/merge_pdf") -> {"status": "success", "documentId": ...}
      const result = await mergePdf(pdfAttachment as Attachment, courseId, documentId, SUPERDOC_INDEX);

      if (result.status === 'success') {
        let message = `PDF merged successfully!\n`;
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
      console.error('Error in superdoc-merge-pdf command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await interaction.editReply({
        content: `Failed to merge PDF: ${errorMessage}`,
      });
    }
  },
};