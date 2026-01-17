import { Attachment } from 'discord.js';
import FormData from 'form-data';

const SUPERDOC_API_URL = process.env.SUPERDOC_API_URL || 'http://localhost:5000';

const SUPERDOC_INDEX = 'sdtest1';
export interface SuperdocApiResponse {
  status?: string;
  message?: string;
  document_id?: string;
  error?: string;
  trace?: string;
  ids?: Record<string, string>;
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
  pdfAttachment: Attachment,
  courseId: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/merge_pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_url: pdfAttachment.url, // Sending the URL string
        course_id: courseId,
        document_id: documentId,
        index_name: indexName,
      }),
    });

    // Handle the unknown type safely
    const data = (await response.json()) as SuperdocApiResponse & { error?: string };

    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
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
    const response = await fetch(`${SUPERDOC_API_URL}/create_heading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
        new_heading: newHeading,
        document_id: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
  } catch (error) {
    console.error('[Superdoc API] Create heading error:', error);
    throw error;
  }
}

/**
 * Update a heading in a document
 */
export async function updateHeading(
  courseId: string,
  oldHeading: string,
  newHeading: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/update_heading`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
        old_heading: oldHeading,
        new_heading: newHeading,
        document_id: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
  } catch (error) {
    console.error('[Superdoc API] Update heading error:', error);
    throw error;
  }
}

/**
 * Delete a heading from a document
 */
export async function deleteHeading(
  courseId: string,
  oldHeading: string,
  documentId?: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/delete_heading`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
        old_heading: oldHeading,
        document_id: documentId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
  } catch (error) {
    console.error('[Superdoc API] Delete heading error:', error);
    throw error;
  }
}

/**
 * Get document IDs for a course
 */
export async function getDocIds(
  courseId: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/get_docids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }
    console.log(data)
    return data as SuperdocApiResponse;
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
  documentName: string,
  indexName: string = SUPERDOC_INDEX
): Promise<SuperdocApiResponse> {
  try {
    const response = await fetch(`${SUPERDOC_API_URL}/create_document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
        document_name: documentName,
        index_name: indexName,
      }),
    });

    const data = (await response.json()) as SuperdocApiResponse
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
  } catch (error) {
    console.error('[Superdoc API] Create document error:', error);
    throw error;
  }
}

