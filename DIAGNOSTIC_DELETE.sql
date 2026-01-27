-- Diagnostic query to check why deleted links reappear

-- Check all invite links including deleted ones
SELECT '=== ALL INVITE LINKS (including deleted) ===' as status;
SELECT id, code, is_active, deleted_at, created_at
FROM invite_links
ORDER BY created_at DESC;

-- Check only active (non-deleted) links
SELECT '=== ACTIVE LINKS ONLY (deleted_at IS NULL) ===' as status;
SELECT id, code, is_active, deleted_at, created_at
FROM invite_links
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- Check RLS policies on invite_links
SELECT '=== RLS POLICIES ON INVITE_LINKS ===' as status;
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'invite_links'
ORDER BY policyname;

-- Check if there are any hard-deleted links that might be in cache
SELECT '=== DELETED LINK COUNT ===' as status;
SELECT COUNT(*) as deleted_count FROM invite_links WHERE deleted_at IS NOT NULL;
SELECT COUNT(*) as active_count FROM invite_links WHERE deleted_at IS NULL;
SELECT COUNT(*) as total_count FROM invite_links;

-- Verify the deleted_at column exists and is being used
SELECT '=== COLUMN INFO ===' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_links' AND column_name IN ('deleted_at', 'is_active', 'id')
ORDER BY ordinal_position;
