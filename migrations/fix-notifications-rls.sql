-- Fix: Notifications RLS policies aren't allowing SELECT

-- Step 1: Check current RLS status
SELECT '=== RLS Status on notifications ===' as status;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notifications';

-- Step 2: Check all policies
SELECT '=== Current Policies on notifications ===' as status;
SELECT policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Step 3: Drop all problematic policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

SELECT '=== Policies dropped ===' as status;

-- Step 4: Disable RLS temporarily to verify
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

SELECT '=== RLS Disabled temporarily ===' as status;
SELECT 'If you can now see notifications in the UI, RLS was the issue.' as note;

-- Step 5: Re-enable with correct policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY for SELECT - Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- CREATE POLICY for UPDATE - Users can update their own notifications
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- CREATE POLICY for INSERT - System can create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Step 6: Test
SELECT '=== Testing - Can you see notifications now? ===' as status;
SELECT COUNT(*) as your_notifications FROM notifications WHERE user_id = auth.uid();
