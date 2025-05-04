// src/utils/emailUtils.js
/**
 * Email service for sending reports and notifications
 * This service uses a backend endpoint to handle email sending
 */

/**
 * Send an email with optional attachments
 * @param {Object} emailData - Email data configuration
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Email body text
 * @param {Array} emailData.attachments - Array of attachment objects
 * @returns {Promise} - Resolves when email is sent
 */
export const sendReportEmail = async (emailData) => {
  try {
    // Create form data to handle binary attachments
    const formData = new FormData();
    
    // Add text fields
    formData.append('to', emailData.to);
    formData.append('subject', emailData.subject);
    formData.append('text', emailData.text);
    
    // Add attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
      emailData.attachments.forEach((attachment, index) => {
        // Convert blob to file if needed
        if (attachment.content instanceof Blob) {
          const file = new File(
            [attachment.content], 
            attachment.filename, 
            { type: attachment.content.type }
          );
          formData.append(`attachment_${index}`, file, attachment.filename);
        } else {
          // Handle cases where content might be a string or other format
          const blob = new Blob([attachment.content], { type: 'application/octet-stream' });
          const file = new File([blob], attachment.filename);
          formData.append(`attachment_${index}`, file, attachment.filename);
        }
      });
    }
    
    // Send request to backend email service
    const response = await fetch('/api/send-email', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header when using FormData
      // The browser will set it automatically with the correct boundary
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send a notification email to the app administrators
 * @param {Object} notificationData - Notification data
 * @returns {Promise} - Resolves when notification is sent
 */
export const sendAdminNotification = async (notificationData) => {
  try {
    const response = await fetch('/api/notify-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send notification');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};
