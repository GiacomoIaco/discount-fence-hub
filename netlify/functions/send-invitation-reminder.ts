import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function formatPhone(phone: string): string {
  let formatted = phone.replace(/[^\d+]/g, '');
  if (!formatted.startsWith('+')) {
    if (formatted.length === 10) formatted = '+1' + formatted;
    else if (formatted.length === 11 && formatted.startsWith('1')) formatted = '+' + formatted;
  }
  return formatted;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { invitationId, requestingUserId } = JSON.parse(event.body || '{}');

    if (!invitationId || !requestingUserId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing invitationId or requestingUserId' }) };
    }

    // Verify requesting user is owner/admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('user_id', requestingUserId)
      .single();

    if (!['owner', 'admin'].includes(userRole?.role_key || '')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // Load invitation
    const { data: invitation, error: invError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (invError || !invitation) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invitation not found' }) };
    }

    if (invitation.is_used) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invitation already accepted' }) };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invitation has expired' }) };
    }

    // Rate limit: no more than 1 reminder per hour
    if (invitation.last_reminder_sent_at) {
      const lastSent = new Date(invitation.last_reminder_sent_at);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSent > hourAgo) {
        return { statusCode: 429, body: JSON.stringify({ error: 'Reminder already sent recently. Please wait before sending another.' }) };
      }
    }

    // Get inviter name for the message
    const { data: inviter } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', invitation.invited_by)
      .single();

    const inviterName = inviter?.full_name || 'Your manager';
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const isCrewInvite = invitation.role === 'crew';
    const lang = invitation.preferred_language || (isCrewInvite ? 'es' : 'en');

    let emailSent = false;
    let smsSent = false;
    let smsError = '';
    let emailError = '';

    // Send SMS reminder (for crew, or for non-crew with phone)
    const phoneToUse = invitation.phone;
    if (phoneToUse && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const formattedPhone = formatPhone(phoneToUse);

        const crewLoginUrl = `${appUrl}/crew-login`;
        let smsBody: string;
        if (isCrewInvite) {
          smsBody = lang === 'es'
            ? [
                `Recordatorio: ${inviterName} te invito a Discount Fence Hub.`,
                `1. Abre: ${crewLoginUrl}`,
                `2. Ingresa tu numero de telefono`,
                `3. Ingresa el codigo que recibiras`,
                `Agrega la app a tu pantalla!`,
              ].join('\n')
            : [
                `Reminder: ${inviterName} invited you to Discount Fence Hub.`,
                `1. Open: ${crewLoginUrl}`,
                `2. Enter your phone number`,
                `3. Enter the code you receive`,
                `Add the app to your home screen!`,
              ].join('\n');
        } else {
          smsBody = `Reminder: ${inviterName} invited you to Discount Fence Hub. Create your account: ${appUrl}/signup?email=${encodeURIComponent(invitation.email)}&token=${invitation.token}`;
        }

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
          const twilioError = await twilioResponse.text();
          console.error('Twilio reminder error:', twilioError);
          smsError = `Twilio: ${twilioError}`;
        }
      } catch (err) {
        console.error('Error sending reminder SMS:', err);
        smsError = err instanceof Error ? err.message : 'Unknown SMS error';
      }
    }

    // Send email reminder (for non-crew with email)
    if (!isCrewInvite && invitation.email && process.env.SENDGRID_API_KEY) {
      try {
        const invitationLink = `${appUrl}/signup?email=${encodeURIComponent(invitation.email)}&token=${invitation.token}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Reminder: You're invited to Discount Fence Hub</h2>
            <p>${inviterName} invited you to join as a <strong>${invitation.role}</strong>. Don't miss out!</p>
            <p>Click below to accept your invitation and create your account:</p>
            <div style="margin: 30px 0;">
              <a href="${invitationLink}"
                 style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This invitation expires on ${new Date(invitation.expires_at).toLocaleDateString()}.</p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all;">Link: ${invitationLink}</p>
          </div>
        `;

        const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: invitation.email }] }],
            from: { email: 'giacomo@discountfenceusa.com' },
            subject: 'Reminder: You\'re invited to Discount Fence Hub',
            content: [{ type: 'text/html', value: emailHtml }],
          }),
        });

        emailSent = sgResponse.ok;
        if (!sgResponse.ok) {
          const sgError = await sgResponse.text();
          console.error('SendGrid reminder error:', sgResponse.status, sgError);
          emailError = `SendGrid ${sgResponse.status}: ${sgError}`;
        }
      } catch (err) {
        console.error('Error sending reminder email:', err);
        emailError = err instanceof Error ? err.message : 'Unknown email error';
      }
    }

    if (!smsSent && !emailSent) {
      const details = [smsError, emailError].filter(Boolean).join('; ') || 'No channel available';
      return { statusCode: 500, body: JSON.stringify({ error: `Failed to send reminder: ${details}` }) };
    }

    // Update tracking
    await supabase
      .from('user_invitations')
      .update({
        reminder_count: (invitation.reminder_count || 0) + 1,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    const channels = [smsSent && 'SMS', emailSent && 'Email'].filter(Boolean).join(' + ');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Reminder sent via ${channels}`,
        smsSent,
        emailSent,
      }),
    };
  } catch (error) {
    console.error('Error sending invitation reminder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send reminder', details: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};
