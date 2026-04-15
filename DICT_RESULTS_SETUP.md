# DICT_Results Google Sheets Setup Guide

## Overview

The export functionality now writes directly to your existing **DICT_Results** Google Spreadsheet instead of creating new sheets each time. This provides:

- **Stable data source** for Looker Studio dashboards
- **Easy App Script integration** for automation
- **Organized data** with separate sheets for different filters
- **No clutter** from multiple exported files

## Quick Setup (3 Steps)

### Step 1: Get Your DICT_Results Spreadsheet ID

1. Open your **DICT_Results** Google Spreadsheet
2. Look at the URL in your browser:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
3. Copy the `SPREADSHEET_ID_HERE` part (the long string between `/d/` and `/edit`)

### Step 2: Share with Service Account

1. In your DICT_Results spreadsheet, click the **Share** button
2. Add this email address as an **Editor**:
   ```
   dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com
   ```
3. Click **Send** (no need to notify)

### Step 3: Update Environment Variable

1. Open your `.env.local` file
2. Find the line with `GOOGLE_SHEETS_TARGET_ID`
3. Replace `YOUR_DICT_RESULTS_SPREADSHEET_ID_HERE` with your actual spreadsheet ID:
   ```env
   GOOGLE_SHEETS_TARGET_ID=1a2b3c4d5e6f7g8h9i0j
   ```
4. Save the file
5. Restart your development server

## How It Works

### Sheet Organization

When you export data, the system creates/updates sheets within DICT_Results based on your filters:

| Filter Selection | Sheet Name | Example |
|-----------------|------------|---------|
| All data | `Activity Data` | All activities |
| Specific project + year | `EGOV_2025` | eGovPH activities in 2025 |
| Specific project only | `EGOV` | All eGovPH activities |
| Specific year only | `FY_2025` | All activities in 2025 |

### Data Updates

- **First export**: Creates a new sheet with the data
- **Subsequent exports**: Clears and updates the existing sheet
- **Multiple filters**: Each filter combination gets its own sheet
- **Header formatting**: Blue background, white text, frozen first row

## Using with Looker Studio

### Initial Setup

1. Export your data to DICT_Results (any filter)
2. Open [Looker Studio](https://lookerstudio.google.com/)
3. Click **Create** > **Data Source**
4. Select **Google Sheets**
5. Choose **DICT_Results** spreadsheet
6. Select the specific sheet (e.g., `EGOV_2025`)
7. Click **Connect**

### Refreshing Data

1. Click **Export to Sheets** in your app (same filters)
2. Data in DICT_Results updates automatically
3. Looker Studio dashboards refresh automatically
4. No need to reconnect or reconfigure

### Multiple Dashboards

You can create different Looker Studio dashboards for different data views:

- **Dashboard 1**: Connect to `EGOV_2025` sheet
- **Dashboard 2**: Connect to `WIFI_2025` sheet
- **Dashboard 3**: Connect to `Activity Data` sheet (all data)

## Using with Google Apps Script

### Example: Auto-Email Reports

```javascript
function sendWeeklyReport() {
  // Open the DICT_Results spreadsheet
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Activity Data');
  
  // Get the data
  const data = sheet.getDataRange().getValues();
  
  // Process and send email
  const rowCount = data.length - 1; // Exclude header
  const subject = `Weekly Activity Report: ${rowCount} activities`;
  
  MailApp.sendEmail({
    to: 'your-email@example.com',
    subject: subject,
    body: `This week's activity count: ${rowCount}`
  });
}

// Set up a weekly trigger
function createWeeklyTrigger() {
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
}
```

### Example: Data Validation

```javascript
function validateNewData() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Activity Data');
  
  // Get the last row
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Validate required fields
  const requiredFields = [0, 5, 12]; // record_id, project_code, activity_title
  const missingFields = [];
  
  requiredFields.forEach(index => {
    if (!data[index]) {
      missingFields.push(sheet.getRange(1, index + 1).getValue());
    }
  });
  
  if (missingFields.length > 0) {
    Logger.log('Missing fields: ' + missingFields.join(', '));
  }
}
```

### Example: Auto-Formatting

```javascript
function formatNewData() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Activity Data');
  
  // Apply alternating row colors
  const range = sheet.getDataRange();
  range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  
  // Add data validation for status column
  const statusColumn = 20; // Adjust based on your column
  const statusRange = sheet.getRange(2, statusColumn, sheet.getLastRow() - 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Draft', 'Submitted', 'Validated', 'Reported'])
    .build();
  statusRange.setDataValidation(rule);
}
```

## Troubleshooting

### Error: "Target spreadsheet not configured"

**Solution**: Set the `GOOGLE_SHEETS_TARGET_ID` in your `.env.local` file

### Error: "Failed to access the target spreadsheet"

**Solution**: Share the DICT_Results spreadsheet with the service account email:
```
dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com
```

### Error: "The caller does not have permission"

**Cause**: Service account doesn't have edit access

**Solution**:
1. Open DICT_Results spreadsheet
2. Click Share
3. Add service account email as **Editor** (not Viewer)
4. Save

### Data not updating in Looker Studio

**Solution**:
1. In Looker Studio, click on your data source
2. Click **Refresh Fields**
3. Or set up automatic refresh in data source settings

### Wrong sheet name created

**Cause**: Filter combination creates unexpected sheet name

**Solution**: Sheet names follow this pattern:
- `Activity Data` = No filters
- `PROJECTCODE_YEAR` = Both project and year
- `PROJECTCODE` = Project only
- `FY_YEAR` = Year only

## Best Practices

### 1. Consistent Exports

Export with the same filters to update the same sheet:
- ✅ Good: Always export "EGOV 2025" to update `EGOV_2025` sheet
- ❌ Bad: Randomly changing filters creates many sheets

### 2. Sheet Organization

Keep your DICT_Results organized:
- Use descriptive sheet names
- Delete old/unused sheets manually
- Keep one sheet per dashboard

### 3. Looker Studio Performance

For better performance:
- Export only the data you need (use filters)
- Smaller sheets = faster dashboards
- Consider separate sheets for different time periods

### 4. App Script Automation

Set up triggers for:
- Daily data exports (using Apps Script to call your API)
- Weekly summary emails
- Data validation checks
- Automatic formatting

## Advanced: Scheduled Exports

You can set up Google Apps Script to automatically trigger exports:

```javascript
function scheduledExport() {
  const url = 'https://your-domain.com/api/export-to-sheets?year=2025&project=EGOV';
  
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Export successful: ' + response.getContentText());
  } catch (error) {
    Logger.log('Export failed: ' + error);
  }
}

// Run every day at 6 AM
function createDailyTrigger() {
  ScriptApp.newTrigger('scheduledExport')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
}
```

## Support

If you encounter issues:

1. Check that `GOOGLE_SHEETS_TARGET_ID` is set correctly
2. Verify service account has Editor access to DICT_Results
3. Check the browser console for detailed error messages
4. Review the API response for hints about what went wrong

## Summary

✅ **One spreadsheet** (DICT_Results) for all exports  
✅ **Organized sheets** based on filters  
✅ **Looker Studio ready** with stable data sources  
✅ **App Script friendly** for automation  
✅ **No clutter** from multiple files  
