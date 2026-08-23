import { randomUUID } from 'crypto';
import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { checkSuperdocHealth, getDocIds } from '../../utils/superdocApi';
import { checkChannelName } from '../../utils/discordUtils';
import { createJob } from '../../utils/jobStore';
import { enqueueMergeJob } from '../../utils/sqsClient';

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

      // 3. Enqueue the merge job — Discord already hosts the attachment on its
      // own CDN, so pdfAttachment.url is used directly as the merge source,
      // no separate upload step needed.
      const jobId = randomUUID();
      await createJob({ jobId, courseId, documentId, documentName });
      await enqueueMergeJob({
        jobId,
        pdfUrl: pdfAttachment.url,
        courseId,
        documentId,
        index_name: SUPERDOC_INDEX,
      });

      await interaction.editReply({
        content: `Queued PDF merge for "${pdfAttachment.name}" into document ${documentId}.\nJob ID: \`${jobId}\` — this runs in the background and may take a few minutes.`,
      });
    } catch (error: any) {
      console.error('Error in superdoc-merge-pdf command:', error);
      await interaction.editReply({
        content: `Failed to queue PDF merge: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      });
    }
  },
};