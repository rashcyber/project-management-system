# Deployment Guide for Vercel

This guide will help you deploy your Task Management App to Vercel and configure it properly for production use.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Supabase project with authentication configured
3. Your app repository pushed to GitHub, GitLab, or Bitbucket

## Step 1: Deploy to Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Configure your project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

## Step 2: Configure Environment Variables

In your Vercel project settings, add the following environment variables:

### Required Variables

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_URL=https://your-app-name.vercel.app
```

**Important:**
- Get `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project dashboard (Settings > API)
- Set `VITE_APP_URL` to your actual Vercel deployment URL (e.g., `https://task-app.vercel.app`)
- This is **critical** for password reset emails to work correctly!

### How to Add Environment Variables in Vercel:

1. Go to your project dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar
4. Add each variable:
   - Enter the variable name (e.g., `VITE_SUPABASE_URL`)
   - Enter the value
   - Select which environments (Production, Preview, Development)
   - Click "Save"

## Step 3: Configure Supabase Authentication

### Update Supabase Site URL

1. Go to your Supabase project dashboard
2. Navigate to Authentication > URL Configuration
3. Set the **Site URL** to your Vercel deployment URL:
   ```
   https://your-app-name.vercel.app
   ```

### Configure Redirect URLs

In the same URL Configuration section, add these redirect URLs:

```
https://your-app-name.vercel.app/reset-password
https://your-app-name.vercel.app/**
```

This allows password reset emails and authentication redirects to work properly.

### Email Templates

Optionally, customize your email templates in Supabase:
1. Go to Authentication > Email Templates
2. Update the "Reset Password" template to ensure it uses your production URL
3. The `{{ .ConfirmationURL }}` variable will automatically use the correct redirect URL you configured

## Step 4: Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Visit your deployed app URL

## Step 5: Test Password Reset Flow

1. Invite a user from your deployed app (Admin > Users)
2. Check that the user receives an email
3. Click the password reset link in the email
4. Verify it redirects to your production URL (not localhost)
5. Complete the password reset process

## Troubleshooting

### Password Reset Links Go to Localhost

**Problem:** Invited users receive reset links pointing to `http://localhost:5173`

**Solution:**
- Ensure `VITE_APP_URL` is set correctly in Vercel environment variables
- Redeploy the app after adding the environment variable
- Clear your browser cache

### Email Not Received

**Problem:** Users don't receive invitation emails

**Solution:**
- Check Supabase email settings (Authentication > Email Settings)
- Verify email rate limits haven't been exceeded
- Check spam folder
- Consider setting up a custom SMTP provider in Supabase

### Authentication Redirect Issues

**Problem:** After login, users are redirected to an error page

**Solution:**
- Verify all redirect URLs are added in Supabase
- Check that your Site URL in Supabase matches your deployment URL
- Ensure there are no trailing slashes in URLs

### Build Fails

**Problem:** Vercel build fails during deployment

**Solution:**
- Check build logs for specific errors
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility
- Try building locally with `npm run build` to catch errors early

## Local Development

When developing locally, use these environment variables in your `.env` file:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_URL=http://localhost:5173
```

## Updating After Deployment

After each update:

1. Push your changes to your Git repository
2. Vercel will automatically trigger a new deployment
3. Monitor the build process
4. Test the deployed version

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Need Help?

If you encounter issues:
1. Check the Vercel deployment logs
2. Check browser console for errors
3. Verify Supabase configuration
4. Review environment variables
