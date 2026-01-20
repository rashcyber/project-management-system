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

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      })
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Parse the request body
    const { email, role, fullName } = (await req.json()) as InvitationRequest

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Verify the requester is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Extract the token
    const token = authHeader.replace("Bearer ", "")

    // Set the token on the client to use it for requests
    await supabaseClient.auth.setSession({
      access_token: token,
      refresh_token: "",
    })

    // Get the current user from the token
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !requestingUser) {
      console.error("Token verification error:", userError)
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("User verified:", requestingUser.id)

    // Check if requesting user is admin
    const { data: requestingProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", requestingUser.id)
      .single()

    if (profileError || !requestingProfile) {
      console.error("Profile fetch error:", profileError)
      return new Response(JSON.stringify({ error: "Could not verify admin status" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!["super_admin", "admin"].includes(requestingProfile.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins can invite users", userRole: requestingProfile.role }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("User is admin, proceeding with invitation")

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingUser) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Generate a temporary password
    const tempPassword = crypto.getRandomValues(new Uint8Array(16)).toString() + "A1!"

    // Step 1: Create the user via admin API
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("User created:", newAuthUser.user.id)

    // Step 2: Update the profile with the correct role
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 800))

    const { error: updateError } = await supabaseAdmin
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Profile updated with role:", role)

    // Step 3: Generate password reset email link
    const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Recovery link generated for:", email)

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
