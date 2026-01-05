-- Add actor_id to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
