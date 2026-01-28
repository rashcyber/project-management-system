-- Check if ANY notifications exist in the database at all

-- 1. Total count of ALL notifications (ignore RLS)
SELECT '=== TOTAL NOTIFICATIONS IN DATABASE ===' as status;
SELECT COUNT(*) as total_count FROM notifications;

-- 2. Show me ALL notifications (first 20)
SELECT '=== ALL NOTIFICATIONS (SAMPLE) ===' as status;
SELECT id, user_id, type, title, created_at FROM notifications LIMIT 20;

-- 3. Your user ID
SELECT '=== YOUR USER ID ===' as status;
SELECT auth.uid()::text as your_user_id;

-- 4. Count notifications by user
SELECT '=== NOTIFICATIONS BY USER ===' as status;
SELECT user_id, COUNT(*) as count FROM notifications GROUP BY user_id LIMIT 10;

-- 5. Check if your user has any notifications
SELECT '=== DO YOU HAVE ANY NOTIFICATIONS ===' as status;
SELECT
  auth.uid()::text as your_id,
  COUNT(*) as your_notification_count,
  (SELECT COUNT(*) FROM notifications) as total_in_db
FROM notifications
WHERE user_id = auth.uid();
