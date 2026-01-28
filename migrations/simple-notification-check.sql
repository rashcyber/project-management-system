-- Very simple notification check

-- 1. Count ALL notifications
SELECT COUNT(*) as total_notifications FROM notifications;

-- 2. Count notifications for YOU
SELECT COUNT(*) as your_notifications FROM notifications WHERE user_id = auth.uid();

-- 3. Show your last 5 notifications
SELECT id, type, title, message, read, created_at
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- 4. Show ALL notifications from last 24 hours
SELECT user_id, type, title, created_at
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Test: Can you see notifications at all?
SELECT
  CASE WHEN COUNT(*) > 0 THEN 'YES - You can see notifications'
       ELSE 'NO - RLS might be blocking'
  END as access_status,
  COUNT(*) as count
FROM notifications
WHERE user_id = auth.uid();
