-- Fix: Create missing lower() function for notification_type

-- First, check if the function exists
SELECT '=== Checking for lower function ===' as status;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'lower'
LIMIT 5;

-- Create the lower() function if it doesn't exist
CREATE OR REPLACE FUNCTION lower(notification_type)
RETURNS text AS $$
BEGIN
  RETURN LOWER($1::text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

SELECT '=== Function created ===' as status;

-- Now test if notifications can be inserted
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
SELECT COUNT(*) as total FROM notifications;
