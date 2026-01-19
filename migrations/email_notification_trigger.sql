-- Trigger to send emails when notifications are created

-- Create function that calls the send-email edge function
CREATE OR REPLACE FUNCTION trigger_send_email_notification()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
  _is_enabled BOOLEAN;
BEGIN
  -- Get the user_id from the notification
  _user_id := NEW.user_id;

  -- Check if user has email notifications enabled
  SELECT email_notifications_enabled INTO _is_enabled
  FROM profiles
  WHERE id = _user_id;

  -- Only proceed if email notifications are enabled
  IF _is_enabled = true THEN
    -- Call the edge function via http
    -- This requires the edge function to be deployed
    -- For now, we'll log it for manual processing or async jobs
    RAISE NOTICE 'Email notification triggered for user % notification type %', _user_id, NEW.type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS on_notification_created ON notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_email_notification();

-- Alternative: Use pg_net extension if available for HTTP calls
-- This comment shows how to do it with pg_net (requires Supabase to have pg_net enabled):
/*
CREATE OR REPLACE FUNCTION trigger_send_email_notification_http()
RETURNS TRIGGER AS $$
DECLARE
  _function_url TEXT := 'https://ccwxkfmrwxmwonmajwoy.supabase.co/functions/v1/send-email';
  _jwt_token TEXT := current_setting('request.jwt.claims', true);
BEGIN
  -- Call the edge function with HTTP
  PERFORM net.http_post(
    _function_url,
    jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'task_id', NEW.task_id,
      'project_id', NEW.project_id,
      'actor_id', NEW.actor_id,
      'created_at', NEW.created_at
    )::text,
    'application/json',
    jsonb_build_object('Authorization', 'Bearer ' || _jwt_token)::text[]
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/
