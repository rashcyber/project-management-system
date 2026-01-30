import { supabase } from './supabase';

/**
 * SendGrid Email Service - Free & Professional
 * Sends emails via SendGrid free tier (100 emails/day)
 * Sign up at: https://sendgrid.com/marketing/sendgrid-free/
 */

const SENDGRID_API_KEY = import.meta.env.VITE_SENDGRID_API_KEY;
const FROM_EMAIL = 'noreply@taskflow.app'; // Change this to your domain
const FROM_NAME = 'TaskFlow Notifications';

/**
 * Send email via SendGrid
 */
export const sendEmailViaSendGrid = async (toEmail, subject, htmlContent) => {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid API key not configured. Notifications will not be sent.');
    console.warn('Set VITE_SENDGRID_API_KEY environment variable to enable email notifications.');
    return { success: false, error: 'SendGrid not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toEmail }],
            subject: subject,
          },
        ],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid error:', error);
      return { success: false, error: `SendGrid: ${response.status}` };
    }

    console.log('✅ Email sent via SendGrid:', toEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
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
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .task-title { font-size: 20px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .reminder-type { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Task Reminder</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <div class="reminder-type">${reminderText[reminderType] || 'Reminder for your task'}</div>

      <p><strong>Task:</strong></p>
      <div class="task-title">${taskTitle}</div>

      <a href="${window.location.origin}/tasks" class="button">View Task</a>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Don't want these reminders? You can adjust notification settings in your account.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 TaskFlow. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaSendGrid(userEmail, `Task Reminder: ${taskTitle}`, htmlContent);
};

/**
 * Send comment notification email
 */
export const sendCommentNotificationEmail = async (userEmail, userName, commenterName, taskTitle, commentContent) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .commenter { font-weight: 600; color: #3b82f6; }
    .task-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .comment-box { background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .comment-text { color: #374151; line-height: 1.6; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Comment</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <p><span class="commenter">${commenterName}</span> commented on a task you're involved in:</p>

      <div class="task-title">${taskTitle}</div>

      <div class="comment-box">
        <div class="comment-text">${commentContent}</div>
      </div>

      <a href="${window.location.origin}/tasks" class="button">View Task</a>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        You received this notification because you're assigned to this task.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 TaskFlow. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaSendGrid(userEmail, `New Comment: ${taskTitle}`, htmlContent);
};

/**
 * Send mention notification email
 */
export const sendMentionNotificationEmail = async (userEmail, userName, mentionerName, taskTitle) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .mention { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .mention-text { color: #92400e; font-weight: 500; }
    .task-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 20px 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You Were Mentioned</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <div class="mention">
        <div class="mention-text">✓ You were mentioned by <strong>${mentionerName}</strong> in a comment</div>
      </div>

      <p><strong>Task:</strong></p>
      <div class="task-title">${taskTitle}</div>

      <a href="${window.location.origin}/tasks" class="button">View Task</a>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Jump into the task to see what was mentioned.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 TaskFlow. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmailViaSendGrid(userEmail, `You were mentioned: ${taskTitle}`, htmlContent);
};

export default {
  sendEmailViaSendGrid,
  sendTaskReminderEmail,
  sendCommentNotificationEmail,
  sendMentionNotificationEmail,
};
