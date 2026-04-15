# 🎯 One-Click Looker Studio Template Solution

## The Goal
You want to click a button and have a **fully-built dashboard** appear with all charts already configured. You just connect your data and it auto-populates.

## ✅ Best Solution: Template Dashboard + Copy

Since Looker Studio has no official API for programmatic report creation, here's the **best workflow**:

### One-Time Setup (10 minutes)
1. Create your "master" dashboard once with all charts
2. Save it as a template
3. Share the template link

### Every Time You Need a Report (30 seconds)
1. Click the template link
2. Click "Use Template"
3. Select your data source
4. Done! All charts auto-populate

---

## 🚀 Step-by-Step Implementation

### Phase 1: Create Master Template (One Time)

#### 1. Build Your Dashboard (10 minutes)
Follow the Quick Setup to create your dashboard with:
- 3 filters (Year, Project, Province)
- 4 scorecards (Activities, Participants, Rate, Provinces)
- 1 time series chart
- 1 geo map
- 1 bar chart

#### 2. Make it a Template
1. In your dashboard, click **Share** (top right)
2. Click **Get report link**
3. Enable **"Anyone with the link can view"**
4. Copy the link - this is your template URL

#### 3. Enable Template Mode
1. In the URL, add `&template=true` at the end
2. Example:
   ```
   https://lookerstudio.google.com/reporting/xxxxx/page/xxxxx?template=true
   ```
3. Save this URL - this is your **template link**

### Phase 2: Use Template (Every Time)

#### Option A: Manual (30 seconds)
1. Open the template link
2. Click **"Use Template"** button
3. Select your data source (DICT_Results → Looker_Summary)
4. Click **"Copy Report"**
5. Done! All charts are pre-configured

#### Option B: Apps Script Button (Automated)
Add this to your Apps Script:

