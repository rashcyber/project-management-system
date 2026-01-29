-- Fix: Drop broken email trigger with CASCADE to handle dependencies

-- Step 1: Drop triggers first
DROP TRIGGER IF EXISTS trigger_queue_notification_email ON notifications CASCADE;
DROP TRIGGER IF EXISTS on_notification_created_queue_email ON notifications CASCADE;

-- Step 2: Drop the function with CASCADE
DROP FUNCTION IF EXISTS queue_notification_email() CASCADE;

SELECT '=== Triggers and function dropped ===' as status;

-- Step 3: Test inserting a notification
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

SELECT '=== Test complete ===' as status;
SELECT COUNT(*) as total_notifications FROM notifications;

-- Step 4: Verify notifications table structure
SELECT '=== Notifications table columns ===' as status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;
