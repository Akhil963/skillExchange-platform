const nodemailer = require('nodemailer');
require('dotenv').config(); // Use main .env file

// Create reusable transporter - ALWAYS use main SMTP credentials
const createTransporter = () => {
    // ONLY use SMTP_ variables from main .env (ignore ADMIN_EMAIL_ variables)
    const emailUser = process.env.SMTP_EMAIL;
    const emailPass = process.env.SMTP_PASSWORD;

    console.log('📧 Admin Email Config:', {
        emailUser: emailUser || 'NOT SET',
        hasPassword: !!emailPass
    });

    if (!emailUser || !emailPass) {
        console.error('❌ SMTP credentials not configured in main .env file!');
        console.error('Please set SMTP_EMAIL and SMTP_PASSWORD');
        throw new Error('Email service not configured');
    }

    return nodemailer.createTransport({
        service: 'gmail', // Use service for better Gmail compatibility
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
};

// Send password reset email
const sendPasswordResetEmail = async (admin, resetToken) => {
    try {
        const transporter = createTransporter();
        
        // Create reset URL
        const resetUrl = `${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5000'}/admin/admin-reset-password.html?token=${resetToken}`;
        
        // Email HTML template
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: 'Arial', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 40px 30px;
                        text-align: center;
                        color: white;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 32px;
                        font-weight: 700;
                    }
                    .header p {
                        margin: 10px 0 0 0;
                        opacity: 0.9;
                        font-size: 16px;
                    }
                    .content {
                        padding: 40px 30px;
                        color: #333;
                    }
                    .content p {
                        line-height: 1.8;
                        margin-bottom: 20px;
                        font-size: 15px;
                    }
                    .info-box {
                        background: #f8f9fa;
                        border-left: 4px solid #667eea;
                        padding: 20px;
                        margin: 25px 0;
                        border-radius: 8px;
                    }
                    .info-box strong {
                        display: block;
                        margin-bottom: 8px;
                        color: #667eea;
                        font-size: 14px;
                    }
                    .info-box span {
                        font-family: 'Courier New', monospace;
                        font-size: 16px;
                        color: #333;
                        font-weight: 600;
                    }
                    .button {
                        display: inline-block;
                        padding: 16px 40px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white !important;
                        text-decoration: none;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 16px;
                        text-align: center;
                        transition: transform 0.2s;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    }
                    .button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
                    }
                    .button-container {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .warning {
                        background: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 25px 0;
                        border-radius: 8px;
                        font-size: 14px;
                        color: #856404;
                    }
                    .footer {
                        background: #f8f9fa;
                        padding: 30px;
                        text-align: center;
                        color: #6c757d;
                        font-size: 13px;
                        border-top: 1px solid #e9ecef;
                    }
                    .footer p {
                        margin: 5px 0;
                    }
                    .divider {
                        height: 1px;
                        background: linear-gradient(to right, transparent, #e9ecef, transparent);
                        margin: 30px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset Request</h1>
                        <p>SkillExchange Admin Panel</p>
                    </div>
                    
                    <div class="content">
                        <p>Hello <strong>${admin.fullName}</strong>,</p>
                        
                        <p>We received a request to reset the password for your admin account. If you didn't make this request, please ignore this email and your password will remain unchanged.</p>
                        
                        <div class="info-box">
                            <strong>📧 Account Email:</strong>
                            <span>${admin.email}</span>
                        </div>
                        
                        <div class="info-box">
                            <strong>🆔 Unique ID:</strong>
                            <span>${admin.uniqueId}</span>
                        </div>
                        
                        <p>To reset your password, click the button below:</p>
                        
                        <div class="button-container">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <p style="font-size: 13px; color: #6c757d;">
                            If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="word-break: break-all; font-size: 12px; color: #667eea; font-family: monospace;">
                            ${resetUrl}
                        </p>
                        
                        <div class="warning">
                            ⚠️ <strong>Important:</strong> This link will expire in 10 minutes for security reasons. If you need to reset your password after that, please request a new reset link.
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>SkillExchange Admin Panel</strong></p>
                        <p>Secure Admin Management System</p>
                        <p style="margin-top: 15px; font-size: 12px;">
                            This is an automated email. Please do not reply to this message.
                        </p>
                        <p style="color: #adb5bd; font-size: 11px; margin-top: 10px;">
                            © ${new Date().getFullYear()} SkillExchange. All rights reserved.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Send email
        const info = await transporter.sendMail({
            from: `"SkillExchange Admin" <${process.env.ADMIN_EMAIL_USER}>`,
            to: admin.email,
            subject: '🔐 Admin Password Reset Request - SkillExchange',
            html: htmlContent
        });
        
        console.log('✅ Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        throw new Error('Failed to send password reset email');
    }
};

// Send welcome email on signup
const sendWelcomeEmail = async (admin) => {
    try {
        const transporter = createTransporter();
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: 'Arial', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 50px 30px;
                        text-align: center;
                        color: white;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 36px;
                        font-weight: 700;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .content p {
                        line-height: 1.8;
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .credentials-box {
                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 12px;
                        margin: 30px 0;
                        text-align: center;
                    }
                    .credentials-box h3 {
                        margin: 0 0 20px 0;
                        font-size: 20px;
                    }
                    .credential-item {
                        background: rgba(255, 255, 255, 0.2);
                        padding: 15px;
                        border-radius: 8px;
                        margin: 10px 0;
                        backdrop-filter: blur(10px);
                    }
                    .credential-item strong {
                        display: block;
                        font-size: 12px;
                        margin-bottom: 8px;
                        opacity: 0.9;
                    }
                    .credential-item span {
                        font-size: 18px;
                        font-weight: 700;
                        font-family: 'Courier New', monospace;
                    }
                    .button {
                        display: inline-block;
                        padding: 16px 40px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white !important;
                        text-decoration: none;
                        border-radius: 50px;
                        font-weight: 600;
                        margin: 20px 0;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    }
                    .footer {
                        background: #f8f9fa;
                        padding: 30px;
                        text-align: center;
                        color: #6c757d;
                        font-size: 13px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to SkillExchange Admin!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your admin account has been created successfully</p>
                    </div>
                    
                    <div class="content">
                        <p>Hello <strong>${admin.fullName}</strong>,</p>
                        
                        <p>Congratulations! Your admin account for the SkillExchange platform has been successfully created. You now have access to the admin panel where you can manage users, exchanges, skills, and more.</p>
                        
                        <div class="credentials-box">
                            <h3>🔑 Your Admin Credentials</h3>
                            <div class="credential-item">
                                <strong>📧 EMAIL</strong>
                                <span>${admin.email}</span>
                            </div>
                            <div class="credential-item">
                                <strong>🆔 UNIQUE ID</strong>
                                <span>${admin.uniqueId}</span>
                            </div>
                        </div>
                        
                        <p style="text-align: center;">
                            <a href="${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5000'}/admin/admin-login.html" class="button">
                                Login to Admin Panel
                            </a>
                        </p>
                        
                        <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
                            <strong>Important:</strong> Please keep your credentials secure and do not share them with anyone. You can use either your email or unique ID to log in.
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p><strong>SkillExchange Admin Panel</strong></p>
                        <p>© ${new Date().getFullYear()} SkillExchange. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        await transporter.sendMail({
            from: `"SkillExchange Admin" <${process.env.ADMIN_EMAIL_USER}>`,
            to: admin.email,
            subject: '🎉 Welcome to SkillExchange Admin Panel!',
            html: htmlContent
        });
        
        console.log('✅ Welcome email sent to:', admin.email);
        
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        // Don't throw error - signup should succeed even if email fails
    }
};

// Verify email configuration
const verifyEmailConfig = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Admin email service is ready');
        return true;
    } catch (error) {
        console.error('❌ Admin email service error:', error.message);
        return false;
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendWelcomeEmail,
    verifyEmailConfig
};
