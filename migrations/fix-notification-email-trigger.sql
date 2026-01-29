-- Fix: Remove problematic email trigger that references non-existent 'action' field

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS queue_notification_email_trigger ON notifications;

-- Step 2: Drop the problematic function
DROP FUNCTION IF EXISTS queue_notification_email();

-- Step 3: Now try inserting a test notification to verify it works
SELECT '=== Testing notification insert ===' as status;

INSERT INTO notifications (user_id, type, title, message, task_id, project_id, actor_id)
VALUES (
  '8f71db61-32e5-4d1f-80c8-180f2a613f61',
  'task_comment',
  'Test Notification',
  'This is a test',
  NULL,
  NULL,
  '8f71db61-32e5-4d1f-80c8-180f2a613f61'
)
ON CONFLICT DO NOTHING;

SELECT '=== Test complete - notification inserted successfully ===' as status;
SELECT COUNT(*) as total_notifications FROM notifications;
