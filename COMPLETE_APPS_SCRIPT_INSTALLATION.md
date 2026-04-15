# Complete Apps Script Installation Guide

## 🎯 What You're Installing

**Two powerful scripts in one**:

1. **Looker Studio Helper** - Prepares data for dashboards
   - Creates summary sheets
   - Adds formatting and validation
   - Sets up auto-refresh

2. **Auto Report Generator** - Creates dashboards with one click
   - Pre-configured layouts
   - Professional styling
   - Template guides

## 📦 Installation (5 Minutes)

### Step 1: Open Apps Script Editor

1. Open your DICT_Results spreadsheet:
   ```
   https://docs.google.com/spreadsheets/d/1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM/edit
   ```

2. Click **Extensions** in the menu
3. Click **Apps Script**
4. New tab opens with the editor

### Step 2: Clear Existing Code

1. If there's any code, select all (Ctrl+A or Cmd+A)
2. Delete it

### Step 3: Add Script 1 - Looker Helper

1. Open file: `APPS_SCRIPT_FOR_LOOKER.gs`
2. Copy ALL the code (Ctrl+A, then Ctrl+C)
3. Paste into Apps Script editor (Ctrl+V)

### Step 4: Add Script 2 - Auto Report Generator

1. **Don't delete the first script!**
2. Scroll to the bottom of the editor
3. Add a few blank lines
4. Open file: `APPS_SCRIPT_LOOKER_AUTO_REPORT.gs`
5. Copy ALL the code
6. Paste it **after** the first script

**Your editor should now have both scripts, one after the other.**

### Step 5: Save Everything

1. Click the **Save** icon (💾) or press Ctrl+S
2. Name the project: "DICT Looker Studio Complete"
3. Click **OK**

### Step 6: Run Initial Setup

1. In the function dropdown (near top), select: **setupLookerStudio**
2. Click the **Run** button (▶️)

**First time authorization**:
1. Dialog appears: "Authorization required"
2. Click **Review permissions**
3. Choose your Google account
4. Click **Advanced** (at bottom)
5. Click **Go to DICT Looker Studio Complete (unsafe)**
   - This is safe - it's your own script
6. Click **Allow**

3. Wait 10-30 seconds for setup to complete
4. Success message: "Setup Complete!"
5. Click **OK**

### Step 7: Verify Installation

Go back to your spreadsheet and check:

**New Sheets Created**:
- [ ] Looker_Summary
- [ ] Looker_Metrics
- [ ] Looker_Pivots

**New Menu Available**:
- [ ] **📊 Looker Studio** menu appears

**Menu Options**:
- [ ] 🚀 Setup for Looker Studio
- [ ] 🔄 Refresh Summary Sheets
- [ ] ⚙️ Enable Auto-Refresh
- [ ] 📈 Create Looker Report (NEW!)
- [ ] 📋 Generate Template Guide (NEW!)
- [ ] ⚙️ Export Report Config (NEW!)
- [ ] 📖 Help

### Step 8: Enable Auto-Refresh

1. Click **📊 Looker Studio** menu
2. Click **⚙️ Enable Auto-Refresh**
3. Authorize if prompted
4. Success message appears
5. Click **OK**

## ✅ Installation Complete!

You now have:
- ✅ Data preparation scripts
- ✅ Auto-refresh enabled
- ✅ One-click report generation
- ✅ Template guides
- ✅ Professional formatting

## 🚀 Quick Test

### Test 1: Export Data

1. Go to your app
2. Click **"Export to Sheets"**
3. Verify data appears in DICT_Results
4. Check that summary sheets update

### Test 2: Generate Report

1. In DICT_Results, click **📊 Looker Studio**
2. Click **📈 Create Looker Report**
3. Click **YES**
4. Dialog appears with instructions
5. Click **🚀 Open Looker Studio**

### Test 3: Create Dashboard

1. Looker Studio opens
2. Data source is pre-selected
3. Click **"Add to Report"**
4. Follow the template guide
5. Add charts as instructed

## 📚 What Each Script Does

### Script 1: Looker Studio Helper

**Purpose**: Prepares your data for optimal Looker Studio performance

**Features**:
- Creates **Looker_Summary** sheet
  - Aggregated data by project, province, time
  - Faster dashboard performance
  
- Creates **Looker_Metrics** sheet
  - KPIs and key metrics
  - Perfect for scorecards
  
- Creates **Looker_Pivots** sheet
  - Pre-aggregated data
  - Ready for visualizations

- Adds **formatting**
  - Blue headers
  - Frozen rows
  - Auto-sized columns

- Sets up **auto-refresh**
  - Summaries update when data changes
  - No manual refresh needed

### Script 2: Auto Report Generator

**Purpose**: Creates complete Looker Studio dashboards with one click

**Features**:
- **One-click generation**
  - Pre-configured layout
  - Professional styling
  - Ready to use

- **Template guide**
  - Detailed instructions
  - Chart configurations
  - Best practices

- **Report configuration**
  - JSON export
  - Shareable templates
  - Easy replication

## 🎨 Using the Scripts

### Daily Use

**Morning Routine**:
1. Export yesterday's data
2. Summary sheets auto-update
3. Looker Studio dashboard refreshes
4. Review KPIs

### Creating New Dashboards

**Quick Method** (2 minutes):
1. Click **📈 Create Looker Report**
2. Follow automated setup
3. Dashboard ready!

**Custom Method** (10 minutes):
1. Generate template guide first
2. Open Looker Studio manually
3. Build custom dashboard
4. Use guide as reference

