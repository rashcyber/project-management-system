-- Migration to add comment_id to notifications table
-- Run this in your Supabase SQL Editor

ALTER TABLE notifications
ADD COLUMN comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_notifications_comment_id ON notifications(comment_id);
