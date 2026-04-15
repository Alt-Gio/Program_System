# Export to DICT_Results - Complete Guide

## 🎯 Overview

This feature allows you to export activity data directly to your **DICT_Results** Google Spreadsheet with a single click. The data is automatically formatted and ready for use with Looker Studio, Google Apps Script, or any other tool that works with Google Sheets.

## ✨ Key Features

- **Single Spreadsheet**: All exports go to one place (DICT_Results)
- **Smart Organization**: Different filters create different sheets
- **Auto-Formatting**: Blue headers, frozen rows, auto-sized columns
- **Looker Studio Ready**: Stable data source for dashboards
- **Apps Script Friendly**: Easy automation and integration
- **No Clutter**: No more dozens of exported files

## 🚀 Quick Start (3 Steps)

### 1️⃣ Get Your Spreadsheet ID

Open DICT_Results and copy the ID from the URL:
```
https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
```

**Need help?** See [GET_SPREADSHEET_ID.md](GET_SPREADSHEET_ID.md)

### 2️⃣ Share with Service Account

Share DICT_Results with this email as **Editor**:
```
dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com
```

### 3️⃣ Configure Environment

Add to `.env.local`:
```env
GOOGLE_SHEETS_TARGET_ID=YOUR_SPREADSHEET_ID
```

Then restart your server:
```bash
npm run dev
```

## 📚 Documentation

### Getting Started
- **[GET_SPREADSHEET_ID.md](GET_SPREADSHEET_ID.md)** - How to find your spreadsheet ID
- **[EXPORT_QUICK_REFERENCE.md](EXPORT_QUICK_REFERENCE.md)** - Quick reference card
- **[DICT_RESULTS_SETUP.md](DICT_RESULTS_SETUP.md)** - Complete setup guide

### Advanced
- **[DICT_RESULTS_IMPLEMENTATION.md](DICT_RESULTS_IMPLEMENTATION.md)** - Technical details
- **[GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)** - Google Cloud setup
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Code changes

## 🎨 How to Use

### From Dashboard
1. Select your filters (year, program, month)
2. Click **"Export to Sheets"**
3. Wait for success message
4. DICT_Results opens automatically

### From Map
1. Select program filter
2. Click **"Sheets"** button
3. Wait for success message
4. DICT_Results opens automatically

### From Project Pages
1. Navigate to any project (eGovPH, Free WiFi, etc.)
2. Click **"Export to Sheets"**
3. Wait for success message
4. DICT_Results opens automatically

## 📊 Sheet Organization

The system creates sheets based on your filters:

| Filters | Sheet Name | Use Case |
|---------|-----------|----------|
| None | `Activity Data` | All activities, all projects |
| EGOV + 2025 | `EGOV_2025` | eGovPH activities in 2025 |
| WIFI + 2025 | `WIFI_2025` | Free WiFi activities in 2025 |
| EGOV only | `EGOV` | All eGovPH activities |
| 2025 only | `FY_2025` | All activities in 2025 |

**Tip**: Same filters = Same sheet (data updates). Different filters = New sheet.

## 🔗 Looker Studio Integration

### Setup
1. Export data to DICT_Results
2. Open [Looker Studio](https://lookerstudio.google.com/)
3. Create Data Source → Google Sheets
4. Select DICT_Results → Choose sheet
5. Build your dashboard

### Updates
1. Click "Export to Sheets" (same filters)
2. Data updates automatically
3. Looker Studio refreshes
4. No reconfiguration needed

**Benefit**: One-time setup, lifetime updates!

## 🤖 Apps Script Examples

### Daily Export
```javascript
function dailyExport() {
  const url = 'https://your-domain.com/api/export-to-sheets?year=2025';
  UrlFetchApp.fetch(url, { method: 'post' });
}
```

### Weekly Email Report
```javascript
function weeklyReport() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Activity Data');
  const rowCount = sheet.getLastRow() - 1;
  
  MailApp.sendEmail({
    to: 'team@example.com',
    subject: 'Weekly Report',
    body: `Activities this week: ${rowCount}`
  });
}
```

### Data Validation
```javascript
function validateData() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Activity Data');
  // Add your validation logic
}
```

## ⚠️ Troubleshooting

### "Target spreadsheet not configured"
→ Set `GOOGLE_SHEETS_TARGET_ID` in `.env.local`

### "The caller does not have permission"
→ Share DICT_Results with service account as **Editor**

### "No data found"
→ Check your filters, ensure data exists

### Data not in Looker Studio
→ Click "Refresh Fields" in data source

**More help**: See [DICT_RESULTS_SETUP.md](DICT_RESULTS_SETUP.md) troubleshooting section

## 💡 Pro Tips

1. **Consistent Exports**: Use same filters to update same sheet
2. **Multiple Dashboards**: Create different sheets for different views
3. **Clean Up**: Delete unused sheets manually in DICT_Results
4. **Performance**: Smaller sheets = faster dashboards
5. **Automation**: Use Apps Script for scheduled exports

## 🎯 Success Checklist

- [ ] Copied spreadsheet ID from DICT_Results URL
- [ ] Shared DICT_Results with service account (Editor)
- [ ] Added `GOOGLE_SHEETS_TARGET_ID` to `.env.local`
- [ ] Restarted development server
- [ ] Tested export from Dashboard
- [ ] Verified data appears in DICT_Results
- [ ] Checked formatting (blue header, frozen row)
- [ ] Connected to Looker Studio (optional)
- [ ] Set up Apps Script automation (optional)

## 📞 Support

### Documentation
- Quick start: [EXPORT_QUICK_REFERENCE.md](EXPORT_QUICK_REFERENCE.md)
- Setup guide: [DICT_RESULTS_SETUP.md](DICT_RESULTS_SETUP.md)
- Get ID: [GET_SPREADSHEET_ID.md](GET_SPREADSHEET_ID.md)

### Common Issues
- Configuration errors → Check `.env.local`
- Permission errors → Verify service account access
- Data errors → Review filters and data availability

### Technical Details
- Implementation: [DICT_RESULTS_IMPLEMENTATION.md](DICT_RESULTS_IMPLEMENTATION.md)
- API details: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## 🎉 What's Next?

### Immediate
1. Complete the 3-step setup
2. Test export functionality
3. Verify data in DICT_Results

### Short Term
1. Connect to Looker Studio
2. Build your first dashboard
3. Share with your team

### Long Term
1. Set up Apps Script automation
2. Create scheduled exports
3. Build multiple dashboards
4. Implement data validation

## 🌟 Benefits Summary

✅ **One spreadsheet** for all exports  
✅ **Organized sheets** by filter  
✅ **Auto-formatted** and professional  
✅ **Looker Studio ready** out of the box  
✅ **Apps Script friendly** for automation  
✅ **No file clutter** in Google Drive  
✅ **Easy maintenance** and updates  
✅ **Team collaboration** in one place  

---

**Ready to start?** Follow the [3-step quick start](#-quick-start-3-steps) above! 🚀

**Questions?** Check the [troubleshooting section](#-troubleshooting) or review the detailed guides.

**Need technical details?** See [DICT_RESULTS_IMPLEMENTATION.md](DICT_RESULTS_IMPLEMENTATION.md).
