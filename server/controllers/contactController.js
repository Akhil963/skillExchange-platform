const { sendEmail } = require('../utils/emailService');

// @desc    Send contact form message
// @route   POST /api/contact
// @access  Public
exports.sendContactMessage = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Send email to support team
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_EMAIL || 'support@skillexchange.com';
    
    await sendEmail(supportEmail, 'contactForm', {
      name,
      email,
      subject,
      message,
      timestamp: new Date().toLocaleString()
    });

    // Send confirmation email to user
    await sendEmail(email, 'contactConfirmation', {
      userName: name,
      subject
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    next(error);
  }
};
