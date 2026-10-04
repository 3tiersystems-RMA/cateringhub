import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cooking-classes/upload-to-drive
 *
 * Accepts a multipart/form-data body with:
 *   - file: the file to upload
 *   - fileName: desired file name in Google Drive
 *   - folderId: (optional) Google Drive folder ID to place the file in
 *
 * Returns: { fileId, viewUrl }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = (formData.get('fileName') as string) || 'upload';
    const folderId = (formData.get('folderId') as string) || process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const accessToken = await getOAuthAccessToken();

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Build multipart body for Drive API upload
    const boundary = `----FormBoundary${Date.now()}`;

    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: file.type || 'application/octet-stream',
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const metadataJson = JSON.stringify(metadata);

    // Construct multipart body manually
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
    const closingBoundary = `\r\n--${boundary}--`;

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const filePartBytes = encoder.encode(filePart);
    const closingBytes = encoder.encode(closingBoundary);

    const totalLength = metadataBytes.length + filePartBytes.length + fileBytes.length + closingBytes.length;
    const body = new Uint8Array(totalLength);
    let offset = 0;
    body.set(metadataBytes, offset); offset += metadataBytes.length;
    body.set(filePartBytes, offset); offset += filePartBytes.length;
    body.set(fileBytes, offset); offset += fileBytes.length;
    body.set(closingBytes, offset);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': totalLength.toString(),
        },
        body: body,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[Drive upload] API error:', errText);
      return NextResponse.json({ error: 'Failed to upload to Google Drive', details: errText }, { status: 500 });
    }

    const uploadData = await uploadRes.json();
    const fileId: string = uploadData.id;

    // Make the file publicly viewable (anyone with the link)
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;

    return NextResponse.json({ fileId, viewUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[Drive upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getOAuthAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.'
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(
      `Failed to get Google access token: ${tokenData.error || 'unknown'} – ${tokenData.error_description || ''}`
    );
  }

  return tokenData.access_token;
}
