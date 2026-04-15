# Complete Setup Checklist - DICT_Results Export System

## 🎯 Overview

This checklist will guide you through the complete setup of the DICT_Results export system, from configuration to your first Looker Studio dashboard.

**Estimated Time**: 15-20 minutes

---

## Phase 1: Environment Configuration ⚙️

### ✅ Step 1.1: Configure Spreadsheet ID

- [ ] Spreadsheet ID is: `1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM`
- [ ] Open `.env.local` file
- [ ] Verify this line exists:
  ```env
  GOOGLE_SHEETS_TARGET_ID=1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM
  ```
- [ ] Save the file

### ✅ Step 1.2: Share Spreadsheet with Service Account

- [ ] Open: https://docs.google.com/spreadsheets/d/1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM/edit
- [ ] Click **Share** button (top-right)
- [ ] Add email: `dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com`
- [ ] Set permission to: **Editor**
- [ ] Uncheck "Notify people" (optional)
- [ ] Click **Send**
- [ ] Verify service account appears in share list

### ✅ Step 1.3: Restart Development Server

- [ ] Stop current server (Ctrl+C in terminal)
- [ ] Run: `npm run dev`
- [ ] Wait for server to start
- [ ] Verify no errors in console

**✅ Phase 1 Complete!** Environment is configured.

---

## Phase 2: Test Export Functionality 🚀

### ✅ Step 2.1: Export from Dashboard

- [ ] Open your app in browser
- [ ] Navigate to Dashboard page
- [ ] Select filters (optional):
  - Year: 2025
  - Program: Any
  - Month: Any
- [ ] Click **"Export to Sheets"** button
- [ ] Wait for success message
- [ ] Verify message shows:
  - ✅ Sheet name (e.g., "Activity Data" or "EGOV_2025")
  - ✅ Row count
  - ✅ Filters applied
- [ ] New tab opens with DICT_Results spreadsheet
- [ ] Verify data appears in the sheet

### ✅ Step 2.2: Export from Map Page

- [ ] Navigate to Map page
- [ ] Select program filter (optional)
- [ ] Click **"Sheets"** button
- [ ] Wait for success message
- [ ] Verify data exported

### ✅ Step 2.3: Export from Project Page

- [ ] Navigate to any project page (e.g., /projects/egov)
- [ ] Click **"Export to Sheets"** button
- [ ] Wait for success message
- [ ] Verify data exported

### ✅ Step 2.4: Verify Data in Spreadsheet

- [ ] Open DICT_Results spreadsheet
- [ ] Check for sheets created:
  - [ ] Activity Data (or other sheet based on filters)
- [ ] Verify data formatting:
  - [ ] Blue header row
  - [ ] White header text
  - [ ] Frozen first row
  - [ ] Auto-sized columns
- [ ] Check data accuracy:
  - [ ] Row count matches export message
  - [ ] Data looks correct

**✅ Phase 2 Complete!** Export functionality is working.

---

## Phase 3: Install Apps Script 🤖

### ✅ Step 3.1: Open Apps Script Editor

- [ ] In DICT_Results spreadsheet, click **Extensions** menu
- [ ] Click **Apps Script**
- [ ] New tab opens with Apps Script editor

### ✅ Step 3.2: Paste Script Code

- [ ] Select any existing code (Ctrl+A)
- [ ] Delete it
- [ ] Open file: `APPS_SCRIPT_FOR_LOOKER.gs`
- [ ] Copy all code (Ctrl+A, then Ctrl+C)
- [ ] Paste into Apps Script editor (Ctrl+V)

### ✅ Step 3.3: Save Script

- [ ] Click Save icon (💾) or press Ctrl+S
- [ ] Name project: "DICT Looker Studio Helper"
- [ ] Click **OK**

### ✅ Step 3.4: Run Setup Function

- [ ] In function dropdown, select: `setupLookerStudio`
- [ ] Click **Run** button (▶️)
- [ ] **First time only**: Authorization dialog appears
  - [ ] Click **Review permissions**
  - [ ] Choose your Google account
  - [ ] Click **Advanced**
  - [ ] Click **Go to DICT Looker Studio Helper (unsafe)**
  - [ ] Click **Allow**
- [ ] Wait for script to complete (10-30 seconds)
- [ ] Success message appears: "Setup Complete!"
- [ ] Click **OK**

