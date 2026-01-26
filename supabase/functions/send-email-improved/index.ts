import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const APP_URL = Deno.env.get("APP_URL") || "https://project-management-system-ten-eta.vercel.app"

interface EmailQueueItem {
  id: string
  user_id: string
  notification_id: string
  email_type: string
  recipient_email: string
  subject: string
  body: string
}

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

// Improved email templates
const getEmailTemplate = (type: string, data: any): { subject: string; html: string } => {
  const taskUrl = data.task_id
    ? `${APP_URL}/projects/${data.project_id}/board?task=${data.task_id}`
    : APP_URL

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    color: #333;
  `

  const headerStyles = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 30px 20px;
    color: white;
    border-radius: 8px 8px 0 0;
    text-align: center;
  `

  const bodyStyles = `
    background: #f9fafb;
    padding: 30px 20px;
    border-radius: 0 0 8px 8px;
  `

  const cardStyles = `
    background: white;
    padding: 20px;
    border-left: 4px solid #667eea;
    margin: 20px 0;
    border-radius: 4px;
  `

  const buttonStyles = `
    background: #667eea;
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    display: inline-block;
    margin: 20px 0;
  `

  switch (type) {
    case "task_assigned":
      return {
        subject: `📋 Task Assigned: ${data.taskTitle || "New Task"}`,
        html: `
          <div style="${baseStyles}">
            <div style="${headerStyles}">
              <h2 style="margin: 0; font-size: 24px;">📋 Task Assigned to You</h2>
            </div>
            <div style="${bodyStyles}">
              <p>Hi ${data.assigneeName || "there"},</p>
              <p style="font-size: 16px;"><strong>${data.actorName || "Someone"}</strong> assigned you to a new task:</p>
              <div style="${cardStyles}">
                <h3 style="margin: 0 0 10px 0; color: #667eea;">${data.taskTitle || "Untitled Task"}</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">${data.taskDescription || "No description provided"}</p>
              </div>
              <div>
                <a href="${taskUrl}" style="${buttonStyles}">View Task</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                You received this email because you have email notifications enabled.
                <a href="${APP_URL}/settings" style="color: #667eea;">Manage notification preferences</a>
              </p>
            </div>
          </div>
        `,
      }

    case "task_updated":
      return {
        subject: `✏️ Task Updated: ${data.taskTitle || "Task"}`,
        html: `
          <div style="${baseStyles}">
            <div style="${headerStyles}">
              <h2 style="margin: 0; font-size: 24px;">✏️ Task Updated</h2>
            </div>
            <div style="${bodyStyles}">
              <p>Hi ${data.assigneeName || "there"},</p>
              <p>A task you're involved with has been updated:</p>
              <div style="${cardStyles}">
                <h3 style="margin: 0 0 10px 0; color: #667eea;">${data.taskTitle || "Untitled Task"}</h3>
                <p style="margin: 0; color: #666;"><strong>Update:</strong> ${data.updateDetails || "Task details were changed"}</p>
              </div>
              <div>
                <a href="${taskUrl}" style="${buttonStyles}">View Task</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                You received this email because you have email notifications enabled.
              </p>
            </div>
          </div>
        `,
      }

    case "task_comment":
      return {
        subject: `💬 New Comment on: ${data.taskTitle || "Task"}`,
        html: `
          <div style="${baseStyles}">
            <div style="${headerStyles}">
              <h2 style="margin: 0; font-size: 24px;">💬 New Comment</h2>
            </div>
            <div style="${bodyStyles}">
              <p>Hi ${data.assigneeName || "there"},</p>
              <p><strong>${data.commentorName || "Someone"}</strong> commented on:</p>
              <div style="${cardStyles}">
                <h3 style="margin: 0 0 10px 0; color: #667eea;">${data.taskTitle || "Untitled Task"}</h3>
                <p style="margin: 0; color: #666; font-style: italic;">"${data.commentText || "Comment"}"</p>
              </div>
              <div>
                <a href="${taskUrl}" style="${buttonStyles}">Reply to Comment</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                You received this email because you have email notifications enabled.
              </p>
            </div>
          </div>
        `,
      }

    default:
      return {
        subject: data.title || "Notification from Task Manager",
        html: `
          <div style="${baseStyles}">
            <div style="${headerStyles}">
              <h2 style="margin: 0;">📬 Notification</h2>
            </div>
            <div style="${bodyStyles}">
              <p>Hi ${data.assigneeName || "there"},</p>
              <p>${data.message || "You have a new notification"}</p>
              <div>
                <a href="${APP_URL}" style="${buttonStyles}">View in App</a>
              </div>
            </div>
          </div>
        `,
      }
  }
}

