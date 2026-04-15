# Installing the Apps Script for DICT_Results

## What This Script Does

The Apps Script automatically prepares your exported data for Looker Studio by:

✅ Creating a **Looker_Summary** sheet with aggregated metrics  
✅ Creating a **Looker_Metrics** sheet with KPIs  
✅ Creating a **Looker_Pivots** sheet for visualizations  
✅ Adding data validation and formatting  
✅ Setting up named ranges for easy reference  
✅ Auto-refreshing when data changes  

## Installation Steps

### Step 1: Open Your Spreadsheet

1. Go to: https://docs.google.com/spreadsheets/d/1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM/edit
2. This is your DICT_Results spreadsheet

### Step 2: Open Apps Script Editor

1. In the spreadsheet, click **Extensions** in the menu
2. Click **Apps Script**
3. A new tab will open with the Apps Script editor

### Step 3: Clear Existing Code

1. If there's any existing code, select it all (Ctrl+A or Cmd+A)
2. Delete it

### Step 4: Paste the New Script

1. Open the file `APPS_SCRIPT_FOR_LOOKER.gs` (in your project folder)
2. Copy ALL the code (Ctrl+A, then Ctrl+C)
3. Paste it into the Apps Script editor (Ctrl+V)

### Step 5: Save the Script

1. Click the **Save** icon (💾) or press Ctrl+S (Cmd+S on Mac)
2. Give your project a name: "DICT Looker Studio Helper"
3. Click **OK**

### Step 6: Run the Setup

1. In the Apps Script editor, find the function dropdown (near the top)
2. Select **setupLookerStudio** from the dropdown
3. Click the **Run** button (▶️)

### Step 7: Authorize the Script

**First time only:**

1. A dialog will appear: "Authorization required"
2. Click **Review permissions**
3. Choose your Google account
4. Click **Advanced** (at the bottom)
5. Click **Go to DICT Looker Studio Helper (unsafe)**
6. Click **Allow**

**Note**: This is safe - you're authorizing your own script to access your own spreadsheet.

### Step 8: Wait for Completion

1. The script will run (takes 10-30 seconds)
2. You'll see a success message: "Setup Complete!"
3. Click **OK**

### Step 9: Verify Installation

Go back to your spreadsheet and check for new sheets:

- ✅ **Looker_Summary** - Aggregated data
- ✅ **Looker_Metrics** - KPIs and metrics
- ✅ **Looker_Pivots** - Pivot table data

You should also see a new menu: **📊 Looker Studio**

## Using the Script

### Custom Menu

After installation, you'll see a new menu in your spreadsheet:

**📊 Looker Studio**
- 🚀 Setup for Looker Studio - Run initial setup
- 🔄 Refresh Summary Sheets - Manually refresh summaries
- ⚙️ Enable Auto-Refresh - Auto-update when data changes
- 📖 Help - Show help dialog

### Auto-Refresh (Recommended)

1. Click **📊 Looker Studio** menu
2. Click **⚙️ Enable Auto-Refresh**
3. Click **OK** when prompted

Now, whenever you export new data, the summary sheets will automatically update!

## What Each Sheet Does

### Looker_Summary
**Best for**: Time-series charts, project comparisons, geographic analysis

Contains aggregated data by:
- Year, Quarter, Month
- Project (EGOV, WIFI, etc.)
- Province
- Status

Metrics included:
- Activity Count
- Total Participants
- Male/Female breakdown
- Completion Rate

### Looker_Metrics
**Best for**: Scorecards, KPI dashboards, summary statistics

Contains key metrics:
- Total Activities
- Total Participants
- Average Participants per Activity
- Completion Rate
- Gender Distribution
- Geographic Coverage

### Looker_Pivots
**Best for**: Custom aggregations, advanced visualizations

Contains pre-aggregated data for:
- Activities by Project and Year
- Participants by Province
- Status Distribution
- Monthly Trends

## Connecting to Looker Studio

### Step 1: Export Data First

1. In your app, click **"Export to Sheets"**
2. Verify data appears in the **Activity Data** sheet
3. Summary sheets will auto-update (if auto-refresh is enabled)

### Step 2: Open Looker Studio

1. Go to https://lookerstudio.google.com
2. Click **Create** → **Data Source**

### Step 3: Connect to Google Sheets

