require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sendEmail, getResetPasswordEmail } = require('../config/email');

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');
  
  console.log('📧 SMTP Settings:');
  console.log('  Host:', process.env.SMTP_HOST);
  console.log('  Port:', process.env.SMTP_PORT);
  console.log('  Email:', process.env.SMTP_EMAIL);
  console.log('  Password:', process.env.SMTP_PASSWORD ? '***' + process.env.SMTP_PASSWORD.slice(-4) : 'Not set');
  console.log('  From Name:', process.env.FROM_NAME);
  console.log('  From Email:', process.env.FROM_EMAIL);
  console.log('');

  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.error('❌ SMTP_EMAIL or SMTP_PASSWORD not configured in .env file');
    process.exit(1);
  }

  try {
    console.log('📤 Sending test email...');
    
    const testResetUrl = 'http://localhost:5000?reset=test-token-12345';
    const htmlContent = getResetPasswordEmail(testResetUrl, 'Test User');
    
    const result = await sendEmail({
      email: process.env.SMTP_EMAIL, // Send to yourself for testing
      subject: '🧪 SkillExchange Email Test - Password Reset',
      html: htmlContent
    });

    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', result.messageId);
    console.log('📧 Sent to:', process.env.SMTP_EMAIL);
    console.log('\n🎉 Email configuration is working correctly!');
    console.log('\nCheck your inbox:', process.env.SMTP_EMAIL);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Email test failed!');
    console.error('Error:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Make sure you\'re using a Gmail App Password (not regular password)');
    console.error('  2. Enable "Less secure app access" or use App Passwords');
    console.error('  3. Check your Gmail account settings');
    console.error('  4. Verify SMTP settings in .env file');
    console.error('\n🔗 How to get Gmail App Password:');
    console.error('  1. Go to https://myaccount.google.com/');
    console.error('  2. Security → 2-Step Verification');
    console.error('  3. Scroll to "App passwords"');
    console.error('  4. Generate new app password');
    console.error('  5. Copy and paste into .env SMTP_PASSWORD');
    
    process.exit(1);
  }
}

testEmailConfiguration();
