import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sync-images-to-sheets
 * 
 * Syncs uploaded images back to Google Sheets column AE
 * Called after image upload to keep Sheets in sync with web app
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sheetId, activityTitle, startDate, images } = body;

    if (!sheetId || !activityTitle || !images) {
      return NextResponse.json(
        { error: 'Missing required fields: sheetId, activityTitle, images' },
        { status: 400 }
      );
    }

    // Get service account credentials
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEmail || !serviceAccountKey) {
      console.warn('Google service account not configured - skipping Sheets sync');
      return NextResponse.json({
        success: true,
        message: 'Sheets sync skipped - no credentials',
      });
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: serviceAccountKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all data from the sheet to find the matching row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:AE', // Read up to column AE
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'Sheet has no data rows' },
        { status: 400 }
      );
    }

    // Find the row matching this activity (by title and start date)
    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowTitle = (row[5] || '').trim(); // Column F (index 5)
      const rowStartDate = (row[8] || '').trim(); // Column I (index 8)
      
      if (rowTitle === activityTitle && rowStartDate === startDate) {
        targetRow = i + 1; // Sheets rows are 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      console.warn(`Activity not found in sheet: ${activityTitle}`);
      return NextResponse.json({
        success: true,
        message: 'Activity not found in sheet - may need manual sync',
      });
    }

    // Format images as newline-separated URLs
    const imageUrls = images.map((img: any) => img.url).join('\n');

    // Update column AE (index 30) for this row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `AE${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[imageUrls]],
      },
    });

    return NextResponse.json({
      success: true,
      row: targetRow,
      imageCount: images.length,
    });
  } catch (error) {
    console.error('Sheets sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync to Sheets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