### ✅ Step 3.5: Verify Script Installation

- [ ] Go back to DICT_Results spreadsheet
- [ ] Check for new sheets:
  - [ ] Looker_Summary
  - [ ] Looker_Metrics
  - [ ] Looker_Pivots
- [ ] Check for new menu: **📊 Looker Studio**
- [ ] Click menu to verify options:
  - [ ] 🚀 Setup for Looker Studio
  - [ ] 🔄 Refresh Summary Sheets
  - [ ] ⚙️ Enable Auto-Refresh
  - [ ] 📖 Help

### ✅ Step 3.6: Enable Auto-Refresh

- [ ] Click **📊 Looker Studio** menu
- [ ] Click **⚙️ Enable Auto-Refresh**
- [ ] Confirm authorization if prompted
- [ ] Success message: "Auto-Refresh Enabled"
- [ ] Click **OK**

**✅ Phase 3 Complete!** Apps Script is installed and configured.

---

## Phase 4: Connect to Looker Studio 📊

### ✅ Step 4.1: Open Looker Studio

- [ ] Go to: https://lookerstudio.google.com
- [ ] Sign in with your Google account

### ✅ Step 4.2: Create Data Source

- [ ] Click **Create** button
- [ ] Click **Data Source**
- [ ] Select **Google Sheets** connector
- [ ] Click **Authorize** if prompted
- [ ] Find and select: **DICT_Results**
- [ ] Select sheet: **Looker_Summary** (recommended)
- [ ] Click **Connect**

### ✅ Step 4.3: Verify Field Types

Check that fields are correctly typed:

- [ ] **Dates**: year, month, start_date, end_date
- [ ] **Numbers**: activity_count, total_participants, completion_rate
- [ ] **Text**: project, province, status, lgu

If any are wrong:
- [ ] Click field name
- [ ] Change type in dropdown
- [ ] Click **Done**

### ✅ Step 4.4: Name Data Source

- [ ] Click **Untitled Data Source** (top-left)
- [ ] Rename to: "DICT R5 - Summary Data"
- [ ] Data source is automatically saved

**✅ Phase 4 Complete!** Looker Studio is connected.

---

## Phase 5: Create First Dashboard 🎨

### ✅ Step 5.1: Create Report

- [ ] In Looker Studio, click **Create Report**
- [ ] Data source is already selected
- [ ] Click **Add to Report**

### ✅ Step 5.2: Add Title

- [ ] Click **Add text** (toolbar)
- [ ] Type: "DICT Region V - Activity Dashboard"
- [ ] Increase font size to 24
- [ ] Make bold
- [ ] Center align

### ✅ Step 5.3: Add KPI Scorecards

**Total Activities:**
- [ ] Click **Add a chart** → **Scorecard**
- [ ] Place in top-left
- [ ] Metric: Activity Count (SUM)
- [ ] Enable compact numbers

**Total Participants:**
- [ ] Add another scorecard
- [ ] Place next to first
- [ ] Metric: Total Participants (SUM)

**Completion Rate:**
- [ ] Add another scorecard
- [ ] Metric: Completion Rate (AVERAGE)

**Provinces Covered:**
- [ ] Add another scorecard
- [ ] Metric: Province (COUNT DISTINCT)

### ✅ Step 5.4: Add Time Series Chart

- [ ] Click **Add a chart** → **Time series**
- [ ] Place below scorecards (full width)
- [ ] Date dimension: Month or Quarter
- [ ] Metric: Activity Count (SUM)
- [ ] Breakdown: Project
- [ ] Enable data labels

### ✅ Step 5.5: Add Filters

- [ ] Click **Add a control** → **Drop-down list**
- [ ] Control field: Year
- [ ] Label: "Select Year"

### ✅ Step 5.6: Save Dashboard

- [ ] Click **File** → **Rename**
- [ ] Name: "DICT R5 Executive Dashboard"
- [ ] Dashboard auto-saves

**✅ Phase 5 Complete!** First dashboard created!

---

## Phase 6: Test End-to-End 🔄

### ✅ Step 6.1: Export New Data

- [ ] Go back to your app
- [ ] Change filters (different year or project)
- [ ] Click **"Export to Sheets"**
- [ ] Verify success message

### ✅ Step 6.2: Verify Auto-Update

