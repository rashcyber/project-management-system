import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const APP_URL = Deno.env.get("APP_URL") || "https://project-management-system-ten-eta.vercel.app"

interface NotificationPayload {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  task_id?: string
  project_id?: string
  actor_id?: string
  created_at: string
}

// Email templates
const getEmailTemplate = (type: string, data: any): { subject: string; html: string } => {
  const taskUrl = data.task_id ? `${APP_URL}/projects/${data.project_id}/board?task=${data.task_id}` : APP_URL

  switch (type) {
    case "task_assigned":
      return {
        subject: `New Task Assigned: ${data.taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">📋 Task Assigned</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
              <p>Hi ${data.assigneeName},</p>
              <p><strong>${data.actorName}</strong> assigned you to:</p>
              <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0;">${data.taskTitle}</h3>
                <p style="margin: 0; color: #666;">${data.taskDescription || "No description"}</p>
              </div>
              <div style="margin: 20px 0;">
                <a href="${taskUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Task</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">You received this email because you have email notifications enabled. You can manage your preferences in Settings.</p>
            </div>
          </div>
        `,
      }

    case "task_updated":
      return {
        subject: `Task Updated: ${data.taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">✏️ Task Updated</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
              <p>Hi ${data.assigneeName},</p>
              <p>A task you're assigned to has been updated:</p>
              <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0;">${data.taskTitle}</h3>
                <p style="margin: 0; color: #666;"><strong>Update:</strong> ${data.updateDetails || "Task details changed"}</p>
              </div>
              <div style="margin: 20px 0;">
                <a href="${taskUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Task</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">You received this email because you have email notifications enabled.</p>
            </div>
          </div>
        `,
      }

    case "task_comment":
      return {
        subject: `New Comment on: ${data.taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">💬 New Comment</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
              <p>Hi ${data.assigneeName},</p>
              <p><strong>${data.commentorName}</strong> commented on:</p>
              <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0;">${data.taskTitle}</h3>
                <p style="margin: 0; color: #666;">"${data.commentText}"</p>
              </div>
              <div style="margin: 20px 0;">
                <a href="${taskUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Reply to Comment</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">You received this email because you have email notifications enabled.</p>
            </div>
          </div>
        `,
      }

    case "due_reminder":
      return {
        subject: `Reminder: Task Due Soon - ${data.taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #ec4899 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">⏰ Task Due Soon</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
              <p>Hi ${data.assigneeName},</p>
              <p>One of your tasks is due soon:</p>
              <div style="background: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0;">${data.taskTitle}</h3>
                <p style="margin: 0; color: #666;"><strong>Due:</strong> ${data.dueDate}</p>
              </div>
              <div style="margin: 20px 0;">
                <a href="${taskUrl}" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Task</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">You received this email because you have email notifications enabled.</p>
            </div>
          </div>
        `,
      }

    default:
      return {
        subject: data.title || "Notification",
        html: `<p>${data.message}</p>`,
      }
  }
}

// Send email via Supabase built-in email service
async function sendEmail(to: string, subject: string, html: string, supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase.auth.admin.sendRawEmail({
      email: to,
      subject: subject,
      html: html,
    })

    if (error) {
      console.error("Supabase email error:", error)
      return false
    }

    console.log(`Email sent successfully to ${to}`)
    return true
  } catch (error) {
    console.error("Error sending email:", error)
    return false
  }
}

// Get user preferences and details
async function getUserPreferences(userId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, email_notifications_enabled, email_digest_frequency, email_notification_types, full_name")
      .eq("id", userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error fetching user preferences:", error)
    return null
  }
}

// Get task details
async function getTaskDetails(taskId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, description, due_date")
      .eq("id", taskId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error fetching task details:", error)
    return null
  }
}

// Get actor (user who triggered the notification) details
async function getActorDetails(actorId: string, supabase: any) {
  try {
    if (!actorId) return { full_name: "Someone" }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error fetching actor details:", error)
    return { full_name: "Someone" }
  }
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    // Parse request body
    const payload: NotificationPayload = await req.json()
    console.log("Processing notification:", payload)

    // Validate required fields
    if (!payload.user_id || !payload.type) {
      return new Response("Missing required fields", { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user preferences
    const userPrefs = await getUserPreferences(payload.user_id, supabase)
    if (!userPrefs || !userPrefs.email) {
      console.log("User not found or no email")
      return new Response("User not found", { status: 404 })
    }

    // Check if user has email notifications enabled
    if (!userPrefs.email_notifications_enabled) {
      console.log("User has email notifications disabled")
      return new Response("Email notifications disabled for user", { status: 200 })
    }

    // Check if this notification type is enabled for emails
    const notificationTypes = userPrefs.email_notification_types || {}
    const typeKey = payload.type.toLowerCase().replace(/\s/g, "_")
    if (notificationTypes[typeKey] === false) {
      console.log(`Notification type ${typeKey} disabled for user`)
      return new Response("Notification type disabled", { status: 200 })
    }

    // Prepare email data
    let emailData: any = {
      assigneeName: userPrefs.full_name || "User",
      recipientEmail: userPrefs.email,
    }

    // Get additional details based on notification type
    if (payload.task_id) {
      const taskDetails = await getTaskDetails(payload.task_id, supabase)
      if (taskDetails) {
        emailData.taskTitle = taskDetails.title
        emailData.taskDescription = taskDetails.description
        emailData.dueDate = taskDetails.due_date
      }
    }

    if (payload.actor_id && payload.type !== "due_reminder") {
      const actorDetails = await getActorDetails(payload.actor_id, supabase)
      emailData.actorName = actorDetails.full_name
    }

    // Extract additional data from notification message if available
    emailData.updateDetails = payload.message
    emailData.commentText = payload.message
    emailData.taskId = payload.task_id
    emailData.projectId = payload.project_id

    // Get email template
    const { subject, html } = getEmailTemplate(payload.type, emailData)

    // Send email
    const sent = await sendEmail(userPrefs.email, subject, html, supabase)

    if (sent) {
      // Optional: Log email send in database
      try {
        await supabase.from("email_logs").insert({
          user_id: payload.user_id,
          notification_id: payload.id,
          notification_type: payload.type,
          recipient_email: userPrefs.email,
          sent_at: new Date().toISOString(),
          status: "sent",
        })
      } catch (error) {
        console.log("Could not log email send (table might not exist yet):", error)
      }

      return new Response("Email sent successfully", { status: 200 })
    } else {
      return new Response("Failed to send email", { status: 500 })
    }
  } catch (error) {
    console.error("Function error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
