-- Migration: Add description column to workspaces table
-- This migration adds a description field to store workspace descriptions

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT;