### Sharing with Team

**Share Spreadsheet**:
1. Click **Share** in DICT_Results
2. Add team members
3. Set permissions (Editor/Viewer)

**Share Dashboard**:
1. Open dashboard in Looker Studio
2. Click **Share**
3. Add team members
4. Set permissions

## 🔧 Customization

### Change Report Title

Edit in the script:
```javascript
const LOOKER_CONFIG = {
  REPORT_TITLE: 'Your Custom Title',
  // ...
};
```

### Change Colors

Edit theme:
```javascript
THEME: {
  primaryColor: '#1a73e8',
  secondaryColor: '#34a853',
  // ...
}
```

### Add More Metrics

Edit in `createMetricsSheet()` function:
```javascript
const metrics = [
  // Add your custom metrics here
  ['Your Metric', '=YOUR_FORMULA', 'Description'],
];
```

## 📊 Menu Reference

### 📊 Looker Studio Menu

**Setup & Maintenance**:
- **🚀 Setup for Looker Studio** - Initial setup (run once)
- **🔄 Refresh Summary Sheets** - Manual refresh
- **⚙️ Enable Auto-Refresh** - Enable automatic updates

**Report Generation**:
- **📈 Create Looker Report** - Generate dashboard (main feature!)
- **📋 Generate Template Guide** - Create reference sheet
- **⚙️ Export Report Config** - Save configuration

**Help**:
- **📖 Help** - Show help dialog

## 🐛 Troubleshooting

### Scripts don't appear in menu

**Solution**:
1. Refresh spreadsheet (F5)
2. Wait a few seconds
3. Check **Extensions** menu
4. If still missing, run `onOpen()` manually in Apps Script

### Authorization errors

**Solution**:
1. Go to Apps Script editor
2. Run **setupLookerStudio** again
3. Complete authorization process
4. Make sure you click "Allow"

### Summary sheets not created

**Solution**:
1. Export data first (need data to summarize)
2. Run **🔄 Refresh Summary Sheets** from menu
3. Check for errors in Apps Script logs

### Auto-refresh not working

**Solution**:
1. Click **⚙️ Enable Auto-Refresh** again
2. Authorize if prompted
3. Check that triggers are created (Apps Script → Triggers)

### Report generation fails

**Solution**:
1. Make sure summary sheets exist
2. Export data first
3. Check browser popup blocker
4. Try opening Looker Studio manually

## 📈 Performance Tips

### For Large Datasets

1. **Use summary sheets** in Looker Studio
   - Connect to Looker_Summary, not Activity Data
   - Much faster performance

2. **Add date filters**
   - Limit data range
   - Faster loading

3. **Limit charts per page**
   - Max 8-10 charts per dashboard
   - Create multiple pages if needed

### For Multiple Users

1. **Share spreadsheet as Viewer**
   - Only admins need Editor access
   - Prevents accidental changes

2. **Create separate dashboards**
   - Executive dashboard (high-level)
   - Analyst dashboard (detailed)
   - Regional dashboards (by province)

3. **Schedule exports**
   - Daily at off-peak hours
   - Reduces load during work hours

## 🎯 Best Practices

### 1. Regular Maintenance

**Weekly**:
- Review dashboard performance
- Check for errors
- Update filters if needed

**Monthly**:
- Archive old data
- Review and optimize queries
- Update documentation

### 2. Data Quality

**Before Export**:
- Verify data accuracy
- Check for duplicates
- Validate required fields

**After Export**:
- Review summary sheets
- Check metrics make sense
- Verify calculations

### 3. Dashboard Design

**Keep it Simple**:
- Focus on key metrics
- Avoid clutter
- Use consistent colors

**Make it Interactive**:
- Add filters
- Enable drill-down
- Use cross-filtering

**Test on Mobile**:
- Check mobile layout
- Simplify if needed
- Test touch interactions

## 📞 Support

### Quick Fixes

| Issue | Solution |
|-------|----------|
| Menu missing | Refresh page (F5) |
| Script error | Check authorization |
| No data | Export data first |
| Slow dashboard | Use summary sheets |
| Can't share | Check permissions |

### Documentation

- **Installation**: This file
- **Auto Report**: AUTO_REPORT_GENERATOR_GUIDE.md
- **Looker Guide**: LOOKER_STUDIO_DASHBOARD_GUIDE.md
- **Quick Reference**: EXPORT_QUICK_REFERENCE.md

### In-App Help

Click **📊 Looker Studio** → **📖 Help** for quick reference

## ✅ Success Checklist

Installation:
- [ ] Both scripts added to Apps Script
- [ ] Scripts saved successfully
- [ ] Initial setup run (setupLookerStudio)
- [ ] Authorization completed
- [ ] Summary sheets created
- [ ] Menu appears in spreadsheet
- [ ] Auto-refresh enabled

Testing:
- [ ] Data exported successfully
- [ ] Summary sheets update
- [ ] Report generation works
- [ ] Looker Studio opens
- [ ] Dashboard created
- [ ] Filters work correctly

Sharing:
- [ ] Spreadsheet shared with team
- [ ] Dashboard shared with stakeholders
- [ ] Documentation provided
- [ ] Training completed (if needed)

## 🎉 You're All Set!

Your complete Looker Studio system is now installed and ready to use!

**Next Steps**:
1. Export some data
2. Click **📈 Create Looker Report**
3. Build your first dashboard
4. Share with your team

**Time to first dashboard**: 2 minutes! 🚀

---

**Need help?** Check the documentation or click **📖 Help** in the menu.
