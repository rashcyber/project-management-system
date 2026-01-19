-- Email Notifications Setup Migration
-- This migration adds email notification support to the application

-- 1. Add email notification fields to profiles table (if not already present)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_digest_frequency TEXT DEFAULT 'daily' CHECK (email_digest_frequency IN ('immediate', 'daily', 'weekly', 'off'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notification_types JSONB DEFAULT '{"task_assigned": true, "task_updated": true, "task_comment": true, "due_reminder": true, "mention": true}';

-- 2. Add actor_id to notifications table (to track who triggered the notification)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Create email_logs table to track sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  notification_type TEXT,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);

-- 5. Enable RLS on email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for email_logs
CREATE POLICY "Users can view their own email logs" ON email_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (true);

-- 7. Add comment to explain email notification types
COMMENT ON COLUMN profiles.email_notification_types IS 'JSON object with notification type keys (task_assigned, task_updated, task_comment, due_reminder, mention) mapped to boolean values';
