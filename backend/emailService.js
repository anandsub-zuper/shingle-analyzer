// backend/services/emailService.js
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configure file upload storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique file name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure upload middleware
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  }
});

// Configure email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

// Email service object
const emailService = {
  /**
   * Send an email with attachments
   * @param {Object} emailData - Email configuration
   * @returns {Promise} - Resolves when email is sent
   */
  sendEmail: async (emailData) => {
    try {
      const transporter = createTransporter();
      
      // Prepare email options
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || null,
        attachments: emailData.attachments || []
      };
      
      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      // Clean up temporary files
      if (emailData.attachments) {
        emailData.attachments.forEach(attachment => {
          if (attachment.path && fs.existsSync(attachment.path)) {
            fs.unlinkSync(attachment.path);
          }
        });
      }
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }
};

module.exports = {
  emailService,
  upload
};
