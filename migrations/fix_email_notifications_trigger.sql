-- Fix Email Notifications - Add trigger to queue emails
-- This creates a trigger that automatically queues emails when notifications are created

-- STEP 1: Create or replace function to queue email on notification insert
CREATE OR REPLACE FUNCTION queue_notification_email()
RETURNS TRIGGER AS $$
DECLARE
  user_prefs RECORD;
  email_type_key TEXT;
BEGIN
  -- Get user preferences
  SELECT
    email,
    email_notifications_enabled,
    email_digest_frequency,
    email_notification_types,
    full_name
  INTO user_prefs
  FROM profiles
  WHERE id = NEW.user_id;

  -- Check if user has email notifications enabled
  IF user_prefs IS NULL OR NOT user_prefs.email_notifications_enabled THEN
    RETURN NEW;
  END IF;

  -- Only process real-time and daily digest notifications
  IF user_prefs.email_digest_frequency NOT IN ('real-time', 'daily') THEN
    RETURN NEW;
  END IF;

  -- Check if this notification type is enabled
  email_type_key := LOWER(NEW.type) || '_' || LOWER(COALESCE(NEW.action, 'notification'));
  IF (user_prefs.email_notification_types->>email_type_key)::boolean IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Queue the email for sending
  INSERT INTO email_queue (
    user_id,
    notification_id,
    email_type,
    recipient_email,
    subject,
    body,
    status,
    scheduled_for
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NEW.type,
    user_prefs.email,
    COALESCE(NEW.title, 'Notification'),
    NEW.message,
    'pending',
    NOW() + INTERVAL '5 seconds' -- Small delay to batch notifications
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_notification_created_queue_email ON notifications;

-- STEP 3: Create trigger on notifications table
CREATE TRIGGER on_notification_created_queue_email
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION queue_notification_email();

-- STEP 4: Add RLS policy to allow system to manage email_queue
DROP POLICY IF EXISTS "System can manage email queue" ON email_queue;
CREATE POLICY "System can insert and update email queue" ON email_queue
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- STEP 5: Add better logging - create email_debug_log table
CREATE TABLE IF NOT EXISTS email_debug_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  notification_id UUID,
  event_type TEXT,
  message TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on debug log
ALTER TABLE email_debug_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to view debug logs
CREATE POLICY "Super admins can view email debug logs" ON email_debug_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- STEP 6: Create function to log email events
CREATE OR REPLACE FUNCTION log_email_event(
  p_user_id UUID,
  p_notification_id UUID,
  p_event_type TEXT,
  p_message TEXT,
  p_error_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO email_debug_log (user_id, notification_id, event_type, message, error_details)
  VALUES (p_user_id, p_notification_id, p_event_type, p_message, p_error_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: Create index for email_debug_log queries
CREATE INDEX IF NOT EXISTS idx_email_debug_log_created_at ON email_debug_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_debug_log_user_id ON email_debug_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_debug_log_status ON email_debug_log(event_type);

-- STEP 8: Add comment
COMMENT ON FUNCTION queue_notification_email() IS 'Automatically queues emails when notifications are created based on user preferences';

-- VERIFICATION
SELECT '=== Email Notification System Fixed ===' as status;
SELECT COUNT(*) as pending_emails FROM email_queue WHERE status = 'pending';
SELECT COUNT(*) as queued_today FROM email_queue WHERE created_at > NOW() - INTERVAL '1 day';