1. Select **Google Sheets** connector
2. Click **Authorize** if prompted
3. Find and select **DICT_Results** spreadsheet
4. Choose which sheet to use:
   - **Looker_Summary** (recommended for most dashboards)
   - **Looker_Metrics** (for KPI scorecards)
   - **Activity Data** (for detailed analysis)

### Step 4: Configure Fields

Looker Studio will automatically detect field types. Verify:

- **Dates**: year, month, start_date, end_date
- **Numbers**: activity_count, total_participants, etc.
- **Text**: project, province, status, etc.

### Step 5: Create Your Dashboard

1. Click **Create Report**
2. Add charts, tables, and scorecards
3. Use the summary data for faster performance

## Recommended Looker Studio Visualizations

### 1. Activities Over Time
- **Chart Type**: Time Series
- **Date Dimension**: Month or Quarter
- **Metric**: Activity Count
- **Breakdown**: Project

### 2. Geographic Distribution
- **Chart Type**: Geo Chart or Table
- **Dimension**: Province
- **Metric**: Activity Count, Total Participants

### 3. Project Performance
- **Chart Type**: Bar Chart
- **Dimension**: Project
- **Metrics**: Activity Count, Completion Rate

### 4. Status Overview
- **Chart Type**: Pie Chart or Donut Chart
- **Dimension**: Status
- **Metric**: Activity Count

### 5. KPI Scorecards
- **Chart Type**: Scorecard
- **Metrics**: Total Activities, Total Participants, Completion Rate

### 6. Gender Distribution
- **Chart Type**: Stacked Bar Chart
- **Dimension**: Project or Province
- **Metrics**: Male Participants, Female Participants

## Troubleshooting

### Script doesn't run
**Solution**: Make sure you authorized the script (Step 7)

### Summary sheets are empty
**Solution**: 
1. Export data first from your app
2. Make sure data is in "Activity Data" sheet
3. Run "Refresh Summary Sheets" from the menu

### Auto-refresh not working
**Solution**:
1. Click **📊 Looker Studio** → **⚙️ Enable Auto-Refresh**
2. Make sure you authorized the script

### Looker Studio shows old data
**Solution**:
1. In Looker Studio, click **Resource** → **Manage added data sources**
2. Find your data source
3. Click **Refresh Fields**

### Error: "Cannot read property 'length'"
**Solution**: Export data first - the script needs data to work with

## Updating the Script

If you need to update the script later:

1. Open **Extensions** → **Apps Script**
2. Replace the code with the new version
3. Save (Ctrl+S)
4. Run **setupLookerStudio** again

## Best Practices

### 1. Regular Exports
Export data regularly to keep Looker Studio dashboards up-to-date:
- Daily: For active monitoring
- Weekly: For regular reporting
- Monthly: For trend analysis

### 2. Use Summary Sheets
For better Looker Studio performance:
- Use **Looker_Summary** for most visualizations
- Use **Looker_Metrics** for KPI dashboards
- Use **Activity Data** only when you need detailed records

### 3. Enable Auto-Refresh
Always enable auto-refresh so summary sheets stay current

### 4. Clean Up Old Data
Periodically review and archive old sheets to keep the spreadsheet fast

### 5. Share Appropriately
Share the spreadsheet with:
- **Editors**: Team members who export data
- **Viewers**: Stakeholders who only view Looker Studio dashboards

## Advanced: Scheduled Exports

You can set up automatic daily exports using Apps Script:

```javascript
function scheduledExport() {
  const url = 'https://your-domain.com/api/export-to-sheets?year=2025';
  
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json' }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Export successful');
  } catch (error) {
    Logger.log('Export failed: ' + error);
  }
}

// Run daily at 6 AM
function createDailyTrigger() {
  ScriptApp.newTrigger('scheduledExport')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
}
```

## Support

### Quick Fixes
- **Script error**: Check authorization
- **Empty sheets**: Export data first
- **Old data**: Refresh summary sheets
- **Looker Studio issues**: Refresh fields

### Documentation
- Apps Script code: `APPS_SCRIPT_FOR_LOOKER.gs`
- Setup guide: This file
- Export guide: `DICT_RESULTS_SETUP.md`

### Help Menu
Click **📊 Looker Studio** → **📖 Help** in your spreadsheet for quick reference

---

**Installation complete?** Now export some data and connect to Looker Studio! 🚀
