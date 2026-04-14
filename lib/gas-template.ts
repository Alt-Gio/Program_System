// ============================================================
// Google Apps Script Template Generator
// DICT Region V – Program Management System
//
// Returns the .gs script code string that users paste into
// their Google Sheet's Apps Script editor to enable
// automatic push on edit → Convex webhook.
// ============================================================

export function generateGASTemplate(params: {
  webhookUrl: string;
  webhookSecret: string;
  sheetId: string;
  projectCode: string;
  sheetName?: string;
  year?: number;
}): string {
  const { webhookUrl, webhookSecret, sheetId, projectCode, sheetName = "Activities", year = new Date().getFullYear() } = params;

  return `// ================================================================
// DICT Region V – PMS Google Sheets Sync Script
// Program: ${projectCode}
// Auto-generated — paste this entire file into your sheet's
// Apps Script editor (Extensions > Apps Script), then save.
// ================================================================

// ---- CONFIGURATION (edit these values) -------------------------
var CONFIG = {
  WEBHOOK_URL: "${webhookUrl}",
  WEBHOOK_SECRET: "${webhookSecret}",
  SHEET_ID: "${sheetId}",
  SHEET_NAME: "${sheetName}",
  PROJECT_CODE: "${projectCode}",
  DEFAULT_YEAR: ${year},

  // Column positions (1-indexed). Adjust if your sheet differs.
  COLS: {
    MONTH:                  1,   // A
    PROVINCE:               2,   // B
    LGU:                    3,   // C
    ACTIVITY_TITLE:         4,   // D
    VENUE:                  5,   // E
    PARTNER_ORGS:           6,   // F
    START_DATE:             7,   // G
    END_DATE:               8,   // H
    MODE:                   9,   // I
    PERSONNEL:             10,   // J
    NGA_MALE:              11,   // K
    NGA_FEMALE:            12,   // L
    LGU_MALE:              13,   // M
    LGU_FEMALE:            14,   // N
    SUC_MALE:              15,   // O
    SUC_FEMALE:            16,   // P
    OTHERS_MALE:           17,   // Q
    OTHERS_FEMALE:         18,   // R
    OTHERS_LABEL:          19,   // S
    AFTER_ACTIVITY_REPORT: 20,   // T
    FB_POSTING_LINK:       21,   // U
    RAW_PHOTOS_LINK:       22,   // V
    TESTIMONIALS_LINK:     23,   // W
    REMARKS:               24,   // X
    STATUS:                25,   // Y
  },

  HEADER_ROWS: 1  // Number of header rows to skip
};

// ----------------------------------------------------------------
// TRIGGER: Fires automatically whenever a cell is edited.
// Sends only the changed row to Convex.
// ----------------------------------------------------------------
function onEdit(e) {
  try {
    var sheet = e.source.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return; // Only track the configured sheet
    if (e.range.getSheet().getName() !== CONFIG.SHEET_NAME) return;

    var row = e.range.getRow();
    if (row <= CONFIG.HEADER_ROWS) return; // Skip header rows

    var rowData = extractRow(sheet, row);
    if (!rowData || !rowData.activityTitle) return; // Skip empty rows

    sendToConvex([rowData]);
    Logger.log("onEdit sync: row " + row + " → " + rowData.activityTitle);
  } catch (err) {
    Logger.log("onEdit error: " + err.toString());
  }
}

// ----------------------------------------------------------------
// MENU ACTION: Syncs all data rows from the sheet.
// Run this once to do a full initial import.
// ----------------------------------------------------------------
function syncAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Sheet not found: " + CONFIG.SHEET_NAME);
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROWS) {
    SpreadsheetApp.getUi().alert("No data rows found.");
    return;
  }

  var rows = [];
  for (var i = CONFIG.HEADER_ROWS + 1; i <= lastRow; i++) {
    var rowData = extractRow(sheet, i);
    if (rowData && rowData.activityTitle) rows.push(rowData);
  }

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert("No valid activity rows found.");
    return;
  }

  var result = sendToConvex(rows);
  SpreadsheetApp.getUi().alert(
    "Sync complete!\\n" +
    "Rows sent: " + rows.length + "\\n" +
    (result ? "Response: " + result : "")
  );
}

// ----------------------------------------------------------------
// INSTALL: Adds the DICT PMS menu and installs the onEdit trigger.
// Run this function ONCE to set up the sheet.
// ----------------------------------------------------------------
function installTrigger() {
  // Remove existing triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Install new onEdit trigger
  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  // Add custom menu
  SpreadsheetApp.getActiveSpreadsheet().addMenu("DICT PMS", [
    { name: "Sync All Rows Now", functionName: "syncAllRows" },
    { name: "Test Connection", functionName: "testConnection" },
    { name: "Remove Trigger", functionName: "removeTrigger" }
  ]);

  SpreadsheetApp.getUi().alert(
    "✓ DICT PMS sync installed!\\n\\n" +
    "• Auto-sync is now active — edits will push to the database automatically.\\n" +
    "• Use DICT PMS > Sync All Rows Now for a full initial import."
  );
}

// ----------------------------------------------------------------
// TEST: Verifies connectivity to the Convex webhook.
// ----------------------------------------------------------------
function testConnection() {
  try {
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: "GET",
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    SpreadsheetApp.getUi().alert(
      "Connection test:\\nStatus: " + code + "\\nResponse: " + body
    );
  } catch (err) {
    SpreadsheetApp.getUi().alert("Connection failed: " + err.toString());
  }
}

function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  SpreadsheetApp.getUi().alert("Removed " + removed + " onEdit trigger(s).");
}

// ----------------------------------------------------------------
// INTERNAL: Extract a single row into an activity object.
// ----------------------------------------------------------------
function extractRow(sheet, rowNum) {
  var c = CONFIG.COLS;
  var row = sheet.getRange(rowNum, 1, 1, 30).getValues()[0];

  var activityTitle = String(row[c.ACTIVITY_TITLE - 1] || "").trim();
  if (!activityTitle) return null;

  var startDateRaw = row[c.START_DATE - 1];
  var startDate = formatDate(startDateRaw);
  var endDateRaw = row[c.END_DATE - 1];
  var endDate = formatDate(endDateRaw) || startDate;

  // Derive month from start date if not provided
  var monthRaw = row[c.MONTH - 1];
  var month = monthRaw ? toMonthNumber(String(monthRaw)) : null;
  if (!month && startDate) {
    month = parseInt(startDate.split("-")[1], 10);
  }

  return {
    rowNumber: rowNum,
    province:               String(row[c.PROVINCE - 1] || "").trim(),
    lgu:                    String(row[c.LGU - 1] || "").trim(),
    activityTitle:          activityTitle,
    venue:                  String(row[c.VENUE - 1] || "").trim(),
    partnerOrganizations:   String(row[c.PARTNER_ORGS - 1] || "").trim(),
    startDate:              startDate,
    endDate:                endDate,
    month:                  month || new Date().getMonth() + 1,
    year:                   CONFIG.DEFAULT_YEAR,
    modeOfConduct:          String(row[c.MODE - 1] || "On-Site").trim(),
    personnelRaw:           String(row[c.PERSONNEL - 1] || "").trim(),
    ngaMale:                toNum(row[c.NGA_MALE - 1]),
    ngaFemale:              toNum(row[c.NGA_FEMALE - 1]),
    lguMale:                toNum(row[c.LGU_MALE - 1]),
    lguFemale:              toNum(row[c.LGU_FEMALE - 1]),
    sucMale:                toNum(row[c.SUC_MALE - 1]),
    sucFemale:              toNum(row[c.SUC_FEMALE - 1]),
    othersMale:             toNum(row[c.OTHERS_MALE - 1]),
    othersFemale:           toNum(row[c.OTHERS_FEMALE - 1]),
    othersLabel:            String(row[c.OTHERS_LABEL - 1] || "Others").trim(),
    afterActivityReport:    String(row[c.AFTER_ACTIVITY_REPORT - 1] || "").trim(),
    fbPostingLink:          String(row[c.FB_POSTING_LINK - 1] || "").trim(),
    rawPhotosLink:          String(row[c.RAW_PHOTOS_LINK - 1] || "").trim(),
    testimonialsLink:       String(row[c.TESTIMONIALS_LINK - 1] || "").trim(),
    remarks:                String(row[c.REMARKS - 1] || "").trim(),
    status:                 String(row[c.STATUS - 1] || "Submitted").trim() || "Submitted"
  };
}

// ----------------------------------------------------------------
// INTERNAL: Send rows array to Convex webhook.
// ----------------------------------------------------------------
function sendToConvex(rows) {
  try {
    var payload = rows.length === 1 ? rows[0] : rows;
    var options = {
      method: "POST",
      contentType: "application/json",
      headers: {
        "X-Webhook-Secret": CONFIG.WEBHOOK_SECRET,
        "X-Sheet-Id": CONFIG.SHEET_ID
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log("Webhook error " + code + ": " + response.getContentText());
    }
    return response.getContentText();
  } catch (err) {
    Logger.log("sendToConvex error: " + err.toString());
    return null;
  }
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------
function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val).trim();
}

function toNum(val) {
  var n = parseFloat(String(val || "0").replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.round(n);
}

function toMonthNumber(val) {
  var months = {
    january:1, february:2, march:3, april:4, may:5, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12,
    jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12
  };
  var n = parseInt(val, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return months[val.toLowerCase()] || null;
}
`;
}

