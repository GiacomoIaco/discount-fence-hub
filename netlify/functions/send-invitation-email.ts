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

    // TODO: Implement actual email sending using a service like SendGrid, Resend, or AWS SES
    // For now, we'll return the invitation link
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@discountfencehub.com',
    //   subject: 'You\'ve been invited to Discount Fence Hub',
    //   html: `
    //     <h2>You've been invited to join Discount Fence Hub</h2>
    //     <p>${invitedByName} has invited you to join as a ${role}.</p>
    //     <p>Click the link below to accept your invitation and create your account:</p>
    //     <a href="${invitationLink}">Accept Invitation</a>
    //     <p>This invitation will expire in 7 days.</p>
    //   `,
    // });

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
