-- Migration: Add assigned_to column to subtasks for subtask assignments
-- Run this in your Supabase SQL Editor

-- Add assigned_to column to subtasks table
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_to ON subtasks(assigned_to);

-- Update RLS policies to allow viewing assigned subtasks
-- (The existing RLS policies should already allow this via tasks)
