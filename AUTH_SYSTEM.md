# Authentication System

## Overview

The DICT Region V Program Management System now has a complete authentication system with role-based access control.

## Features

### 1. **Sign In / Sign Up Pages**
- Beautiful, modern UI with gradient backgrounds
- Password strength indicator
- Email validation
- Automatic redirect after login
- First user becomes admin automatically

### 2. **Route Protection**
- **Public routes**: `/` (landing page), `/signin`, `/signup`
- **Protected routes**: All other routes require authentication
- Middleware automatically redirects unauthenticated users to sign-in page
- Callback URL preserved for post-login redirect

### 3. **User Roles**
- **Admin**: Full access, can manage Google Sheets sync
- **User**: Can view and edit data
- **Viewer**: Read-only access (future implementation)

### 4. **Session Management**
- 30-day session duration
- Token stored in cookies and localStorage
- Automatic session cleanup for expired tokens
- Logout clears all session data

## Usage

### First Time Setup

1. **Start the app**: `npm run dev`
2. **Navigate to**: `http://localhost:3000`
3. **Click "Sign up"** or go to `/signup`
4. **Create first account** - automatically becomes admin
5. **Login** and access protected routes

### Sign In

- Go to `/signin`
- Enter email and password
- Redirects to dashboard or callback URL

### Sign Up

- Go to `/signup`
- Enter full name, email, and password
- Password must be at least 6 characters
- First user automatically gets admin role

### Logout

- Click the logout button in the header (top-right)
- Clears session and redirects to sign-in page

## Google Sheets Sync

The Google Sheets sync feature (in Settings) uses **NextAuth with Google OAuth**. This is separate from the main authentication system:

- Users must sign in with their **Google account** to sync sheets
- The `googleEmail` field in the user profile can be set by admins
- Only users with matching Google email can perform admin actions

## Database Schema

### Users Table
```typescript
{
  email: string,
  passwordHash: string,
  fullName: string,
  role: "admin" | "user" | "viewer",
  googleEmail?: string,  // For Google Sheets sync
  isActive: boolean,
  createdAt: number,
  lastLoginAt?: number,
}
```

### Sessions Table
```typescript
{
  userId: Id<"users">,
  token: string,
  expiresAt: number,
  createdAt: number,
}
```

## API Endpoints

### Convex Mutations

- `api.auth.register({ fullName, email, password })` - Register new user
- `api.auth.login({ email, password })` - Login user
- `api.auth.logout({ token })` - Logout user
- `api.auth.updateGoogleEmail({ token, userId, googleEmail })` - Admin only

### Convex Queries

- `api.auth.getCurrentUser({ token })` - Get current user info
- `api.auth.isAdmin({ token })` - Check if user is admin

## Security Notes

⚠️ **Important**: The current password hashing uses Base64 encoding, which is **NOT secure for production**. 

For production deployment:
1. Install `bcrypt`: `npm install bcrypt @types/bcrypt`
2. Replace the `hashPassword` function in `convex/auth.ts` with bcrypt
3. Use environment variables for sensitive data
4. Enable HTTPS in production

## File Structure

```
app/
  (auth)/
    signin/page.tsx       # Sign-in page
    signup/page.tsx       # Sign-up page
  (main)/                 # Protected routes
    dashboard/
    activities/
    interns/
    ...

convex/
  auth.ts                 # Auth mutations and queries
  schema.ts               # Users and sessions tables

middleware.ts             # Route protection

components/
  layout/
    Header.tsx            # User menu and logout button
```

## Troubleshooting

### "Not authenticated" error
- Check if `auth_token` cookie exists
- Try logging out and logging in again
- Clear browser cookies and localStorage

### Redirect loop
- Check middleware.ts PUBLIC_ROUTES array
- Ensure cookies are being set correctly
- Check browser console for errors

### Google Sheets sync not working
- This uses separate NextAuth Google OAuth
- Sign in with Google account in Settings
- Check `.env.local` for Google OAuth credentials

## Future Enhancements

- [ ] Password reset functionality
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] User management page for admins
- [ ] Activity logs
- [ ] Role-based permissions per feature
- [ ] Viewer role implementation
