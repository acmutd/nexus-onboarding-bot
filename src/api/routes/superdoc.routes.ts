import { Router, Request, Response } from 'express';
import { superdocQueue } from '../../utils/superdocQueue';
import * as superdocApi from '../../utils/superdocApi';

const router = Router();

/**
 * Helper to handle standard API logic with the Queue
 */
async function handleQueuedRequest(
  res: Response, 
  documentId: string, 
  task: () => Promise<any>
) {
  try {
    const result = await superdocQueue.enqueue(documentId, task);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        error: 'Timeout',
        detail: 'The document is taking too long to process. The queue has been cleared for this ID.'
      });
    }
    
    return res.status(500).json({
      error: 'Internal Server Error',
      detail: error.message
    });
  }
}

// POST /api/superdoc/merge
router.post('/merge', async (req: Request, res: Response) => {
  const { pdfAttachment, courseId, documentId, indexName } = req.body;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  await handleQueuedRequest(res, documentId, () => 
    superdocApi.mergePdf(pdfAttachment, courseId, documentId, indexName)
  );
});

// POST /api/superdoc/heading
router.post('/heading', async (req: Request, res: Response) => {
  const { courseId, newHeading, documentId, indexName } = req.body;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  await handleQueuedRequest(res, documentId, () => 
    superdocApi.createHeading(courseId, newHeading, documentId, indexName)
  );
});

// PUT /api/superdoc/heading
router.put('/heading', async (req: Request, res: Response) => {
  const { courseId, oldHeading, newHeading, documentId, indexName } = req.body;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  await handleQueuedRequest(res, documentId, () => 
    superdocApi.updateHeading(courseId, oldHeading, newHeading, documentId, indexName)
  );
});

// DELETE /api/superdoc/heading
router.delete('/heading', async (req: Request, res: Response) => {
  const { courseId, oldHeading, documentId, indexName } = req.body;
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  await handleQueuedRequest(res, documentId, () => 
    superdocApi.deleteHeading(courseId, oldHeading, documentId, indexName)
  );
});

// GET /api/superdoc/documents/:courseId
router.get('/documents/:courseId', async (req: Request, res: Response) => {
  try {
    const result = await superdocApi.getDocIds(req.params.courseId as string);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;