import { Attachment } from 'discord.js';
import { Buffer } from 'node:buffer';

const SUPERDOC_API_URL = process.env.SUPERDOC_API_URL || 'http://localhost:8000'; // Uvicorn default is 8000
const SUPERDOC_INDEX = 'sdtest1';


console.log("SUPERDOC_API_URL:",SUPERDOC_API_URL);
export interface SuperdocApiResponse {
  status?: string;
  message?: string;
  documentId?: string;
  document?: string;
  documentIds?: Record<string, string>;
  courseId?: string;
  error?: string;
  detail?: string;
}

/**
 * Check if the Superdoc API is healthy
 */
export async function checkSuperdocHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('[Superdoc API] Health check failed:', error);
    return false;
  }
}


/**
 * Merge a PDF file into a document
 */
export async function mergePdf(
  pdfAttachment: Attachment | string,
  courseId: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const pdfUrl = typeof pdfAttachment === 'string' 
      ? pdfAttachment 
      : pdfAttachment.url;
    const response = await fetch(`${SUPERDOC_API_URL}/merge_pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfUrl: pdfUrl, // Python expects req.pdfUrl
        courseId: courseId,        // Python expects req.courseId
        documentId: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Merge failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Merge PDF error:', error);
    throw error;
  }
}

/**
 * Create a heading in a document
 */
export async function createHeading(
  courseId: string,
  newHeading: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/headings/create`, { // Path updated
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: courseId,
        heading: newHeading, // Python expects req.heading
        documentId: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Create Heading Failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Create heading error:', error);
    throw error;
  }
}

/**
 * Update a heading
 */
export async function updateHeading(
  courseId: string,
  oldHeading: string,
  newHeading: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/headings/update`, { // Path updated
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: courseId,
        oldHeading: oldHeading,
        newHeading: newHeading,
        documentId: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Update Heading failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Update heading error:', error);
    throw error;
  }
}

/**
 * Delete a heading
 */
export async function deleteHeading(
  courseId: string,
  heading: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/headings/delete`, { // Path updated
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: courseId,
        heading: heading,
        documentId: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Delete Heading Failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Delete heading error:', error);
    throw error;
  }
}

/**
 * Get document IDs for a course
 */
export async function getDocIds(courseId: string): Promise<SuperdocApiResponse> {
  try {
    // Python endpoint is @app.get("/documents/{course_id}")
    const response = await fetch(`${SUPERDOC_API_URL}/documents/${courseId}`, {
      method: 'GET',
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Get Docids failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Get doc IDs error:', error);
    throw error;
  }
}

/**
 * Create a new document
 */
export async function createDocument(
  courseId: string,
  documentName: string
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/documents/create`, { // Path updated
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: courseId,
        documentName: documentName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      // If detail is an object, stringify it; otherwise use it as is
      const errorMsg = typeof data.detail === 'object'
        ? JSON.stringify(data.detail)
        : (data.detail || data.error || 'Create Document Failed');

      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error('[Superdoc API] Create document error:', error);
    throw error;
  }
}