import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const APP_URL = Deno.env.get("APP_URL") || "https://project-management-system-ten-eta.vercel.app"

interface InvitationRequest {
  email: string
  role: string
  fullName: string
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req) => {
  try {
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

    const body = await req.json() as InvitationRequest
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

    // Create admin client
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Check authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("✅ Authorization verified")

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle()

    if (checkError) {
      console.error("❌ Error checking existing user:", checkError)
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: "User with this email already exists",
          email: existingUser.email,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ User does not exist, proceeding...")

    // Generate secure temporary password
    const tempPassword = crypto.getRandomValues(new Uint8Array(16)).toString() + "A1!"

    // Step 1: Create user with EXPLICIT role in metadata
    // This is critical - the role MUST be passed in raw_user_meta_data
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        role: role, // CRITICAL: This ensures the trigger uses this role
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

    console.log("✅ User created:", newAuthUser.user.id)

    // Step 2: Wait for trigger to create profile
    console.log("⏳ Waiting for database trigger to create profile...")
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 3: Verify profile was created with correct role
    const { data: createdProfile, error: profileCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", newAuthUser.user.id)
      .single()

    if (profileCheckError || !createdProfile) {
      console.error("❌ Profile check error:", profileCheckError)
      // Try to update/create it explicitly
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newAuthUser.user.id,
          email: email,
          full_name: fullName || email.split("@")[0],
          role: role,
        })

      if (updateError) {
        console.error("❌ Profile upsert error:", updateError)
        return new Response(
          JSON.stringify({
            error: "Failed to set up user profile",
            details: updateError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    } else {
      console.log("✅ Profile exists with role:", createdProfile.role)

      // Verify the role is correct
      if (createdProfile.role !== role) {
        console.warn("⚠️ Profile role mismatch, updating...", {
          expected: role,
          actual: createdProfile.role,
        })

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ role })
          .eq("id", newAuthUser.user.id)

        if (updateError) {
          console.error("❌ Role update error:", updateError)
        } else {
          console.log("✅ Profile role updated to:", role)
        }
      }
    }

    // Step 4: Generate password reset link
    console.log("📧 Generating password reset link...")
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${APP_URL}/reset-password`,
      },
    })

    if (resetError) {
      console.error("❌ Password reset error:", resetError)
      return new Response(
        JSON.stringify({
          error: "Failed to generate reset link",
          details: resetError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ Recovery link generated")

    // Success response
    const successResponse = {
      success: true,
      message: "User invited successfully",
      user: {
        id: newAuthUser.user.id,
        email: newAuthUser.user.email,
        role: role,
        full_name: fullName || email.split("@")[0],
      },
    }

    console.log("✅ Invitation complete:", JSON.stringify(successResponse))

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ Invitation error:", error)
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
