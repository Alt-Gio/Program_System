# Export to DICT_Results - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard Page  │  Map Page  │  Project Pages (EGOV, WIFI...)  │
│                                                                  │
│  [Export to Sheets Button] ──────────────────────────┐          │
└──────────────────────────────────────────────────────┼──────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Route                            │
│                /api/export-to-sheets                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Receive filters (year, project, month)                      │
│  2. Fetch data from Convex                                      │
│  3. Determine sheet name from filters                           │
│  4. Check if sheet exists in DICT_Results                       │
│  5. Create/clear sheet                                          │
│  6. Write data with formatting                                  │
│  7. Return sheet URL                                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ├──────────────────┐
                   ▼                  ▼
         ┌──────────────────┐  ┌──────────────────┐
         │  Convex Backend  │  │  Google Sheets   │
         │                  │  │      API         │
         ├──────────────────┤  ├──────────────────┤
         │ • Activities DB  │  │ • Create sheets  │
         │ • Projects DB    │  │ • Write data     │
         │ • Provinces DB   │  │ • Format cells   │
         │ • Export query   │  │ • Freeze rows    │
         └──────────────────┘  └──────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  DICT_Results    │
                              │   Spreadsheet    │
                              ├──────────────────┤
                              │ • Activity Data  │
                              │ • EGOV_2025      │
                              │ • WIFI_2025      │
                              │ • FY_2025        │
                              │ • ...            │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │Looker Studio │  │ Apps Script  │  │Manual Review │
            │  Dashboards  │  │  Automation  │  │   & Export   │
            └──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow

### Export Process

```
User Action
    │
    ├─ Selects filters (year, project, month)
    │
    └─ Clicks "Export to Sheets"
         │
         ▼
    Frontend Handler
         │
         ├─ Builds query parameters
         │
         └─ Calls POST /api/export-to-sheets
              │
              ▼
         API Route
              │
              ├─ 1. Validate environment config
              │      └─ Check GOOGLE_SHEETS_TARGET_ID exists
              │
              ├─ 2. Resolve project ID (if needed)
              │      └─ Query Convex: api.projects.getByCode
              │
              ├─ 3. Fetch activity data
              │      └─ Query Convex: api.activities.lookerExport
              │
              ├─ 4. Determine sheet name
              │      ├─ No filters → "Activity Data"
              │      ├─ Project + Year → "EGOV_2025"
              │      ├─ Project only → "EGOV"
              │      └─ Year only → "FY_2025"
              │
              ├─ 5. Check sheet existence
              │      └─ Google Sheets API: spreadsheets.get
              │
              ├─ 6. Create or clear sheet
              │      ├─ New → spreadsheets.batchUpdate (addSheet)
              │      └─ Exists → values.clear
              │
              ├─ 7. Write data
              │      └─ values.update (all rows)
              │
              ├─ 8. Apply formatting
              │      └─ batchUpdate:
              │           ├─ Blue header background
              │           ├─ White header text
              │           ├─ Bold header font
              │           ├─ Freeze first row
              │           └─ Auto-resize columns
              │
              └─ 9. Return response
                   ├─ Success: { sheetUrl, sheetName, rowCount, ... }
                   └─ Error: { error, hint, details }
                        │
                        ▼
                   Frontend Handler
                        │
                        ├─ Success:
                        │    ├─ Open sheet in new tab
                        │    └─ Show success alert with details
                        │
                        └─ Error:
                             └─ Show error alert with hints
```

## Component Architecture

### Frontend Components

```
Dashboard Page (app/(main)/dashboard/page.tsx)
├─ State: isExporting
├─ Handler: handleExportToSheets()
│   ├─ Builds params from filters
│   ├─ Calls API
│   ├─ Handles response
│   └─ Shows alerts
└─ UI: "Export to Sheets" button

Map Page (app/(main)/map/page.tsx)
├─ State: isExporting
├─ Handler: handleExportToSheets()
│   ├─ Builds params from filterProject
│   ├─ Calls API
│   ├─ Handles response
│   └─ Shows alerts
└─ UI: Compact "Sheets" button

Project Page (app/(main)/projects/[code]/page.tsx)
├─ State: isExporting
├─ Handler: handleExportToSheets()
│   ├─ Builds params from projectCode
│   ├─ Calls API
│   ├─ Handles response
│   └─ Shows alerts
└─ UI: "Export to Sheets" button
```

### Backend API

```
API Route (app/api/export-to-sheets/route.ts)
├─ POST handler
│   ├─ Parse query parameters
│   ├─ Validate configuration
│   ├─ Initialize Google Auth
│   ├─ Fetch data from Convex
│   ├─ Manage Google Sheets
│   └─ Return response
│
├─ Dependencies
│   ├─ ConvexHttpClient
│   ├─ Google Sheets API
│   └─ Google Auth
│
└─ Error Handling
    ├─ Configuration errors
    ├─ Permission errors
    ├─ Data errors
    └─ API errors
```

## Authentication Flow

```
Service Account Authentication
    │
    ├─ Environment Variables
    │   ├─ GOOGLE_SERVICE_ACCOUNT_EMAIL
    │   └─ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    │
    ├─ Google Auth Library
    │   └─ Creates JWT token
    │
    ├─ Google Sheets API
    │   └─ Validates token
    │
    └─ Access Granted
        └─ Can read/write DICT_Results
```

