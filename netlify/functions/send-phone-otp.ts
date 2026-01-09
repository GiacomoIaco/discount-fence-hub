import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/[^\d+]/g, '');
  if (!formatted.startsWith('+')) {
    if (formatted.length === 10) {
      formatted = '+1' + formatted;
    } else if (formatted.length === 11 && formatted.startsWith('1')) {
      formatted = '+' + formatted;
    }
  }
  return formatted;
}

interface SendOTPRequest {
  userId: string;
  phone: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId, phone }: SendOTPRequest = JSON.parse(event.body || '{}');

    if (!userId || !phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId or phone' }),
      };
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);

    // Validate phone format
    if (!/^\+1\d{10}$/.test(formattedPhone)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid phone number format. Please use a valid US phone number.' }),
      };
    }

    // Check for recent OTP requests (rate limiting - max 3 per 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentCodes, error: countError } = await supabase
      .from('phone_verification_codes')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', tenMinutesAgo);

    if (countError) {
      console.error('Error checking rate limit:', countError);
    } else if (recentCodes && recentCodes.length >= 3) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many verification attempts. Please wait 10 minutes.' }),
      };
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        user_id: userId,
        phone: formattedPhone,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to generate verification code' }),
      };
    }

    // Send OTP via Twilio
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'SMS service not configured' }),
      };
    }

    const smsBody = `Your Discount Fence Hub verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

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

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio error:', errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send verification code' }),
      };
    }

    console.log('OTP sent successfully to:', formattedPhone.substring(0, 6) + '****');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Verification code sent',
        phone: formattedPhone.substring(0, 6) + '****', // Masked for security
      }),
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send verification code',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
