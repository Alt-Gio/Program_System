# Creating Your First Looker Studio Dashboard

## Prerequisites

✅ DICT_Results spreadsheet configured (ID: 1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM)  
✅ Apps Script installed and run  
✅ Data exported at least once  
✅ Summary sheets created (Looker_Summary, Looker_Metrics)  

## Dashboard Templates

### Template 1: Executive Summary Dashboard

**Purpose**: High-level overview for management

**Components**:
1. **KPI Scorecards** (Top row)
   - Total Activities
   - Total Participants
   - Completion Rate
   - Provinces Covered

2. **Time Series Chart** (Middle)
   - Activities over time by project
   - Line chart showing trends

3. **Geographic Map** (Bottom left)
   - Activities by province
   - Color-coded by volume

4. **Project Breakdown** (Bottom right)
   - Bar chart of activities by project
   - Sorted by count

### Template 2: Project Performance Dashboard

**Purpose**: Detailed project analysis

**Components**:
1. **Project Filter** (Top)
   - Dropdown to select project

2. **Monthly Trend** (Upper middle)
   - Line chart of activities per month
   - Comparison with previous year

3. **Status Distribution** (Middle left)
   - Pie chart showing status breakdown
   - Draft, Submitted, Validated, Reported

4. **Top Provinces** (Middle right)
   - Table of provinces by activity count
   - Includes participant numbers

5. **Gender Distribution** (Bottom)
   - Stacked bar chart
   - Male vs Female participants

### Template 3: Geographic Analysis Dashboard

**Purpose**: Regional performance tracking

**Components**:
1. **Province Map** (Top half)
   - Geo chart of Philippines
   - Color intensity by activity count

2. **Province Table** (Bottom left)
   - Detailed metrics per province
   - Activities, Participants, Completion Rate

3. **LGU Coverage** (Bottom right)
   - Bar chart of top LGUs
   - Participant counts

## Step-by-Step: Creating Executive Summary Dashboard

### Step 1: Create New Report

1. Go to https://lookerstudio.google.com
2. Click **Create** → **Report**
3. Click **Add data to report**

### Step 2: Connect Data Source

1. Select **Google Sheets**
2. Find **DICT_Results** spreadsheet
3. Select **Looker_Summary** sheet
4. Click **Add**
5. Click **Add to Report**

### Step 3: Add KPI Scorecards

**Total Activities:**
1. Click **Add a chart** → **Scorecard**
2. Drag to top-left corner
3. In **Data** panel:
   - Metric: `Activity Count` (set to SUM)
4. In **Style** panel:
   - Compact numbers: ON
   - Show comparison: OFF

**Total Participants:**
1. Add another Scorecard next to it
2. Metric: `Total Participants` (SUM)
3. Style: Same as above

**Completion Rate:**
1. Add another Scorecard
2. Metric: `Completion Rate` (AVERAGE)
3. Style: Add % symbol

**Provinces Covered:**
1. Add another Scorecard
2. Metric: `Province` (COUNT DISTINCT)
3. Style: Same as first

### Step 4: Add Time Series Chart

1. Click **Add a chart** → **Time series chart**
2. Drag below scorecards (full width)
3. In **Data** panel:
   - Date dimension: `Month` or `Quarter`
   - Metric: `Activity Count` (SUM)
   - Breakdown dimension: `Project`
4. In **Style** panel:
   - Show data labels: ON
   - Line smoothness: Smooth

### Step 5: Add Geographic Map

1. Click **Add a chart** → **Geo chart**
2. Drag to bottom-left
3. In **Data** panel:
   - Geo dimension: `Province`
   - Metric: `Activity Count` (SUM)
4. In **Style** panel:
   - Region: Philippines
   - Color by: Metric value

### Step 6: Add Project Breakdown

1. Click **Add a chart** → **Bar chart**
2. Drag to bottom-right
3. In **Data** panel:
   - Dimension: `Project`
   - Metric: `Activity Count` (SUM)
   - Sort: By metric, descending
4. In **Style** panel:
   - Show data labels: ON
   - Bar color: By dimension

### Step 7: Add Filters

1. Click **Add a control** → **Drop-down list**
2. Drag to top of page
3. Control field: `Year`
4. Label: "Select Year"

Add another filter:
1. Control field: `Status`
2. Label: "Select Status"

### Step 8: Style Your Dashboard

**Theme:**
1. Click **Theme and layout**
2. Choose a theme (e.g., "Simple Light")

**Title:**
1. Click **Add text**
2. Type: "DICT Region V - Activity Dashboard"
3. Font size: 24
4. Bold: ON

**Date Range:**
1. Click **Add a control** → **Date range control**
2. Place at top-right

### Step 9: Save and Share

1. Click **File** → **Rename**
2. Name: "DICT R5 Executive Dashboard"
3. Click **Share**
4. Add team members
5. Set permissions (Viewer or Editor)

## Chart Configuration Tips

### Scorecards
```
Best for: Single metrics, KPIs
Data: Use SUM for counts, AVERAGE for rates
Style: Enable compact numbers, use colors for thresholds
```

### Time Series
```
Best for: Trends over time
Data: Date dimension + metric + optional breakdown
Style: Smooth lines, show data labels, legend on right
```

### Bar Charts
```
Best for: Comparing categories
Data: Dimension + metric, sort by metric
Style: Horizontal bars for long labels, show values
```