## Sheet Naming Logic

```
Filter Combination → Sheet Name

┌─────────────────────────────────────────────┐
│ Input Filters                               │
├─────────────────────────────────────────────┤
│ year: undefined, project: undefined         │ → "Activity Data"
│ year: 2025, project: "EGOV"                 │ → "EGOV_2025"
│ year: 2025, project: "WIFI"                 │ → "WIFI_2025"
│ year: undefined, project: "EGOV"            │ → "EGOV"
│ year: 2025, project: undefined              │ → "FY_2025"
└─────────────────────────────────────────────┘
```

## Data Structure

### Request

```json
{
  "method": "POST",
  "url": "/api/export-to-sheets",
  "params": {
    "year": "2025",
    "project": "EGOV",
    "month": "3"
  }
}
```

### Response (Success)

```json
{
  "success": true,
  "sheetUrl": "https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_ID",
  "sheetId": "SPREADSHEET_ID",
  "sheetName": "EGOV_2025",
  "rowCount": 150,
  "timestamp": "2025-04-14T15:30:00.000Z",
  "filters": "Year: 2025, Project: EGOV, Month: 3",
  "message": "Successfully exported 150 records to DICT_Results spreadsheet!"
}
```

### Response (Error)

```json
{
  "error": "Target spreadsheet not configured",
  "hint": "Please set GOOGLE_SHEETS_TARGET_ID in .env.local",
  "details": "Get the ID from your Google Sheets URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit"
}
```

## Integration Points

### Looker Studio

```
DICT_Results Spreadsheet
    │
    ├─ Sheet: "EGOV_2025"
    │   └─ Connected to Dashboard 1
    │
    ├─ Sheet: "WIFI_2025"
    │   └─ Connected to Dashboard 2
    │
    └─ Sheet: "Activity Data"
        └─ Connected to Dashboard 3

Update Flow:
1. User exports data (same filters)
2. Sheet updates in DICT_Results
3. Looker Studio auto-refreshes
4. Dashboards show new data
```

### Apps Script

```
Trigger (Time-based)
    │
    ├─ Daily at 6 AM
    │   └─ Call export API
    │       └─ Update "Activity Data" sheet
    │
    ├─ Weekly on Monday
    │   └─ Read sheet data
    │       └─ Send email report
    │
    └─ On sheet edit
        └─ Validate data
            └─ Log errors
```

## Security Model

```
Access Control
    │
    ├─ Service Account
    │   ├─ Email: dict-monitoring@...
    │   ├─ Private Key: Stored in .env.local
    │   └─ Permissions: Editor on DICT_Results
    │
    ├─ API Route
    │   ├─ Server-side only
    │   ├─ No client exposure
    │   └─ Environment variables
    │
    └─ DICT_Results Spreadsheet
        ├─ Shared with service account
        ├─ Can be shared with users
        └─ Looker Studio can access
```

## Performance Considerations

```
Optimization Points
    │
    ├─ Data Fetching
    │   ├─ Convex query with filters
    │   └─ Only fetch needed data
    │
    ├─ Sheet Operations
    │   ├─ Batch updates (not row-by-row)
    │   ├─ Single API call for formatting
    │   └─ Reuse existing sheets
    │
    └─ Response Time
        ├─ Small datasets: < 2 seconds
        ├─ Medium datasets: 2-5 seconds
        └─ Large datasets: 5-10 seconds
```

## Error Handling Strategy

```
Error Types
    │
    ├─ Configuration Errors
    │   ├─ Missing GOOGLE_SHEETS_TARGET_ID
    │   └─ Invalid spreadsheet ID
    │   → Return 500 with setup instructions
    │
    ├─ Permission Errors
    │   ├─ Service account not shared
    │   └─ Wrong permission level
    │   → Return 500 with sharing instructions
    │
    ├─ Data Errors
    │   ├─ No data found
    │   └─ Invalid filters
    │   → Return 404 with filter suggestions
    │
    └─ API Errors
        ├─ Google API failures
        └─ Network issues
        → Return 500 with retry suggestion
```

## Deployment Considerations

```
Environment Setup
    │
    ├─ Development
    │   ├─ .env.local
    │   ├─ Local Convex instance
    │   └─ Test spreadsheet
    │
    ├─ Staging
    │   ├─ Environment variables
    │   ├─ Staging Convex
    │   └─ Staging spreadsheet
    │
    └─ Production
        ├─ Secure environment variables
        ├─ Production Convex
        └─ DICT_Results (production)
```

## Monitoring & Logging

```
Logging Points
    │
    ├─ API Route
    │   ├─ Request received
    │   ├─ Data fetched
    │   ├─ Sheet operations
    │   └─ Response sent
    │
    ├─ Error Logging
    │   ├─ Console.error for failures
    │   └─ Detailed error messages
    │
    └─ Success Metrics
        ├─ Export count
        ├─ Row count
        └─ Response time
```

---

This architecture provides a robust, scalable solution for exporting data to Google Sheets with proper error handling, security, and integration capabilities.
