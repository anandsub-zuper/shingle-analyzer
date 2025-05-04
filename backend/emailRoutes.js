// backend/routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const { emailService, upload } = require('../services/emailService');

/**
 * POST /api/send-email
 * Send an email with report attachment
 */
router.post('/send-email', upload.array('attachment', 5), async (req, res) => {
  try {
    // Validate request
    if (!req.body.to || !req.body.subject) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email recipient and subject are required' 
      });
    }
    
    // Process uploaded files as attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.originalname,
          path: file.path
        });
      });
    }
    
    // Prepare email data
    const emailData = {
      to: req.body.to,
      subject: req.body.subject,
      text: req.body.text || '',
      html: req.body.html || '',
      attachments: attachments
    };
    
    // Send the email
    const result = await emailService.sendEmail(emailData);
    
    res.json({
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Error in send-email route:', error);
    res.status(500).json({
      success: false,
      message: `Failed to send email: ${error.message}`
    });
  }
});

/**
 * POST /api/notify-admin
 * Send a notification to administrators
 */
router.post('/notify-admin', async (req, res) => {
  try {
    // Prepare admin notification
    const emailData = {
      to: process.env.ADMIN_EMAIL,
      subject: 'Roof Analyzer Admin Notification',
      text: req.body.message || 'New activity on Roof Analyzer',
      html: req.body.html || `<p>${req.body.message || 'New activity on Roof Analyzer'}</p>`
    };
    
    // Add details if provided
    if (req.body.details) {
      emailData.text += `\n\nDetails: ${JSON.stringify(req.body.details)}`;
      emailData.html += `<h3>Details:</h3><pre>${JSON.stringify(req.body.details, null, 2)}</pre>`;
    }
    
    // Send the email
    const result = await emailService.sendEmail(emailData);
    
    res.json({
      success: true,
      messageId: result.messageId,
      message: 'Admin notification sent successfully'
    });
  } catch (error) {
    console.error('Error in notify-admin route:', error);
    res.status(500).json({
      success: false,
      message: `Failed to send notification: ${error.message}`
    });
  }
});

module.exports = router;
