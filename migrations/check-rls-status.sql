-- Check RLS status on notifications table

SELECT '=== RLS STATUS ===' as status;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notifications';

-- If RLS is off, you need to re-enable it
-- Run this if RLS is false (disabled):
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

SELECT '=== CURRENT POLICIES ===' as status;
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Check if you can see your notifications
SELECT '=== CAN YOU SEE YOUR NOTIFICATIONS ===' as status;
SELECT COUNT(*) as count FROM notifications WHERE user_id = auth.uid();
