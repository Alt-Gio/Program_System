# Example Scenario — Import & Change Tracking Walkthrough

This walks through the full lifecycle: connect a Google Sheet to a program,
import data three different ways, and review the change history.

---

## Scenario

You are the **eGovPH focal person**. The programme team maintains activity
records in a Google Sheet. You want to:

1. Link that sheet to the eGovPH program.
2. Ingest a fresh batch of activities from it.
3. Also drop in a one-off CSV from a partner agency.
4. Review who changed what.

---

## Step 1 — Open the eGovPH project page

From the sidebar, click **Projects → eGovPH** (or any of the 10 programs).
The project page shows the usual dashboard: stats, province pins, activities.

Next to **Add Activity** in the header, you'll now see a new **⚙ gear icon**
button. Click it.

---

## Step 2 — Connect the Google Sheet

The **Project Settings** dialog opens. It has three sections:

- **Import data** — deep link into `/import-log?program=eGovPH`
- **View changes** — deep link into `/projects/egov/changes`
- **Google Sheet Connection** — status + form

Since no sheet is connected yet, the form shows:

1. **Google Sheets URL** — paste the full spreadsheet URL:
   `https://docs.google.com/spreadsheets/d/1AbC.../edit`
2. Click **Detect tabs** — the dropdown fills with the tabs in that sheet.
3. Pick the tab with the activity rows (e.g. `2026 Activities`).
4. Click **Connect sheet**.

The dialog now shows `✓ Connected · tab: 2026 Activities · last sync never`.
The toggle is **on** (auto-sync enabled), and **Sync now** runs an immediate
pull through `/api/sheets-sync` — rows land in the real Convex `activities`
table (the existing pipeline, not the staging one).

*(Behind the scenes: this writes to `sheetsConnections` via
`api.sheetsSync.saveConnection`, exactly like the /settings page does.)*

---

## Step 3 — Import some ad-hoc data

Close the dialog and click the quick link **Import data** (or just visit
`/import-log?program=eGovPH`).

The import page opens with **eGovPH** already selected in the program pill
bar. You have four import modes in the left column:

### 3a. Paste mode
Open the sheet in your browser, select the rows, **Ctrl+C**, and paste into
the big textarea. Papaparse auto-detects the tab delimiter.
- The **Column Mapper** fuzzy-matches headers ("No. of Participants" →
  `participants`, etc.). You can correct any unmapped field from the dropdown.
- The **Validation Table** shows each row with a badge:
  - ✓ Valid — required fields present, dates parse, numbers parse
  - ✕ Invalid — missing required / bad type (not selectable)
  - ⚡ Duplicate — MD5 fingerprint of `activityTitle + date + venue` collides
    with an existing record; shown side-by-side with the match
  - ⚠ Warning — value not in a `select` option list, etc.
- Tick the rows you want, hit **Import N Rows →**.

Result: a new `import_sessions` row, one `import_row_log` per row, a
fingerprint per accepted row, and an `activity_log` audit entry.

### 3b. CSV/XLSX upload
Drag a `.csv` or `.xlsx` into the drop zone, same validation & mapping flow.
Uses `papaparse` for CSV, `xlsx` (dynamically imported) for Excel.

### 3c. Manual entry
A form is generated from `PROGRAM_SCHEMAS["eGovPH"]` — fields are required-
starred, `select` becomes dropdown, `date` becomes a date picker, etc.
Add rows with **+ Add Another Row**, then **Validate & Preview**.

### 3d. Google Sheet pull
Clicks **Pull Latest Data** against `/api/sheets-tabs`. *(Currently the
endpoint returns tab names, not CSV. To make this mode end-to-end live,
add a small endpoint that returns the tab contents as CSV; the UI already
handles that gracefully and shows a clear error otherwise.)*

---

## Step 4 — Review the changes

Click **View changes** from the project settings dialog (or navigate to
`/projects/egov/changes`).

