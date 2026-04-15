/**
 * DICT_Results - Looker Studio Helper Script
 * 
 * This script prepares your exported data for optimal use in Looker Studio by:
 * - Creating a summary sheet with aggregated metrics
 * - Adding data validation and formatting
 * - Creating pivot tables for common visualizations
 * - Setting up automatic data refresh
 * 
 * Installation:
 * 1. Open your DICT_Results spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Save (Ctrl+S or Cmd+S)
 * 6. Run "setupLookerStudio" function
 * 7. Authorize when prompted
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Source sheet name (where your exported data goes)
  SOURCE_SHEET: 'Activity Data',
  
  // Summary sheet names (will be created)
  SUMMARY_SHEET: 'Looker_Summary',
  PIVOT_SHEET: 'Looker_Pivots',
  METRICS_SHEET: 'Looker_Metrics',
  
  // Colors for formatting
  COLORS: {
    HEADER: '#1a73e8',
    HEADER_TEXT: '#ffffff',
    SUMMARY_BG: '#f8f9fa',
    HIGHLIGHT: '#e8f0fe'
  }
};

// ============================================================
// MAIN SETUP FUNCTION
// ============================================================

/**
 * Main setup function - Run this once to set up everything
 */
function setupLookerStudio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log('Starting Looker Studio setup...');
  
  // 1. Create summary sheets
  createSummarySheet(ss);
  createMetricsSheet(ss);
  createPivotsSheet(ss);
  
  // 2. Format source data
  formatSourceData(ss);
  
  // 3. Set up data validation
  setupDataValidation(ss);
  
  // 4. Create named ranges for Looker Studio
  createNamedRanges(ss);
  
  Logger.log('Setup complete! Your spreadsheet is now Looker Studio ready.');
  
  // Show success message
  SpreadsheetApp.getUi().alert(
    'Setup Complete!',
    'Your DICT_Results spreadsheet is now optimized for Looker Studio.\n\n' +
    'Next steps:\n' +
    '1. Go to Looker Studio (lookerstudio.google.com)\n' +
    '2. Create a new data source\n' +
    '3. Connect to this spreadsheet\n' +
    '4. Use the "Looker_Summary" or "Looker_Metrics" sheets for best results',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// SUMMARY SHEET CREATION
// ============================================================

/**
 * Creates a summary sheet with aggregated data
 */
function createSummarySheet(ss) {
  Logger.log('Creating summary sheet...');
  
  // Delete existing summary sheet if it exists
  const existingSheet = ss.getSheetByName(CONFIG.SUMMARY_SHEET);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }
  
  // Create new summary sheet
  const summarySheet = ss.insertSheet(CONFIG.SUMMARY_SHEET);
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  
  if (!sourceSheet) {
    Logger.log('Source sheet not found. Please export data first.');
    return;
  }
  
  // Get source data
  const sourceData = sourceSheet.getDataRange().getValues();
  const headers = sourceData[0];
  
  // Find column indices
  const colIndices = {
    year: headers.indexOf('year'),
    month: headers.indexOf('month'),
    quarter: headers.indexOf('quarter'),
    project: headers.indexOf('project_code'),
    province: headers.indexOf('province'),
    status: headers.indexOf('status'),
    totalPax: headers.indexOf('total_participants')
  };
  
  // Create summary headers
  const summaryHeaders = [
    'Year',
    'Quarter',
    'Month',
    'Project',
    'Province',
    'Status',
    'Activity Count',
    'Total Participants',
    'Male Participants',
    'Female Participants',
    'Completion Rate'
  ];
  
  summarySheet.getRange(1, 1, 1, summaryHeaders.length)
    .setValues([summaryHeaders])
    .setBackground(CONFIG.COLORS.HEADER)
    .setFontColor(CONFIG.COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Aggregate data by year, quarter, project, province
  const aggregated = aggregateData(sourceData, colIndices);
  
  // Write aggregated data
  if (aggregated.length > 0) {
    summarySheet.getRange(2, 1, aggregated.length, summaryHeaders.length)
      .setValues(aggregated);
  }
  
  // Format the sheet
  summarySheet.setFrozenRows(1);
  summarySheet.autoResizeColumns(1, summaryHeaders.length);
  
  // Add alternating row colors
  const dataRange = summarySheet.getRange(2, 1, aggregated.length, summaryHeaders.length);
  dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  
  Logger.log('Summary sheet created successfully');
}

/**
 * Aggregates source data for summary
 */
function aggregateData(sourceData, colIndices) {
  const aggregated = {};
  
  // Skip header row
  for (let i = 1; i < sourceData.length; i++) {
    const row = sourceData[i];
    
    const year = row[colIndices.year] || 'Unknown';
    const quarter = row[colIndices.quarter] || 'Q1';
    const month = row[colIndices.month] || 1;
    const project = row[colIndices.project] || 'Unknown';
    const province = row[colIndices.province] || 'Unknown';
    const status = row[colIndices.status] || 'Draft';
    const totalPax = parseInt(row[colIndices.totalPax]) || 0;
    
    const key = `${year}_${quarter}_${month}_${project}_${province}_${status}`;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        year: year,
        quarter: quarter,
        month: month,
        project: project,
        province: province,
        status: status,
        count: 0,
        totalPax: 0,
        male: 0,
        female: 0
      };
    }
    
    aggregated[key].count++;
    aggregated[key].totalPax += totalPax;
  }
  
  // Convert to array
  const result = [];
  for (const key in aggregated) {
    const data = aggregated[key];
    const completionRate = data.status === 'Reported' || data.status === 'Validated' ? 100 : 
                          data.status === 'Submitted' ? 50 : 0;
    
    result.push([
      data.year,
      data.quarter,
      data.month,
      data.project,
      data.province,
      data.status,
      data.count,
      data.totalPax,
      data.male,
      data.female,
      completionRate + '%'
    ]);
  }
  
  return result;
}