- [ ] Go to DICT_Results spreadsheet
- [ ] Check that data updated in source sheet
- [ ] Check that summary sheets updated (if auto-refresh enabled)
- [ ] Verify row counts match

### ✅ Step 6.3: Refresh Looker Studio

- [ ] Go to your Looker Studio dashboard
- [ ] Click **Refresh data** button (top-right)
- [ ] Or press Ctrl+R (Cmd+R on Mac)
- [ ] Verify dashboard shows new data

### ✅ Step 6.4: Test Filters

- [ ] In Looker Studio dashboard, use Year filter
- [ ] Verify charts update
- [ ] Try different filter values
- [ ] Confirm data changes correctly

**✅ Phase 6 Complete!** End-to-end system is working!

---

## Phase 7: Share and Document 📤

### ✅ Step 7.1: Share Spreadsheet

- [ ] Open DICT_Results spreadsheet
- [ ] Click **Share**
- [ ] Add team members with appropriate permissions:
  - **Editors**: Can export data
  - **Viewers**: Can only view
- [ ] Click **Send**

### ✅ Step 7.2: Share Dashboard

- [ ] Open Looker Studio dashboard
- [ ] Click **Share**
- [ ] Add team members:
  - **Editors**: Can modify dashboard
  - **Viewers**: Can only view
- [ ] Click **Send**

### ✅ Step 7.3: Create Documentation

- [ ] Document export process for team
- [ ] Share relevant guides:
  - [ ] `EXPORT_QUICK_REFERENCE.md`
  - [ ] `LOOKER_STUDIO_DASHBOARD_GUIDE.md`
- [ ] Schedule training session (optional)

**✅ Phase 7 Complete!** System is shared and documented.

---

## 🎉 Final Verification

### System Health Check

- [ ] ✅ Environment configured (`.env.local`)
- [ ] ✅ Service account has access to spreadsheet
- [ ] ✅ Export works from all pages (Dashboard, Map, Projects)
- [ ] ✅ Data appears correctly in DICT_Results
- [ ] ✅ Apps Script installed and running
- [ ] ✅ Summary sheets created and updating
- [ ] ✅ Auto-refresh enabled
- [ ] ✅ Looker Studio connected
- [ ] ✅ Dashboard created and functional
- [ ] ✅ End-to-end flow tested
- [ ] ✅ Team members have access

### Success Criteria

✅ **Export**: Click button → Data in DICT_Results  
✅ **Summary**: Data updates → Summaries refresh  
✅ **Looker**: Refresh dashboard → New data appears  
✅ **Sharing**: Team can view/edit as needed  

---

## 📚 Reference Documentation

### Quick Guides
- **Export**: `EXPORT_QUICK_REFERENCE.md`
- **Setup**: `DICT_RESULTS_SETUP.md`
- **Apps Script**: `INSTALL_APPS_SCRIPT.md`
- **Looker Studio**: `LOOKER_STUDIO_DASHBOARD_GUIDE.md`

### Technical Details
- **Implementation**: `DICT_RESULTS_IMPLEMENTATION.md`
- **Architecture**: `ARCHITECTURE.md`
- **API Details**: `app/api/export-to-sheets/route.ts`

### Troubleshooting
- **Common Issues**: See `DICT_RESULTS_SETUP.md` troubleshooting section
- **Error Messages**: Check browser console and API responses
- **Support**: Review documentation or contact system administrator

---

## 🚀 Next Steps

### Immediate (This Week)
1. [ ] Train team on export functionality
2. [ ] Create additional Looker Studio dashboards
3. [ ] Set up regular export schedule
4. [ ] Monitor system performance

### Short Term (This Month)
1. [ ] Gather feedback from users
2. [ ] Optimize dashboard layouts
3. [ ] Add more visualizations
4. [ ] Document best practices

### Long Term (This Quarter)
1. [ ] Set up automated exports (Apps Script)
2. [ ] Create dashboard templates for different audiences
3. [ ] Implement data validation rules
4. [ ] Build advanced analytics

---

## ✅ Completion Certificate

**Date Completed**: _______________

**Completed By**: _______________

**System Status**: 
- [ ] Fully Operational
- [ ] Partially Operational (note issues below)
- [ ] Needs Attention

**Notes**:
_______________________________________
_______________________________________
_______________________________________

**Verified By**: _______________

---

**Congratulations! 🎉** Your DICT_Results export and Looker Studio system is now fully operational!
