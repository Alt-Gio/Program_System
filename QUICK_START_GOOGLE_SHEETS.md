# Quick Start: Google Sheets Export

## What's New?

You now have a new **"Export to Sheets"** button next to the existing "Export CSV" button on:
- Dashboard page
- Map page
- All Project pages (eGovPH, Free WiFi, etc.)

## How to Use

### Step 1: Navigate to Dashboard, Map, or Project Page
- Go to the Dashboard, or
- Go to the Map view, or
- Go to any specific project page (e.g., /projects/egov)

### Step 2: Apply Filters (Optional)
- Select year, program, month as needed
- The export will include only the filtered data

### Step 3: Click "Export to Sheets"
- Click the blue **"Export to Sheets"** button (or **"Sheets"** on the map page)
- Wait for the export to complete (button will show "Exporting..." or "...")
- A new Google Sheet will be created and opened automatically

### Step 4: Use with Looker Studio
1. Copy the URL of the newly created Google Sheet
2. Go to [Looker Studio](https://lookerstudio.google.com/)
3. Click **Create** > **Data Source**
4. Select **Google Sheets**
5. Paste the URL or select the sheet
6. Start building your visualizations!

## Benefits

### vs CSV Export
| Feature | CSV Export | Sheets Export |
|---------|-----------|---------------|
| Download file | ✅ Yes | ❌ No |
| Cloud storage | ❌ No | ✅ Yes |
| Auto-formatting | ❌ No | ✅ Yes |
| Looker Studio | Manual import | Direct connect |
| Sharing | Email file | Share link |
| Updates | Re-export | Re-export |

### Why Use Sheets Export?
- **No file management**: Data goes directly to Google Drive
- **Easy sharing**: Just share the Google Sheets link
- **Looker Studio ready**: Connect directly without importing
- **Professional formatting**: Headers are pre-formatted
- **Accessible anywhere**: Access from any device with internet

## Troubleshooting

### Button doesn't work
- Check your internet connection
- Ensure you're logged into Google (for opening the sheet)
- Try refreshing the page

### "Export failed" message
- Contact your system administrator
- The Google Sheets API may need to be configured

### Sheet opens but is empty
- Check that your filters aren't too restrictive
- Verify there is data for the selected period

## Tips

1. **Bookmark your sheets**: Save frequently used exports to Google Drive favorites
2. **Use filters**: Export only the data you need to keep sheets manageable
3. **Regular exports**: Export data regularly to track changes over time
4. **Looker Studio templates**: Create reusable dashboard templates in Looker Studio

## Need Help?

- See `GOOGLE_SHEETS_SETUP.md` for detailed setup instructions
- See `IMPLEMENTATION_SUMMARY.md` for technical details
- Contact your system administrator for API configuration issues
