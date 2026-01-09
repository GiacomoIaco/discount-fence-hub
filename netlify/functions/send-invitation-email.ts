import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// ✅ VITE_SUPABASE_URL is OK to use - URL is public, access is controlled by keys
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// ✅ SUPABASE_SERVICE_ROLE_KEY is correct (NO VITE_ prefix) - this is a secret!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Twilio config for SMS
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface InvitationEmailRequest {
  email: string;
  phone?: string;
  role: string;
  invitedBy: string;
  invitedByName: string;
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Starting invitation email function...');

    const { email, phone, role, invitedBy, invitedByName }: InvitationEmailRequest = JSON.parse(
      event.body || '{}'
    );

    console.log('Parsed request:', { email, phone: phone?.substring(0, 6), role, invitedBy, invitedByName });

    // Validate required fields
    if (!email || !role || !invitedBy || !invitedByName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Verify the requesting user is an admin or sales-manager
    const { data: inviter, error: inviterError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', invitedBy)
      .single();

    const canInvite = inviter?.role === 'admin' || inviter?.role === 'sales-manager';
    if (inviterError || !canInvite) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized: Only admins and sales managers can send invitations' }),
      };
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A user with this email already exists' }),
      };
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('user_invitations')
      .select('id, is_used')
      .eq('email', email)
      .eq('is_used', false)
      .single();

    if (existingInvitation) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'This email already has a pending invitation' }),
      };
    }

    // Generate invitation token
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'generate_invitation_token'
    );

    if (tokenError || !tokenData) {
      throw new Error('Failed to generate invitation token');
    }

    const token = tokenData as string;

    // Create invitation in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const { data: invitation, error: invitationError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        invited_by: invitedBy,
        token,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
      .select()
      .single();

    if (invitationError) {
      throw invitationError;
    }

    // Generate invitation link
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const invitationLink = `${appUrl}/signup?email=${encodeURIComponent(
      email
    )}&token=${token}`;

    // Send invitation email via SendGrid API
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">You've been invited to join Discount Fence Hub</h2>
          <p>${invitedByName} has invited you to join as a <strong>${role}</strong>.</p>
          <p>Click the button below to accept your invitation and create your account:</p>
          <div style="margin: 30px 0;">
            <a href="${invitationLink}"
               style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This invitation will expire in 7 days.</p>
          <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link:</p>
          <p style="color: #2563eb; font-size: 12px; word-break: break-all;">${invitationLink}</p>
        </div>
      `;

      const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email }],
          }],
          from: { email: 'giacomo@discountfenceusa.com' },
          subject: 'You\'ve been invited to Discount Fence Hub',
          content: [{
            type: 'text/html',
            value: emailHtml,
          }],
        }),
      });

      if (!sendGridResponse.ok) {
        const errorText = await sendGridResponse.text();
        console.error('SendGrid error:', errorText);
        // Don't throw - try SMS as backup
      } else {
        console.log('Invitation email sent successfully to:', email);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the whole request if email fails, try SMS
    }

    // Send SMS invitation if phone provided
    let smsSent = false;
    if (phone && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        // Format phone number
        let formattedPhone = phone.replace(/[^\d+]/g, '');
        if (!formattedPhone.startsWith('+')) {
          if (formattedPhone.length === 10) {
            formattedPhone = '+1' + formattedPhone;
          } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
            formattedPhone = '+' + formattedPhone;
          }
        }

        const smsBody = `${invitedByName} invited you to Discount Fence Hub! Create your account: ${invitationLink}`;

        const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: twilioPhoneNumber,
              Body: smsBody,
            }),
          }
        );

        smsSent = twilioResponse.ok;
        if (!twilioResponse.ok) {
          console.error('Twilio error:', await twilioResponse.text());
        } else {
          console.log('Invitation SMS sent successfully to:', formattedPhone.substring(0, 6) + '...');
        }
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }
    }

    console.log('Invitation created:', {
      email,
      role,
      token,
      link: invitationLink,
      smsSent,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invitation created successfully',
        invitationLink, // Return link as fallback
        invitation,
        smsSent,
      }),
    };
  } catch (error) {
    console.error('Error sending invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send invitation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
