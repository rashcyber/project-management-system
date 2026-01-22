import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const APP_URL = Deno.env.get("APP_URL") || "https://project-management-system-ten-eta.vercel.app"

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
    const { email, role, fullName } = body

    console.log("📨 Invitation request:", { email, role, fullName })

    // Validate input
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
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

    // Check if user already exists in profiles
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
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

    // Step 1: Create user with role in metadata
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        role,
        invited: true,
      },
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

    console.log("✅ User created with ID:", newAuthUser.user.id)

    // Step 2: Wait for trigger to create profile
    console.log("⏳ Waiting for database trigger to create profile...")
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Step 3: Verify and fix profile role if needed
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", newAuthUser.user.id)
      .single()

    if (profileError) {
      console.error("❌ Profile fetch error:", profileError)
      // Try to upsert it
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newAuthUser.user.id,
          email,
          full_name: fullName || email.split("@")[0],
          role,
        })

      if (upsertError) {
        console.error("❌ Profile upsert error:", upsertError)
        return new Response(
          JSON.stringify({ error: "Failed to set up profile", details: upsertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
      console.log("✅ Profile created via upsert")
    } else {
      console.log("✅ Profile exists with role:", profile.role)

      // If role doesn't match, update it
      if (profile.role !== role) {
        console.log("⚠️ Updating profile role from", profile.role, "to", role)
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ role })
          .eq("id", newAuthUser.user.id)

        if (updateError) {
          console.error("❌ Role update error:", updateError)
        } else {
          console.log("✅ Profile role updated")
        }
      }
    }

    // Step 4: Generate recovery link for password reset
    console.log("📧 Generating password reset link...")
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${APP_URL}/reset-password`,
      },
    })

    if (resetError) {
      console.error("❌ Reset link error:", resetError)
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link", details: resetError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ Recovery link generated and email queued")

    // Success response
    const response = {
      success: true,
      message: "User invited successfully",
      user: {
        id: newAuthUser.user.id,
        email: newAuthUser.user.email,
        role,
        full_name: fullName || email.split("@")[0],
      },
    }

    console.log("✅ Invitation complete!")

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
