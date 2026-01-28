-- Debug: Check notification status

-- 1. Count total notifications
SELECT '=== TOTAL NOTIFICATIONS ===' as status;
SELECT COUNT(*) as total FROM notifications;

-- 2. Your notifications
SELECT '=== YOUR NOTIFICATIONS ===' as status;
SELECT id, type, title, message, task_id, project_id, read, created_at
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if notifications have actor_id column
SELECT '=== NOTIFICATIONS COLUMNS ===' as status;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 4. Check RLS policies on notifications
SELECT '=== RLS POLICIES ON NOTIFICATIONS ===' as status;
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 5. Check if your user can view notifications
SELECT '=== CAN YOU VIEW NOTIFICATIONS ===' as status;
SELECT
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) as your_notifications,
  COUNT(*) FILTER (WHERE user_id = auth.uid() AND read = false) as your_unread
FROM notifications;

-- 6. Check a sample notification with actor
SELECT '=== SAMPLE NOTIFICATION WITH ACTOR ===' as status;
SELECT
  n.id,
  n.type,
  n.title,
  n.message,
  n.actor_id,
  p.full_name as actor_name,
  n.created_at
FROM notifications n
LEFT JOIN profiles p ON p.id = n.actor_id
ORDER BY n.created_at DESC
LIMIT 1;
