import express from 'express'
import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { superdocQueue } from '../../utils/superdocQueue';
import * as superdocApi from '../../utils/superdocApi';
import { createJob } from '../../utils/jobStore';
import { enqueueMergeJob } from '../../utils/sqsClient';

const router = express.Router();

/**
 * Helper to resolve Name to ID and handle Queue
 */
async function handleQueuedRequestByName(
  res: Response, 
  courseId: string,
  documentName: string, 
  task: (resolvedId: string) => Promise<any>
) {
  try {
    // 1. Resolve Name to ID
    const docData = await superdocApi.getDocIds(courseId);
    const documentId = docData.documentIds?.[documentName];

    if (!documentId) {
      return res.status(404).json({ 
        error: 'Document Not Found', 
        detail: `Could not find an ID for document name: "${documentName}"` 
      });
    }

    // 2. Enqueue using the resolved ID
    const result = await superdocQueue.enqueue(documentId, () => task(documentId));
    return res.status(200).json(result);

  } catch (error: any) {
    if (error?.message?.includes('timed out')) {
      return res.status(504).json({
        error: 'Timeout',
        detail: 'The document is taking too long to process.'
      });
    }
    
    return res.status(500).json({
      error: 'Internal Server Error',
      detail: error.message
    });
  }
}

// POST /api/superdoc/merge
// Enqueues an async merge job (SQS) and returns immediately with a jobId instead
// of waiting for the merge to finish — merges can run far longer than the old
// 30s in-process queue timeout allowed.
router.post('/merge', async (req: Request, res: Response) => {
  try {
    const { pdfAttachment, courseId, documentName, documentId, indexName } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    if (!pdfAttachment) return res.status(400).json({ error: 'pdfAttachment is required' });

    let resolvedId = documentId;
    if (!resolvedId) {
      if (!documentName) return res.status(400).json({ error: 'documentName is required when documentId is not provided' });
      const docData = await superdocApi.getDocIds(courseId);
      resolvedId = docData.documentIds?.[documentName];
      if (!resolvedId) {
        return res.status(404).json({
          error: 'Document Not Found',
          detail: `Could not find an ID for document name: "${documentName}"`
        });
      }
    }

    const jobId = randomUUID();
    await createJob({ jobId, courseId, documentId: resolvedId, documentName });
    await enqueueMergeJob({
      jobId,
      pdfUrl: pdfAttachment,
      courseId,
      documentId: resolvedId,
      index_name: indexName,
    });

    return res.status(202).json({ jobId, status: 'queued' });
  } catch (error: any) {
    console.error('[merge] Unhandled error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', detail: error?.message ?? String(error) });
  }
});

// POST /api/superdoc/create
router.post('/documents/create', async (req: Request, res: Response) => {                                                                                                                                                                       
  try {                                                                                                                                                                                                                                         
    const { courseId, documentName } = req.body;                                                                                                                                                                                                
    if (!courseId || !documentName)                                                                                                                                                                                                             
      return res.status(400).json({ error: 'courseId and documentName are required' });                                                                                                                                                         
    const result = await superdocApi.createDocument(courseId, documentName);                                                                                                                                                                    
    res.status(200).json(result);                                                                                                                                                                                                               
  } catch (error: any) {                                                                                                                                                                                                                        
    res.status(500).json({ error: error.message });                                                                                                                                                                                             
  }                                                                                                                                                                                                                                             
});                                                                                                                                                                                                                                          
          

// GET /api/superdoc/documents/:courseId
router.get('/documents/:courseId', async (req: Request, res: Response) => {
  try {
    const courseId = req.params.courseId as string;
    const result = await superdocApi.getDocIds(courseId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', detail: error?.message ?? String(error) });
  }
});

// POST /api/superdoc/heading
router.post('/heading', async (req: Request, res: Response) => {
  const { courseId, newHeading, documentName, indexName } = req.body;
  if (!documentName || !courseId) return res.status(400).json({ error: 'courseId and documentName are required' });

  await handleQueuedRequestByName(res, courseId, documentName, (resolvedId) => 
    superdocApi.createHeading(courseId, newHeading, resolvedId, indexName)
  );
});

// PUT /api/superdoc/heading
router.put('/heading', async (req: Request, res: Response) => {
  const { courseId, oldHeading, newHeading, documentName, indexName } = req.body;
  if (!documentName || !courseId) return res.status(400).json({ error: 'courseId and documentName are required' });

  await handleQueuedRequestByName(res, courseId, documentName, (resolvedId) => 
    superdocApi.updateHeading(courseId, oldHeading, newHeading, resolvedId, indexName)
  );
});

// DELETE /api/superdoc/heading
router.delete('/heading', async (req: Request, res: Response) => {
  const { courseId, oldHeading, documentName, indexName } = req.body;
  if (!documentName || !courseId) return res.status(400).json({ error: 'courseId and documentName are required' });

  await handleQueuedRequestByName(res, courseId, documentName, (resolvedId) => 
    superdocApi.deleteHeading(courseId, oldHeading, resolvedId, indexName)
  );
});

export default router;