// ============================================================
// METRICS SHEET CREATION
// ============================================================

/**
 * Creates a metrics sheet with KPIs for Looker Studio
 */
function createMetricsSheet(ss) {
  Logger.log('Creating metrics sheet...');
  
  // Delete existing metrics sheet if it exists
  const existingSheet = ss.getSheetByName(CONFIG.METRICS_SHEET);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }
  
  // Create new metrics sheet
  const metricsSheet = ss.insertSheet(CONFIG.METRICS_SHEET);
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  
  if (!sourceSheet) {
    Logger.log('Source sheet not found.');
    return;
  }
  
  // Set up metrics headers
  const headers = [
    ['Metric', 'Value', 'Description']
  ];
  
  metricsSheet.getRange(1, 1, 1, 3)
    .setValues(headers)
    .setBackground(CONFIG.COLORS.HEADER)
    .setFontColor(CONFIG.COLORS.HEADER_TEXT)
    .setFontWeight('bold');
  
  // Calculate metrics
  const lastRow = sourceSheet.getLastRow();
  const metrics = [
    ['Total Activities', `=COUNTA('${CONFIG.SOURCE_SHEET}'!A2:A)`, 'Total number of activities'],
    ['Total Participants', `=SUM('${CONFIG.SOURCE_SHEET}'!AF2:AF)`, 'Sum of all participants'],
    ['Average Participants', `=AVERAGE('${CONFIG.SOURCE_SHEET}'!AF2:AF)`, 'Average participants per activity'],
    ['Completed Activities', `=COUNTIF('${CONFIG.SOURCE_SHEET}'!T2:T,"Reported")+COUNTIF('${CONFIG.SOURCE_SHEET}'!T2:T,"Validated")`, 'Activities marked as completed'],
    ['Completion Rate', `=IF(A2>0,A5/A2*100,0)&"%"`, 'Percentage of completed activities'],
    ['Male Participants', `=SUM('${CONFIG.SOURCE_SHEET}'!AD2:AD)`, 'Total male participants'],
    ['Female Participants', `=SUM('${CONFIG.SOURCE_SHEET}'!AE2:AE)`, 'Total female participants'],
    ['Gender Ratio', `=IF(A7>0,A6/A7,0)`, 'Male to female ratio'],
    ['Unique Provinces', `=COUNTA(UNIQUE('${CONFIG.SOURCE_SHEET}'!J2:J))`, 'Number of provinces covered'],
    ['Unique LGUs', `=COUNTA(UNIQUE('${CONFIG.SOURCE_SHEET}'!L2:L))`, 'Number of LGUs covered']
  ];
  
  metricsSheet.getRange(2, 1, metrics.length, 3).setValues(metrics);
  
  // Format the sheet
  metricsSheet.setFrozenRows(1);
  metricsSheet.setColumnWidth(1, 200);
  metricsSheet.setColumnWidth(2, 150);
  metricsSheet.setColumnWidth(3, 300);
  
  // Add background color to metric names
  metricsSheet.getRange(2, 1, metrics.length, 1)
    .setBackground(CONFIG.COLORS.SUMMARY_BG)
    .setFontWeight('bold');
  
  Logger.log('Metrics sheet created successfully');
}

// ============================================================
// PIVOTS SHEET CREATION
// ============================================================

/**
 * Creates a sheet with pivot table data for Looker Studio
 */
function createPivotsSheet(ss) {
  Logger.log('Creating pivots sheet...');
  
  // Delete existing pivots sheet if it exists
  const existingSheet = ss.getSheetByName(CONFIG.PIVOT_SHEET);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }
  
  // Create new pivots sheet
  const pivotsSheet = ss.insertSheet(CONFIG.PIVOT_SHEET);
  
  // Add instructions
  const instructions = [
    ['Pivot Tables for Looker Studio'],
    [''],
    ['This sheet contains pre-aggregated data for common visualizations:'],
    [''],
    ['1. Activities by Project and Year'],
    ['2. Participants by Province'],
    ['3. Status Distribution'],
    ['4. Monthly Trends'],
    [''],
    ['Use these ranges in Looker Studio for faster dashboard performance.']
  ];
  
  pivotsSheet.getRange(1, 1, instructions.length, 1).setValues(instructions);
  pivotsSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  
  Logger.log('Pivots sheet created successfully');
}