### Pie/Donut Charts
```
Best for: Part-to-whole relationships
Data: Dimension + metric, limit to 5-7 slices
Style: Show percentages, use distinct colors
```

### Tables
```
Best for: Detailed data, multiple metrics
Data: Multiple dimensions and metrics
Style: Enable sorting, pagination, conditional formatting
```

### Geo Charts
```
Best for: Geographic distribution
Data: Location dimension + metric
Style: Set correct region, color by metric
```

## Advanced Features

### Calculated Fields

Create custom metrics:

**Completion Percentage:**
```
(COUNT(CASE WHEN Status IN ('Validated', 'Reported') THEN 1 END) / COUNT(*)) * 100
```

**Average Participants per Activity:**
```
SUM(Total Participants) / COUNT(Activity Count)
```

**Gender Ratio:**
```
SUM(Male Participants) / SUM(Female Participants)
```

### Blended Data

Combine multiple data sources:

1. Click **Resource** → **Manage blended data**
2. Click **Add a blend**
3. Select data sources to combine
4. Choose join keys
5. Select metrics from each source

### Date Comparisons

Show period-over-period changes:

1. In scorecard, enable **Show comparison**
2. Set comparison type:
   - Previous period
   - Previous year
   - Custom date range

### Conditional Formatting

Highlight important values:

1. Select a table or scorecard
2. In **Style** panel, find **Conditional formatting**
3. Add rule:
   - If `Completion Rate` < 50% → Red
   - If `Completion Rate` >= 50% and < 80% → Yellow
   - If `Completion Rate` >= 80% → Green

## Dashboard Best Practices

### 1. Layout
- **Top**: Filters and KPIs
- **Middle**: Main visualizations
- **Bottom**: Detailed tables

### 2. Colors
- Use consistent colors for projects
- Limit to 5-7 colors per chart
- Use color to highlight, not decorate

### 3. Performance
- Use summary sheets (Looker_Summary) not raw data
- Limit date ranges with filters
- Avoid too many charts on one page

### 4. Interactivity
- Add filters for year, project, province
- Enable drill-down where appropriate
- Use chart interactions (click to filter)

### 5. Mobile
- Test on mobile devices
- Use responsive layouts
- Simplify for small screens

## Sample Dashboard Layouts

### Layout 1: Grid (Balanced)
```
┌─────────────────────────────────────────┐
│  [Filter: Year]  [Filter: Project]      │
├──────────┬──────────┬──────────┬────────┤
│ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4  │
├──────────┴──────────┴──────────┴────────┤
│         Time Series Chart               │
├─────────────────────┬───────────────────┤
│   Geo Map           │  Bar Chart        │
└─────────────────────┴───────────────────┘
```

### Layout 2: Focus (Emphasis on main chart)
```
┌─────────────────────────────────────────┐
│  [Filters]                              │
├──────────┬──────────┬──────────┬────────┤
│ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4  │
├──────────┴──────────┴──────────┴────────┤
│                                         │
│         Large Time Series Chart         │
│                                         │
├──────────┬──────────┬──────────┬────────┤
│ Chart 1  │ Chart 2  │ Chart 3  │ Chart 4│
└──────────┴──────────┴──────────┴────────┘
```

### Layout 3: Detailed (Tables and charts)
```
┌─────────────────────────────────────────┐
│  [Filters]                              │
├──────────┬──────────┬──────────┬────────┤
│ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4  │
├──────────┴──────────┴──────────┴────────┤
│         Time Series Chart               │
├─────────────────────┬───────────────────┤
│   Detailed Table    │  Summary Chart    │
│   (Sortable)        │  (Interactive)    │
└─────────────────────┴───────────────────┘
```

## Refreshing Data

### Automatic Refresh
Looker Studio automatically refreshes data every 12 hours.

### Manual Refresh
1. Click **Refresh data** button (top-right)
2. Or press Ctrl+R (Cmd+R on Mac)

### Force Refresh
1. Click **Resource** → **Manage added data sources**
2. Find your data source
3. Click **Refresh fields**

## Sharing Your Dashboard

### View-Only Access
1. Click **Share**
2. Add email addresses
3. Set role to **Viewer**
4. Click **Send**

### Edit Access
1. Click **Share**
2. Add email addresses
3. Set role to **Editor**
4. Click **Send**

### Public Link
1. Click **Share**
2. Click **Get shareable link**
3. Set to **Anyone with the link can view**
4. Copy and share link

### Embed in Website
1. Click **File** → **Embed report**
2. Copy embed code
3. Paste in your website HTML

## Troubleshooting

### Data not showing
- Check that data exists in DICT_Results
- Verify correct sheet selected (Looker_Summary)
- Refresh data source

### Charts are slow
- Use summary sheets instead of raw data
- Add date range filters
- Reduce number of charts per page

### Wrong data displayed
- Check field types (date, number, text)
- Verify aggregation methods (SUM, AVG, COUNT)
- Refresh fields in data source

### Filters not working
- Ensure filter field exists in data
- Check filter is applied to all charts
- Verify data source connection

## Next Steps

1. ✅ Create your first dashboard using Template 1
2. ✅ Share with your team
3. ✅ Set up automatic data exports
4. ✅ Create additional dashboards for different audiences
5. ✅ Schedule regular reviews and updates

---

**Ready to build?** Start with the Executive Summary template and customize from there! 🎨📊
