/**
 * Resend Email Service - RECOMMENDED
 * Free forever: 100 emails/day with no expiration
 * Sign up at: https://resend.com (completely free, no credit card needed)
 *
 * After 100/day limit, optional paid plans start at $20/month
 * But free tier never expires unlike SendGrid
 */

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

// Email Configuration - CUSTOMIZE THESE
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev'; // Default Resend email, replace with your domain
const FROM_NAME = import.meta.env.VITE_FROM_NAME || 'Task Management App'; // Your app name

// For production, configure:
// VITE_FROM_EMAIL=noreply@yourdomain.com (after verifying domain in Resend)
// VITE_FROM_NAME=Your App Name

/**
 * Send email via Resend
 */
export const sendEmailViaResend = async (toEmail, subject, htmlContent) => {
  if (!RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured. Notifications will not be sent.');
    console.warn('Set VITE_RESEND_API_KEY environment variable to enable email notifications.');
    console.warn('Sign up for free at: https://resend.com');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return { success: false, error: `Resend: ${data.message}` };
    }

    console.log('✅ Email sent via Resend:', toEmail);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send task reminder email
 */
export const sendTaskReminderEmail = async (userEmail, userName, taskTitle, reminderType) => {
  const reminderText = {
    at_time: 'Your task is due now',
    '15_min': 'Your task is due in 15 minutes',
    '1_hour': 'Your task is due in 1 hour',
    '1_day': 'Your task is due tomorrow',
    '2_days': 'Your task is due in 2 days',
    custom: 'Reminder for your upcoming task',
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 30px; }
    .reminder-badge { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 6px; margin: 20px 0; font-weight: 500; text-align: center; }
    .task-title { font-size: 20px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    p { line-height: 1.6; color: #374151; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>📋 Task Reminder</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>

        <div class="reminder-badge">${reminderText[reminderType] || 'Reminder for your task'}</div>

        <p><strong>Task:</strong></p>
        <div class="task-title">${taskTitle}</div>

        <p style="margin-top: 30px;">
          <a href="${window.location.origin || 'https://taskflow.app'}/tasks" class="button">View Task →</a>
        </p>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          You can manage your reminder preferences in your account settings.
        </p>
      </div>
      <div class="footer">
        <p>© 2026 TaskFlow. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaResend(userEmail, `Task Reminder: ${taskTitle}`, htmlContent);
};

/**
 * Send comment notification email
 */
export const sendCommentNotificationEmail = async (userEmail, userName, commenterName, taskTitle, commentContent) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 30px; }
    .commenter { font-weight: 600; color: #3b82f6; }
    .task-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .comment-box { background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .comment-text { color: #374151; line-height: 1.6; margin: 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    p { line-height: 1.6; color: #374151; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>💬 New Comment</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>

        <p><span class="commenter">${commenterName}</span> commented on a task you're involved in:</p>

        <div class="task-title">${taskTitle}</div>

        <div class="comment-box">
          <p class="comment-text">${commentContent}</p>
        </div>

        <p style="margin-top: 30px;">
          <a href="${window.location.origin || 'https://taskflow.app'}/tasks" class="button">View Task →</a>
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          You received this notification because you're assigned to this task.
        </p>
      </div>
      <div class="footer">
        <p>© 2026 TaskFlow. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaResend(userEmail, `New Comment: ${taskTitle}`, htmlContent);
};

/**
 * Send mention notification email
 */
export const sendMentionNotificationEmail = async (userEmail, userName, mentionerName, taskTitle) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 30px; }
    .mention { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .mention-text { color: #92400e; font-weight: 500; }
    .task-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    p { line-height: 1.6; color: #374151; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🔔 You Were Mentioned</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>

        <div class="mention">
          <div class="mention-text">✓ You were mentioned by <strong>${mentionerName}</strong> in a comment</div>
        </div>

        <p><strong>Task:</strong></p>
        <div class="task-title">${taskTitle}</div>

        <p style="margin-top: 30px;">
          <a href="${window.location.origin || 'https://taskflow.app'}/tasks" class="button">View Task →</a>
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          Jump into the task to see what was mentioned.
        </p>
      </div>
      <div class="footer">
        <p>© 2026 TaskFlow. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaResend(userEmail, `You were mentioned: ${taskTitle}`, htmlContent);
};

export default {
  sendEmailViaResend,
  sendTaskReminderEmail,
  sendCommentNotificationEmail,
  sendMentionNotificationEmail,
};
