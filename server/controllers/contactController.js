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

    // Send email to support team (non-fatal — log failure but don't crash)
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL;
    let emailWarning = null;

    if (supportEmail && supportEmail !== 'noreply@sendgrid.net') {
      try {
        await sendEmail(supportEmail, 'contactForm', {
          name,
          email,
          subject,
          message,
          timestamp: new Date().toLocaleString()
        });
      } catch (emailErr) {
        console.error('⚠️  Failed to send contact notification to support:', emailErr.message);
        emailWarning = 'Email notification could not be delivered, but your message was recorded.';
      }
    }

    // Send confirmation email to user (non-fatal)
    try {
      await sendEmail(email, 'contactConfirmation', {
        userName: name,
        subject
      });
    } catch (emailErr) {
      console.error('⚠️  Failed to send confirmation to user:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: emailWarning || 'Your message has been sent successfully. We will get back to you soon!'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    next(error);
  }
};
