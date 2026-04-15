# How to Get Your DICT_Results Spreadsheet ID

## Visual Guide

### Step 1: Open DICT_Results

1. Go to Google Drive
2. Find and open your **DICT_Results** spreadsheet
3. The spreadsheet should open in a new tab

### Step 2: Look at the URL

Your browser's address bar will show something like this:

```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0/edit#gid=0
```

### Step 3: Identify the Spreadsheet ID

The spreadsheet ID is the long string between `/d/` and `/edit`:

```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit#gid=0
                                      ↑                  ↑
                                    Start              End
```

**Example**:
```
URL: https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0/edit#gid=0

Spreadsheet ID: 1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0
```

### Step 4: Copy the ID

1. Select the spreadsheet ID (the part between `/d/` and `/edit`)
2. Copy it (Ctrl+C or Cmd+C)
3. Keep it handy for the next step

## Common Mistakes

### ❌ Wrong: Copying the entire URL
```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0/edit#gid=0
```

### ❌ Wrong: Including `/edit` or `#gid=0`
```
1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0/edit#gid=0
```

### ✅ Correct: Just the ID
```
1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0
```

## What to Do Next

### 1. Add to .env.local

Open your `.env.local` file and add:

```env
GOOGLE_SHEETS_TARGET_ID=1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0
```

Replace `1a2b3c4d5e6f7g8h9i0jK1L2M3N4O5P6Q7R8S9T0` with your actual spreadsheet ID.

### 2. Share with Service Account

1. In DICT_Results, click the **Share** button (top right)
2. Add this email: `dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com`
3. Set permission to **Editor**
4. Uncheck "Notify people" (optional)
5. Click **Share**

### 3. Restart Your Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Verification

To verify you have the correct ID:

1. Open a new browser tab
2. Paste this URL (replace YOUR_ID with your spreadsheet ID):
   ```
   https://docs.google.com/spreadsheets/d/YOUR_ID/edit
   ```
3. If it opens your DICT_Results spreadsheet, you have the correct ID! ✅
4. If you get an error, double-check the ID

## Example: Complete Setup

Let's say your DICT_Results URL is:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
```

**Step 1**: Extract the ID
```
1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

**Step 2**: Add to `.env.local`
```env
GOOGLE_SHEETS_TARGET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

**Step 3**: Share with service account
```
dict-monitoring@glass-marker-492600-r2.iam.gserviceaccount.com (Editor)
```

**Step 4**: Restart server
```bash
npm run dev
```

**Step 5**: Test export
- Go to Dashboard
- Click "Export to Sheets"
- Should see success message
- DICT_Results opens with new data

## Troubleshooting

### Can't find DICT_Results spreadsheet?

1. Check Google Drive
2. Search for "DICT_Results"
3. If it doesn't exist, create a new Google Sheet and name it "DICT_Results"
4. Follow the steps above to get its ID

### URL looks different?

Some variations you might see:

**With sheet ID**:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=123456789
```
→ Still use the part between `/d/` and `/edit`

**With additional parameters**:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit?usp=sharing
```
→ Still use the part between `/d/` and `/edit`

**Mobile view**:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit?usp=drivesdk
```
→ Still use the part between `/d/` and `/edit`

### Still stuck?

The spreadsheet ID is **always** the long string between `/d/` and `/edit` in the URL. It's typically 44 characters long and contains letters, numbers, hyphens, and underscores.

## Quick Copy-Paste Method

1. Open DICT_Results
2. Click in the address bar (or press Ctrl+L / Cmd+L)
3. The entire URL is selected
4. Copy it
5. Paste into a text editor
6. Delete everything before `/d/` and after `/edit`
7. What's left is your spreadsheet ID

## Need Help?

If you're still having trouble:

1. Take a screenshot of your browser with DICT_Results open (showing the URL)
2. Check that the URL starts with `https://docs.google.com/spreadsheets/d/`
3. The ID is the very next part after `/d/`

---

**Next Steps**: Once you have the ID, continue with `DICT_RESULTS_SETUP.md` for complete setup instructions.
