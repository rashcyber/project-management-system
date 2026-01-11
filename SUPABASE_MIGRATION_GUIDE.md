# Supabase Migration Guide - Run These 3 Times

This guide will walk you through running the 3 database migrations needed to activate the new features.

## 📋 Overview

You need to run **3 migration files** in Supabase SQL Editor to add:
1. **Time Tracking** - Track estimated and actual hours on tasks
2. **Recurring Tasks** - Set up tasks to repeat on a schedule
3. **Email Notifications** - Configure email notification preferences

## 🚀 Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### Step 2: Run Migration #1 - Time Tracking

1. Copy all the SQL code from this file: `migrations/add-time-tracking.sql`
2. Paste it into the Supabase SQL Editor
3. Click the **"Run"** button (or press Cmd/Ctrl + Enter)
4. Wait for completion - you should see a green checkmark ✅
5. Verify success in the notification at the bottom

**What this migration creates:**
- `estimated_hours` column on tasks table
- `actual_hours` column on tasks table
- `time_entries` table (new table for time logs)
- RLS policies for time_entries
- Indexes for performance

---

### Step 3: Run Migration #2 - Recurring Tasks

1. Click **"New query"** button again
2. Copy all the SQL code from this file: `migrations/add-recurring-tasks.sql`
3. Paste it into the Supabase SQL Editor
4. Click the **"Run"** button
5. Wait for completion - you should see a green checkmark ✅

**What this migration creates:**
- `is_recurring` column on tasks table
- `recurrence_pattern` column on tasks table
- `recurrence_start_date` column on tasks table
- `recurrence_end_date` column on tasks table
- `recurring_task_instances` table (new table for recurring instances)
- RLS policies for recurring_task_instances
- Indexes for performance

---

### Step 4: Run Migration #3 - Email Notifications

1. Click **"New query"** button again
2. Copy all the SQL code from this file: `migrations/add-email-notifications.sql`
3. Paste it into the Supabase SQL Editor
4. Click the **"Run"** button
5. Wait for completion - you should see a green checkmark ✅

**What this migration creates:**
- `email_notification_preferences` column on profiles table
- `email_notification_types` column on profiles table
- `email_digest_frequency` column on profiles table
- `email_logs` table (new table for email tracking)
- `email_queue` table (new table for pending emails)
- RLS policies for email_logs and email_queue
- Indexes for performance

---

## ✅ Verification Checklist

After running all 3 migrations, verify they worked:

### In Supabase Dashboard:

1. **Go to Tables section** (left sidebar → Tables)
2. Verify these NEW tables exist:
   - [ ] `time_entries` table (for time tracking)
   - [ ] `recurring_task_instances` table (for recurring tasks)
   - [ ] `email_logs` table (for email tracking)
   - [ ] `email_queue` table (for pending emails)

3. **Go to tasks table** and verify these new columns exist:
   - [ ] `estimated_hours` (decimal)
   - [ ] `actual_hours` (decimal)
   - [ ] `is_recurring` (boolean)
   - [ ] `recurrence_pattern` (text)
   - [ ] `recurrence_start_date` (date)
   - [ ] `recurrence_end_date` (date)

4. **Go to profiles table** and verify these new columns exist:
   - [ ] `email_notification_preferences` (jsonb)
   - [ ] `email_notification_types` (jsonb)
   - [ ] `email_digest_frequency` (text)

---

## 🔍 Troubleshooting

### Error: "Relation 'tasks' does not exist"

**Solution**: Make sure you're running the migrations in order (Time Tracking → Recurring Tasks → Email Notifications)

### Error: "Column already exists"

**Solution**: The migration may have already been run. This is fine - skip to the next migration.

### Error: "Function uuid_generate_v4 does not exist"

**Solution**: This is unlikely but means your Supabase project doesn't have the UUID extension. Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Can't see new columns

**Solution**:
1. Refresh your browser (F5)
2. Close and reopen the Tables section
3. Click on the `tasks` table again

---

## 📝 What Happens Next

After migrations are complete, you'll need to:

1. **Integrate Components into UI** (see INTEGRATION_POINTS.md)
   - Add TimeTracker to TaskDetail
   - Add EmailNotificationSettings to ProjectSettings
   - Add RecurrenceSettings to TaskForm

2. **Test the Features**
   - Create time entries
   - Set up recurring tasks
   - Configure email notifications

---

## ❓ Need Help?

If you encounter issues:

1. Check the error message carefully
2. Review the troubleshooting section above
3. Make sure you're using the correct Supabase project
4. Verify you have admin access to the project
5. Try running the migration again (it's idempotent - safe to rerun)

---

## 🎯 Next Steps

Once all 3 migrations are complete:

1. Read `INTEGRATION_POINTS.md` for component integration locations
2. Follow the integration steps to add components to existing pages
3. Test all 3 features end-to-end
4. Deploy the updated app

**Estimated time for migrations**: ~5 minutes
**Status**: After this step, all database schema changes will be complete ✅

---

**Last updated**: January 11, 2026
**Total migrations**: 3
**Complexity**: Low (copy-paste SQL into Supabase)