export function getColumnGuide(): Array<{ col: string; field: string; example: string }> {
  return [
    { col: "A", field: "Month", example: "January or 1" },
    { col: "B", field: "Province", example: "Albay" },
    { col: "C", field: "LGU / Municipality", example: "Legazpi City" },
    { col: "D", field: "Activity Title", example: "eGovPH Orientation for LGU Personnel" },
    { col: "E", field: "Venue", example: "Legazpi City Hall" },
    { col: "F", field: "Partner Organizations", example: "DOST, DepEd (comma-separated)" },
    { col: "G", field: "Start Date", example: "2025-01-15 or 01/15/2025" },
    { col: "H", field: "End Date", example: "2025-01-15" },
    { col: "I", field: "Mode of Conduct", example: "On-Site / Online / Hybrid" },
    { col: "J", field: "DICT Personnel", example: "Juan dela Cruz, Ana Reyes" },
    { col: "K", field: "NGA Male", example: "5" },
    { col: "L", field: "NGA Female", example: "3" },
    { col: "M", field: "LGU Male", example: "10" },
    { col: "N", field: "LGU Female", example: "8" },
    { col: "O", field: "SUC Male", example: "2" },
    { col: "P", field: "SUC Female", example: "4" },
    { col: "Q", field: "Others Male", example: "1" },
    { col: "R", field: "Others Female", example: "2" },
    { col: "S", field: "Others Category", example: "Private Sector" },
    { col: "T", field: "After Activity Report URL", example: "https://docs.google.com/..." },
    { col: "U", field: "FB Posting Link", example: "https://facebook.com/..." },
    { col: "V", field: "Raw Photos Link", example: "https://drive.google.com/..." },
    { col: "W", field: "Testimonials Link", example: "https://drive.google.com/..." },
    { col: "X", field: "Remarks", example: "Any additional notes" },
    { col: "Y", field: "Status", example: "Draft / Submitted / Validated / Reported" },
  ];
}
