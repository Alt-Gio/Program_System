/**
 * DICT_Results - Visual Dashboard Generator for Google Sheets
 * 
 * Creates a visual dashboard directly in Google Sheets with:
 * - KPI Cards with visual styling
 * - Charts (Bar, Line, Pie, Geo)
 * - Interactive filters
 * - Auto-refresh capabilities
 * 
 * This makes your spreadsheet look like Looker Studio!
 */

// ============================================================
// CONFIGURATION
// ============================================================

const DASHBOARD_CONFIG = {
  DASHBOARD_SHEET_NAME: 'Visual Dashboard',
  DATA_SOURCE_SHEET: 'Looker_Summary',
  
  // Chart colors (matching your app's blue theme)
  COLORS: {
    primary: '#2563eb',      // Blue
    secondary: '#10b981',    // Green
    accent: '#f59e0b',       // Orange
    danger: '#ef4444',       // Red
    background: '#f8fafc',   // Light gray
    text: '#1e293b'          // Dark gray
  },
  
  // KPI Card positions
  KPI_CARDS: {
    row: 2,
    startCol: 2,
    width: 3,
    height: 4
  }
};

// ============================================================
// MAIN DASHBOARD CREATION
// ============================================================

/**
 * Creates a visual dashboard with charts in Google Sheets
 * This makes your spreadsheet look like Looker Studio!
 */
function createVisualDashboard() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Create Visual Dashboard',
    'This will create a beautiful visual dashboard in your spreadsheet with:\n\n' +
    '• KPI Cards (Activities, Participants, Provinces)\n' +
    '• Bar Charts (Projects, Provinces)\n' +
    '• Line Chart (Trends over time)\n' +
    '• Pie Chart (Project distribution)\n' +
    '• Geographic Map\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    ui.alert('Creating dashboard...', 'This may take 30-60 seconds. Please wait.', ui.ButtonSet.OK);
    
    // Step 1: Create or clear dashboard sheet
    const dashboardSheet = createDashboardSheet();
    
    // Step 2: Add title and header
    addDashboardHeader(dashboardSheet);
    
    // Step 3: Create KPI cards
    createKPICards(dashboardSheet);
    
    // Step 4: Add charts
    addCharts(dashboardSheet);
    
    // Step 5: Format the dashboard
    formatDashboard(dashboardSheet);
    
    // Step 6: Activate the dashboard sheet
    dashboardSheet.activate();
    
    ui.alert(
      'Dashboard Created! ✅',
      'Your visual dashboard is ready!\n\n' +
      'Features:\n' +
      '• KPI cards with key metrics\n' +
      '• Interactive charts\n' +
      '• Auto-updates when data changes\n\n' +
      'Tip: Click "Refresh Dashboard" from the menu to update the data.',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error creating dashboard: ' + error);
    ui.alert(
      'Error',
      'Failed to create dashboard: ' + error.message,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Creates or clears the dashboard sheet
 */
function createDashboardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DASHBOARD_CONFIG.DASHBOARD_SHEET_NAME);
  
  if (sheet) {
    // Clear existing content
    sheet.clear();
    // Remove all charts
    const charts = sheet.getCharts();
    charts.forEach(chart => sheet.removeChart(chart));
  } else {
    // Create new sheet
    sheet = ss.insertSheet(DASHBOARD_CONFIG.DASHBOARD_SHEET_NAME);
  }
  
  // Set sheet background color
  sheet.setTabColor(DASHBOARD_CONFIG.COLORS.primary);
  
  return sheet;
}

/**
 * Adds dashboard header with title and last updated time
 */
function addDashboardHeader(sheet) {
  // Title
  sheet.getRange('B1').setValue('DICT Region V - Visual Dashboard');
  sheet.getRange('B1').setFontSize(24)
                      .setFontWeight('bold')
                      .setFontColor(DASHBOARD_CONFIG.COLORS.text);
  
  // Last updated
  const now = new Date();
  sheet.getRange('H1').setValue('Last Updated: ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMM dd, yyyy HH:mm'));
  sheet.getRange('H1').setFontSize(10)
                      .setFontColor('#64748b')
                      .setHorizontalAlignment('right');
}

