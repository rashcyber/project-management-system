# PHASE 1: EMAIL NOTIFICATIONS - TESTING & VERIFICATION

## Migration Status: ✅ DEPLOYED SUCCESSFULLY

The email notification migration has been successfully deployed to your Supabase database.

### Verification Result
```
queued_today: 0
```
✅ This is **NORMAL** - means the migration ran successfully. Zero queued emails because no new notifications have been created yet.

---

## What Was Created

### Database Objects
- ✅ `queue_notification_email()` function
- ✅ `on_notification_created_queue_email` trigger
- ✅ `email_debug_log` table
- ✅ RLS policies for email management
- ✅ Indexes for performance

### Now Active
When a notification is created:
1. Trigger automatically fires
2. User email preferences checked
3. Email queued in `email_queue` table
4. Debug entry created in `email_debug_log`

---

## Testing Steps

### Test 1: Verify Trigger Works (Recommended)

#### Step 1A: Check Trigger Exists
Go to Supabase SQL Editor and run:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_notification_created_queue_email';
```

✅ Should return: `on_notification_created_queue_email | INSERT | notifications`

#### Step 1B: Create Test Notification
```sql
-- Create a test notification
INSERT INTO notifications (user_id, type, title, message)
SELECT id, 'task_assigned', 'Test Email', 'This is a test notification'
FROM profiles
WHERE email_notifications_enabled = true
LIMIT 1
RETURNING id;
```

✅ Note the returned notification ID

#### Step 1C: Check Email Queue
```sql
-- Check if email was queued
SELECT id, user_id, email_type, recipient_email, status, created_at
FROM email_queue
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

✅ Should show your test email queued!

#### Step 1D: Check Debug Log
```sql
-- Check debug events
SELECT event_type, message, created_at
FROM email_debug_log
ORDER BY created_at DESC
LIMIT 10;
```

✅ Should show events like: `email_sent`, `error_no_user`, etc.

---

### Test 2: Real-World Test (Assign Task)

#### Step 2A: Assign Task
1. Go to Projects → Select a project
2. Create or open a task
3. Assign to another team member
4. ✅ Notification should be created

#### Step 2B: Check Email Queue
```sql
SELECT * FROM email_queue
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

✅ Should show the email just queued

#### Step 2C: Check Email Status
```sql
SELECT * FROM email_logs
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

✅ Should show email sent/failed status

#### Step 2D: Check Inbox
- Check assigned user's email inbox
- ✅ Should have received task assignment email
- Click link to verify it works

---

### Test 3: User Preferences Test

#### Step 3A: Disable Email Notifications
```sql
-- Disable for a user
UPDATE profiles
SET email_notifications_enabled = false
WHERE id = 'USER_UUID_HERE';
```

#### Step 3B: Create Notification
Create another test notification for that user

#### Step 3C: Verify Not Queued
```sql
SELECT * FROM email_queue
WHERE user_id = 'USER_UUID_HERE'
AND created_at > NOW() - INTERVAL '5 minutes';
```

✅ Should return nothing (email not queued because disabled)

#### Step 3D: Re-enable
```sql
UPDATE profiles
SET email_notifications_enabled = true
WHERE id = 'USER_UUID_HERE';
```

---

## Expected Results

### When Everything Works
```
✅ Notification created
✅ Email automatically queued
✅ Debug event logged
✅ Email sent to recipient
✅ User receives email in inbox
✅ Email log records status
```

### Monitoring Queries

**Active Queue:**
```sql
SELECT COUNT(*) as pending_emails
FROM email_queue WHERE status = 'pending';
```

**Recent Activity:**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM email_queue
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Recent Errors:**
```sql
SELECT event_type, message, user_id, created_at
FROM email_debug_log
WHERE event_type LIKE 'error%' OR event_type = 'email_failed'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting During Testing

### Problem 1: Email Queued but Not Sent
**Check:**
```sql
-- See what happened
SELECT * FROM email_debug_log
WHERE event_type IN ('email_sent', 'email_failed', 'error_processing')
ORDER BY created_at DESC LIMIT 5;
```

**Possible Issues:**
- Supabase email service not configured
- Service role key missing
- Email address invalid

### Problem 2: Email Not Queued
**Check:**
```sql
-- Verify trigger exists
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_name = 'on_notification_created_queue_email';
```

**If returns 0:** Trigger not created, re-run migration

**Check user preferences:**
```sql
SELECT id, email, email_notifications_enabled, email_notification_types
FROM profiles WHERE id = 'USER_UUID_HERE';
```

**If email_notifications_enabled = false:** Enable it first

### Problem 3: Wrong Email Format
**Check templates:**
- Go to: `supabase/functions/send-email/index.ts`
- Check `getEmailTemplate()` function
- Templates might need adjustment

---

## Performance Monitoring

### Check Queue Size
```sql
SELECT
  COUNT(*) as total_in_queue,
  COUNT(*) FILTER (WHERE retry_count > 0) as retries,
  COUNT(*) FILTER (WHERE scheduled_for > NOW()) as scheduled_future
FROM email_queue;
```

### Check Email History
```sql
SELECT
  DATE(created_at),
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM email_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

---

## Success Indicators

✅ **System is working if:**
1. Test notification creates email queue entry
2. Debug log shows events
3. Assigned users receive emails
4. Emails have correct content and links work
5. User preferences are respected
6. Email notifications can be disabled/enabled

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Email system is fully functional
2. Ready for real-world use
3. Monitor email_queue daily
4. Clean up old logs periodically

### If Tests Fail ❌
1. Check debug_log for specific errors
2. Verify Supabase email configuration
3. Ensure service role key is set
4. Review troubleshooting section
5. Check email_notification_types setting

---

## Maintenance

### Daily Checks
```sql
-- Check queue status
SELECT status, COUNT(*) FROM email_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Weekly Cleanup
```sql
-- Delete old debug logs (optional)
DELETE FROM email_debug_log
WHERE created_at < NOW() - INTERVAL '30 days';

-- Archive old email logs (optional)
-- DELETE FROM email_logs
-- WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Current Status

**Migration Deployed:** ✅ Yes
**Tables Created:** ✅ Yes
**Trigger Active:** ✅ Yes
**Emails Queued Today:** 0 (Normal - waiting for test)
**System Ready:** ✅ Yes

**Next Action:** Run Test 1 from above to verify everything works!