You'll see:

- **Connection summary** at the top (tab name, last sync time, row count).
- **Timeline** that *merges* both data sources, newest first:
  - 🟢 `Sheet sync` entries from `sheetsSyncLog` (live production pipeline)
  - 📥 `Import` / ✏️ `Manual Add` / 🎙️ `Voice` entries from `activity_log`
    (the staging + audit log)
- Grouped by **Today / Yesterday / explicit date**.
- Each entry expands to show its detail JSON.

If someone triggered the import from the voice system ("import data for
eGovPH"), the entry is flagged with a 🎙️ icon.

---

## Step 5 — Do it again via voice

Click the floating mic orb (bottom-right). Say:

> "Open eGovPH settings"

→ opens the eGovPH project page (voice intent: `go_to_project`, program
`eGovPH`).

> "Import data for eGovPH"

→ navigates to `/import-log?program=eGovPH`. You'll hear:
*"Opening the import manager for eGovPH."*

> "How many activities today?"

→ answers via Convex query + speech synthesis.

> "Open import log"

→ any time, to check the timeline.

---

## Files involved

### New
- `convex/import_log.ts` — staging + audit tables (`import_sessions`,
  `import_row_log`, `activity_log`, `import_fingerprints`) + queries/mutations
- `lib/import/{programSchemas,csvParser,xlsxParser,validator,
  duplicateDetector,validateAndDedup}.ts`
- `components/import-log/*` — selector, 4 import modes, column mapper,
  validation table, timeline
- `components/project-settings/{ProjectSheetConnection,
  ProjectSettingsDialog}.tsx`
- `app/(main)/import-log/page.tsx` — the import manager
- `app/(main)/projects/[code]/changes/page.tsx` — per-project changes view
- `lib/voice/voiceEvents.ts` — typed voice→UI event bus

### Touched
- `convex/schema.ts` — `...importLogTables` spread
- `components/layout/Sidebar.tsx` — "Import & Log" nav item
- `app/(main)/projects/[code]/page.tsx` — gear icon + settings dialog wiring
- `app/(main)/activities/page.tsx` — voice event listeners

### Reused (unchanged)
- `convex/sheetsSync.ts` — `saveConnection`, `getConnection`, `toggleSync`,
  `deleteConnection`, `getSyncLog`
- `/api/sheets-sync`, `/api/sheets-tabs` — existing endpoints
- `app/(main)/settings/page.tsx` — the global settings page is untouched

---

## Where the data actually goes

| Action                            | Writes to                                                           |
|-----------------------------------|---------------------------------------------------------------------|
| Connect a sheet (gear icon)       | `sheetsConnections`                                                 |
| Sync now (gear icon)              | `activities` + `sheetsSyncLog` + patches `sheetsConnections`        |
| Import via Paste / CSV / Manual   | `import_sessions` + `import_row_log` + `import_fingerprints` + `activity_log` |
| Voice "import data for X"         | Navigates to `/import-log?program=X`; human still confirms rows     |

The staging tables give you a safe preview + audit trail. The **Sync now**
button in the gear dialog is how rows actually reach the live `activities`
table — it uses the existing sync pipeline that already handles the
`projectId` / `provinceId` / nested-participants mapping.

---

## Notes / follow-ups

- The `/import-log` confirm-import flow currently logs and fingerprints the
  rows but does **not** insert into the production `activities` table. That
  mapping (flat CSV → nested `participants.{nga,lgu,suc,others}.{male,
  female}` + `projectId` + `provinceId` lookup) is the next piece of work;
  it was intentionally left separate so a bad mapping doesn't quietly
  corrupt production data.
- To make **Google Sheet pull** mode inside `/import-log` functional,
  expose a CSV endpoint, e.g. `GET /api/sheets/preview?program=eGovPH`,
  reading the tab via the existing Google auth code in
  `/api/sheets-tabs/route.ts`.