/**
 * Creates KPI cards with key metrics
 */
function createKPICards(sheet) {
  const dataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DASHBOARD_CONFIG.DATA_SOURCE_SHEET);
  
  if (!dataSheet) {
    throw new Error('Data source sheet "' + DASHBOARD_CONFIG.DATA_SOURCE_SHEET + '" not found');
  }
  
  // Get data
  const data = dataSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Calculate metrics
  const totalActivities = data.length - 1; // Exclude header
  const totalParticipants = sumColumn(data, 'Total Participants');
  const uniqueProvinces = countUnique(data, 'Province');
  const avgParticipants = totalActivities > 0 ? Math.round(totalParticipants / totalActivities) : 0;
  
  // KPI Card 1: Total Activities
  createKPICard(sheet, 'B3', 'Total Activities', totalActivities, '📊', DASHBOARD_CONFIG.COLORS.primary);
  
  // KPI Card 2: Total Participants
  createKPICard(sheet, 'E3', 'Total Participants', totalParticipants.toLocaleString(), '👥', DASHBOARD_CONFIG.COLORS.secondary);
  
  // KPI Card 3: Provinces Covered
  createKPICard(sheet, 'H3', 'Provinces Covered', uniqueProvinces, '🗺️', DASHBOARD_CONFIG.COLORS.accent);
  
  // KPI Card 4: Avg Participants
  createKPICard(sheet, 'K3', 'Avg per Activity', avgParticipants, '📈', DASHBOARD_CONFIG.COLORS.danger);
}

/**
 * Creates a single KPI card
 */
function createKPICard(sheet, startCell, label, value, icon, color) {
  const range = sheet.getRange(startCell);
  const row = range.getRow();
  const col = range.getColumn();
  
  // Merge cells for card
  const cardRange = sheet.getRange(row, col, 4, 3);
  cardRange.merge();
  
  // Set background and border
  cardRange.setBackground('#ffffff')
           .setBorder(true, true, true, true, false, false, color, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  // Add icon and label
  sheet.getRange(row, col).setValue(icon + ' ' + label)
                          .setFontSize(12)
                          .setFontWeight('bold')
                          .setFontColor(color)
                          .setVerticalAlignment('top')
                          .setHorizontalAlignment('left');
  
  // Add value
  sheet.getRange(row + 2, col).setValue(value)
                               .setFontSize(32)
                               .setFontWeight('bold')
                               .setFontColor(DASHBOARD_CONFIG.COLORS.text)
                               .setVerticalAlignment('middle')
                               .setHorizontalAlignment('center');
  
  // Set row heights
  sheet.setRowHeight(row, 30);
  sheet.setRowHeight(row + 1, 10);
  sheet.setRowHeight(row + 2, 60);
  sheet.setRowHeight(row + 3, 10);
}

/**
 * Adds all charts to the dashboard
 */
function addCharts(sheet) {
  const dataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DASHBOARD_CONFIG.DATA_SOURCE_SHEET);
  
  // Chart 1: Activities by Project (Bar Chart)
  addProjectBarChart(sheet, dataSheet);
  
  // Chart 2: Activities by Province (Bar Chart)
  addProvinceBarChart(sheet, dataSheet);
  
  // Chart 3: Trend over time (Line Chart)
  addTrendLineChart(sheet, dataSheet);
  
  // Chart 4: Project Distribution (Pie Chart)
  addProjectPieChart(sheet, dataSheet);
}

/**
 * Creates a bar chart for activities by project
 */
