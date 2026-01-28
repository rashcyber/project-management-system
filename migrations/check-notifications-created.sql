-- Check if notifications were actually created in the database

-- 1. Get current user
SELECT '=== YOUR USER INFO ===' as status;
SELECT auth.uid() as user_id, current_user;

-- 2. Check ALL notifications created in the last 1 hour
SELECT '=== ALL NOTIFICATIONS (Last 1 Hour) ===' as status;
SELECT
  id,
  user_id,
  type,
  title,
  message,
  actor_id,
  created_at
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 3. Check YOUR notifications specifically
SELECT '=== YOUR NOTIFICATIONS (Last 1 Hour) ===' as status;
SELECT
  id,
  type,
  title,
  message,
  actor_id,
  read,
  created_at
FROM notifications
WHERE user_id = auth.uid()
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 4. Check if you can SELECT from notifications (RLS check)
SELECT '=== CAN YOU VIEW NOTIFICATIONS ===' as status;
SELECT COUNT(*) as your_notifications FROM notifications WHERE user_id = auth.uid();

-- 5. Check mention type notifications
SELECT '=== MENTION NOTIFICATIONS ===' as status;
SELECT
  id,
  user_id,
  type,
  title,
  message,
  created_at
FROM notifications
WHERE type = 'mention'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 6. Check task_comment notifications
SELECT '=== TASK_COMMENT NOTIFICATIONS ===' as status;
SELECT
  id,
  user_id,
  type,
  title,
  message,
  created_at
FROM notifications
WHERE type = 'task_comment'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
