-- TEMPORARY FIX: Completely disable RLS on notifications
-- This will allow you to see ALL notifications to verify that's the issue
-- We'll re-enable with proper policies after

-- Step 1: Disable RLS on notifications table completely
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

SELECT '=== RLS DISABLED on notifications ===' as status;
SELECT 'Check your app now. If you can see notifications, RLS was the issue.' as note;

-- Step 2: Now test - can you see your notifications?
SELECT '=== YOUR NOTIFICATIONS (RLS DISABLED) ===' as status;
SELECT COUNT(*) as your_notifications FROM notifications WHERE user_id = auth.uid();

SELECT '=== YOUR NOTIFICATION DETAILS ===' as status;
SELECT id, type, title, message, read, created_at
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: If you can see them, let us know and we'll fix the policies properly
-- To re-enable RLS later, run:
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