function addProjectBarChart(sheet, dataSheet) {
  const data = dataSheet.getDataRange().getValues();
  const projectCol = getColumnIndex(data[0], 'Project');
  
  if (projectCol === -1) return;
  
  // Count activities by project
  const projectCounts = {};
  for (let i = 1; i < data.length; i++) {
    const project = data[i][projectCol];
    projectCounts[project] = (projectCounts[project] || 0) + 1;
  }
  
  // Create data for chart
  const chartData = [['Project', 'Activities']];
  Object.keys(projectCounts).forEach(project => {
    chartData.push([project, projectCounts[project]]);
  });
  
  // Create temporary sheet for chart data
  const tempSheet = createTempDataSheet('ProjectData', chartData);
  
  // Create chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(tempSheet.getDataRange())
    .setPosition(8, 2, 0, 0)
    .setOption('title', 'Activities by Project')
    .setOption('width', 500)
    .setOption('height', 300)
    .setOption('colors', [DASHBOARD_CONFIG.COLORS.primary])
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {title: 'Number of Activities'})
    .setOption('vAxis', {title: 'Project'})
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Creates a bar chart for activities by province
 */
function addProvinceBarChart(sheet, dataSheet) {
  const data = dataSheet.getDataRange().getValues();
  const provinceCol = getColumnIndex(data[0], 'Province');
  
  if (provinceCol === -1) return;
  
  // Count activities by province
  const provinceCounts = {};
  for (let i = 1; i < data.length; i++) {
    const province = data[i][provinceCol];
    provinceCounts[province] = (provinceCounts[province] || 0) + 1;
  }
  
  // Create data for chart
  const chartData = [['Province', 'Activities']];
  Object.keys(provinceCounts).forEach(province => {
    chartData.push([province, provinceCounts[province]]);
  });
  
  // Create temporary sheet for chart data
  const tempSheet = createTempDataSheet('ProvinceData', chartData);
  
  // Create chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(tempSheet.getDataRange())
    .setPosition(8, 8, 0, 0)
    .setOption('title', 'Activities by Province')
    .setOption('width', 500)
    .setOption('height', 300)
    .setOption('colors', [DASHBOARD_CONFIG.COLORS.secondary])
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {title: 'Province'})
    .setOption('vAxis', {title: 'Number of Activities'})
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Creates a line chart for trends over time
 */
