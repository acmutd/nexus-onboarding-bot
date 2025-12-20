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
    // Download the PDF file from Discord
    const pdfResponse = await fetch(pdfAttachment.url);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Create form data
    const formData = new FormData();
    formData.append('pdf_file', pdfBuffer, {
      filename: pdfAttachment.name || 'document.pdf',
      contentType: pdfAttachment.contentType || 'application/pdf',
    });
    // Ensure text fields are sent as strings
    formData.append('course_id', String(courseId));
    if (documentId) {
      formData.append('document_id', String(documentId));
    }
    formData.append('index_name', String(indexName));

    // Convert form-data to buffer for fetch compatibility
    // form-data package doesn't work well with fetch, so we need to convert it to a buffer
    // Handle both Buffer and string chunks from form-data
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      formData.on('data', (chunk: any) => {
        // form-data can emit both Buffer and string chunks (boundaries are strings)
        let bufferChunk: Buffer;
        if (Buffer.isBuffer(chunk)) {
          bufferChunk = chunk;
        } else if (typeof chunk === 'string') {
          bufferChunk = Buffer.from(chunk, 'utf8');
        } else if (chunk instanceof Uint8Array) {
          bufferChunk = Buffer.from(chunk);
        } else {
          // Fallback: try to convert to buffer
          bufferChunk = Buffer.from(String(chunk), 'utf8');
        }
        chunks.push(bufferChunk);
      });
      formData.on('end', () => {
        if (chunks.length === 0) {
          resolve(Buffer.alloc(0));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
      formData.on('error', reject);
      formData.resume();
    });

    const headers = formData.getHeaders();
    console.log('[Superdoc API] Sending merge_pdf request with headers:', headers);
    console.log('[Superdoc API] FormData size:', formDataBuffer.length, 'bytes');

    // Convert Buffer to Uint8Array for fetch (fetch accepts Uint8Array directly)
    const response = await fetch(`${SUPERDOC_API_URL}/merge_pdf`, {
      method: 'POST',
      body: new Uint8Array(formDataBuffer),
      headers: headers,
    });

    const data = await response.json();
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

    const data = await response.json();
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

    const data = await response.json();
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

    const data = await response.json();
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

    const data = await response.json();
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

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `API returned status ${response.status}`);
    }

    return data as SuperdocApiResponse;
  } catch (error) {
    console.error('[Superdoc API] Create document error:', error);
    throw error;
  }
}