```javascript
function openLookerTemplate() {
  const TEMPLATE_URL = 'YOUR_TEMPLATE_URL_HERE?template=true';
  
  const html = `
    <html>
      <body style="font-family: Arial; padding: 20px; text-align: center;">
        <h2>🚀 Open Looker Studio Template</h2>
        <p>Click the button below to create a new dashboard from template.</p>
        <p>All charts are pre-configured - just select your data source!</p>
        <a href="${TEMPLATE_URL}" target="_blank" 
           style="display: inline-block; background: #1a73e8; color: white; 
                  padding: 15px 30px; text-decoration: none; border-radius: 4px; 
                  font-weight: bold; margin: 20px;">
          📊 Create Dashboard from Template
        </a>
        <hr style="margin: 30px 0;">
        <h3>Quick Steps:</h3>
        <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
          <li>Click the button above</li>
          <li>Click "Use Template" in Looker Studio</li>
          <li>Select "DICT_Results" spreadsheet</li>
          <li>Select "Looker_Summary" sheet</li>
          <li>Click "Copy Report"</li>
          <li>Done! ✅</li>
        </ol>
      </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(600)
    .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(ui, 'Looker Studio Template');
}
```

Then add to your menu:
```javascript
.addItem('📊 Create from Template', 'openLookerTemplate')
```

---

## 🎨 Alternative: Embedded Dashboard

If you want to **view** the dashboard (not create new ones), you can embed it:

### 1. Create One Dashboard
Build your dashboard once with your data.

### 2. Embed in Google Sheets
```javascript
function showDashboard() {
  const DASHBOARD_URL = 'YOUR_DASHBOARD_URL_HERE';
  
  const html = `
    <html>
      <body style="margin: 0; padding: 0;">
        <iframe src="${DASHBOARD_URL}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                style="border: 0;">
        </iframe>
      </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(1200)
    .setHeight(800);
  
  SpreadsheetApp.getUi().showModalDialog(ui, 'DICT Dashboard');
}
```

Add to menu:
```javascript
.addItem('📊 View Dashboard', 'showDashboard')
```

---

## 🔥 Best Workflow for Your Use Case

### Scenario 1: Multiple Users, Same Data
**Solution:** One shared dashboard
- Create one dashboard
- Share with all users
- Everyone views the same dashboard
- Data updates automatically

**Implementation:**
```javascript
function viewSharedDashboard() {
  const url = 'YOUR_DASHBOARD_URL';
  const html = `<script>window.open('${url}', '_blank');</script>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html), 
    'Opening Dashboard...'
  );
}
```

### Scenario 2: Each User Needs Their Own Dashboard
**Solution:** Template + Copy
- Create master template
- Each user copies from template
- Takes 30 seconds per user
- Each has their own customizable dashboard

**Implementation:**
```javascript
function createMyDashboard() {
  const TEMPLATE_URL = 'YOUR_TEMPLATE_URL?template=true';
  
  const html = `
    <html>
      <body style="font-family: Arial; padding: 30px; text-align: center;">
        <h2>🚀 Create Your Dashboard</h2>
        <p style="font-size: 16px; color: #5f6368;">
          Click below to create your own dashboard from the template.<br>
          All charts are pre-configured!
        </p>
        <a href="${TEMPLATE_URL}" target="_blank" 
           style="display: inline-block; background: #1a73e8; color: white; 
                  padding: 20px 40px; text-decoration: none; border-radius: 8px; 
                  font-weight: bold; font-size: 18px; margin: 30px;">
          📊 Create My Dashboard
        </a>
        <div style="background: #e8f0fe; padding: 20px; border-radius: 8px; margin-top: 30px;">
          <h3 style="margin-top: 0;">What happens next?</h3>
          <ol style="text-align: left; max-width: 500px; margin: 0 auto; line-height: 1.8;">
            <li>Looker Studio opens with the template</li>
            <li>Click <strong>"Use Template"</strong></li>
            <li>Select <strong>"DICT_Results"</strong> spreadsheet</li>
            <li>Select <strong>"Looker_Summary"</strong> sheet</li>
            <li>Click <strong>"Copy Report"</strong></li>
            <li>Your dashboard is ready! ✅</li>
          </ol>
          <p style="color: #5f6368; margin-top: 20px;">
            ⏱️ Takes only 30 seconds!
          </p>
        </div>
      </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(700)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(ui, 'Create Dashboard from Template');
}
```

### Scenario 3: Automated Reports
**Solution:** Scheduled email reports
- Create one dashboard
- Set up scheduled email delivery
- Users receive PDF/link automatically

**Setup in Looker Studio:**
1. Open your dashboard
2. Click **Share** → **Schedule email delivery**
3. Set frequency (daily, weekly, monthly)
4. Add recipients
5. Done! Automatic reports

---

## 📊 Complete Implementation

Here's the complete Apps Script code for your use case:

```javascript
// ============================================================
// LOOKER STUDIO TEMPLATE SYSTEM
// ============================================================

// CONFIGURATION - Update these after creating your template
const LOOKER_TEMPLATE_CONFIG = {
  TEMPLATE_URL: 'https://lookerstudio.google.com/reporting/YOUR_REPORT_ID?template=true',
  DASHBOARD_URL: 'https://lookerstudio.google.com/reporting/YOUR_REPORT_ID',
  SPREADSHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId()
};

/**
 * Opens the template for creating a new dashboard
 * User clicks "Use Template" and selects their data source
 */
function createFromTemplate() {
  const ui = SpreadsheetApp.getUi();
  
  const html = `
    <html>
      <head>
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 30px;
            text-align: center;
            line-height: 1.6;
          }
          h2 { color: #1a73e8; margin-bottom: 10px; }
          .button {
            display: inline-block;
            background: #1a73e8;
            color: white;
            padding: 20px 40px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 18px;
            margin: 30px 0;
          }
          .button:hover { background: #1557b0; }
          .info-box {
            background: #e8f0fe;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            text-align: left;
          }
          .step {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #1a73e8;
            border-radius: 4px;
          }
          .step-number {
            display: inline-block;
            background: #1a73e8;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            text-align: center;
            line-height: 28px;
            margin-right: 10px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h2>🚀 Create Dashboard from Template</h2>
        <p style="font-size: 16px; color: #5f6368;">
          All charts are pre-configured!<br>
          Just connect your data and you're done.
        </p>
        
        <a href="${LOOKER_TEMPLATE_CONFIG.TEMPLATE_URL}" target="_blank" class="button">
          📊 Create My Dashboard
        </a>
        
        <div class="info-box">
          <h3 style="margin-top: 0; color: #202124;">📋 Quick Steps (30 seconds):</h3>
          
          <div class="step">
            <span class="step-number">1</span>
            <strong>Click the button above</strong><br>
            <small>Opens Looker Studio with the template</small>
          </div>
          
          <div class="step">
            <span class="step-number">2</span>
            <strong>Click "Use Template"</strong><br>
            <small>Button appears at the top of the page</small>
          </div>
          
          <div class="step">
            <span class="step-number">3</span>
            <strong>Select "DICT_Results" spreadsheet</strong><br>
            <small>Choose your data source</small>
          </div>
          
          <div class="step">
            <span class="step-number">4</span>
            <strong>Select "Looker_Summary" sheet</strong><br>
            <small>Use the summary sheet for best performance</small>
          </div>
          
          <div class="step">
            <span class="step-number">5</span>
            <strong>Click "Copy Report"</strong><br>
            <small>Creates your own copy of the dashboard</small>
          </div>
          
          <div class="step">
            <span class="step-number">6</span>
            <strong>Done! ✅</strong><br>
            <small>All charts auto-populate with your data</small>
          </div>
        </div>
        
        <p style="color: #5f6368; font-size: 14px;">
          ⏱️ <strong>Total time: 30 seconds</strong><br>
          💡 The template includes all charts, filters, and styling
        </p>
      </body>
    </html>
  `;
  
  const output = HtmlService.createHtmlOutput(html)
    .setWidth(700)
    .setHeight(750);
  
  ui.showModalDialog(output, 'Create Dashboard from Template');
}

/**
 * Opens the existing dashboard for viewing
 */
function viewDashboard() {
  const url = LOOKER_TEMPLATE_CONFIG.DASHBOARD_URL;
  const html = `<script>window.open('${url}', '_blank');google.script.host.close();</script>`;
  
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html),
    'Opening Dashboard...'
  );
}

/**
 * Shows embedded dashboard in a dialog
 */
function showEmbeddedDashboard() {
  const html = `
    <html>
      <body style="margin: 0; padding: 0; overflow: hidden;">
        <iframe src="${LOOKER_TEMPLATE_CONFIG.DASHBOARD_URL}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                style="border: 0; display: block;">
        </iframe>
      </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(1400)
    .setHeight(900);
  
  SpreadsheetApp.getUi().showModalDialog(ui, 'DICT Region V Dashboard');
}

/**
 * Update menu to include template options
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Looker Studio')
    .addItem('🚀 Create from Template', 'createFromTemplate')
    .addItem('📈 View Dashboard', 'viewDashboard')
    .addItem('🖥️ Show Embedded Dashboard', 'showEmbeddedDashboard')
    .addSeparator()
    .addItem('🔄 Refresh Summary Sheets', 'refreshSummarySheets')
    .addItem('⚙️ Enable Auto-Refresh', 'setupTriggers')
    .addSeparator()
    .addItem('📋 Generate Template Guide', 'createTemplateGuide')
    .addItem('📖 Help', 'showHelp')
    .addToUi();
}
```

---

## 🎯 Implementation Steps

### Step 1: Create Your Master Dashboard (10 minutes)
1. Follow the Quick Setup guide to build your dashboard
2. Add all charts, filters, and styling
3. Save it with a clear name like "DICT Dashboard Template"

### Step 2: Get Template URL (1 minute)
1. Click **Share** in your dashboard
2. Enable **"Anyone with the link can view"**
3. Copy the URL
4. Add `?template=true` at the end
5. Update `LOOKER_TEMPLATE_CONFIG.TEMPLATE_URL` in the code

### Step 3: Add Code to Apps Script (2 minutes)
1. Copy the complete code above
2. Paste into your Apps Script
3. Update the TEMPLATE_URL with your URL
4. Save

### Step 4: Use It! (30 seconds each time)
1. Click **📊 Looker Studio → 🚀 Create from Template**
2. Click **"Create My Dashboard"**
3. Click **"Use Template"** in Looker Studio
4. Select your data source
5. Done!

---

## ✅ What You Get

- ✅ **One-click dashboard creation** (30 seconds)
- ✅ **All charts pre-configured** (no manual setup)
- ✅ **Auto-populates with your data** (just select data source)
- ✅ **Reusable template** (create unlimited dashboards)
- ✅ **Embedded viewing option** (view in spreadsheet)
- ✅ **Shareable** (send template link to team)

---

## 🎉 This is the Closest to "Fully Automated"

Since Looker Studio has no API, this template approach is the **best possible solution**:
- **30 seconds** to create a new dashboard (vs 10 minutes manual)
- **Zero configuration** needed (all charts pre-built)
- **One-click** from your spreadsheet menu
- **Auto-populates** when you select data source

**This is as automated as Looker Studio allows!** 🚀

---

Would you like me to implement this template system in your Apps Script?
