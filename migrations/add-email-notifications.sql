-- Migration: Add email notification preferences
-- Run this in your Supabase SQL Editor

-- Add email notification settings to profiles table
ALTER TABLE profiles
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN email_digest_frequency TEXT DEFAULT 'daily' CHECK (email_digest_frequency IN ('real-time', 'daily', 'weekly', 'never')),
ADD COLUMN email_notification_types JSONB DEFAULT '{"task_assigned": true, "task_completed": true, "task_mentioned": true, "project_created": true, "comment_mentioned": true}'::jsonb;

-- Create email_logs table to track sent emails
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  notification_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create email_queue table for pending emails
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on email_queue
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Policies for email_logs
CREATE POLICY "Users can view their own email logs" ON email_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create email logs" ON email_logs
  FOR INSERT WITH CHECK (TRUE);

-- Policies for email_queue
CREATE POLICY "Users can view their pending emails" ON email_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage email queue" ON email_queue
  FOR ALL USING (TRUE);

-- Create indexes for better performance
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX idx_profiles_email_notifications_enabled ON profiles(email_notifications_enabled);

-- Comments
COMMENT ON TABLE email_logs IS 'Audit log of emails sent to users';
COMMENT ON TABLE email_queue IS 'Queue of emails pending delivery';
COMMENT ON COLUMN profiles.email_notifications_enabled IS 'Whether the user has enabled email notifications';
COMMENT ON COLUMN profiles.email_digest_frequency IS 'How often to send digest emails: real-time, daily, weekly, never';
COMMENT ON COLUMN profiles.email_notification_types IS 'JSON object specifying which notification types should trigger emails';
