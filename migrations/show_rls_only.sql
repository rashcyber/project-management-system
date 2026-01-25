-- SHOW ONLY RLS POLICIES
SELECT tablename, policyname, permissive, qual FROM pg_policies ORDER BY tablename;
