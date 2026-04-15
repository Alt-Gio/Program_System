# 🚀 Looker Studio Dashboard - Quick Start Card

## ⚡ 5-Minute Dashboard Creation

### Your Spreadsheet ID (Copy This!)
```
1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM
```

---

## 📋 Step 1: Connect Data (30 seconds)

1. Go to: **https://lookerstudio.google.com**
2. Click **"Blank Report"** or **"+"**
3. Select **"Google Sheets"** connector
4. Search **"DICT_Results"** or paste Spreadsheet ID above
5. Select **"Looker_Summary"** worksheet ⚡ (NOT Activity Data)
6. Click **"Add"** then **"Add to Report"**

✅ **Done! Now build your dashboard...**

---

## 📊 Step 2: Build Dashboard (5 minutes)

### A. Add Filters First (1 min)
```
Insert → Drop-down list → Year
Insert → Drop-down list → Project  
Insert → Drop-down list → Province
```
Place these at the top of your report.

### B. Add 4 Scorecards (2 min)
```
1. Insert → Scorecard → Metric: Activity Count (SUM)
2. Insert → Scorecard → Metric: Total Participants (SUM)
3. Insert → Scorecard → Metric: Completion Rate (AVG, show as %)
4. Insert → Scorecard → Metric: Province (COUNT DISTINCT)
```
Arrange in a row below filters.

### C. Add Time Series Chart (1 min)
```
Insert → Time series chart
- Date: Month or Quarter
- Metric: Activity Count (SUM)
- Breakdown: Project
- Style: Smooth lines, data labels ON
```
Full width below scorecards.

### D. Add Two Charts Side by Side (2 min)

**Left (50% width):**
```
Insert → Geo chart
- Dimension: Province
- Metric: Activity Count (SUM)
- Region: Philippines
```

**Right (50% width):**
```
Insert → Bar chart
- Dimension: Project
- Metric: Activity Count (SUM)
- Sort: Descending
```

### E. Apply Theme (30 sec)
```
Theme and Layout → Choose a theme
Adjust spacing and alignment
Save and name your report
```

---

## ✅ Final Checklist

- [ ] Connected to Looker_Summary sheet
- [ ] 3 filters at top (Year, Project, Province)
- [ ] 4 scorecards in a row
- [ ] Time series chart (full width)
- [ ] Geo map (left) + Bar chart (right)
- [ ] Theme applied
- [ ] Report named and saved
- [ ] Tested all filters

---

## 💡 Pro Tips

### Speed Hacks
- ⚡ Add filters FIRST → charts auto-connect
- 🎨 Apply theme EARLY → saves reformatting
- ⌨️ Use Ctrl+C/V → duplicate charts quickly
- 📏 Enable grid → perfect alignment

### Common Mistakes
- ❌ Using "Activity Data" sheet (too slow)
- ❌ Adding charts before filters
- ❌ Forgetting to name the report
- ❌ Not testing filters

### Performance
- ✅ Always use "Looker_Summary" (fast)
- ✅ Limit date ranges (faster loading)
- ✅ Use filters to reduce data volume

---

## ⏱️ Time Breakdown

| Task | Time |
|------|------|
| Connect data source | 30 sec |
| Add filters | 1 min |
| Add scorecards | 2 min |
| Add charts | 2 min |
| Apply theme | 30 sec |
| **TOTAL** | **6 min** |

---

## 🎯 Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  [Year ▼]  [Project ▼]  [Province ▼]           │  ← Filters
├─────────────────────────────────────────────────┤
│  [Total]  [Participants]  [Rate]  [Provinces]  │  ← Scorecards
├─────────────────────────────────────────────────┤
│                                                 │
│         Time Series Chart (Full Width)          │  ← Trend
│                                                 │
├────────────────────────┬────────────────────────┤
│                        │                        │
│      Geo Map           │     Bar Chart          │  ← Analysis
│    (Province)          │     (Project)          │
│                        │                        │
└────────────────────────┴────────────────────────┘
```

---

## 📞 Need Help?

### In Your Spreadsheet
- Menu: **📊 Looker Studio → 📈 Create Looker Report**
- Menu: **📊 Looker Studio → 📋 Generate Template Guide**
- Menu: **📊 Looker Studio → 📖 Help**

### Documentation
- **WHY_URL_METHOD_FAILS.md** - Why manual method is better
- **LOOKER_STUDIO_QUICK_FIX.md** - Complete troubleshooting
- **Looker_Template_Guide** sheet - Detailed reference

---

## 🎉 You're Ready!

**Just follow the steps above and you'll have a professional dashboard in 6 minutes!**

**Start here:** https://lookerstudio.google.com

---

**Print this card or keep it open while building your dashboard!** 📋✨
