import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({ region: process.env.AWS_REGION || 'us-east-2' });

const QUEUE_URL = process.env.SQS_QUEUE_URL;

export interface MergeJobMessage {
  jobId: string;
  pdfUrl: string;
  courseId: string;
  documentId?: string;
  index_name?: string;
}

/**
 * Enqueues a merge job for the superdoc Lambda's SQS consumer to pick up.
 *
 * The queue is FIFO (superdoc.fifo), so every message needs a MessageGroupId —
 * using documentId means SQS only ever processes one merge per document at a
 * time, in order, which keeps two concurrent merges from racing on the same
 * Google Doc.
 *
 * Message body is wrapped as {action, payload} to match the Lambda's actual
 * consumer contract (it dispatches on `action`, e.g. "merge_pdf").
 */
export async function enqueueMergeJob(message: MergeJobMessage): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error('SQS_QUEUE_URL is not configured');
  }
  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        action: 'merge_pdf',
        payload: {
          jobId: message.jobId,
          pdfUrl: message.pdfUrl,
          courseId: message.courseId,
        },
      }),
      MessageGroupId: message.documentId || message.jobId,
      MessageDeduplicationId: message.jobId,
    })
  );
}
