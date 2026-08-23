import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(client);

const JOBS_TABLE = process.env.DYNAMO_JOBS_TABLE || 'superdoc-jobs';

export interface MergeJob {
  jobId: string;
  courseId: string;
  documentId?: string;
  documentName?: string;
}

/**
 * Writes the initial "queued" row for a merge job. The Lambda updates this
 * row's status as it processes the job off SQS.
 */
export async function createJob(job: MergeJob): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: JOBS_TABLE,
      Item: {
        jobId: job.jobId,
        status: 'queued',
        courseId: job.courseId,
        documentId: job.documentId,
        documentName: job.documentName,
        createdAt: now,
        updatedAt: now,
      },
    })
  );
}
