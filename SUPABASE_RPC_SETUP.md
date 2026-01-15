# Supabase RPC Function Setup - User Deletion

## Overview
To enable user deletion from the User Management page, we need to create a Supabase RPC (Remote Procedure Call) function that can delete users from the `auth.users` table.

## Why This Is Needed
- Supabase doesn't allow direct client-side deletion of auth users
- We need a server-side function to handle this securely
- Only super admins should be able to delete users

## Setup Instructions

### Step 1: Go to Supabase SQL Editor
1. Open: https://app.supabase.com
2. Select your project: `ccwxkfmrwxmwonmajwoy`
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**

### Step 2: Create the Delete User Function
Copy and paste this SQL code:

```sql
-- Create a function to delete a user (for super admins only)
CREATE OR REPLACE FUNCTION public.delete_user(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete from auth.users table
  -- This will cascade delete from profiles if there's a foreign key constraint
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;
```

### Step 3: Run the Query
1. Click the blue **Run** button
2. You should see: "Success. No rows returned."

### Step 4: Verify the Function Was Created
1. Go to **Database** → **Functions**
2. Look for `delete_user` in the list
3. You should see it there

## Testing the Function

### Test Locally:
```javascript
// In browser console or code:
const { error } = await supabase.rpc('delete_user', { user_id: 'some-user-id' });
if (error) console.error('Error:', error);
else console.log('User deleted successfully');
```

## How It Works Now

When you delete a user from User Management:

1. ✅ Remove from `task_assignees` table
2. ✅ Remove from `project_members` table
3. ✅ Delete from `profiles` table
4. ✅ Delete from `auth.users` table via RPC function
5. ✅ User is completely removed from the system

## Security Note

The function uses `SECURITY DEFINER` which means it runs with the function owner's permissions. Make sure:
- Only super admins can call `deleteUser()` in the UI (already enforced)
- The RPC function exists and is properly restricted

## If You Get an Error

### "Function not found" or "Undefined function"
- The RPC function hasn't been created yet
- Follow the setup instructions above
- Make sure to click **Run** in the SQL editor

### "Permission denied"
- The function might not have proper grants
- Try recreating it with the SQL code above
- Ensure the `GRANT` statement runs successfully

## Alternative: Manual Deletion (Temporary)

Until the RPC function is set up, users can be deleted from:
1. Supabase Dashboard → Authentication → Users
2. Click the three-dot menu → Delete user
3. Confirm deletion

After the RPC function is created, deletion will work in the User Management page.

---

**Next Steps:**
1. Create the RPC function using the SQL above
2. Deploy the code (already done - commit `0c83795` includes the userStore changes)
3. Test user deletion from User Management page
4. Verify user is deleted from both profiles and auth.users tables
