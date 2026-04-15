# 🚀 Deploy to Netlify NOW - Simple Steps

## ✅ Latest Fix Applied (Build-Time Validation Issue)

**Fixed:** All API routes that were initializing ConvexHttpClient at module scope (causing build-time validation errors) have been updated to initialize the client inside the request handlers.

**Files Fixed:**
- ✅ `app/api/intern-sheets-sync/route.ts`
- ✅ `app/api/sheets-sync/route.ts`
- ✅ `app/api/looker-export/route.ts`
- ✅ `app/api/export-to-sheets/route.ts`

## What I Fixed Previously
✅ Removed Convex deployment from build process  
✅ Updated netlify.toml to use simple build  
✅ Removed build:netlify script  
✅ Convex generated files will be committed to git  

## Do These 3 Steps:

### Step 1: Commit and Push Changes

```bash
git add .
git commit -m "fix: configure for Netlify deployment without Convex deploy key"
git push
```

This will commit:
- Updated `netlify.toml` (simple build command)
- Updated `package.json` (removed build:netlify)
- Convex generated files (already exist in `convex/_generated/`)

### Step 2: Set Environment Variable in Netlify

1. Go to Netlify Dashboard
2. Click on your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add this:

```
Name: NEXT_PUBLIC_CONVEX_URL
Value: (copy from your .env.local file)
```

To find the value:
- Open `.env.local` in your project
- Copy the value of `NEXT_PUBLIC_CONVEX_URL`
- It looks like: `https://something.convex.cloud`

### Step 3: Deploy

1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Deploy site**

## ✅ Done!

Your site should build successfully now!

---

## Optional: Add More Environment Variables Later

If you need these features, add these variables:

**For Maps:**
```
NEXT_PUBLIC_MAPBOX_TOKEN = your_mapbox_token
```

**For Authentication:**
```
NEXTAUTH_SECRET = (run: openssl rand -base64 32)
NEXTAUTH_URL = https://your-site.netlify.app
```

**For Google Sheets:**
```
GOOGLE_SERVICE_ACCOUNT_EMAIL = your_email
GOOGLE_PRIVATE_KEY = your_key
GOOGLE_SHEET_ID = your_sheet_id
```

---

## When You Update Convex Functions

If you change any Convex files (schema, queries, mutations):

1. Make sure `npm run convex:dev` is running locally
2. It will auto-generate new files in `convex/_generated/`
3. Commit and push those changes
4. Netlify will rebuild automatically

---

## Need Help?

If build still fails:
1. Check Netlify build logs
2. Make sure `NEXT_PUBLIC_CONVEX_URL` is set
3. Make sure you pushed all changes including `convex/_generated/`
