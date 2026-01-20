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

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Parse the request body
    const { email, role, fullName } = (await req.json()) as InvitationRequest

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Verify the requester is authenticated and is an admin
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Create Supabase client with service role (admin privileges)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Verify the user making the request is an admin
    const token = authHeader.replace("Bearer ", "")
    const { data: { user: requestingUser }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check if requesting user is admin
    const { data: requestingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", requestingUser.id)
      .single()

    if (!requestingProfile || !["super_admin", "admin"].includes(requestingProfile.role)) {
      return new Response(JSON.stringify({ error: "Only admins can invite users" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single()

    if (existingUser) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Generate a temporary password
    const tempPassword = crypto.getRandomValues(new Uint8Array(16)).toString() + "A1!"

    // Step 1: Create the user via admin API
    const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        role: role,
        invited: true,
      },
    })

    if (createError || !newAuthUser.user) {
      console.error("User creation error:", createError)
      return new Response(
        JSON.stringify({ error: "Failed to create user", details: createError?.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Step 2: Update the profile with the correct role
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: role,
        full_name: fullName || email.split("@")[0],
      })
      .eq("id", newAuthUser.user.id)

    if (updateError) {
      console.error("Profile update error:", updateError)
      return new Response(
        JSON.stringify({ error: "Failed to update profile", details: updateError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Step 3: Send password reset email so user can set their own password
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${APP_URL}/reset-password`,
      },
    })

    if (resetError) {
      console.error("Password reset error:", resetError)
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link", details: resetError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User invited successfully",
        user: {
          id: newAuthUser.user.id,
          email: newAuthUser.user.email,
          role: role,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Invitation error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
