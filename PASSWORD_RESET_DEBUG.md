# Password Reset Debugging Guide

## Current Status

The password reset **WAS working** but is now broken. The email links are redirecting to `http://localhost:3000` instead of the production URL.

## Root Cause

**This is a Supabase configuration issue, NOT a code issue.**

The problem is in your Supabase dashboard settings. Even though your code sends the correct redirect URL, Supabase has a hardcoded URL that overrides it.

## Evidence

From your test, the password reset email link is:
```
http://localhost:3000/#access_token=eyJhbGci...&type=recovery
```

This URL is coming from **Supabase's dashboard configuration**, not from your application code.

## How to Fix

### Step 1: Check Supabase Dashboard Settings

1. Go to: https://supabase.com/dashboard/project/zjnphtvoytquthuosggi/auth/url-configuration

2. Look for these settings:
   - **Site URL**: This should be `https://www.playapexpadel.com`
   - **Redirect URLs**: This should include:
     - `https://www.playapexpadel.com/**`
     - `http://localhost:5173/**`
     - `http://localhost:5174/**`

3. If you see `http://localhost:3000` anywhere, that's the problem.

### Step 2: Update the Configuration

**Site URL** (set to):
```
https://www.playapexpadel.com
```

**Redirect URLs** (add these):
```
https://www.playapexpadel.com/**
http://localhost:5173/**
http://localhost:5174/**
```

**Remove** any references to `http://localhost:3000`

### Step 3: Test the Fix

After updating Supabase:

1. Go to production: https://www.playapexpadel.com/forgot-password
2. Request a password reset with your email
3. Check the email - the link should now say `https://www.playapexpadel.com/reset-password#...`
4. Click the link
5. You should see the password reset form
6. Open browser console (F12) - you should see logs with emojis (🔐, 📍, etc.)

## Alternative: Temporary Email Template Fix

If you can't access the URL Configuration, you can try modifying the email template:

1. Go to: https://supabase.com/dashboard/project/zjnphtvoytquthuosggi/auth/templates
2. Find the "Reset Password" email template
3. Look for the reset link - it might have a hardcoded URL
4. Change any `localhost:3000` references to `{{ .SiteURL }}`

## Why This Happened

The commit `eb3ac2e` tried to "fix" the password reset by using an environment variable, but:

1. The `.env` file is in `.gitignore` (not deployed)
2. The real issue was always in Supabase's dashboard configuration
3. The code change didn't solve the actual problem

I've now reverted the code to use `window.location.origin` (the original working version), which will:
- In production: Use `https://www.playapexpadel.com`
- In local dev: Use `http://localhost:5174`

But this only tells Supabase what URL you WANT. Supabase will only accept it if that URL is in the allowed list in the dashboard.

## Debugging Steps

If it's still not working after updating Supabase:

1. **Check browser console** - You should see these logs:
   ```
   🔐 AuthListener mounted
   📍 Current URL: [should show the full URL]
   🔗 Hash: [should show #access_token=... if recovery link]
   ```

2. **If you see NO logs**:
   - The page isn't loading at all
   - You're on the wrong URL/port
   - Check that the email link goes to the correct domain

3. **If you see logs but no recovery token**:
   - The hash should contain `type=recovery`
   - If it doesn't, Supabase didn't process the reset request correctly

4. **Test in local dev**:
   - Go to `http://localhost:5174/forgot-password`
   - Request reset
   - Email should go to `http://localhost:5174/reset-password#...`
   - If it goes to `localhost:3000`, Supabase redirect URLs are still wrong

## Contact Supabase Support

If you've updated the configuration and it's still broken, you may need to contact Supabase support. Sometimes there are caching issues or the settings don't take effect immediately.

Tell them:
- Password reset emails are redirecting to `http://localhost:3000`
- You've updated the Site URL and Redirect URLs
- The links should go to `https://www.playapexpadel.com`

## Quick Test

To verify your Supabase configuration without waiting for emails:

1. Open browser console on your production site
2. Run this:
```javascript
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'test@example.com',
  { redirectTo: 'https://www.playapexpadel.com/reset-password' }
);
console.log('Result:', { data, error });
```

3. Check the email that gets sent - does it have the correct URL?
4. If not, the Supabase configuration is still wrong
