-- Add reminders column to tasks table for storing reminder settings
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminders JSONB;

-- Create index for queries filtering by reminders
CREATE INDEX IF NOT EXISTS idx_tasks_with_reminders ON tasks(id) WHERE reminders IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN tasks.reminders IS 'JSON array of reminder objects: [{type: string, hours: number}]';
