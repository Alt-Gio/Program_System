# 🔍 Google Sync Diagnostic Guide

## ✅ Your Configuration Status

Based on the check, here's what's confirmed:

- ✅ **GOOGLE_CLIENT_ID** is set
- ✅ **GOOGLE_CLIENT_SECRET** is set  
- ✅ **NEXTAUTH_URL** is set to `http://localhost:3000`
- ✅ **App is running** on port 3000
- ✅ **SessionProvider** is configured in `app/providers.tsx`
- ✅ **NextAuth route** exists at `/api/auth/[...nextauth]`

---

## 🔍 **Diagnostic Steps**

Since your credentials are configured, let's diagnose the actual issue:

### **Step 1: Check Google Cloud Console Redirect URIs**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Check **Authorized redirect URIs** section

**Required URI:**
```
http://localhost:3000/api/auth/callback/google
```

**Common mistakes:**
- ❌ `http://localhost:3000/api/auth/callback` (missing `/google`)
- ❌ `http://localhost:3000/callback/google` (wrong path)
- ❌ `https://localhost:3000/api/auth/callback/google` (https instead of http)
- ❌ `http://127.0.0.1:3000/api/auth/callback/google` (IP instead of localhost)

**If it's wrong:**
- Add the correct URI
- Click **SAVE**
- Wait 5 minutes for changes to propagate
- Try connecting again

---

### **Step 2: Test the OAuth Flow**

1. Open your browser
2. Go to `http://localhost:3000/settings`
3. Open **Developer Tools** (F12)
4. Go to **Console** tab
5. Click **"Connect with Google"** button

**What should happen:**
1. Redirects to Google sign-in page
2. You sign in with your Google account
3. Google asks for permissions
4. Redirects back to `http://localhost:3000/settings`
5. Shows your account connected

**If it fails, check Console for errors:**

**Error: "Redirect URI mismatch"**
- Fix the redirect URI in Google Cloud Console (see Step 1)

**Error: "Invalid client"**
- Check `GOOGLE_CLIENT_ID` in `.env.local` matches Google Cloud Console
- Restart dev server: `npm run dev`

**Error: "Access denied"**
- Check OAuth consent screen scopes include `spreadsheets.readonly`

**No error but not connected:**
- Check **Network** tab in DevTools
- Look for failed requests to `/api/auth/callback/google`
- Check **Application** tab → **Cookies** → Make sure cookies are enabled

---

### **Step 3: Check Browser Console**

Open DevTools Console and look for errors like:

```
Failed to load resource: the server responded with a status of 401
```
or
```
next-auth] JWT_SESSION_ERROR
```
or
```
[next-auth] NO_SECRET
```

**If you see these errors:**

**JWT_SESSION_ERROR:**
- Check `NEXTAUTH_SECRET` is set in `.env.local`
- Generate a new secret: `openssl rand -base64 32`
- Restart dev server

**NO_SECRET:**
- Add `NEXTAUTH_SECRET` to `.env.local`
- Restart dev server

---

### **Step 4: Check Network Tab**

1. Open DevTools → **Network** tab
2. Click **"Connect with Google"**
3. Watch the network requests

**Expected flow:**
```
1. GET /api/auth/signin/google
2. Redirect to accounts.google.com
3. User signs in
4. Redirect to /api/auth/callback/google?code=...
5. POST /api/auth/session
6. Page reloads, session established
```

**If step 4 fails (404 or 500):**
- Check redirect URI in Google Cloud Console
- Check NextAuth route exists at `/api/auth/[...nextauth]/route.ts`

**If step 5 fails:**
- Session not being created
- Check `NEXTAUTH_SECRET` is set
- Clear browser cookies and try again

---

### **Step 5: Test Session Manually**

Open browser console and run:

```javascript
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log)
```

**Expected output if signed in:**
```json
{
  "user": {
    "name": "Your Name",
    "email": "your.email@gmail.com",
    "image": "https://..."
  },
  "expires": "2026-05-14T..."
}
```

**If output is `{}`:**
- Session is not established
- Try signing in again
- Check cookies are enabled
- Check `NEXTAUTH_SECRET` is set

---

### **Step 6: Check Environment Variables**

Run this in your terminal:

```powershell
Get-Content .env.local
```

**Verify you have:**
```env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXTAUTH_SECRET=... (32+ characters)
NEXTAUTH_URL=http://localhost:3000
```

**If any are missing:**
- Add them to `.env.local`
- Restart dev server: `npm run dev`

---

### **Step 7: Clear Cache and Cookies**

Sometimes old sessions interfere:

1. Open DevTools → **Application** tab
2. **Storage** → **Clear site data**
3. Check all boxes
4. Click **Clear site data**
5. Reload page
6. Try connecting again

---

### **Step 8: Check OAuth Consent Screen**

1. Go to Google Cloud Console
2. **APIs & Services** → **OAuth consent screen**
3. Check **Scopes** section

**Required scope:**
```
https://www.googleapis.com/auth/spreadsheets.readonly
```

**If missing:**
1. Click **EDIT APP**
2. Click **ADD OR REMOVE SCOPES**
3. Search for "Google Sheets API"
4. Check `.../auth/spreadsheets.readonly`
5. Click **UPDATE**
6. Click **SAVE AND CONTINUE**

