-- Migration: Add trigger to queue emails when notifications are created
-- This trigger will add notifications to the email_queue table
-- The actual email sending will be handled by a Supabase Edge Function

-- Create function to queue emails
CREATE OR REPLACE FUNCTION queue_notification_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue email only if user has email notifications enabled
  INSERT INTO email_queue (
    user_id,
    notification_id,
    email_type,
    recipient_email,
    subject,
    body,
    status,
    created_at,
    scheduled_for
  )
  SELECT
    NEW.user_id,
    NEW.id,
    NEW.type,
    p.email,
    'New ' || NEW.title,
    NEW.message,
    'pending',
    NOW(),
    NOW()
  FROM profiles p
  WHERE p.id = NEW.user_id
    AND p.email_notifications_enabled = TRUE
    AND p.email_notification_types->>(NEW.type)::text = 'true';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_queue_notification_email ON notifications;

-- Create trigger on notifications table
CREATE TRIGGER trigger_queue_notification_email
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION queue_notification_email();

-- Create index for active pending emails for the Edge Function to poll
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(status, scheduled_for)
WHERE status = 'pending';
