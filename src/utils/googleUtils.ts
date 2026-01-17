import fs from 'fs/promises';
import path from 'path';
import { google, docs_v1, drive_v3, Auth } from 'googleapis';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export async function configGoogleDoc(): Promise<{ docs: docs_v1.Docs; drive: drive_v3.Drive }> {
  // Use the double-cast here to satisfy the compiler
  const oauth2Client = (await authorize()) as unknown as Auth.OAuth2Client;

  const docs = google.docs({
    version: 'v1',
    auth: oauth2Client,
  });

  const drive = google.drive({
    version: 'v3',
    auth: oauth2Client,
  });

  return { docs, drive };
}

async function authorize(): Promise<Auth.OAuth2Client> {
  // 1. Load Credentials
  const keysRaw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const keys = JSON.parse(keysRaw);
  const key = keys.installed || keys.web;
  
  const client = new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    key.redirect_uris?.[0] || 'http://localhost'
  );

  // 2. Try loading existing token
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf8');
    const token = JSON.parse(content);
    client.setCredentials(token);
    
    // Refresh if needed
    await client.getAccessToken();
    return client as unknown as Auth.OAuth2Client;
  } catch (err) {
    console.log('No valid token.json found.');
  }

  // 3. Manual URL Generation
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Ensures we get a refresh_token
  });

  console.log('\n--- ACTION REQUIRED ---');
  console.log('1. Open this URL in Firefox:\n', authUrl);
  
  const rl = readline.createInterface({ input, output });
  const code = await rl.question('\n2. Paste the code from the redirect URL here: ');
  rl.close();

  // 4. Exchange code for tokens
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // 5. Save for next time
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: tokens.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);

  return client as unknown as Auth.OAuth2Client;
}
/**
 * Creates a Google Doc in the account of the user associated with the refreshToken.
 */
export const createGoogleDoc = async (
  name: string
): Promise<drive_v3.Schema$File | undefined> => {
  
  // Initialize clients with the user's specific token
  const { docs,drive } = await configGoogleDoc();

  try {
    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.document',
      },
      fields: 'id, name',
    });

    const fileId = response.data.id;
    console.log('Created Document ID:', fileId);

    return response.data;
  } catch (err: any) {
    console.error('Error creating document:', err.response?.data || err.message);
    return undefined;
  }
};

async function main() {
  console.log('--- Starting Google Doc Creation Test ---');

  const docName = `Test Doc - ${new Date().toLocaleString()}`;
  
  try {
    console.log("Starting to create google doc");
    const newDoc = await createGoogleDoc(docName);
    console.log("Finished creating google doc");
    if (newDoc && newDoc.id) {
      console.log('✅ Success!');
      console.log('Document Name:', newDoc.name);
      console.log('Document ID:', newDoc.id);
      console.log('URL:', `https://docs.google.com/document/d/${newDoc.id}/edit`);
    } else {
      console.error('❌ Failed to create document: No data returned.');
    }
  } catch (error) {
    console.error('❌ An unexpected error occurred during the test:', error);
  }
}

// Execute the test
main();