---

## 🔧 **Quick Fixes**

### **Fix 1: Restart Everything**

```bash
# Stop dev server (Ctrl+C)
npm run dev
```

Then:
1. Clear browser cache/cookies
2. Go to Settings
3. Try connecting again

### **Fix 2: Regenerate NEXTAUTH_SECRET**

```bash
openssl rand -base64 32
```

Copy output to `.env.local`:
```env
NEXTAUTH_SECRET=<paste-here>
```

Restart dev server.

### **Fix 3: Verify Redirect URI**

Google Cloud Console → Credentials → OAuth Client:

**Add this exact URI:**
```
http://localhost:3000/api/auth/callback/google
```

Save and wait 5 minutes.

### **Fix 4: Test with Incognito**

1. Open incognito/private window
2. Go to `http://localhost:3000/settings`
3. Try connecting

If it works in incognito:
- Clear cookies in normal browser
- Try again

---

## 🐛 **Common Issues & Solutions**

### **Issue: Button does nothing**

**Check:**
1. Browser console for JavaScript errors
2. Network tab for failed requests
3. Button onClick handler is working

**Solution:**
- Hard refresh: Ctrl+Shift+R
- Clear cache
- Check if JavaScript is enabled

### **Issue: Redirects to Google but comes back not connected**

**Check:**
1. Network tab → Look for `/api/auth/callback/google`
2. Check response status (should be 302 redirect)
3. Check cookies are being set

**Solution:**
- Check redirect URI in Google Cloud Console
- Enable third-party cookies
- Check `NEXTAUTH_SECRET` is set

### **Issue: "Error: Configuration" message**

**Check:**
- `.env.local` has all required variables
- No typos in variable names
- No extra spaces in values

**Solution:**
- Double-check `.env.local` format
- Restart dev server
- Check terminal for errors

### **Issue: Works once, then stops**

**Check:**
- Token expiration
- Refresh token not being saved

**Solution:**
- Disconnect and reconnect
- Check `authorization.params.access_type: "offline"` in `lib/auth.ts`
- Check `prompt: "consent"` is set

---

## 📊 **Expected Behavior**

### **Before Connecting:**
```
Settings Page:
┌─────────────────────────────────────┐
│ ⚠ Google account not connected      │
│ You need to sign in to sync data... │
│ [Connect with Google]               │
└─────────────────────────────────────┘
```

### **After Connecting:**
```
Settings Page:
┌─────────────────────────────────────┐
│ ✅ Your Name                         │
│    your.email@gmail.com             │
│    [Sign out]                       │
└─────────────────────────────────────┘

Google Sheet Connections:
┌─────────────────────────────────────┐
│ eGovPH                              │
│ No sheet connected                  │
│ [Expand to connect]                 │
└─────────────────────────────────────┘
```

---

## 🎯 **Next Steps After Connecting**

Once connected, you should be able to:

1. **Detect Tabs** - Click to find sheet tabs
2. **Connect Sheet** - Link Google Sheet to program
3. **Sync** - Import data from sheet
4. **Sync All** - Import from all connected sheets

---

## 🆘 **Still Not Working?**

If you've tried everything above and it still doesn't work:

### **Check Server Logs**

Look at your terminal where `npm run dev` is running for errors like:

```
[next-auth][error][JWT_SESSION_ERROR]
[next-auth][error][NO_SECRET]
[next-auth][error][OAUTH_CALLBACK_ERROR]
```

### **Enable Debug Mode**

Add to `.env.local`:
```env
NEXTAUTH_DEBUG=true
```

Restart server and check terminal for detailed logs.

### **Test OAuth Flow Manually**

Visit:
```
http://localhost:3000/api/auth/signin/google
```

This should redirect to Google. If it doesn't:
- NextAuth is not configured correctly
- Check `/api/auth/[...nextauth]/route.ts` exists
- Check `lib/auth.ts` exports `authOptions`

---

## 📝 **Checklist**

Before asking for help, verify:

- [ ] `.env.local` has `GOOGLE_CLIENT_ID`
- [ ] `.env.local` has `GOOGLE_CLIENT_SECRET`
- [ ] `.env.local` has `NEXTAUTH_SECRET` (32+ chars)
- [ ] `.env.local` has `NEXTAUTH_URL=http://localhost:3000`
- [ ] Dev server restarted after changing `.env.local`
- [ ] Google Cloud Console redirect URI is exact: `http://localhost:3000/api/auth/callback/google`
- [ ] OAuth consent screen has `spreadsheets.readonly` scope
- [ ] Browser cookies are enabled
- [ ] Tried in incognito mode
- [ ] Cleared browser cache/cookies
- [ ] Checked browser console for errors
- [ ] Checked network tab for failed requests

---

## 💡 **Most Likely Causes**

Based on common issues, the problem is usually:

1. **Redirect URI mismatch** (90% of cases)
   - Fix in Google Cloud Console

2. **Missing NEXTAUTH_SECRET** (5% of cases)
   - Add to `.env.local`

3. **Browser blocking cookies** (3% of cases)
   - Enable cookies or use incognito

4. **Cached old session** (2% of cases)
   - Clear cache and cookies

**Try these first before diving deeper!** 🚀
