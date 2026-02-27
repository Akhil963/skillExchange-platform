const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
const initializeSendGrid = () => {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  
  if (!sendGridApiKey) {
    console.log('⚠️  SendGrid not configured. Set SENDGRID_API_KEY in environment variables');
    return false;
  }

  try {
    sgMail.setApiKey(sendGridApiKey);
    console.log('✅ SendGrid configured successfully');
    return true;
  } catch (err) {
    console.error('❌ Error configuring SendGrid:', err.message);
    return false;
  }
};

// Initialize on module load
initializeSendGrid();

// ========================================
// EMAIL TEMPLATES (DEFINED BEFORE sendEmail)
// ========================================
const emailTemplates = {
  exchangeRequest: (data) => ({
    subject: `🤝 New Skill Exchange Request from ${data.requesterName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">SkillExchange Platform</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">New Exchange Request</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.providerName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            <strong>${data.requesterName}</strong> wants to exchange skills with you!
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
              <div style="flex: 1;">
                <p style="margin: 0; color: #6366f1; font-size: 12px; font-weight: 600;">THEY WANT TO LEARN</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${data.requestedSkill}</p>
              </div>
              <div style="font-size: 24px; margin: 0 15px;">⇄</div>
              <div style="flex: 1; text-align: right;">
                <p style="margin: 0; color: #8b5cf6; font-size: 12px; font-weight: 600;">YOU LEARN</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${data.offeredSkill}</p>
              </div>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 20px 0;">
            This is a great opportunity to share your knowledge and learn something new in return!
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View & Accept Request
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
            <p style="font-size: 13px; color: #888; margin: 0;">
              💡 <strong>Quick Stats:</strong> ${data.requesterName} has completed ${data.requesterExchanges} exchanges with a ${data.requesterRating}⭐ rating
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
          <p style="font-size: 11px; color: #aaa; margin: 5px 0;">
            You received this email because someone requested to exchange skills with you.
          </p>
        </div>
      </div>
    `
  }),

  exchangeAccepted: (data) => ({
    subject: `✅ Your Exchange Request Was Accepted!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Exchange Accepted!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Time to start learning</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.requesterName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Great news! <strong>${data.providerName}</strong> has accepted your skill exchange request!
          </p>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <div style="margin-bottom: 15px;">
              <p style="margin: 0; color: #059669; font-size: 12px; font-weight: 600;">EXCHANGE DETAILS</p>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="flex: 1;">
                <p style="margin: 0; font-size: 14px; color: #666;">You Learn</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${data.requestedSkill}</p>
              </div>
              <div style="font-size: 24px; margin: 0 15px; color: #10b981;">⇄</div>
              <div style="flex: 1; text-align: right;">
                <p style="margin: 0; font-size: 14px; color: #666;">You Teach</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${data.offeredSkill}</p>
              </div>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 20px 0;">
            <strong>Next Steps:</strong><br>
            📱 Connect with ${data.providerName} via messages<br>
            📅 Schedule your first session<br>
            🎯 Start exchanging skills!
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.messagesUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Send Message
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
        </div>
      </div>
    `
  }),

  exchangeCompleted: (data) => ({
    subject: `🎓 Exchange Completed - Please Rate Your Experience`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎓 Exchange Completed!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Congratulations on your achievement</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.userName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Your skill exchange with <strong>${data.otherUserName}</strong> has been marked as completed!
          </p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #d97706;">You Earned ${data.tokensEarned} Tokens!</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
              Skills: ${data.requestedSkill} ⇄ ${data.offeredSkill}
            </p>
          </div>
          
          ${data.badgeEarned ? `
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: white; font-size: 16px; font-weight: bold;">
                🏆 New Badge Unlocked: ${data.badgeEarned}
              </p>
            </div>
          ` : ''}
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 20px 0;">
            Help others make informed decisions by sharing your experience:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.ratingUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ⭐ Rate ${data.otherUserName}
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
        </div>
      </div>
    `
  }),

  newRating: (data) => ({
    subject: `⭐ You Received a New ${data.rating}-Star Rating!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">⭐ New Rating Received!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your efforts are appreciated</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.providerName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            <strong>${data.requesterName}</strong> just rated your skill exchange experience!
          </p>
          
          <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">${'⭐'.repeat(data.rating)}</div>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #333;">${data.rating} out of 5 stars</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
              Exchange: ${data.requestedSkill} ⇄ ${data.offeredSkill}
            </p>
          </div>
          
          ${data.review ? `
            <div style="background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
              <p style="margin: 0; color: #6366f1; font-size: 12px; font-weight: 600; margin-bottom: 10px;">REVIEW</p>
              <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6; font-style: italic;">
                "${data.review}"
              </p>
            </div>
          ` : ''}
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #666;">Your Updated Rating</p>
            <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #10b981;">
              ${data.newAverageRating} ⭐
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">
              Based on ${data.totalRatings} rating${data.totalRatings !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Your Profile
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
        </div>
      </div>
    `
  }),

  newMessage: (data) => ({
    subject: `💬 New Message from ${data.senderName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">💬 New Message</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You have a new message on SkillExchange</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.recipientName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            <strong>${data.senderName}</strong> sent you a message:
          </p>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #06b6d4;">
            <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6;">
              ${data.messagePreview}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.messagesUrl}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Read & Reply
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
        </div>
      </div>
    `
  }),

  welcomeEmail: (data) => ({
    subject: `🎉 Welcome to SkillExchange Platform, ${data.userName}!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px;">Welcome to SkillExchange!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 16px;">Your journey of learning begins now</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.userName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Thank you for joining SkillExchange! You're now part of a community where everyone teaches and learns together.
          </p>
          
          <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">🚀 Get Started:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
              <li>Complete your profile with skills you can teach</li>
              <li>Add skills you want to learn</li>
              <li>Browse the marketplace to find exchange partners</li>
              <li>Start exchanging skills and earning tokens!</li>
            </ul>
          </div>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #666;">You started with</p>
            <p style="margin: 5px 0; font-size: 32px; font-weight: bold; color: #10b981;">50 Tokens</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">Earn more by completing exchanges!</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Complete Your Profile
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
            <p style="font-size: 13px; color: #888; margin: 0; line-height: 1.6;">
              💡 <strong>Pro Tip:</strong> The more detailed your profile, the more likely you are to find great exchange partners!
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
          <p style="font-size: 11px; color: #aaa; margin: 5px 0;">
            If you have any questions, feel free to reach out to our support team.
          </p>
        </div>
      </div>
    `
  }),

  // Contact Form Submission (to support team)
  contactForm: (data) => ({
    subject: `📧 New Contact Form Submission: ${data.subject}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📧 New Contact Message</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">From: ${data.name}</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>From:</strong> ${data.name}</p>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Subject:</strong> ${data.subject}</p>
            <p style="margin: 0; font-size: 14px; color: #666;"><strong>Date:</strong> ${data.timestamp}</p>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">Message:</h3>
            <p style="margin: 0; font-size: 15px; color: #78350f; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="mailto:${data.email}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Reply to ${data.name}
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Support System
          </p>
        </div>
      </div>
    `
  }),

  // Contact Confirmation (to user)
  contactConfirmation: (data) => ({
    subject: `✅ We received your message: ${data.subject}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Message Received!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">We'll get back to you soon</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hi <strong>${data.userName}</strong>,</p>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Thank you for contacting SkillExchange! We've received your message regarding:
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px; color: #333; font-weight: 600;">"${data.subject}"</p>
          </div>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Our support team will review your message and get back to you within 24-48 hours.
          </p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; font-size: 14px; color: #065f46; line-height: 1.6;">
              💡 <strong>In the meantime:</strong><br>
              • Check our <a href="#" style="color: #10b981;">FAQ section</a> for quick answers<br>
              • Browse our <a href="#" style="color: #10b981;">Help Center</a> for guides<br>
              • Join our <a href="#" style="color: #10b981;">Community Forum</a> for peer support
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
            <p style="font-size: 13px; color: #888; margin: 0; line-height: 1.6;">
              📧 Need urgent help? Email us at <a href="mailto:support@skillexchange.com" style="color: #6366f1;">support@skillexchange.com</a>
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 12px; color: #888; margin: 5px 0;">
            SkillExchange Platform - Exchange Skills, Build Connections
          </p>
        </div>
      </div>
    `
  })
};

// ========================================
// SEND EMAIL FUNCTION (USES emailTemplates)
// ========================================
const sendEmail = async (to, template, data) => {
  try {
    // Validate email address
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new Error('Invalid email address: ' + to);
    }

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  Email service not configured, skipping email send');
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [EMAIL SIMULATION] To: ${to}`);
        console.log(`   Template: ${template}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2));
      }
      return { success: false, message: 'Email service not configured' };
    }

    // Get email template
    const emailContent = emailTemplates[template]?.(data);
    
    if (!emailContent) {
      throw new Error(`Email template '${template}' not found`);
    }

    // Send email via SendGrid
    const msg = {
      to,
      from: process.env.FROM_EMAIL || 'noreply@sendgrid.net',
      subject: emailContent.subject,
      html: emailContent.html
    };

    const result = await sgMail.send(msg);
    console.log('✅ Email sent successfully to', to, 'Message ID:', result[0]?.messageId || 'Success');
    return { success: true, messageId: result[0]?.messageId || 'sent' };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
};

// ========================================
// BATCH EMAIL SENDER
// ========================================
const sendBatchEmails = async (recipients) => {
  const results = [];
  
  for (const recipient of recipients) {
    const result = await sendEmail(recipient.email, recipient.template, recipient.data);
    results.push({ ...recipient, result });
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
};

module.exports = {
  sendEmail,
  sendBatchEmails,
  emailTemplates
};
