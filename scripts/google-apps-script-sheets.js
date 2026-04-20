// ============================================================
// Google Apps Script — DICT Dual Database Integration
// Deploy this script to EACH of the 3 Google Sheets:
//   1. DICT_Attendance_Log
//   2. DICT_DTC_Logbook
//   3. DICT_Sync_Status
//
// HOW TO INSTALL:
//   1. Open the Google Sheet
//   2. Extensions → Apps Script
//   3. Paste this entire script
//   4. Replace the CONFIG values below with your actual values
//   5. Save & deploy
//   6. Set up triggers via Edit → Current project's triggers:
//      - onEdit: From spreadsheet, On edit
//      - autoFormat: Time-driven, Every 1 hour
//
// WHAT IT DOES:
//   - Auto-formats new rows with headers, styling, and data validation
//   - Sends webhook to Convex when a Sheet cell is manually edited
//     (bidirectional: Sheets → Convex via webhook)
//   - Auto-freeze header rows
//   - Color-coded status columns
//   - Date/time stamps for new entries
//   - Dashboard summary formulas (for Sync Status sheet)
// ============================================================

// ── CONFIGURATION ──────────────────────────────────────────────
const CONFIG = {
  // Convex HTTP endpoint for webhooks (Sheets → Convex direction)
  // For local dev:  http://127.0.0.1:3210/api/sheets-sync
  // For production: https://your-deployment.convex.site/api/sheets-sync
  CONVEX_WEBHOOK_URL: "http://127.0.0.1:3210/api/sheets-sync",
  WEBHOOK_SECRET: "your-webhook-secret-here",

  // Which sheet is this? Set ONE of these to true per deployment
  IS_ATTENDANCE_LOG: false,
  IS_DTC_LOGBOOK: false,
  IS_SYNC_STATUS: false,
};

// ============================================================
// 1. AUTO-FORMAT: Set up headers and styling
// ============================================================

function setupAttendanceLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create or get "Attendance" tab
  let att = ss.getSheetByName("Attendance");
  if (!att) att = ss.insertSheet("Attendance");

  const headers = [
    "Date", "Intern Name", "School", "Department",
    "Time In", "Time Out", "Hours", "Method", "Confidence", "Status",
  ];
  att.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(att, headers.length);
  att.setFrozenRows(1);

  // Create or get "AuditTrail" tab
  let audit = ss.getSheetByName("AuditTrail");
  if (!audit) audit = ss.insertSheet("AuditTrail");

  const auditHeaders = [
    "Timestamp", "Type", "User", "Method", "Confidence", "Details",
  ];
  audit.getRange(1, 1, 1, auditHeaders.length).setValues([auditHeaders]);
  formatHeaderRow(audit, auditHeaders.length);
  audit.setFrozenRows(1);

  // Data validation for Method column
  const methodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["QR", "FACE_CV", "MANUAL"], true)
    .setAllowInvalid(false)
    .build();
  att.getRange("H2:H1000").setDataValidation(methodRule);

  // Data validation for Status column
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"], true)
    .setAllowInvalid(false)
    .build();
  att.getRange("J2:J1000").setDataValidation(statusRule);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ Attendance Log sheet configured!");
}

function setupDTCLogbookSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName("Logbook");
  if (!sheet) sheet = ss.insertSheet("Logbook");

  const headers = [
    "Date", "Full Name", "Agency", "Purpose", "Equipment Used",
    "PC", "Service Type", "Time In", "Time Out",
    "Planned Hours", "Rating", "Remarks", "Contact Email", "Contact Phone",
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, headers.length);
  sheet.setFrozenRows(1);

  // Data validation for Service Type
  const serviceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "Internet Access", "Computer Use", "Printing", "Scanning",
      "Technical Assistance", "Training", "Other",
    ], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange("G2:G1000").setDataValidation(serviceRule);

  // Data validation for Rating (1-5)
  const ratingRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(1, 5)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("K2:K1000").setDataValidation(ratingRule);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ DTC Logbook sheet configured!");
}

function setupSyncStatusSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName("Status");
  if (!sheet) sheet = ss.insertSheet("Status");

  const headers = [
    "Sheet Name", "Status", "Last Sync", "Records Synced",
    "Pending", "Last Error",
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, headers.length);
  sheet.setFrozenRows(1);

  // Conditional formatting for Status column
  const range = sheet.getRange("B2:B100");
  const successRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("success")
    .setBackground("#d4edda")
    .setFontColor("#155724")
    .setRanges([range])
    .build();
  const errorRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("error")
    .setBackground("#f8d7da")
    .setFontColor("#721c24")
    .setRanges([range])
    .build();
  const syncingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("syncing")
    .setBackground("#cce5ff")
    .setFontColor("#004085")
    .setRanges([range])
    .build();

  sheet.setConditionalFormatRules([successRule, errorRule, syncingRule]);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ Sync Status sheet configured!");
}

// ============================================================
// 2. ON EDIT: Webhook to Convex (Sheets → Convex direction)
// ============================================================

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const name = sheet.getName();

  // Only send webhooks for data sheets, not the Status dashboard
  if (name === "Status") return;

  const row = e.range.getRow();
  if (row <= 1) return; // Skip header

  // Rate limit: don't send more than once per 5 seconds per row
  const cache = CacheService.getScriptCache();
  const cacheKey = `edit_${name}_${row}`;
  if (cache.get(cacheKey)) return;
  cache.put(cacheKey, "1", 5);

  // Build row data
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rowData = {};
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) rowData[headers[i]] = values[i];
  }
  rowData["_rowNumber"] = row;
  rowData["_sheetTab"] = name;
  rowData["_editedColumn"] = e.range.getColumn();
  rowData["_editedBy"] = Session.getActiveUser().getEmail() || "unknown";
  rowData["_timestamp"] = new Date().toISOString();

  // Send to Convex webhook
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Webhook-Secret": CONFIG.WEBHOOK_SECRET,
        "X-Sheet-Id": e.source.getId(),
        "X-Sheet-Tab": name,
        "X-Edit-Type": "manual",
      },
      payload: JSON.stringify(rowData),
      muteHttpExceptions: true,
    };
    UrlFetchApp.fetch(CONFIG.CONVEX_WEBHOOK_URL, options);
  } catch (err) {
    console.log("Webhook failed:", err);
  }
}

// ============================================================
// 3. AUTO-FORMAT HELPER: Consistent header styling
// ============================================================

function formatHeaderRow(sheet, colCount) {
  const headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange
    .setBackground("#1a365d")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  // Auto-resize columns
  for (let i = 1; i <= colCount; i++) {
    sheet.autoResizeColumn(i);
    // Set minimum width
    if (sheet.getColumnWidth(i) < 100) {
      sheet.setColumnWidth(i, 100);
    }
  }

  // Set row height for header
  sheet.setRowHeight(1, 35);
}

// ============================================================
// 4. HOURLY AUTO-FORMAT: Clean up and re-style
// ============================================================

function autoFormat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Format each data sheet
  ["Attendance", "AuditTrail", "Logbook", "Status"].forEach(function (tabName) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const colCount = sheet.getLastColumn();
    formatHeaderRow(sheet, colCount);

    // Alternate row colors for readability
    for (let r = 2; r <= lastRow; r++) {
      const range = sheet.getRange(r, 1, 1, colCount);
      range.setBackground(r % 2 === 0 ? "#f8f9fa" : "#ffffff");
    }
  });
}

// ============================================================
// 5. CUSTOM MENU
// ============================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🔄 DICT Sync")
    .addItem("Setup Attendance Headers", "setupAttendanceLogSheet")
    .addItem("Setup DTC Logbook Headers", "setupDTCLogbookSheet")
    .addItem("Setup Sync Status Headers", "setupSyncStatusSheet")
    .addSeparator()
    .addItem("Auto-Format All Tabs", "autoFormat")
    .addToUi();
}

// ============================================================
// 6. UTILITY: Get sheet stats (can be called from Convex)
// ============================================================

function getSheetStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stats = {};

  ["Attendance", "AuditTrail", "Logbook", "Status"].forEach(function (tabName) {
    const sheet = ss.getSheetByName(tabName);
    if (sheet) {
      stats[tabName] = {
        rows: sheet.getLastRow() - 1, // Exclude header
        cols: sheet.getLastColumn(),
        lastModified: sheet.getRange(sheet.getLastRow(), 1).getValue(),
      };
    }
  });

  return stats;
}
