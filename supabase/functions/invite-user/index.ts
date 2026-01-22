import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const { email, role, fullName, inviter_workspace_id } = body

    console.log("📨 Invitation request:", { email, role, fullName, inviter_workspace_id })

    // Validate input
    if (!email || !role || !inviter_workspace_id) {
      return new Response(
        JSON.stringify({ error: "Email, role, and inviter_workspace_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Validate role
    const validRoles = ["super_admin", "admin", "manager", "member"]
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log("✅ Supabase admin client created")

    // Check if user already exists in profiles by email
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .eq("email", email)
      .maybeSingle()

    if (checkError) {
      console.error("❌ Error checking existing user:", checkError)
    }

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          error: "User with this email already exists",
          email: existingProfile.email,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ User does not exist, proceeding with creation...")

    // Generate secure temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-12)}A1!`

    // Step 1: Create auth user without complex metadata
    console.log("📝 Creating auth user...")
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
    })

    if (createError || !newAuthUser?.user) {
      console.error("❌ User creation error:", createError)
      return new Response(
        JSON.stringify({
          error: "Failed to create user",
          details: createError?.message || "Unknown error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const newUserId = newAuthUser.user.id
    console.log("✅ Auth user created with ID:", newUserId)

    // Step 2: Wait briefly for trigger to potentially create profile
    console.log("⏳ Waiting for database trigger...")
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Step 3: Directly upsert profile with correct role and workspace
    // This ensures the invited user gets the correct role, not super_admin
    console.log("📝 Upserting profile with role:", role, "and workspace:", inviter_workspace_id)
    const { data: upsertedProfile, error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email,
          full_name: fullName || email.split("@")[0],
          role,
          workspace_id: inviter_workspace_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single()

    if (upsertError) {
      console.error("❌ Profile upsert error:", upsertError)
      return new Response(
        JSON.stringify({
          error: "Failed to set up profile",
          details: upsertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ Profile created/updated with role:", upsertedProfile.role)

    // Step 4: Generate recovery link for password reset (this triggers the password reset email)
    console.log("📧 Generating password reset link...")
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${Deno.env.get("APP_URL") || "http://localhost:5173"}/reset-password`,
      },
    })

    if (resetError) {
      console.error("❌ Reset link error:", resetError)
      // Don't fail completely - user was created
      console.warn("⚠️ Warning: Password reset link generation failed, but user was created")
    } else {
      console.log("✅ Password reset link generated (email will be sent by Supabase)")
    }

    // Success response
    const response = {
      success: true,
      message: "User invited successfully",
      user: {
        id: newUserId,
        email: email,
        role: upsertedProfile.role,
        full_name: upsertedProfile.full_name,
        workspace_id: upsertedProfile.workspace_id,
      },
    }

    console.log("✅ Invitation process complete!")

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ Unexpected error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
