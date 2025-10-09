import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface InvitationEmailRequest {
  email: string;
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
    const { email, role, invitedBy, invitedByName }: InvitationEmailRequest = JSON.parse(
      event.body || '{}'
    );

    // Validate required fields
    if (!email || !role || !invitedBy || !invitedByName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Verify the requesting user is an admin
    const { data: inviter, error: inviterError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', invitedBy)
      .single();

    if (inviterError || inviter?.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized: Only admins can send invitations' }),
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
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
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
        status: 'pending',
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

    // Send invitation email via SendGrid
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.send({
        to: email,
        from: 'giacomo@discountfenceusa.com', // Must match your verified sender
        subject: 'You\'ve been invited to Discount Fence Hub',
        html: `
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
        `,
      });

      console.log('Invitation email sent successfully to:', email);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the whole request if email fails, still return the link
    }

    console.log('Invitation created:', {
      email,
      role,
      token,
      link: invitationLink,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invitation created successfully',
        invitationLink, // Return link until email sending is implemented
        invitation,
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
