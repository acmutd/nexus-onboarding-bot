import { Router, Request, Response } from 'express';
import { superdocQueue } from '../../utils/superdocQueue';
import * as superdocApi from '../../utils/superdocApi';

const router = Router();

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
    if (error.message.includes('timed out')) {
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
router.post('/merge', async (req: Request, res: Response) => {
  const { pdfAttachment, courseId, documentName, indexName } = req.body;
  if (!documentName || !courseId) return res.status(400).json({ error: 'courseId and documentName are required' });

  await handleQueuedRequestByName(res, courseId, documentName, (resolvedId) => 
    superdocApi.mergePdf(pdfAttachment, courseId, resolvedId, indexName)
  );
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

// GET /api/superdoc/documents/:courseId
router.get('/documents/:courseId', async (req: Request, res: Response) => {
  try {
    const result = await superdocApi.getDocIds(req.params.courseId as string );
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;