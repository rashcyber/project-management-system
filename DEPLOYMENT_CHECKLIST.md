# Deployment Verification Checklist

## Current Deployment Info
- **New Vercel URL**: https://project-management-system-ten-eta.vercel.app
- **Supabase Project**: ccwxkfmrwxmwonmajwoy
- **Old URL (deprecated)**: https://project-management-system-six-tau.vercel.app

## Pre-Launch Checklist

### ✅ Environment Configuration
- [ ] `.env` file updated with new Vercel URL
- [ ] `VITE_APP_URL=https://project-management-system-ten-eta.vercel.app`
- [ ] Build successful (npm run build)
- [ ] No build errors or warnings

### ✅ Supabase Configuration
- [ ] Go to https://app.supabase.com
- [ ] Select project: ccwxkfmrwxmwonmajwoy
- [ ] Navigate: Authentication → URL Configuration
- [ ] Redirect URLs updated with NEW domain (project-management-system-ten-eta)
- [ ] OLD domain (project-management-system-six-tau) REMOVED
- [ ] Changes SAVED (click Save button)
- [ ] Wait 2-3 minutes for changes to propagate

### ✅ Vercel Deployment
- [ ] Go to https://vercel.com/dashboard
- [ ] Find project: project-management-system-ten-eta
- [ ] Deployment status: ✅ Ready (green)
- [ ] Not showing: Building, Error, or Canceled

### ✅ Browser Verification
- [ ] Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- [ ] Visit: https://project-management-system-ten-eta.vercel.app
- [ ] Page loads (not 404 error)
- [ ] Try login - should redirect to dashboard

### ✅ Feature Verification
- [ ] Time Tracking visible with delete buttons
- [ ] Task Dependencies section appears
- [ ] Email Notifications in Settings
- [ ] Recurrence Settings for tasks
- [ ] All styling looks professional

## If You Still Get 404 Error

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Check Authentication → URL Configuration**
3. **Verify these exact URLs are present:**
   ```
   https://project-management-system-ten-eta.vercel.app/
   https://project-management-system-ten-eta.vercel.app/auth/callback
   https://project-management-system-ten-eta.vercel.app/dashboard
   ```
4. **Check these are NOT present:**
   ```
   https://project-management-system-six-tau.vercel.app/
   https://project-management-system-six-tau.vercel.app/auth/callback
   ```
5. **Click Save**
6. **Wait 2-3 minutes**
7. **Hard refresh browser again**

## Important Notes

⚠️ **DO NOT delete Vercel project again** - This changes the URL
⚠️ **Keep using same Vercel project** - Just push new code to GitHub
⚠️ **Cache is tricky** - Always hard refresh when testing
✅ **Production deployment** - Keep the same Vercel project forever

