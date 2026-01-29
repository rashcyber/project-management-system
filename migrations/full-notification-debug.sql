-- Complete notification debug

-- 1. RLS Status
SELECT '=== 1. RLS STATUS ===' as section;
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'notifications';

-- 2. Policies
SELECT '=== 2. POLICIES ===' as section;
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'notifications';

-- 3. Total notifications in DB
SELECT '=== 3. TOTAL NOTIFICATIONS ===' as section;
SELECT COUNT(*) as total FROM notifications;

-- 4. Your user ID
SELECT '=== 4. YOUR USER ID ===' as section;
SELECT auth.uid()::text as your_id;

-- 5. Notifications for YOUR user ID (hardcoded)
SELECT '=== 5. NOTIFICATIONS FOR YOUR USER ID ===' as section;
SELECT COUNT(*) as your_notifications FROM notifications WHERE user_id = '8f71db61-32e5-4d1f-80c8-180f2a613f61';

-- 6. Show recent notifications from last 2 hours
SELECT '=== 6. RECENT NOTIFICATIONS (LAST 2 HOURS) ===' as section;
SELECT id, user_id, type, title, created_at FROM notifications WHERE created_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 20;

-- 7. Show ALL notifications (first 10)
SELECT '=== 7. ALL NOTIFICATIONS ===' as section;
SELECT id, user_id, type, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;

-- 8. Mention notifications from last 2 hours
SELECT '=== 8. MENTION NOTIFICATIONS ===' as section;
SELECT id, user_id, type, title, created_at FROM notifications WHERE type = 'mention' AND created_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 10;

-- 9. Comment notifications from last 2 hours
SELECT '=== 9. COMMENT NOTIFICATIONS ===' as section;
SELECT id, user_id, type, title, created_at FROM notifications WHERE type = 'task_comment' AND created_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 10;
