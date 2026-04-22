import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map project codes to Drive folder IDs (from your Apps Script)
const DRIVE_FOLDERS: Record<string, string> = {
  'MASTER': '',
  'EGOVPH': '1VyhnzXqt1O4zR2q9XEknx7tk_O1SHr_M',
  'ELGU': '1XS9TMgaiXNVJj5X8RJafAel1QyVgW-qC',
  'WIFI': '1zZHazM6N5PelDet1nbfNJH-AZeHWbodf',
  'GOVNET': '19Sj7r9TmrQgIlUf9fCvfSI4FFCq9fQv6',
  'NBP': '1fpiwVj00fm-USmI6DN0Uq6NQNyEEheIb',
  'CYBER': '1YXqk2dnG30XGJl-skbb4nA-54b4jk-yq',
  'PNPKI': '1iLa4N023Z3At26LMMw6xOTFP8WP3XhfO',
  'DRRM': '1lF8OHg9d2u0QkGtkHIQD1oMo2qdOlQ7L',
  'ILCDB': '1cF144KsqWOi_P3y9CvNGsHXWqOmW0BP1',
  'IIDB': '1fXNLyAidizoP3gWc2A2jH9zW8ozyWjBZ',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const activityId = formData.get('activityId') as string;
    const activityTitle = formData.get('activityTitle') as string;
    const projectCode = formData.get('projectCode') as string;
    const driveFolderLink = formData.get('driveFolderLink') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!activityTitle || !projectCode) {
      return NextResponse.json({ error: 'Missing required fields: activityTitle and projectCode' }, { status: 400 });
    }
    // activityId is optional — the folder is derived from activityTitle.
    void activityId;

    // Get service account credentials
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEmail || !serviceAccountKey) {
      return NextResponse.json(
        { error: 'Google service account not configured' },
        { status: 500 }
      );
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: serviceAccountKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Determine target folder
    let targetFolderId: string | null = null;

    if (driveFolderLink) {
      // Extract folder ID from existing Drive folder link
      const match = driveFolderLink.match(/[-\w]{25,}/);
      if (match) {
        targetFolderId = match[0];
      }
    }

    // If no existing folder, use program's base folder
    if (!targetFolderId) {
      const baseFolderId = DRIVE_FOLDERS[projectCode];
      if (!baseFolderId) {
        return NextResponse.json(
          { error: `No Drive folder configured for project ${projectCode}` },
          { status: 400 }
        );
      }

      // Create activity folder if it doesn't exist
      const safeName = activityTitle.replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 100);
      
      // Check if folder exists
      const searchResponse = await drive.files.list({
        q: `name='${safeName}' and '${baseFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        targetFolderId = searchResponse.data.files[0].id!;
      } else {
        // Create new folder
        const folderResponse = await drive.files.create({
          requestBody: {
            name: safeName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [baseFolderId],
          },
          fields: 'id',
        });
        targetFolderId = folderResponse.data.id!;

        // Create subfolders
        const subfolders = ['Raw Photos', 'After Activity Report', 'Testimonials', 'Supporting Documents'];
        for (const subfolder of subfolders) {
          await drive.files.create({
            requestBody: {
              name: subfolder,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [targetFolderId],
            },
          });
        }
      }
    }

    // Find or create "Raw Photos" subfolder
    const photosSearchResponse = await drive.files.list({
      q: `name='Raw Photos' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    let photosFolderId: string;
    if (photosSearchResponse.data.files && photosSearchResponse.data.files.length > 0) {
      photosFolderId = photosSearchResponse.data.files[0].id!;
    } else {
      const photosFolder = await drive.files.create({
        requestBody: {
          name: 'Raw Photos',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [targetFolderId],
        },
        fields: 'id',
      });
      photosFolderId = photosFolder.data.id!;
    }

    // Upload file to Raw Photos folder
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;

    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [photosFolderId],
      },
      media: {
        mimeType: file.type,
        body: buffer as any,
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = uploadResponse.data.id!;

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Generate direct image URL
    const imageUrl = `https://drive.google.com/uc?id=${fileId}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      driveId: fileId,
      webViewLink: uploadResponse.data.webViewLink,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
