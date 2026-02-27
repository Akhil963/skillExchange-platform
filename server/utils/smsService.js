/**
 * SMS Service using Twilio
 * Send SMS for password reset and OTP verification
 */

// Initialize Twilio (optional - only if TWILIO_* env vars are set)
const initializeTwilio = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️  Twilio not configured. SMS features disabled.');
    console.log('    Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to enable SMS');
    return null;
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ SMS service (Twilio) initialized');
    return client;
  } catch (error) {
    console.error('❌ Error initializing Twilio:', error.message);
    return null;
  }
};

let twilioClient = initializeTwilio();

/**
 * Send SMS message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - SMS send result
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    // Validate phone number
    if (!phoneNumber || !/^\+?[1-9]\d{1,14}$/.test(phoneNumber.replace(/\D/g, ''))) {
      throw new Error('Invalid phone number format');
    }

    // If Twilio not configured, simulate SMS (dev mode)
    if (!twilioClient) {
      console.warn('⚠️  SMS simulation (Twilio not configured)');
      console.log(`📱 [SMS to ${phoneNumber}]: ${message}`);
      return {
        success: true,
        simulated: true,
        message: 'SMS simulated (development mode)',
        phoneNumber,
        sentAt: new Date()
      };
    }

    // Send via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log('✅ SMS sent successfully:', result.sid);
    return {
      success: true,
      messageId: result.sid,
      phoneNumber,
      sentAt: result.dateCreated
    };
  } catch (error) {
    console.error('❌ SMS send error:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Send password reset code via SMS
 * @param {string} phoneNumber - User's phone number
 * @param {string} resetCode - 6-digit reset code
 * @param {string} userName - User's name
 */
const sendResetCodeSMS = async (phoneNumber, resetCode, userName = 'User') => {
  const message = `🔐 SkillExchange Password Reset

Hi ${userName}, your password reset code is:

${resetCode}

This code expires in 10 minutes. Do not share it with anyone.

If you didn't request this, please ignore this message.`;

  return sendSMS(phoneNumber, message);
};

/**
 * Send password reset link via SMS
 * @param {string} phoneNumber - User's phone number
 * @param {string} resetUrl - Full reset URL
 * @param {string} userName - User's name
 */
const sendResetLinkSMS = async (phoneNumber, resetUrl, userName = 'User') => {
  const message = `🔐 SkillExchange Password Reset

Hi ${userName}, click the link below to reset your password:

${resetUrl}

This link expires in 15 minutes.

If you didn't request this, please ignore this message.`;

  return sendSMS(phoneNumber, message);
};

/**
 * Send OTP via SMS
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - 6-digit OTP
 */
const sendOTPSMS = async (phoneNumber, otp) => {
  const message = `🔐 SkillExchange - Your verification code is:

${otp}

This code expires in 10 minutes. Do not share it with anyone.`;

  return sendSMS(phoneNumber, message);
};

/**
 * Send email verification code via SMS
 * @param {string} phoneNumber - User's phone number
 * @param {string} code - Verification code
 */
const sendVerificationCodeSMS = async (phoneNumber, code) => {
  const message = `✅ SkillExchange - Your email verification code is:

${code}

This code expires in 30 minutes.`;

  return sendSMS(phoneNumber, code);
};

module.exports = {
  sendSMS,
  sendResetCodeSMS,
  sendResetLinkSMS,
  sendOTPSMS,
  sendVerificationCodeSMS
};