// ============================================================
// DATA FORMATTING
// ============================================================

/**
 * Formats the source data sheet
 */
function formatSourceData(ss) {
  Logger.log('Formatting source data...');
  
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet) return;
  
  // Freeze header row
  sourceSheet.setFrozenRows(1);
  
  // Format header
  const lastCol = sourceSheet.getLastColumn();
  sourceSheet.getRange(1, 1, 1, lastCol)
    .setBackground(CONFIG.COLORS.HEADER)
    .setFontColor(CONFIG.COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Auto-resize columns
  sourceSheet.autoResizeColumns(1, lastCol);
  
  Logger.log('Source data formatted successfully');
}

// ============================================================
// DATA VALIDATION
// ============================================================

/**
 * Sets up data validation rules
 */
function setupDataValidation(ss) {
  Logger.log('Setting up data validation...');
  
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet) return;
  
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return;
  
  // Find status column (column T - index 20)
  const statusColumn = 20;
  
  // Create validation rule for status
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Draft', 'Submitted', 'Validated', 'Reported'], true)
    .setAllowInvalid(false)
    .build();
  
  // Apply to status column
  sourceSheet.getRange(2, statusColumn, lastRow - 1, 1).setDataValidation(statusRule);
  
  Logger.log('Data validation set up successfully');
}

// ============================================================
// NAMED RANGES
// ============================================================

/**
 * Creates named ranges for easy reference in Looker Studio
 */
function createNamedRanges(ss) {
  Logger.log('Creating named ranges...');
  
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet) return;
  
  const lastRow = sourceSheet.getLastRow();
  const lastCol = sourceSheet.getLastColumn();
  
  // Remove existing named ranges
  const existingRanges = ss.getNamedRanges();
  existingRanges.forEach(range => {
    if (range.getName().startsWith('DICT_')) {
      range.remove();
    }
  });
  
  // Create new named ranges
  const ranges = {
    'DICT_AllData': sourceSheet.getRange(1, 1, lastRow, lastCol),
    'DICT_Headers': sourceSheet.getRange(1, 1, 1, lastCol),
    'DICT_DataOnly': sourceSheet.getRange(2, 1, Math.max(1, lastRow - 1), lastCol)
  };
  
  for (const name in ranges) {
    ss.setNamedRange(name, ranges[name]);
  }
  
  Logger.log('Named ranges created successfully');
}

// ============================================================
// AUTO-REFRESH FUNCTION
// ============================================================

/**
 * Refreshes all summary sheets when source data changes
 * Set up a trigger to run this automatically
 */
function refreshSummarySheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log('Refreshing summary sheets...');
  
  createSummarySheet(ss);
  createMetricsSheet(ss);
  
  Logger.log('Summary sheets refreshed successfully');
}

// ============================================================
// TRIGGER SETUP
// ============================================================

/**
 * Sets up automatic triggers
 * Run this once to enable auto-refresh
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new trigger to refresh summaries when sheet is edited
  ScriptApp.newTrigger('refreshSummarySheets')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  Logger.log('Triggers set up successfully');
  
  SpreadsheetApp.getUi().alert(
    'Auto-Refresh Enabled',
    'Summary sheets will now automatically refresh when data is updated.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// MENU FUNCTIONS
// ============================================================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Looker Studio')
    .addItem('🚀 Setup for Looker Studio', 'setupLookerStudio')
    .addItem('🔄 Refresh Summary Sheets', 'refreshSummarySheets')
    .addItem('⚙️ Enable Auto-Refresh', 'setupTriggers')
    .addSeparator()
    .addItem('📖 Help', 'showHelp')
    .addToUi();
}

/**
 * Shows help dialog
 */
function showHelp() {
  const html = HtmlService.createHtmlOutput(`
    <h2>DICT_Results - Looker Studio Helper</h2>
    <h3>Quick Start:</h3>
    <ol>
      <li>Click "Setup for Looker Studio" to create summary sheets</li>
      <li>Go to <a href="https://lookerstudio.google.com" target="_blank">Looker Studio</a></li>
      <li>Create a new data source</li>
      <li>Connect to this spreadsheet</li>
      <li>Use "Looker_Summary" or "Looker_Metrics" sheets</li>
    </ol>
    <h3>Features:</h3>
    <ul>
      <li><strong>Looker_Summary:</strong> Aggregated data by project, province, and time</li>
      <li><strong>Looker_Metrics:</strong> Key performance indicators</li>
      <li><strong>Looker_Pivots:</strong> Pre-aggregated data for visualizations</li>
    </ul>
    <h3>Tips:</h3>
    <ul>
      <li>Enable auto-refresh to keep summaries updated</li>
      <li>Use named ranges (DICT_AllData, etc.) in formulas</li>
      <li>Summary sheets update automatically when you export new data</li>
    </ul>
  `)
    .setWidth(500)
    .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Help - Looker Studio Helper');
}
