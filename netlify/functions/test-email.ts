import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email address required' }),
      };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Resend API key not configured' }),
      };
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Resend Test Email</h2>
        <p>This is a test email from <strong>Discount Fence Hub</strong> to verify Resend integration.</p>
        <p style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <strong>Sent at:</strong> ${new Date().toLocaleString()}<br/>
          <strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}
        </p>
        <p style="color: #059669;">If you received this, Resend is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated test from the Discount Fence Hub application.
        </p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Discount Fence Hub <giacomo@discountfenceusa.com>',
        to: [email],
        subject: 'Resend Test - Discount Fence Hub',
        html: emailHtml,
      }),
    });

    if (response.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Test email sent successfully to ${email}`,
        }),
      };
    } else {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({
          success: false,
          error: 'Resend API error',
          details: errorText,
        }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
