# Google Sheets Export Setup Guide

This guide explains how to set up the Google Sheets export functionality for automatic data export to Google Sheets, which can then be used with Looker Studio.

## Features

- **Export CSV**: Download data as a CSV file (existing functionality)
- **Export to Sheets**: Automatically create a new Google Sheet with your data (new functionality)
- The exported Google Sheet can be directly connected to Looker Studio for visualization

## Setup Instructions

### 1. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. Create a Service Account

1. In Google Cloud Console, go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g., "dict-monitoring")
4. Click **Create and Continue**
5. Grant the service account the **Editor** role
6. Click **Done**

### 3. Generate Service Account Key

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** > **Create New Key**
4. Select **JSON** format
5. Click **Create** - this will download a JSON file

### 4. Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Google Sheets (service account for server-side export)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Important Notes:**
- The private key must include the `\n` characters for line breaks
- Keep the quotes around the private key value
- Never commit the `.env.local` file to version control

### 5. Extract Credentials from JSON

From the downloaded JSON file, extract:
- `client_email` → Use as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → Use as `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

## Usage

### Dashboard Page
1. Navigate to the Dashboard
2. Select your filters (year, program, etc.)
3. Click **Export to Sheets** button
4. A new Google Sheet will be created and opened in a new tab
5. The sheet is automatically set to public (read-only)

### Project Page
1. Navigate to any project page (e.g., eGovPH, Free WiFi)
2. Click **Export to Sheets** button
3. Data for that specific project will be exported

## Connecting to Looker Studio

Once you have exported data to Google Sheets:

1. Open [Looker Studio](https://lookerstudio.google.com/)
2. Click **Create** > **Data Source**
3. Select **Google Sheets**
4. Choose the exported spreadsheet
5. Click **Connect**
6. Create your visualizations and reports

## Troubleshooting

### "Failed to export to Google Sheets"
- Check that the Google Sheets API and Google Drive API are enabled
- Verify that the service account credentials are correct
- Ensure the private key includes proper line breaks (`\n`)

### "No data found"
- Verify that there is data matching your selected filters
- Check that the year and project filters are set correctly

### Permission Issues
- The exported sheets are automatically set to public (read-only)
- If you need to share with specific users, modify the permissions in the Google Sheet

## API Endpoint

The export functionality is handled by:
- **Endpoint**: `POST /api/export-to-sheets`
- **Query Parameters**:
  - `year` - Filter by fiscal year (e.g., 2025)
  - `project` - Filter by project code (e.g., EGOV)
  - `month` - Filter by month number (1-12)

## Security Notes

- Service account credentials should never be committed to version control
- The `.env.local` file is already in `.gitignore`
- Exported sheets are set to public read-only by default
- Consider implementing additional access controls for sensitive data