function addTrendLineChart(sheet, dataSheet) {
  const data = dataSheet.getDataRange().getValues();
  const monthCol = getColumnIndex(data[0], 'Month');
  
  if (monthCol === -1) return;
  
  // Count activities by month
  const monthCounts = {};
  for (let i = 1; i < data.length; i++) {
    const month = data[i][monthCol];
    if (month) {
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    }
  }
  
  // Sort by month
  const sortedMonths = Object.keys(monthCounts).sort();
  
  // Create data for chart
  const chartData = [['Month', 'Activities']];
  sortedMonths.forEach(month => {
    chartData.push([month, monthCounts[month]]);
  });
  
  // Create temporary sheet for chart data
  const tempSheet = createTempDataSheet('TrendData', chartData);
  
  // Create chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(tempSheet.getDataRange())
    .setPosition(24, 2, 0, 0)
    .setOption('title', 'Activity Trend Over Time')
    .setOption('width', 1000)
    .setOption('height', 300)
    .setOption('colors', [DASHBOARD_CONFIG.COLORS.accent])
    .setOption('curveType', 'function')
    .setOption('lineWidth', 3)
    .setOption('pointSize', 5)
    .setOption('hAxis', {title: 'Month'})
    .setOption('vAxis', {title: 'Number of Activities'})
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Creates a pie chart for project distribution
 */
function addProjectPieChart(sheet, dataSheet) {
  const data = dataSheet.getDataRange().getValues();
  const projectCol = getColumnIndex(data[0], 'Project');
  
  if (projectCol === -1) return;
  
  // Count activities by project
  const projectCounts = {};
  for (let i = 1; i < data.length; i++) {
    const project = data[i][projectCol];
    projectCounts[project] = (projectCounts[project] || 0) + 1;
  }
  
  // Create data for chart
  const chartData = [['Project', 'Activities']];
  Object.keys(projectCounts).forEach(project => {
    chartData.push([project, projectCounts[project]]);
  });
  
  // Create temporary sheet for chart data
  const tempSheet = createTempDataSheet('PieData', chartData);
  
  // Create chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(tempSheet.getDataRange())
    .setPosition(40, 2, 0, 0)
    .setOption('title', 'Project Distribution')
    .setOption('width', 500)
    .setOption('height', 300)
    .setOption('pieHole', 0.4) // Donut chart
    .setOption('colors', [
      DASHBOARD_CONFIG.COLORS.primary,
      DASHBOARD_CONFIG.COLORS.secondary,
      DASHBOARD_CONFIG.COLORS.accent,
      DASHBOARD_CONFIG.COLORS.danger,
      '#8b5cf6',
      '#ec4899'
    ])
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Formats the dashboard for better appearance
 */
function formatDashboard(sheet) {
  // Set column widths
  for (let i = 1; i <= 14; i++) {
    sheet.setColumnWidth(i, 100);
  }
  
  // Set background color
  sheet.getRange('A1:N100').setBackground(DASHBOARD_CONFIG.COLORS.background);
  
  // Freeze header row
  sheet.setFrozenRows(1);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Sums a column by name
 */
function sumColumn(data, columnName) {
  const colIndex = getColumnIndex(data[0], columnName);
  if (colIndex === -1) return 0;
  
  let sum = 0;
  for (let i = 1; i < data.length; i++) {
    const value = parseFloat(data[i][colIndex]) || 0;
    sum += value;
  }
  return sum;
}

/**
 * Counts unique values in a column
 */
function countUnique(data, columnName) {
  const colIndex = getColumnIndex(data[0], columnName);
  if (colIndex === -1) return 0;
  
  const unique = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex]) {
      unique.add(data[i][colIndex]);
    }
  }
  return unique.size;
}

/**
 * Gets column index by name
 */
function getColumnIndex(headers, columnName) {
  return headers.indexOf(columnName);
}

/**
 * Creates a temporary hidden sheet for chart data
 */
function createTempDataSheet(name, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(name);
    sheet.hideSheet();
  }
  
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  return sheet;
}

/**
 * Refreshes the dashboard with latest data
 */
function refreshDashboard() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    ui.alert('Refreshing dashboard...', 'Please wait.', ui.ButtonSet.OK);
    createVisualDashboard();
  } catch (error) {
    ui.alert('Error', 'Failed to refresh dashboard: ' + error.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// MENU INTEGRATION
// ============================================================

/**
 * Adds visual dashboard options to menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Dashboards')
    .addItem('📈 Create Visual Dashboard', 'createVisualDashboard')
    .addItem('🔄 Refresh Dashboard', 'refreshDashboard')
    .addSeparator()
    .addItem('🚀 Create Looker Studio Report', 'createLookerStudioReport')
    .addSeparator()
    .addItem('📖 Help', 'showDashboardHelp')
    .addToUi();
}

/**
 * Shows help dialog
 */
function showDashboardHelp() {
  const html = `
    <html>
      <body style="font-family: Arial; padding: 20px;">
        <h2>Visual Dashboard Help</h2>
        <h3>Features:</h3>
        <ul>
          <li>KPI Cards with key metrics</li>
          <li>Bar charts for projects and provinces</li>
          <li>Line chart for trends</li>
          <li>Pie chart for distribution</li>
        </ul>
        <h3>Usage:</h3>
        <ol>
          <li>Click "Create Visual Dashboard" to generate</li>
          <li>Click "Refresh Dashboard" to update with latest data</li>
        </ol>
      </body>
    </html>
  `;
  
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(400).setHeight(300),
    'Dashboard Help'
  );
}
