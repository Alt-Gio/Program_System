# Export to DICT_Results - Quick Reference

## 🎯 What You Need

1. **DICT_Results Spreadsheet ID** - Get from the URL
2. **Service Account Access** - Share spreadsheet with service account
3. **Environment Variable** - Set `GOOGLE_SHEETS_TARGET_ID` in `.env.local`

## 📋 Setup Checklist

- [ ] Copy spreadsheet ID from DICT_Results URL
- [ ] Share DICT_Results with: `dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com` (as Editor)
- [ ] Add `GOOGLE_SHEETS_TARGET_ID=your_id_here` to `.env.local`
- [ ] Restart development server

## 🚀 How to Export

### From Dashboard
1. Select filters (year, program, month)
2. Click **"Export to Sheets"** button
3. Wait for success message
4. Sheet opens automatically

### From Map
1. Select program filter
2. Click **"Sheets"** button (compact version)
3. Wait for success message
4. Sheet opens automatically

### From Project Page
1. Already filtered by project
2. Click **"Export to Sheets"** button
3. Wait for success message
4. Sheet opens automatically

## 📊 Sheet Names

| Your Filters | Sheet Name Created |
|-------------|-------------------|
| No filters | `Activity Data` |
| eGovPH + 2025 | `EGOV_2025` |
| Free WiFi + 2025 | `WIFI_2025` |
| eGovPH only | `EGOV` |
| 2025 only | `FY_2025` |

## 🔄 Data Updates

- **First time**: Creates new sheet
- **Next time**: Updates existing sheet (clears old data)
- **Different filters**: Creates different sheet

## 🎨 Automatic Formatting

✅ Blue header with white text  
✅ Frozen first row  
✅ Auto-resized columns  
✅ Professional appearance  

## 🔗 Looker Studio Connection

1. Export data (any filters)
2. Open Looker Studio
3. Create Data Source → Google Sheets
4. Select DICT_Results → Choose sheet
5. Build your dashboard!

**Tip**: Each sheet can power a different dashboard

## 🤖 Apps Script Integration

Access your data programmatically:

```javascript
const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
const sheet = ss.getSheetByName('Activity Data');
const data = sheet.getDataRange().getValues();
```

## ⚠️ Common Issues

### "Target spreadsheet not configured"
→ Set `GOOGLE_SHEETS_TARGET_ID` in `.env.local`

### "The caller does not have permission"
→ Share DICT_Results with service account as **Editor**

### "No data found"
→ Check your filters, ensure data exists

### Data not in Looker Studio
→ Click "Refresh Fields" in data source settings

## 💡 Pro Tips

1. **Consistent filters** = Same sheet updated
2. **Different filters** = New sheets created
3. **Delete unused sheets** manually in DICT_Results
4. **One sheet per dashboard** for best performance
5. **Use filters** to keep sheets focused and fast

## 📞 Need Help?

1. Check `DICT_RESULTS_SETUP.md` for detailed guide
2. Review error messages in browser console
3. Verify service account has Editor access
4. Confirm spreadsheet ID is correct

## 🎯 Quick Test

1. Click any "Export to Sheets" button
2. Should see: "Successfully exported X records..."
3. DICT_Results opens in new tab
4. See your data with blue header
5. ✅ Success!

---

**Remember**: One spreadsheet (DICT_Results), multiple sheets (by filter), infinite possibilities! 🚀
