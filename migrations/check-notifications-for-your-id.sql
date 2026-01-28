-- Check notifications for YOUR specific user ID
-- Your ID: 8f71db61-32e5-4d1f-80c8-180f2a613f61

-- 1. Count notifications for YOU
SELECT '=== NOTIFICATIONS FOR YOU ===' as status;
SELECT COUNT(*) as your_notifications
FROM notifications
WHERE user_id = '8f71db61-32e5-4d1f-80c8-180f2a613f61';

-- 2. Show your actual notifications
SELECT '=== YOUR NOTIFICATION DETAILS ===' as status;
SELECT
  id,
  type,
  title,
  message,
  actor_id,
  read,
  created_at
FROM notifications
WHERE user_id = '8f71db61-32e5-4d1f-80c8-180f2a613f61'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Show notifications for OTHER users (to confirm some exist)
SELECT '=== NOTIFICATIONS FOR OTHER USERS ===' as status;
SELECT user_id, COUNT(*) as count
FROM notifications
WHERE user_id != '8f71db61-32e5-4d1f-80c8-180f2a613f61'
GROUP BY user_id
LIMIT 10;

-- 4. Total breakdown
SELECT '=== NOTIFICATION BREAKDOWN ===' as status;
SELECT
  'Your notifications' as type,
  COUNT(*) as count
FROM notifications
WHERE user_id = '8f71db61-32e5-4d1f-80c8-180f2a613f61'
UNION ALL
SELECT
  'Other users notifications',
  COUNT(*)
FROM notifications
WHERE user_id != '8f71db61-32e5-4d1f-80c8-180f2a613f61';
