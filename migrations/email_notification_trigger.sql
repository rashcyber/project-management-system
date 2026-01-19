-- Trigger to send emails when notifications are created
-- Note: Email sending is handled on the frontend by subscribeToNotificationsForEmail()
-- This trigger is optional and can be uncommented when pg_net extension is available

-- For now, we just log that a notification was created
CREATE OR REPLACE FUNCTION trigger_send_email_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Email sending is handled by the frontend via edge function
  -- This trigger serves as a placeholder for future database-level triggering
  RAISE NOTICE 'Notification created for user % with type %', NEW.user_id, NEW.type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS on_notification_created ON notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_email_notification();