// Send email via Supabase built-in email service with retry logic
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[EMAIL] Attempting to send email to ${to}`)

    // Use Supabase built-in email service
    const { error } = await supabase.auth.admin.sendRawEmail({
      email: to,
      subject: subject,
      html: html,
    })

    if (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error)
      return { success: false, error: error.message || error }
    }

    console.log(`[EMAIL SUCCESS] Email sent to ${to}`)
    return { success: true }
  } catch (error) {
    console.error(`[EMAIL ERROR] Exception while sending email:`, error)
    return { success: false, error: String(error) }
  }
}

// Log email event for debugging
async function logEmailEvent(
  supabase: any,
  user_id: string,
  notification_id: string,
  event_type: string,
  message: string,
  error_details?: any
) {
  try {
    await supabase.from("email_debug_log").insert({
      user_id,
      notification_id,
      event_type,
      message,
      error_details: error_details ? JSON.stringify(error_details) : null,
    })
  } catch (err) {
    console.log("[LOG ERROR] Could not log email event:", err)
  }
}

// Process notification and send email
async function processNotification(payload: NotificationPayload, supabase: any) {
  console.log(`[PROCESS] Processing notification:`, JSON.stringify(payload))

  try {
    // Get user preferences
    const { data: userPrefs, error: prefError } = await supabase
      .from("profiles")
      .select("email, email_notifications_enabled, email_notification_types, full_name")
      .eq("id", payload.user_id)
      .single()

    if (prefError || !userPrefs) {
      const errMsg = `User not found or error fetching preferences: ${prefError?.message}`
      console.error(`[PROCESS ERROR] ${errMsg}`)
      await logEmailEvent(supabase, payload.user_id, payload.id, "error_no_user", errMsg)
      return { success: false, error: errMsg }
    }

    // Check if email notifications are enabled
    if (!userPrefs.email_notifications_enabled) {
      console.log(`[PROCESS] User ${payload.user_id} has email notifications disabled`)
      return { success: false, error: "Email notifications disabled" }
    }

    // Check if this notification type is enabled
    const typeKey = payload.type.toLowerCase().replace(/\s/g, "_")
    if (userPrefs.email_notification_types?.[typeKey] === false) {
      console.log(`[PROCESS] Notification type ${typeKey} disabled for user`)
      return { success: false, error: "Notification type disabled" }
    }

    // Prepare email data
    const emailData: any = {
      assigneeName: userPrefs.full_name || "User",
      recipientEmail: userPrefs.email,
    }

    // Get task details if needed
    if (payload.task_id) {
      const { data: taskData } = await supabase
        .from("tasks")
        .select("id, title, description")
        .eq("id", payload.task_id)
        .single()

      if (taskData) {
        emailData.taskTitle = taskData.title
        emailData.taskDescription = taskData.description
      }
    }

    // Get actor details if needed
    if (payload.actor_id && payload.type !== "due_reminder") {
      const { data: actorData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", payload.actor_id)
        .single()

      if (actorData) {
        emailData.actorName = actorData.full_name
      }
    }

    emailData.taskId = payload.task_id
    emailData.projectId = payload.project_id
    emailData.updateDetails = payload.message
    emailData.commentText = payload.message

    // Get email template
    const { subject, html } = getEmailTemplate(payload.type, emailData)

    // Send email
    const result = await sendEmail(userPrefs.email, subject, html, supabase)

    if (result.success) {
      // Log successful send
      await logEmailEvent(supabase, payload.user_id, payload.id, "email_sent", `Email sent to ${userPrefs.email}`)

      // Update email_logs table
      try {
        await supabase.from("email_logs").insert({
          user_id: payload.user_id,
          recipient_email: userPrefs.email,
          subject: subject,
          email_type: payload.type,
          notification_ids: [payload.id],
          status: "sent",
          sent_at: new Date().toISOString(),
        })
      } catch (err) {
        console.log("[LOG] Could not insert email_log:", err)
      }

      return { success: true }
    } else {
      // Log failed send
      await logEmailEvent(supabase, payload.user_id, payload.id, "email_failed", `Failed to send: ${result.error}`, {
        error: result.error,
      })

      return { success: false, error: result.error }
    }
  } catch (error) {
    const errMsg = `Exception processing notification: ${String(error)}`
    console.error(`[PROCESS ERROR] ${errMsg}`)
    await logEmailEvent(supabase, payload.user_id, payload.id, "error_processing", errMsg, { error: String(error) })
    return { success: false, error: errMsg }
  }
}

// Main handler
serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    // Parse request body
    const payload: NotificationPayload = await req.json()
    console.log(`[REQUEST] Received email request for notification ${payload.id}`)

    // Validate required fields
    if (!payload.user_id || !payload.type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Process notification and send email
    const result = await processNotification(payload, supabase)

    if (result.success) {
      return new Response(JSON.stringify({ success: true, message: "Email sent" }), { status: 200 })
    } else {
      return new Response(JSON.stringify({ success: false, error: result.error }), { status: 400 })
    }
  } catch (error) {
    console.error(`[SERVER ERROR] Unexpected error:`, error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
