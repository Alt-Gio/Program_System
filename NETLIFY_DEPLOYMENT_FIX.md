# 🚀 Netlify Deployment Fix - No Dashboard Access Required

## Problem
The build was failing because it tried to deploy Convex during the Netlify build, which requires a `CONVEX_DEPLOY_KEY` that you can't access.

## Solution Applied
I've configured the project to **commit the Convex generated files** to git, so Netlify doesn't need to generate them during build.

## What I Changed

### 1. ✅ Updated `.gitignore`
- **Removed** `convex/_generated/` from gitignore
- Now these files will be committed to your repository

### 2. ✅ Updated `netlify.toml`
- Changed build command from `npm run build:netlify` to `npm run build`
- No longer tries to run Convex deployment during Netlify build

### 3. ✅ Updated `package.json`
- Removed the `build:netlify` script that was causing issues
- Build now uses standard Next.js build process

## Steps to Deploy Successfully

### Step 1: Generate Convex Files Locally

Run this command on your local machine:

```bash
npm run convex:dev
```

This will generate the `convex/_generated/` folder with all necessary files.

**Keep this running** while you work locally, or press Ctrl+C after it generates the files.

### Step 2: Commit the Generated Files

```bash
git add convex/_generated/
git add .gitignore
git add netlify.toml
git add package.json
git commit -m "fix: commit Convex generated files for Netlify deployment"
git push
```

### Step 3: Set Required Environment Variables in Netlify

Go to Netlify Dashboard → **Site settings** → **Environment variables** and add:

**REQUIRED:**
```
NEXT_PUBLIC_CONVEX_URL = https://your-project.convex.cloud
```

To find your Convex URL:
1. Check your local `.env.local` file
2. Look for `NEXT_PUBLIC_CONVEX_URL`
3. Copy that value

**OPTIONAL (but recommended):**
```
NEXTAUTH_SECRET = (any random string, generate with: openssl rand -base64 32)
NEXTAUTH_URL = https://your-site.netlify.app
NEXT_PUBLIC_MAPBOX_TOKEN = (your Mapbox token if you have one)
```

### Step 4: Trigger Netlify Deploy

After committing and setting environment variables:
1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Clear cache and deploy site**

## ✅ This Should Work Now!

The build will succeed because:
- ✅ Convex generated files are already in your repo
- ✅ No Convex deployment happens during build
- ✅ Only Next.js build runs (which is fast and simple)

## Important Notes

### When to Regenerate Convex Files

You need to regenerate and commit the Convex files whenever you:
- ✏️ Change Convex schema (`convex/schema.ts`)
- ✏️ Add/modify Convex functions
- ✏️ Update Convex queries/mutations

**Process:**
1. Make your changes to Convex files
2. Run `npm run convex:dev` (or keep it running)
3. Commit the updated `convex/_generated/` files
4. Push to trigger Netlify rebuild

### Alternative: Get Dashboard Access

If you can get access to the Convex dashboard later, you can:
1. Get the `CONVEX_DEPLOY_KEY` from dashboard
2. Add it to Netlify environment variables
3. Revert these changes to use automatic deployment

But for now, this manual approach will work fine!

## Troubleshooting

### "Module not found: @/convex/_generated/api"
**Solution:** Make sure you've committed the `convex/_generated/` folder

### "NEXT_PUBLIC_CONVEX_URL is not defined"
**Solution:** Add the environment variable in Netlify settings

### Build succeeds but app doesn't work
**Solution:** Check that `NEXT_PUBLIC_CONVEX_URL` is set correctly and matches your actual Convex deployment

## Quick Command Reference

```bash
# Generate Convex files locally
npm run convex:dev

# Build locally to test
npm run build

# Commit generated files
git add convex/_generated/
git commit -m "update: Convex generated files"
git push

# Deploy Convex changes (when you have access)
npm run convex:deploy
```

---

**Need Help?** Check the build logs in Netlify for specific errors.
