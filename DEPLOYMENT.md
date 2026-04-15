# Deployment Guide for DICT R5 PMS

## Prerequisites

1. **Convex Account**: Make sure you have a Convex account and your project is deployed
2. **Netlify Account**: You need a Netlify account to deploy the frontend

## Step 1: Set Up Convex Deployment

### Option A: Deploy Convex First (Recommended)

1. Install Convex CLI globally (if not already installed):
   ```bash
   npm install -g convex
   ```

2. Login to Convex:
   ```bash
   npx convex login
   ```

3. Deploy your Convex backend:
   ```bash
   npx convex deploy
   ```

4. Note down your deployment URL (it will look like: `https://your-project.convex.cloud`)

## Step 2: Configure Netlify Environment Variables

In your Netlify dashboard, go to **Site settings > Environment variables** and add:

### Required Variables:

1. **CONVEX_DEPLOYMENT**
   - Value: Your Convex deployment URL (e.g., `https://your-project.convex.cloud`)
   - Used for: Server-side Convex operations during build

2. **NEXT_PUBLIC_CONVEX_URL**
   - Value: Same as CONVEX_DEPLOYMENT
   - Used for: Client-side Convex connection

3. **NEXTAUTH_SECRET**
   - Value: Generate a random secret (run: `openssl rand -base64 32`)
   - Used for: NextAuth session encryption

4. **NEXTAUTH_URL**
   - Value: Your Netlify site URL (e.g., `https://your-site.netlify.app`)
   - Used for: NextAuth callback URLs

### Optional Variables (if using these features):

5. **NEXT_PUBLIC_MAPBOX_TOKEN**
   - Value: Your Mapbox access token
   - Used for: Map visualization features

6. **GOOGLE_SERVICE_ACCOUNT_EMAIL**
   - Value: Your Google service account email
   - Used for: Google Sheets integration

7. **GOOGLE_PRIVATE_KEY**
   - Value: Your Google service account private key
   - Used for: Google Sheets integration

8. **GOOGLE_SHEET_ID**
   - Value: Your Google Sheet ID
   - Used for: Data export to Google Sheets

## Step 3: Deploy to Netlify

### Method 1: Connect GitHub Repository (Recommended)

1. Go to Netlify dashboard
2. Click "Add new site" > "Import an existing project"
3. Connect your GitHub repository
4. Netlify will auto-detect the `netlify.toml` configuration
5. Click "Deploy site"

### Method 2: Manual Deploy via CLI

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Deploy:
   ```bash
   netlify deploy --prod
   ```

## Step 4: Verify Deployment

After deployment completes:

1. ✅ Check that the site loads without errors
2. ✅ Verify Convex connection (check browser console for errors)
3. ✅ Test authentication (if using NextAuth)
4. ✅ Test map features (if using Mapbox)
5. ✅ Test data fetching from Convex

## Troubleshooting

### Build Fails with "Module not found: Can't resolve '@/convex/_generated/api'"

**Solution**: Make sure you've set the `CONVEX_DEPLOYMENT` environment variable in Netlify. The build script needs this to generate Convex types.

### "CONVEX_DEPLOYMENT environment variable not set"

**Solution**: Add `CONVEX_DEPLOYMENT` to your Netlify environment variables with your Convex deployment URL.

### Map not showing

**Solution**: Add `NEXT_PUBLIC_MAPBOX_TOKEN` to your environment variables.

### Google Sheets export not working

**Solution**: Ensure all Google service account variables are set correctly:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (make sure to preserve newlines)
- `GOOGLE_SHEET_ID`

### Authentication issues

**Solution**: 
1. Verify `NEXTAUTH_SECRET` is set
2. Verify `NEXTAUTH_URL` matches your deployed site URL
3. Check that your Convex auth configuration is correct

## Build Configuration

The project uses the following build configuration (defined in `netlify.toml`):

```toml
[build]
  command = "npm run build:netlify"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

The `build:netlify` script runs:
```bash
npx convex deploy --cmd 'npm run build'
```

This ensures Convex types are generated before Next.js builds.

## Local Development

To run locally:

1. Copy `.env.local.example` to `.env.local` (if exists)
2. Add your environment variables
3. Run Convex dev server:
   ```bash
   npm run convex:dev
   ```
4. In another terminal, run Next.js:
   ```bash
   npm run dev
   ```

## Production Checklist

Before deploying to production:

- [ ] All environment variables are set in Netlify
- [ ] Convex backend is deployed
- [ ] Database schema is up to date
- [ ] Authentication is configured
- [ ] API keys are valid and have proper permissions
- [ ] Test the build locally: `npm run build:netlify`
- [ ] Review security settings (CORS, API access, etc.)

## Support

For issues:
1. Check Netlify build logs
2. Check Convex dashboard for backend errors
3. Check browser console for client-side errors
4. Review this deployment guide

## Additional Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Netlify Documentation](https://docs.netlify.com/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
