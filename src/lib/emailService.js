import { supabase } from './supabase';

/**
 * Email Service
 * Handles sending emails via Supabase Edge Functions
 */

const SEND_EMAIL_FUNCTION_URL = '/functions/v1/send-email';

/**
 * Call the send-email edge function
 * @param {object} notificationData - The notification data to send via email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const callSendEmailFunction = async (notificationData) => {
  try {
    // Get the session to include in the request
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.warn('No session available for email function call');
      return { success: false, error: 'No session' };
    }

    // Call the edge function
    const response = await fetch(
      `${supabase.supabaseUrl}${SEND_EMAIL_FUNCTION_URL}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(notificationData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Email function error:', errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }

    console.log('Email function called successfully');
    return { success: true };
  } catch (error) {
    console.error('Error calling email function:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Trigger email for a notification
 * This should be called when a notification is created
 * @param {object} notification - The notification object
 * @returns {Promise<void>}
 */
export const triggerEmailNotification = async (notification) => {
  try {
    // Don't await this - let it run in the background
    // We don't want to block the main operation if email fails
    callSendEmailFunction(notification).catch(error => {
      console.error('Failed to send email for notification:', error);
    });
  } catch (error) {
    console.error('Error triggering email notification:', error);
  }
};

/**
 * Subscribe to new notifications and send emails
 * This sets up a real-time listener for notifications
 * @param {string} userId - The user ID to listen for
 * @returns {function} Unsubscribe function
 */
export const subscribeToNotificationsForEmail = (userId) => {
  try {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // When a new notification is created, trigger email
          console.log('New notification detected, triggering email:', payload.new);
          triggerEmailNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('Error subscribing to notifications for email:', error);
    return () => {}; // Return no-op unsubscribe
  }
};

export default {
  callSendEmailFunction,
  triggerEmailNotification,
  subscribeToNotificationsForEmail,
};
